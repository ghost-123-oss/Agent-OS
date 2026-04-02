'TYPESCRIPT'
// =============================================================================
// Agent OS — Retry Wrapper with Exponential Backoff
// =============================================================================
// Wraps any async function with configurable retry logic.
// Only retries on HTTP 429 (rate limit) and 5xx (transient server errors).
// Respects Retry-After header from 429 responses.

import { logger } from "@/lib/logger";

export interface RetryOptions {
    maxAttempts?: number;           // default 3
    baseDelayMs?: number;           // default 1500ms (attempt 2 wait)
    maxDelayMs?: number;            // default 30000ms
    timeoutMs?: number;             // per-attempt timeout (default 12000ms when retrying)
    traceId?: string;
    agentName?: string;
}

// Errors that are worth retrying
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Extracts the numeric HTTP status code from an error message.
 * Handles the patterns used by MistralProvider, GeminiProvider, GroqProvider:
 *   "Mistral API error (429): ..."
 *   "Gemini API error (429): ..."
 *   "Groq API error (503): ..."
 */
function extractStatusCode(err: unknown): number | null {
    if (!(err instanceof Error)) return null;
    const match = err.message.match(/\((\d{3})\)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts Retry-After seconds from a 429 error message body.
 * Gemini includes: "retryDelay": "8s" in the JSON body.
 */
function extractRetryAfterSeconds(err: unknown): number | null {
    if (!(err instanceof Error)) return null;
    // "retryDelay": "8s" or "retryDelay": "8.5s"
    const match = err.message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
    if (match) return Math.ceil(parseFloat(match[1]));
    // Retry-After: 30 (plain header value in error string)
    const header = err.message.match(/Retry-After:\s*(\d+)/i);
    if (header) return parseInt(header[1], 10);
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * withRetry — wraps fn with up to maxAttempts retries.
 *
 * Backoff schedule (defaults):
 *   Attempt 1: immediate
 *   Attempt 2: 1500ms
 *   Attempt 3: 4000ms
 *   (or Retry-After header value if present on 429)
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelayMs = 1500,
        maxDelayMs = 30000,
        traceId,
        agentName = "unknown",
    } = options;

    const delays = [0, baseDelayMs, baseDelayMs * 2.5]; // 0ms, 1.5s, ~4s

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const waitMs = delays[attempt - 1] ?? maxDelayMs;

        if (waitMs > 0) {
            logger.info(
                `Retry: waiting ${waitMs}ms before attempt ${attempt}/${maxAttempts}`,
                { agentName, attempt },
                traceId
            );
            await sleep(waitMs);
        }

        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const status = extractStatusCode(err);

            // Non-retryable errors — fail fast
            if (status !== null && !RETRYABLE_STATUS_CODES.has(status)) {
                logger.warn(
                    `Retry: status ${status} is not retryable — failing immediately`,
                    { agentName, attempt },
                    traceId
                );
                throw err;
            }

            // For 429: check if there is a Retry-After hint
            if (status === 429 && attempt < maxAttempts) {
                const retryAfter = extractRetryAfterSeconds(err);
                if (retryAfter !== null) {
                    const capped = Math.min(retryAfter * 1000, maxDelayMs);
                    logger.info(
                        `Retry: 429 with Retry-After ${retryAfter}s — waiting ${capped}ms`,
                        { agentName, attempt },
                        traceId
                    );
                    delays[attempt] = capped; // override next delay
                }
            }

            logger.warn(
                `Retry: attempt ${attempt}/${maxAttempts} failed for ${agentName}`,
                { error: err instanceof Error ? err.message.slice(0, 200) : String(err), status },
                traceId
            );

            if (attempt === maxAttempts) break;
        }
    }

    throw lastError;
}