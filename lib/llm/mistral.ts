// ===========================================
// Agent OS — Mistral AI Provider
// ===========================================

import { LLMMessage, LLMProvider, LLMResponse } from "./index";

export class MistralProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "mistral-small-latest") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
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
      content: data.choices[0].message.content,
      provider: "mistral",
    };
  }

  async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
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
    const content = data.choices[0].message.content;

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error(`Failed to parse JSON from Mistral response: ${content}`);
    }
  }
}
