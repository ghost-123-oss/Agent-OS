'TYPESCRIPT'
// =============================================================================
// Agent OS — Orchestrator + Full Pipeline
// =============================================================================

import { getLLMProvider } from "@/lib/llm/provider";
import type { LLMMessage } from "@/lib/llm/index";
import { AGENT_PROMPTS } from "./prompts";
import { logger, generateTraceId } from "@/lib/logger";
import { buildAgentContext } from "@/lib/memory/agent-context";
import {
  runRequirementAnalyst,
  runProductStrategist,
  runTechnicalArchitect,
  runPromptEngineer,
} from "./specialist-agents";
import { runFeedbackIntegrator } from "./feedback-integrator";
import { saveAgentMessageAction } from "@/actions/db";
import type {
  AgentContext,
  AgentName,
  ChatMessage,
  RequirementAnalysis,
  ProductStrategy,
  TechnicalArchitecture,
  FinalPromptData,
} from "@/types";

// ── Pipeline result type ──────────────────────────────────────────────────────

export interface PipelineResult {
  requirements: RequirementAnalysis;
  strategy: ProductStrategy;
  architecture: TechnicalArchitecture;
  finalPrompt: FinalPromptData;
  traceId: string;
  pipelineRunId: string;
  confidenceScores: Record<string, number>;
  warnings: string[];
  usedFallback: Record<string, boolean>;
  isPartialRerun?: boolean;
}

// ── Pipeline run options ──────────────────────────────────────────────────────

export interface RunPipelineOptions {
  /** Agent to restart from (for partial re-runs triggered by user feedback). */
  restartFrom?: AgentName;
  /** Extra context injected by the Feedback Integrator into the restarted agent. */
  injectedContext?: string;
  /** Previous pipeline result — provides outputs for agents that are NOT being re-run. */
  previousResult?: PipelineResult;
}

// ── Orchestrator: live chat ───────────────────────────────────────────────────

export async function getOrchestratorResponse(
  conversationHistory: ChatMessage[],
  traceId?: string
): Promise<string> {
  const tid = traceId ?? generateTraceId();
  const startTime = Date.now();
  
  logger.info("Orchestrator: Starting chat processing", { 
    messageCount: conversationHistory.length 
  }, tid);

  try {
    const provider = getLLMProvider();
    logger.info("Orchestrator: Provider obtained", { 
      provider: provider.constructor.name 
    }, tid);

    const messages: LLMMessage[] = [
      { role: "system", content: AGENT_PROMPTS.orchestrator },
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    logger.info("Orchestrator: Calling LLM provider", { 
      messageCount: messages.length 
    }, tid);

    const response = await provider.chat(messages);
    const duration = Date.now() - startTime;

    logger.info("Orchestrator: Response received successfully", { 
      provider: response.provider,
      contentLength: response.content.length,
      duration 
    }, tid);

    return response.content;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Orchestrator: Error during chat processing", {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : String(error),
      duration
    }, tid);
    throw error;
  }
}

// ── Trigger detection (Phase 3 improvement) ───────────────────────────────────
// Uses exact phrase matching on the phrase baked into the orchestrator prompt.
// Falls back to the old includes() check as a safety net.

export function isPipelineReady(content: string): boolean {
  const exactPhrase = "I have enough information now. Let me generate your structured brief and build prompt!";
  if (content.includes(exactPhrase)) return true;

  // Safety net fallback
  const lower = content.toLowerCase();
  return lower.includes("enough information") || lower.includes("generate your");
}

// ── Fire-and-forget message persistence ──────────────────────────────────────

function persistAgentMessage(
  context: AgentContext,
  agentName: string,
  payload: Record<string, unknown>,
  sequenceNumber: number,
  meta: { durationMs: number; usedFallback: boolean; confidence?: number; modelUsed?: string }
): void {
  saveAgentMessageAction({
    project_id: context.projectId,
    pipeline_run_id: context.pipelineRunId,
    from_agent: agentName as never,
    to_agent: "prompt_engineer" as never,
    message_type: "output",
    payload,
    sequence_number: sequenceNumber,
    meta: {
      model_used: meta.modelUsed ?? "mistral",
      duration_ms: meta.durationMs,
      confidence: meta.confidence ?? 75,
      used_fallback: meta.usedFallback,
    },
  }).catch((err: any) =>
    logger.error("persistAgentMessage failed (fire-and-forget)", { error: err })
  );
}

// ── Full Pipeline ─────────────────────────────────────────────────────────────

