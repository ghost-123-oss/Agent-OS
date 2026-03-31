// ===========================================
// Agent OS — Agent Orchestration Pipeline
// ===========================================

import { getLLMProvider } from "@/lib/llm/provider";
import { LLMMessage } from "@/lib/llm/index";
import { AGENT_PROMPTS } from "./prompts";
import { logger, generateTraceId } from "@/lib/logger";
import type {
  RequirementAnalysis,
  ProductStrategy,
  TechnicalArchitecture,
  FinalPromptData,
  ChatMessage,
} from "@/types";

// ---- Safe agent runner with fallback ----------------------------------------
// FIX: Previously a single agent failure threw all the way up, killing the
// entire pipeline and returning a 500 with no partial data. Now each agent
// is wrapped — if it fails, a typed fallback is returned and the pipeline
// continues. The error is logged with the shared traceId for correlation.

async function safeRunAgent<T>(
  fn: () => Promise<T>,
  fallback: T,
  agentName: string,
  traceId: string
): Promise<T> {
  const start = Date.now();
  try {
    logger.info(`Agent starting: ${agentName}`, undefined, traceId);
    const result = await fn();
    const duration = Date.now() - start;
    logger.info(`Agent completed: ${agentName}`, { durationMs: duration }, traceId);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error(
      `Agent failed: ${agentName} — using fallback`,
      { error: err instanceof Error ? err.message : String(err), durationMs: duration },
      traceId
    );
    return fallback;
  }
}

// ---- Fallback values --------------------------------------------------------
// Returned when an agent fails so the pipeline can still produce a usable output.

const FALLBACK_REQUIREMENTS: RequirementAnalysis = {
  problem_statement: "Could not extract problem statement.",
  goals: [],
  constraints: [],
  missing_details: ["Agent failed — please regenerate."],
};

const FALLBACK_STRATEGY: ProductStrategy = {
  target_users: [],
  mvp_scope: [],
  feature_priorities: [],
  user_flow: [],
};

const FALLBACK_ARCHITECTURE: TechnicalArchitecture = {
  suggested_stack: {},
  system_modules: [],
  integrations: [],
  data_model_overview: [],
};

const FALLBACK_FINAL_PROMPT: FinalPromptData = {
  product_name: "Untitled Project",
  concept: "",
  problem_statement: "",
  target_users: [],
  mvp_goal: "",
  features: [],
  core_flows: [],
  suggested_stack: {},
  pages_and_components: [],
  data_model: [],
  constraints: [],
  future_enhancements: [],
  build_instruction: "Insufficient data — please try regenerating.",
};

// ---- Context builder --------------------------------------------------------
// FIX: Cap at last 30 messages to prevent unbounded context growth across
// the 4 sequential LLM calls. Early messages matter less to Architect/Strategist.

const MAX_CONTEXT_MESSAGES = 30;

