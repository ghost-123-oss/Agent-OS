'EOF'
// =============================================================================
// Agent OS — LLM Provider Factory
// =============================================================================
// PHASE 2: getProviderForAgent() now routes by agent name.
// Swapping models later requires changes only in this file.

import type { LLMProvider } from "./index";
import { isMockMode } from "./index";
import { MistralProvider } from "./mistral";
import { MockProvider } from "./mock";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { logger } from "@/lib/logger";
import type { AgentName } from "@/types";

/**
 * Default provider — used by the orchestrator chat (not pipeline agents).
 * Always Mistral (or Mock in dev).
 */
export function getLLMProvider(): LLMProvider {
  if (isMockMode()) {
    logger.warn("[LLM] No MISTRAL_API_KEY — running in mock mode.");
    return new MockProvider();
  }
  return new MistralProvider(process.env.MISTRAL_API_KEY!);
}

/**
 * PHASE 2: Routes each pipeline agent to its designated model.
 *
 * Routing table:
 *   requirement_analyst  → Mistral  (strong at extraction + JSON)
 *   product_strategist   → Gemini   (strong at user reasoning + scope)
 *   technical_architect  → Groq     (fast, strong structured tech output)
 *   prompt_engineer      → Mistral  (consistent polished prose)
 *   feedback_integrator  → Groq     (fast routing decisions)
 *   orchestrator         → Mistral  (conversational, handled by getLLMProvider)
 *
 * In mock mode ALL agents return MockProvider regardless of routing.
 * This ensures the full demo flow works with no API keys.
 */
export function getProviderForAgent(agentName: AgentName): LLMProvider {
  if (isMockMode()) {
    return new MockProvider();
  }

  switch (agentName) {
    case "product_strategist":
      if (!process.env.GEMINI_API_KEY) {
        logger.warn(
          "[LLM] GEMINI_API_KEY missing — falling back to Mistral for product_strategist"
        );
        return new MistralProvider(process.env.MISTRAL_API_KEY!);
      }
      return new GeminiProvider(process.env.GEMINI_API_KEY);

    case "technical_architect":
    case "feedback_integrator":
      if (!process.env.GROQ_API_KEY) {
        logger.warn(
          `[LLM] GROQ_API_KEY missing — falling back to Mistral for ${agentName}`
        );
        return new MistralProvider(process.env.MISTRAL_API_KEY!);
      }
      return new GroqProvider(process.env.GROQ_API_KEY);

    case "requirement_analyst":
    case "prompt_engineer":
    case "orchestrator":
    default:
      return new MistralProvider(process.env.MISTRAL_API_KEY!);
  }
}