export async function runFullPipeline(
  messages: ChatMessage[],
  projectId: string = "unknown",
  traceId?: string,
  options: RunPipelineOptions = {}
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const context = buildAgentContext(projectId, messages);
  if (traceId) context.traceId = traceId;

  const { restartFrom, injectedContext, previousResult } = options;

  logger.info(
    "Pipeline started",
    { messageCount: messages.length, projectId, restartFrom: restartFrom ?? "beginning" },
    context.traceId
  );

  // ── Seed context from previous result when doing partial re-run ────────────
  if (previousResult && restartFrom) {
    const stageOrder: AgentName[] = [
      "requirement_analyst",
      "product_strategist",
      "technical_architect",
      "prompt_engineer",
    ];
    const restartIdx = stageOrder.indexOf(restartFrom);

    // Copy outputs from agents BEFORE the restart point
    if (restartIdx > 0 && previousResult.requirements) context.requirementOutput = previousResult.requirements;
    if (restartIdx > 1 && previousResult.strategy) context.strategyOutput = previousResult.strategy;
    if (restartIdx > 2 && previousResult.architecture) context.architectureOutput = previousResult.architecture;

    // Inject feedback context into the conversation text
    if (injectedContext) {
      context.conversationText += `\n\n[User feedback for re-run]: ${injectedContext}`;
    }
  }

  // ── Stage 1: Requirement Analyst ──────────────────────────────────────────
  let requirements: RequirementAnalysis;
  if (previousResult?.requirements && restartFrom && ["product_strategist", "technical_architect", "prompt_engineer"].includes(restartFrom)) {
    requirements = previousResult.requirements;
    context.requirementOutput = requirements;
  } else {
    const t = Date.now();
    requirements = await runRequirementAnalyst(context);
    persistAgentMessage(context, "requirement_analyst", requirements as unknown as Record<string, unknown>, 1,
      { durationMs: Date.now() - t, usedFallback: context.usedFallback["requirement_analyst"] ?? false, confidence: context.confidenceScores["requirement_analyst"] });
  }

  // ── Stage 2: Product Strategist ───────────────────────────────────────────
  let strategy: ProductStrategy;
  if (previousResult?.strategy && restartFrom && ["technical_architect", "prompt_engineer"].includes(restartFrom)) {
    strategy = previousResult.strategy;
    context.strategyOutput = strategy;
  } else {
    const t = Date.now();
    strategy = await runProductStrategist(context);
    persistAgentMessage(context, "product_strategist", strategy as unknown as Record<string, unknown>, 2,
      { durationMs: Date.now() - t, usedFallback: context.usedFallback["product_strategist"] ?? false, confidence: context.confidenceScores["product_strategist"] });
  }

  // ── Stage 3: Technical Architect ──────────────────────────────────────────
  let architecture: TechnicalArchitecture;
  if (previousResult?.architecture && restartFrom === "prompt_engineer") {
    architecture = previousResult.architecture;
    context.architectureOutput = architecture;
  } else {
    const t = Date.now();
    architecture = await runTechnicalArchitect(context);
    persistAgentMessage(context, "technical_architect", architecture as unknown as Record<string, unknown>, 3,
      { durationMs: Date.now() - t, usedFallback: context.usedFallback["technical_architect"] ?? false, confidence: context.confidenceScores["technical_architect"] });
  }

  // ── Stage 4: Prompt Engineer ──────────────────────────────────────────────
  const t4 = Date.now();
  const finalPrompt = await runPromptEngineer(context);
  persistAgentMessage(context, "prompt_engineer", finalPrompt as unknown as Record<string, unknown>, 4,
    { durationMs: Date.now() - t4, usedFallback: context.usedFallback["prompt_engineer"] ?? false, confidence: context.confidenceScores["prompt_engineer"] });

  const totalMs = Date.now() - pipelineStart;
  logger.info(
    "Pipeline completed",
    { totalMs, warnings: context.warnings.length, confidenceScores: context.confidenceScores },
    context.traceId
  );

  return {
    requirements,
    strategy,
    architecture,
    finalPrompt,
    traceId: context.traceId,
    pipelineRunId: context.pipelineRunId,
    confidenceScores: context.confidenceScores,
    warnings: context.warnings,
    usedFallback: context.usedFallback,
  };
}

// ── Partial Pipeline (with feedback) ─────────────────────────────────────────

export async function runPipelineWithFeedback(
  messages: ChatMessage[],
  projectId: string,
  feedback: string,
  previousResult: PipelineResult,
  traceId?: string
): Promise<PipelineResult> {
  const tid = traceId ?? generateTraceId();

  // Build a brief summary of the current result for the feedback integrator
  const briefSummary = [
    `Product: ${previousResult.finalPrompt.product_name}`,
    `Problem: ${previousResult.requirements.problem_statement}`,
    `Top features: ${previousResult.finalPrompt.features.slice(0, 3).join(", ")}`,
    `Stack: ${Object.values(previousResult.architecture.suggested_stack).join(", ")}`,
  ].join("\n");

  const { restartFrom, injectedContext } = await runFeedbackIntegrator(feedback, briefSummary, tid);

  return runFullPipeline(messages, projectId, tid, { restartFrom, injectedContext, previousResult });
}