function buildConversationContext(messages: ChatMessage[]): string {
  const capped = messages.slice(-MAX_CONTEXT_MESSAGES);
  return capped
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

// ---- Orchestrator: live chat ------------------------------------------------

export async function getOrchestratorResponse(
  conversationHistory: ChatMessage[],
  traceId?: string
): Promise<string> {
  const tid = traceId ?? generateTraceId();
  const provider = getLLMProvider();

  logger.info("Orchestrator chat request", { messageCount: conversationHistory.length }, tid);

  const messages: LLMMessage[] = [
    { role: "system", content: AGENT_PROMPTS.orchestrator },
    ...conversationHistory.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  const response = await provider.chat(messages);
  logger.info("Orchestrator chat response received", { provider: response.provider }, tid);
  return response.content;
}

// ---- Specialist agents ------------------------------------------------------

export async function runRequirementAnalyst(
  messages: ChatMessage[],
  traceId: string
): Promise<RequirementAnalysis> {
  const provider = getLLMProvider();
  const context = buildConversationContext(messages);

  const llmMessages: LLMMessage[] = [
    { role: "system", content: AGENT_PROMPTS.requirement_analyst },
    {
      role: "user",
      content: `Analyze the following conversation and extract structured requirements:\n\n${context}`,
    },
  ];

  return provider.chatJSON<RequirementAnalysis>(llmMessages);
}

export async function runProductStrategist(
  messages: ChatMessage[],
  requirements: RequirementAnalysis,
  traceId: string
): Promise<ProductStrategy> {
  const provider = getLLMProvider();
  const context = buildConversationContext(messages);

  const llmMessages: LLMMessage[] = [
    { role: "system", content: AGENT_PROMPTS.product_strategist },
    {
      role: "user",
      content: `Based on this conversation:\n\n${context}\n\nAnd these extracted requirements:\n${JSON.stringify(requirements, null, 2)}\n\nDefine the product strategy.`,
    },
  ];

  return provider.chatJSON<ProductStrategy>(llmMessages);
}

export async function runTechnicalArchitect(
  messages: ChatMessage[],
  requirements: RequirementAnalysis,
  strategy: ProductStrategy,
  traceId: string
): Promise<TechnicalArchitecture> {
  const provider = getLLMProvider();
  const context = buildConversationContext(messages);

  const llmMessages: LLMMessage[] = [
    { role: "system", content: AGENT_PROMPTS.technical_architect },
    {
      role: "user",
      content: `Based on this conversation:\n\n${context}\n\nRequirements:\n${JSON.stringify(requirements, null, 2)}\n\nProduct Strategy:\n${JSON.stringify(strategy, null, 2)}\n\nDefine the technical architecture.`,
    },
  ];

  return provider.chatJSON<TechnicalArchitecture>(llmMessages);
}

export async function runPromptEngineer(
  requirements: RequirementAnalysis,
  strategy: ProductStrategy,
  architecture: TechnicalArchitecture,
  traceId: string
): Promise<FinalPromptData> {
  const provider = getLLMProvider();

  const llmMessages: LLMMessage[] = [
    { role: "system", content: AGENT_PROMPTS.prompt_engineer },
    {
      role: "user",
      content: `Synthesize these agent outputs into a final build prompt:\n\nRequirements:\n${JSON.stringify(requirements, null, 2)}\n\nProduct Strategy:\n${JSON.stringify(strategy, null, 2)}\n\nTechnical Architecture:\n${JSON.stringify(architecture, null, 2)}`,
    },
  ];

  return provider.chatJSON<FinalPromptData>(llmMessages);
}

// ---- Full Pipeline ----------------------------------------------------------

export interface PipelineResult {
  requirements: RequirementAnalysis;
  strategy: ProductStrategy;
  architecture: TechnicalArchitecture;
  finalPrompt: FinalPromptData;
  traceId: string;
}

export async function runFullPipeline(
  messages: ChatMessage[],
  traceId?: string
): Promise<PipelineResult> {
  const tid = traceId ?? generateTraceId();
  const pipelineStart = Date.now();

  logger.info("Pipeline started", { messageCount: messages.length }, tid);

  // FIX: Each agent is wrapped in safeRunAgent so one failure doesn't
  // cascade and kill the entire pipeline. Errors are logged with traceId.

  // Step 1: Requirement Analyst
  const requirements = await safeRunAgent(
    () => runRequirementAnalyst(messages, tid),
    FALLBACK_REQUIREMENTS,
    "RequirementAnalyst",
    tid
  );

  // Step 2: Product Strategist (receives analyst output)
  const strategy = await safeRunAgent(
    () => runProductStrategist(messages, requirements, tid),
    FALLBACK_STRATEGY,
    "ProductStrategist",
    tid
  );

  // Step 3: Technical Architect (receives analyst + strategist output)
  const architecture = await safeRunAgent(
    () => runTechnicalArchitect(messages, requirements, strategy, tid),
    FALLBACK_ARCHITECTURE,
    "TechnicalArchitect",
    tid
  );

  // Step 4: Prompt Engineer (synthesises all three)
  const finalPrompt = await safeRunAgent(
    () => runPromptEngineer(requirements, strategy, architecture, tid),
    FALLBACK_FINAL_PROMPT,
    "PromptEngineer",
    tid
  );

  const totalDuration = Date.now() - pipelineStart;
  logger.info("Pipeline completed", { totalDurationMs: totalDuration }, tid);

  return { requirements, strategy, architecture, finalPrompt, traceId: tid };
}