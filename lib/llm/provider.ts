// ===========================================
// Agent OS — LLM Provider Factory
// ===========================================
// Single entry point. Call getLLMProvider() anywhere on the server.

import { LLMProvider, isMockMode } from "./index";
import { MistralProvider } from "./mistral";
import { MockProvider } from "./mock";

let _provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider;

  if (isMockMode()) {
    console.warn("[Agent OS] No MISTRAL_API_KEY found — running in mock mode.");
    _provider = new MockProvider();
  } else {
    _provider = new MistralProvider(process.env.MISTRAL_API_KEY!);
  }

  return _provider;
}
