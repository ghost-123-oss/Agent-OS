import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { logger } from "@/lib/logger";

// =============================================================================
// Tailwind class merge utility (shadcn/ui)
// =============================================================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Attempt 1  — strict JSON.parse on the raw string
 * Attempt 2  — extract the first {...} / [...] block, then parse
 * Attempt 3  — return null (caller decides whether to throw or fall back)
 *
 * The repair-prompt retry (attempt 3 in the roadmap) is intentionally
 * left to the provider layer so token cost stays predictable.
 */
export function extractAndParseJSON<T>(raw: string, traceId?: string): T | null {
  // ── Attempt 1: strict parse ───────────────────────────────────────────────
  try {
    return JSON.parse(raw) as T;
  } catch {
    // fall through to attempt 2
  }

  // ── Attempt 2: strip markdown fences, then extract first {…} or […] ──────
  // Handles: ```json\n{...}\n```, extra text before/after the JSON object
  const stripped = raw
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find the outermost balanced brace / bracket
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  const arrMatch = stripped.match(/\[[\s\S]*\]/);
  const candidate = objMatch?.[0] ?? arrMatch?.[0];

  if (candidate) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // fall through — candidate had syntax errors (trailing comma, etc.)
    }

    // Last sub-attempt: remove trailing commas before closing braces/brackets
    const cleaned = candidate
      .replace(/,\s*([}\]])/g, "$1")   // trailing commas
      .replace(/([{[,])\s*,/g, "$1");  // leading commas

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // fall through to null
    }
  }

  logger.warn(
    "extractAndParseJSON: all attempts failed — returning null",
    { rawLength: raw.length },
    traceId
  );
  return null;
}