// =============================================================================
// Agent OS — LLM Provider Abstraction Layer
// =============================================================================

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  // PHASE 2: Extended union — gemini and groq added alongside mistral/mock
  provider: "mistral" | "mock" | "gemini" | "groq";
}

export interface LLMProvider {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  chatJSON<T>(messages: LLMMessage[]): Promise<T>;
}

/**
 * Returns true if the app should operate in mock mode.
 * Checks both server-only and client-side env vars for flexibility.
 */
export function isMockMode(): boolean {
  // Check both variants (with and without NEXT_PUBLIC_ prefix)
  if (process.env.FORCE_MOCK_MODE === "true" || process.env.NEXT_PUBLIC_FORCE_MOCK_MODE === "true") return true;
  if (!process.env.MISTRAL_API_KEY) return true;
  return false;
}