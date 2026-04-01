// =============================================================================
// Agent OS — Groq Provider
// =============================================================================
// Used by: Technical Architect + Feedback Integrator agents (Phase 2 + 3)
// Model:   llama-3.3-70b-versatile (fast, strong structured output)
// Requires: GROQ_API_KEY in .env.local
// Install:  npm install groq-sdk

import type { LLMMessage, LLMProvider, LLMResponse } from "./index";

/**
 * Strips markdown code fences from LLM responses before JSON parsing.
 */
function extractJSON(content: string): string {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    return fenced ? fenced[1].trim() : content.trim();
}

export class GroqProvider implements LLMProvider {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model = "llama-3.3-70b-versatile") {
        this.apiKey = apiKey;
        this.model = model;
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        try {
            const res = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
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
                }
            );

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Groq API error (${res.status}): ${err}`);
            }

            const data = await res.json();
            return {
                content: data.choices?.[0]?.message?.content ?? "",
                provider: "groq",
            };
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error("Groq request timed out after 25 seconds");
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
            const res = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
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
                }
            );

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Groq API error (${res.status}): ${err}`);
            }

            const data = await res.json();
            const content: string = data.choices?.[0]?.message?.content ?? "";

            try {
                return JSON.parse(extractJSON(content)) as T;
            } catch {
                throw new Error(
                    `Failed to parse JSON from Groq response: ${content}`
                );
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error("Groq request timed out after 25 seconds");
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }
}