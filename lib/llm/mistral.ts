// ===========================================
// Agent OS — Mistral AI Provider
// ===========================================

import { LLMMessage, LLMProvider, LLMResponse } from "./index";

/**
 * FIX: Strip markdown code fences that LLMs sometimes wrap JSON in.
 * e.g. ```json { ... } ``` → { ... }
 * Without this, JSON.parse throws intermittently even with response_format: json_object.
 */
function extractJSON(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : content.trim();
}

export class MistralProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "mistral-small-latest") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    // FIX: AbortController timeout — was missing entirely before,
    // meaning hung requests would block until the 30s Next.js default killed them.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

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
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mistral API error (${res.status}): ${err}`);
      }

      const data = await res.json();

      return {
        content: data.choices?.[0]?.message?.content ?? "",
        provider: "mistral",
      };
    } catch (err: unknown) {
      // FIX: Was using err: any which bypasses type safety.
      // Check for AbortError explicitly via the name property.
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Mistral request timed out after 25 seconds");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

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
          temperature: 0.4,
          max_tokens: 2048,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Mistral API error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const content: string = data.choices?.[0]?.message?.content ?? "";

      try {
        // FIX: extractJSON strips markdown fences before parsing.
        // Without this, responses like ```json {...} ``` cause a JSON.parse crash.
        return JSON.parse(extractJSON(content)) as T;
      } catch {
        throw new Error(`Failed to parse JSON from Mistral response: ${content}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Mistral request timed out after 25 seconds");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}