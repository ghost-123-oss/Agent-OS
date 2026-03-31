// ===========================================
// Agent OS — LLM Provider Abstraction Layer
// ===========================================

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: "mistral" | "mock";
}

export interface LLMProvider {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  chatJSON<T>(messages: LLMMessage[]): Promise<T>;
}

/**
 * Returns true if the app should operate in mock mode.
 *
 * FIX: Was using NEXT_PUBLIC_FORCE_MOCK_MODE which leaks into the
 * client bundle. This is server-only logic — use plain env vars.
 */
export function isMockMode(): boolean {
  if (process.env.FORCE_MOCK_MODE === "true") return true;
  if (!process.env.MISTRAL_API_KEY) return true;
  return false;
}