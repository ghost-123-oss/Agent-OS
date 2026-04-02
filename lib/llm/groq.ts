'TYPESCRIPT'
// =============================================================================
// Agent OS — Groq Provider (OpenAI-compatible)
// =============================================================================

import type { LLMMessage, LLMProvider, LLMResponse } from "./index";
import { extractAndParseJSON } from "../utils";
import { withRetry } from "./retry";
import { checkCircuit, recordSuccess, recordFailure } from "./circuit-breaker";

const PROVIDER_ID = "groq";

export interface GroqConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
}

export class GroqProvider implements LLMProvider {
    private apiKey: string;
    private model: string;
    private temperature: number;
    private maxTokens: number;
    private timeoutMs: number;

    constructor(apiKey: string, config: GroqConfig = {}) {
        this.apiKey = apiKey;
        this.model = config.model ?? "llama-3.3-70b-versatile";
        this.temperature = config.temperature ?? 0.0;
        this.maxTokens = config.maxTokens ?? 2048;
        this.timeoutMs = config.timeoutMs ?? 12000;
    }

    private async callAPI(
        messages: LLMMessage[],
        jsonMode = false
    ): Promise<string> {
        checkCircuit(PROVIDER_ID);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Groq API error (${res.status}): ${err}`);
            }

            const data = await res.json();
            recordSuccess(PROVIDER_ID);
            return data.choices?.[0]?.message?.content ?? "";
        } catch (err: unknown) {
            if (err instanceof Error && err.name !== "AbortError") {
                recordFailure(PROVIDER_ID);
            }
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(`Groq request timed out after ${this.timeoutMs}ms`);
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const content = await withRetry(() => this.callAPI(messages, false), {
            agentName: `groq-${this.model}`,
        });
        return { content, provider: "groq" };
    }

    async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
        const raw = await withRetry(() => this.callAPI(messages, true), {
            agentName: `groq-${this.model}`,
        });
        const parsed = extractAndParseJSON<T>(raw);
        if (parsed === null) {
            throw new Error(`Groq: could not parse JSON. Raw: ${raw.slice(0, 300)}`);
        }
        return parsed;
    }
}