// =============================================================================
// Agent OS — Agent Orchestration Pipeline
// =============================================================================
// PHASE 2: All agents now use getProviderForAgent() via specialist-agents.ts.
// PHASE 3: Supports partial re-run (restartFrom) driven by feedback integrator.
//          PipelineResult now includes confidenceScores, warnings, pipelineRunId.
import type { AgentOutputJson } from "@/actions/db";
import { getLLMProvider } from "@/lib/llm/provider";
import type { LLMMessage } from "@/lib/llm/index";
import { AGENT_PROMPTS } from "./prompts";
import { generateTraceId, logger } from "@/lib/logger";
import { buildAgentContext } from "@/lib/memory/agent-context";
import {
  runRequirementAnalyst,
  runProductStrategist,
  runTechnicalArchitect,
  runPromptEngineer,
} from "./specialist-agents";
import { runFeedbackIntegrator } from "./feedback-integrator";
import {
  saveAgentOutputAction,
  saveAgentMessageAction,
} from "@/actions/db";
import type {
  AgentContext,
  AgentName,
  ChatMessage,
  RequirementAnalysis,
  ProductStrategy,
  TechnicalArchitecture,
  FinalPromptData,
} from "@/types";

// ── Orchestrator chat (unchanged) ────────────────────────────────────────────

export async function getOrchestratorResponse(
  conversationHistory: ChatMessage[],
  traceId?: string
): Promise<string> {
  const tid = traceId ?? generateTraceId();
  const provider = getLLMProvider();

  logger.info(
    "Orchestrator chat",
    { count: conversationHistory.length },
    tid
  );

  const messages: LLMMessage[] = [
    { role: "system", content: AGENT_PROMPTS.orchestrator },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const response = await provider.chat(messages);
  return response.content;
}

// ── Pipeline result type ─────────────────────────────────────────────────────

export interface PipelineResult {
  requirements: RequirementAnalysis;
  strategy: ProductStrategy;
  architecture: TechnicalArchitecture;
  finalPrompt: FinalPromptData;
  traceId: string;
  pipelineRunId: string;
  // PHASE 3: confidence scores per agent (0-100)
  confidenceScores: Partial<Record<AgentName, number>>;
  warnings: string[];
  // PHASE 3: was the result from a partial re-run?
  isPartialRerun: boolean;
  restartedFrom?: AgentName;
}

// ── Persist agent outputs (fire and forget) ──────────────────────────────────

async function persistAgentOutput(
  projectId: string | undefined,
  context: AgentContext,
  agentName: AgentName,
  output: unknown,
  sequenceNumber: number
): Promise<void> {
  if (!projectId) return;

  try {
    // Save to agent_outputs table
    await saveAgentOutputAction(
      projectId,
      agentName,
      output as AgentOutputJson
    );

    // Save to agent_messages audit log
    await saveAgentMessageAction({
      project_id: projectId,
      pipeline_run_id: context.pipelineRunId,
      from_agent: agentName,
      to_agent: agentName === "requirement_analyst"
        ? "product_strategist"
        : agentName === "product_strategist"
          ? "technical_architect"
          : agentName === "technical_architect"
            ? "prompt_engineer"
            : "prompt_engineer",
      message_type: "output",
      payload: output as Record<string, unknown>,
      sequence_number: sequenceNumber,
    });
  } catch (err) {
    logger.error(
      `Failed to persist ${agentName} output`,
      { error: err instanceof Error ? err.message : String(err) },
      context.traceId
    );
    // Non-fatal — pipeline continues
  }
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

export interface RunPipelineOptions {
  // PHASE 3: Optional feedback-driven partial re-run
  restartFrom?: AgentName;
  injectedContext?: string;
  existingContext?: Partial<Pick<AgentContext,
    "requirementOutput" | "strategyOutput" | "architectureOutput"
  >>;
}

export async function runFullPipeline(
  messages: ChatMessage[],
  traceId?: string,
  projectId?: string,
  rawIdea?: string,
  options: RunPipelineOptions = {}
): Promise<PipelineResult> {
  const tid = traceId ?? generateTraceId();
  const pipelineStart = Date.now();

  logger.info(
    "Pipeline started",
    {
      messageCount: messages.length,
      projectId,
      restartFrom: options.restartFrom ?? "beginning",
    },
    tid
  );

  // Build context envelope (once — shared across all agents)
  const context: AgentContext = buildAgentContext(
    projectId ?? "",
    rawIdea ?? messages.find((m) => m.role === "user")?.content ?? "",
    messages,
    tid
  );

  // PHASE 3: For partial re-runs, restore previous agent outputs into context
  if (options.existingContext) {
    if (options.existingContext.requirementOutput) {
      context.requirementOutput = options.existingContext.requirementOutput;
    }
    if (options.existingContext.strategyOutput) {
      context.strategyOutput = options.existingContext.strategyOutput;
    }
    if (options.existingContext.architectureOutput) {
      context.architectureOutput = options.existingContext.architectureOutput;
    }
  }

  // PHASE 3: Inject feedback context into conversation text if provided
  if (options.injectedContext) {
    context.conversationText = `${context.conversationText}\n\n[Feedback context]: ${options.injectedContext}`;
  }

  const restartFrom = options.restartFrom ?? "requirement_analyst";
  const agentOrder: AgentName[] = [
    "requirement_analyst",
    "product_strategist",
    "technical_architect",
    "prompt_engineer",
  ];
  const startIndex = agentOrder.indexOf(restartFrom);
  const effectiveStart = startIndex === -1 ? 0 : startIndex;

  let sequenceNumber = effectiveStart;

  // ── Stage 1: Requirement Analyst ─────────────────────────────────────────
  if (effectiveStart <= 0) {
    await runRequirementAnalyst(context);
    await persistAgentOutput(
      projectId, context, "requirement_analyst",
      context.requirementOutput, sequenceNumber++
    );
  }

  // ── Stage 2: Product Strategist ───────────────────────────────────────────
  if (effectiveStart <= 1) {
    await runProductStrategist(context);
    await persistAgentOutput(
      projectId, context, "product_strategist",
      context.strategyOutput, sequenceNumber++
    );
  }

  // ── Stage 3: Technical Architect ──────────────────────────────────────────
  if (effectiveStart <= 2) {
    await runTechnicalArchitect(context);
    await persistAgentOutput(
      projectId, context, "technical_architect",
      context.architectureOutput, sequenceNumber++
    );
  }

  // ── Stage 4: Prompt Engineer ──────────────────────────────────────────────
  await runPromptEngineer(context);
  await persistAgentOutput(
    projectId, context, "prompt_engineer",
    context.finalPromptOutput, sequenceNumber++
  );

  const totalDuration = Date.now() - pipelineStart;
  logger.info(
    "Pipeline completed",
    {
      totalMs: totalDuration,
      warnings: context.warnings.length,
      confidenceScores: context.confidenceScores,
    },
    tid
  );

  return {
    requirements: context.requirementOutput!,
    strategy: context.strategyOutput!,
    architecture: context.architectureOutput!,
    finalPrompt: context.finalPromptOutput!,
    traceId: tid,
    pipelineRunId: context.pipelineRunId,
    confidenceScores: context.confidenceScores,
    warnings: context.warnings,
    isPartialRerun: effectiveStart > 0,
    restartedFrom: effectiveStart > 0 ? restartFrom : undefined,
  };
}