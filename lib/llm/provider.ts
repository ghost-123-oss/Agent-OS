// ===========================================
// Agent OS — LLM Provider Factory
// ===========================================
// Single entry point. Call getLLMProvider() anywhere on the server.

import { LLMProvider, isMockMode } from "./index";
import { MistralProvider } from "./mistral";
import { MockProvider } from "./mock";
import { logger } from "@/lib/logger";

/**
 * FIX: Removed the module-level singleton (_provider cache).
 *
 * In Next.js serverless/edge API routes every invocation is a cold start —
 * the module-level variable is re-initialised on each request, so the
 * `if (_provider) return _provider` guard never fired in production.
 * It gave false confidence that the instance was being reused while
 * a new one was silently created every time.
 *
 * Solution: just instantiate directly. The overhead is negligible
 * (a class constructor, no I/O). If true connection pooling is needed
 * later, use a proper Next.js edge-compatible caching strategy.
 */
export function getLLMProvider(): LLMProvider {
  if (isMockMode()) {
    logger.warn("[LLM] No MISTRAL_API_KEY found — running in mock mode.");
    return new MockProvider();
  }

  return new MistralProvider(process.env.MISTRAL_API_KEY!);
}