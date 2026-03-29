// ===========================================
// Agent OS — Agent Orchestration Pipeline
// ===========================================
// Runs the multi-agent pipeline on gathered conversation data.

import { getLLMProvider } from "@/lib/llm/provider";
import { LLMMessage } from "@/lib/llm/index";
import { AGENT_PROMPTS } from "./prompts";
import type {
  RequirementAnalysis,
  ProductStrategy,
  TechnicalArchitecture,
  FinalPromptData,
  ChatMessage,
} from "@/types";

// ---- Orchestrator: handles the live chat ----

export async function getOrchestratorResponse(
  conversationHistory: ChatMessage[]
): Promise<string> {
  const provider = getLLMProvider();

  const messages: LLMMessage[] = [
    { role: "system", content: AGENT_PROMPTS.orchestrator },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  const response = await provider.chat(messages);
  return response.content;
}

// ---- Internal Pipeline: runs after conversation is complete ----

function buildConversationContext(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

export async function runRequirementAnalyst(
  messages: ChatMessage[]
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
  requirements: RequirementAnalysis
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
  strategy: ProductStrategy
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
  architecture: TechnicalArchitecture
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

// ---- Full Pipeline ----

export interface PipelineResult {
  requirements: RequirementAnalysis;
  strategy: ProductStrategy;
  architecture: TechnicalArchitecture;
  finalPrompt: FinalPromptData;
}

export async function runFullPipeline(
  messages: ChatMessage[]
): Promise<PipelineResult> {
  // Step 1: Requirement Analyst
  const requirements = await runRequirementAnalyst(messages);

  // Step 2: Product Strategist (uses requirements)
  const strategy = await runProductStrategist(messages, requirements);

  // Step 3: Technical Architect (uses requirements + strategy)
  const architecture = await runTechnicalArchitect(
    messages,
    requirements,
    strategy
  );

  // Step 4: Prompt Engineer (synthesizes everything)
  const finalPrompt = await runPromptEngineer(
    requirements,
    strategy,
    architecture
  );

  return { requirements, strategy, architecture, finalPrompt };
}
