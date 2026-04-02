'TYPESCRIPT'
// =============================================================================
// Agent OS — LLM Provider Factory
// =============================================================================
// getProviderForAgent(agentName) — routes each agent to its designated model.
// Backup chain: primary provider → backup → mock (last resort).

import type { LLMProvider } from "./index";
import { isMockMode } from "./index";
import { MistralProvider } from "./mistral";
import { GeminiProvider } from "./gemini";
import { GroqProvider } from "./groq";
import { MockProvider } from "./mock";
import { ProviderUnavailableError } from "./circuit-breaker";
import { logger } from "@/lib/logger";
import type { AgentName } from "@/types";

// ── Provider config per agent ────────────────────────────────────────────────
// Routing table from the implementation roadmap (Section 2.1).
//
// Agent                 Primary              Backup-1             Backup-2
// Requirement Analyst   Mistral #1 (t=0.1)   Groq (t=0.1)         Mock
// Product Strategist    Gemini (t=0.5)        Mistral #2 (t=0.5)   Groq
// Technical Architect   Groq (t=0.0)          Mistral #1 (t=0.0)   Mock
// Prompt Engineer       Mistral #2 (t=0.7)    Groq (t=0.6)         Mock
// Feedback Integrator   Groq #2 (t=0.2)       Mistral #1           Mock
// Orchestrator          Mistral #1 (t=0.7)    —                    Mock

function mistral1(temperature?: number) {
  return new MistralProvider(process.env.MISTRAL_API_KEY!, {
    model: "mistral-small-latest",
    temperature: temperature ?? 0.7,
    maxTokens: 2048,
    timeoutMs: 25000,
  });
}

function mistral2(temperature?: number) {
  const key = process.env.MISTRAL_API_KEY_2 ?? process.env.MISTRAL_API_KEY!;
  return new MistralProvider(key, {
    model: "mistral-small-latest",
    temperature: temperature ?? 0.7,
    maxTokens: 2048,
    timeoutMs: 25000,
  });
}

function gemini(temperature?: number) {
  return new GeminiProvider(process.env.GEMINI_API_KEY!, {
    model: "gemini-2.0-flash",
    temperature: temperature ?? 0.5,
    maxTokens: 2048,
    timeoutMs: 20000,
  });
}

function groq1(temperature?: number) {
  return new GroqProvider(process.env.GROQ_API_KEY!, {
    model: "llama-3.3-70b-versatile",
    temperature: temperature ?? 0.0,
    maxTokens: 2048,
    timeoutMs: 12000,
  });
}

function groq2(temperature?: number) {
  const key = process.env.GROQ_API_KEY_2 ?? process.env.GROQ_API_KEY!;
  return new GroqProvider(key, {
    model: "llama-3.3-70b-versatile",
    temperature: temperature ?? 0.2,
    maxTokens: 1024,
    timeoutMs: 10000,
  });
}

/**
 * tryProviders — attempt each provider in order, skip if circuit is open.
 * Falls back to MockProvider only as last resort.
 */
async function tryProviders(
  agentName: string,
  primaryFn: () => LLMProvider,
  backups: Array<() => LLMProvider>
): Promise<LLMProvider> {
  const chain = [primaryFn, ...backups];

  for (const providerFn of chain) {
    try {
      const p = providerFn();
      return p;
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        logger.warn(`Provider circuit open for ${agentName} — trying next in chain`, undefined);
        continue;
      }
      throw err;
    }
  }

  logger.warn(`All providers failed for ${agentName} — falling back to Mock`, undefined);
  return new MockProvider();
}

/**
 * getProviderForAgent — main entry point.
 * Returns a fully configured LLMProvider for the given agent.
 */
export async function getProviderForAgent(agentName: AgentName): Promise<LLMProvider> {
  if (isMockMode()) {
    logger.warn(`[LLM] Mock mode active — all agents use MockProvider`);
    return new MockProvider();
  }

  switch (agentName) {
    case "requirement_analyst":
      return tryProviders(agentName, () => mistral1(0.1), [() => groq1(0.1), () => new MockProvider()]);

    case "product_strategist":
      return tryProviders(agentName, () => gemini(0.5), [() => mistral2(0.5), () => groq1(0.3)]);

    case "technical_architect":
      return tryProviders(agentName, () => groq1(0.0), [() => mistral1(0.0), () => new MockProvider()]);

    case "prompt_engineer":
      return tryProviders(agentName, () => mistral2(0.7), [() => groq2(0.6), () => new MockProvider()]);

    case "feedback_integrator":
      return tryProviders(agentName, () => groq2(0.2), [() => mistral1(0.3), () => new MockProvider()]);

    case "orchestrator":
    default:
      return tryProviders(agentName, () => mistral1(0.7), [() => new MockProvider()]);
  }
}

/**
 * getLLMProvider — legacy entry point kept for backwards compatibility.
 * Used by getOrchestratorResponse in orchestrator.ts.
 */
export function getLLMProvider(): LLMProvider {
  if (isMockMode()) {
    logger.warn("[LLM] No MISTRAL_API_KEY found — running in mock mode.");
    return new MockProvider();
  }
  return mistral1();
}