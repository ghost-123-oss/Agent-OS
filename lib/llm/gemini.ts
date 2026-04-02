'TYPESCRIPT'
// =============================================================================
// Agent OS — Google Gemini Provider
// =============================================================================
// Uses the Gemini REST API directly (no SDK) for zero extra dependencies.

import type { LLMMessage, LLMProvider, LLMResponse } from "./index";
import { extractAndParseJSON } from "../utils";
import { withRetry } from "./retry";
import { checkCircuit, recordSuccess, recordFailure } from "./circuit-breaker";

const PROVIDER_ID = "gemini";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiConfig {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
}

function toGeminiParts(messages: LLMMessage[]): {
    systemInstruction?: { parts: { text: string }[] };
    contents: { role: string; parts: { text: string }[] }[];
} {
    const systemMsgs = messages.filter((m) => m.role === "system");
    const chatMsgs = messages.filter((m) => m.role !== "system");

    const systemInstruction =
        systemMsgs.length > 0
            ? { parts: [{ text: systemMsgs.map((m) => m.content).join("\n\n") }] }
            : undefined;

    const contents = chatMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));

    return { systemInstruction, contents };
}

export class GeminiProvider implements LLMProvider {
    private apiKey: string;
    private model: string;
    private temperature: number;
    private maxTokens: number;
    private timeoutMs: number;

    constructor(apiKey: string, config: GeminiConfig = {}) {
        this.apiKey = apiKey;
        this.model = config.model ?? "gemini-2.0-flash";
        this.temperature = config.temperature ?? 0.5;
        this.maxTokens = config.maxTokens ?? 2048;
        this.timeoutMs = config.timeoutMs ?? 20000;
    }

    private async callAPI(
        messages: LLMMessage[],
        jsonMode = false
    ): Promise<string> {
        checkCircuit(PROVIDER_ID);

        const { systemInstruction, contents } = toGeminiParts(messages);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                temperature: this.temperature,
                maxOutputTokens: this.maxTokens,
                ...(jsonMode ? { responseMimeType: "application/json" } : {}),
            },
        };
        if (systemInstruction) body.system_instruction = systemInstruction;

        const url = `${BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;

        try {
            const res = await fetch(url, {
                method: "POST",
                signal: controller.signal,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Gemini API error (${res.status}): ${err}`);
            }

            const data = await res.json();
            const text: string =
                data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            recordSuccess(PROVIDER_ID);
            return text;
        } catch (err: unknown) {
            if (err instanceof Error && err.name !== "AbortError") {
                recordFailure(PROVIDER_ID);
            }
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(`Gemini request timed out after ${this.timeoutMs}ms`);
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const content = await withRetry(() => this.callAPI(messages, false), {
            agentName: `gemini-${this.model}`,
        });
        return { content, provider: "gemini" };
    }

    async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
        const raw = await withRetry(() => this.callAPI(messages, true), {
            agentName: `gemini-${this.model}`,
        });
        const parsed = extractAndParseJSON<T>(raw);
        if (parsed === null) {
            throw new Error(`Gemini: could not parse JSON. Raw: ${raw.slice(0, 300)}`);
        }
        return parsed;
    }
}