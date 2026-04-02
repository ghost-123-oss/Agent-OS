'TYPESCRIPT'
// =============================================================================
// Agent OS — Mistral AI Provider
// =============================================================================

import type { LLMMessage, LLMProvider, LLMResponse } from "./index";
import { extractAndParseJSON } from "../utils";
import { withRetry } from "./retry";
import { checkCircuit, recordSuccess, recordFailure } from "./circuit-breaker";

const PROVIDER_ID = "mistral";

export interface MistralConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export class MistralProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private timeoutMs: number;

  constructor(apiKey: string, config: MistralConfig = {}) {
    this.apiKey = apiKey;
    this.model = config.model ?? "mistral-small-latest";
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 2048;
    this.timeoutMs = config.timeoutMs ?? 25000;
  }

  private async callAPI(
    messages: LLMMessage[],
    extra: Record<string, unknown> = {}
  ): Promise<string> {
    checkCircuit(PROVIDER_ID);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          ...extra,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mistral API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      recordSuccess(PROVIDER_ID);
      return data.choices?.[0]?.message?.content ?? "";
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        recordFailure(PROVIDER_ID);
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Mistral request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const content = await withRetry(() => this.callAPI(messages), {
      agentName: `mistral-${this.model}`,
    });
    return { content, provider: "mistral" };
  }

  async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
    const raw = await withRetry(
      () => this.callAPI(messages, { response_format: { type: "json_object" } }),
      { agentName: `mistral-${this.model}` }
    );

    const parsed = extractAndParseJSON<T>(raw);
    if (parsed === null) {
      throw new Error(`Mistral: could not parse JSON after all attempts. Raw: ${raw.slice(0, 300)}`);
    }
    return parsed;
  }
}