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
 * Uses server-only env var (no NEXT_PUBLIC_ prefix) to avoid leaking
 * this flag into the client bundle.
 */
export function isMockMode(): boolean {
  if (process.env.FORCE_MOCK_MODE === "true") return true;
  if (!process.env.MISTRAL_API_KEY) return true;
  return false;
}