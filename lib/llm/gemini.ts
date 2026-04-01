'EOF'
// =============================================================================
// Agent OS — Gemini Provider (Google AI)
// =============================================================================
// Used by: Product Strategist agent (Phase 2)
// Model:   gemini-2.0-flash (fast, cost-effective, strong reasoning)
// Requires: GEMINI_API_KEY in .env.local
// Install:  npm install @google/generative-ai

import type { LLMMessage, LLMProvider, LLMResponse } from "./index";

/**
 * Strips markdown code fences that Gemini sometimes wraps JSON in.
 * e.g. ```json { ... } ``` → { ... }
 */
function extractJSON(content: string): string {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    return fenced ? fenced[1].trim() : content.trim();
}

export class GeminiProvider implements LLMProvider {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model = "gemini-2.0-flash") {
        this.apiKey = apiKey;
        this.model = model;
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        // Gemini uses a different message format — system prompt becomes first user turn
        const systemMsg = messages.find((m) => m.role === "system");
        const conversationMsgs = messages.filter((m) => m.role !== "system");

        const contents = conversationMsgs.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: "POST",
                    signal: controller.signal,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        system_instruction: systemMsg
                            ? { parts: [{ text: systemMsg.content }] }
                            : undefined,
                        contents,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048,
                        },
                    }),
                }
            );

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Gemini API error (${res.status}): ${err}`);
            }

            const data = await res.json();
            const content =
                data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            return { content, provider: "gemini" };
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error("Gemini request timed out after 25 seconds");
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
        // Force JSON output via generationConfig
        const systemMsg = messages.find((m) => m.role === "system");
        const conversationMsgs = messages.filter((m) => m.role !== "system");

        const contents = conversationMsgs.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: "POST",
                    signal: controller.signal,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        system_instruction: systemMsg
                            ? { parts: [{ text: systemMsg.content }] }
                            : undefined,
                        contents,
                        generationConfig: {
                            temperature: 0.4,
                            maxOutputTokens: 2048,
                            responseMimeType: "application/json",
                        },
                    }),
                }
            );

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Gemini API error (${res.status}): ${err}`);
            }

            const data = await res.json();
            const content =
                data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            try {
                return JSON.parse(extractJSON(content)) as T;
            } catch {
                throw new Error(
                    `Failed to parse JSON from Gemini response: ${content}`
                );
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error("Gemini request timed out after 25 seconds");
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }
}