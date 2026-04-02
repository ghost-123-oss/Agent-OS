'TYPESCRIPT'
// =============================================================================
// Agent OS — Per-Provider Circuit Breaker
// =============================================================================
// Stops sending requests to a failing provider before the 25s timeout fires.
//
// States:
//   CLOSED   — normal. Requests pass through. Failures counted.
//   OPEN     — tripped. Requests rejected immediately with ProviderUnavailableError.
//   HALF_OPEN — one probe request allowed every 60s. Success → CLOSED. Fail → OPEN.
//
// NOTE: State is in-memory. Resets on cold start (acceptable for MVP).

import { logger } from "@/lib/logger";

export class ProviderUnavailableError extends Error {
    constructor(provider: string) {
        super(`Circuit breaker OPEN for provider: ${provider}. Skipping to fallback.`);
        this.name = "ProviderUnavailableError";
    }
}

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface BreakerState {
    state: CircuitState;
    failureCount: number;
    windowStart: number;      // ms timestamp — rolling 5-min window start
    openedAt: number | null;  // when circuit was tripped
    lastProbeAt: number | null;
}

const WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const FAILURE_THRESHOLD = 3;              // failures within window before open
const FAILURE_RATE_PCT = 40;            // failure rate % threshold (unused in v1 — count-based)
const PROBE_INTERVAL_MS = 60 * 1000;     // 60s between half-open probes

const registry = new Map<string, BreakerState>();

function getState(provider: string): BreakerState {
    if (!registry.has(provider)) {
        registry.set(provider, {
            state: "CLOSED",
            failureCount: 0,
            windowStart: Date.now(),
            openedAt: null,
            lastProbeAt: null,
        });
    }
    return registry.get(provider)!;
}

/** Call before making a provider request. Throws ProviderUnavailableError if OPEN. */
export function checkCircuit(provider: string): void {
    const s = getState(provider);
    const now = Date.now();

    if (s.state === "OPEN") {
        // Check if enough time has passed to allow a probe
        if (s.openedAt !== null && now - s.openedAt >= PROBE_INTERVAL_MS) {
            // Only one probe at a time
            if (s.lastProbeAt === null || now - s.lastProbeAt >= PROBE_INTERVAL_MS) {
                s.state = "HALF_OPEN";
                s.lastProbeAt = now;
                logger.info(`Circuit breaker HALF_OPEN for ${provider} — probe allowed`, undefined);
                return; // let the request through
            }
        }
        throw new ProviderUnavailableError(provider);
    }

    // Roll the failure window
    if (now - s.windowStart > WINDOW_MS) {
        s.failureCount = 0;
        s.windowStart = now;
    }
}

/** Call after a successful provider request. */
export function recordSuccess(provider: string): void {
    const s = getState(provider);
    s.failureCount = 0;
    if (s.state === "HALF_OPEN" || s.state === "OPEN") {
        logger.info(`Circuit breaker CLOSED for ${provider} — probe succeeded`, undefined);
        s.state = "CLOSED";
        s.openedAt = null;
        s.lastProbeAt = null;
    }
}

/** Call after a failed provider request. May trip the circuit. */
export function recordFailure(provider: string): void {
    const s = getState(provider);
    const now = Date.now();

    if (now - s.windowStart > WINDOW_MS) {
        s.failureCount = 0;
        s.windowStart = now;
    }

    s.failureCount++;

    if (s.state === "HALF_OPEN") {
        // Probe failed — snap back to OPEN
        s.state = "OPEN";
        s.openedAt = now;
        logger.warn(`Circuit breaker re-OPEN for ${provider} — probe failed`, undefined);
        return;
    }

    if (s.failureCount >= FAILURE_THRESHOLD && s.state === "CLOSED") {
        s.state = "OPEN";
        s.openedAt = now;
        logger.warn(
            `Circuit breaker OPEN for ${provider} — ${s.failureCount} failures in 5 min`,
            { failureCount: s.failureCount },
            undefined
        );
    }
}

/** Returns current state for a provider (useful for health checks / logging). */
export function getCircuitState(provider: string): CircuitState {
    return getState(provider).state;
}

/** Resets a provider's circuit breaker (use in tests or admin tooling). */
export function resetCircuit(provider: string): void {
    registry.delete(provider);
}