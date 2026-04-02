'TYPESCRIPT'
// =============================================================================
// Agent OS — Feedback Integrator Agent
// =============================================================================
// Reads user feedback on the final brief, determines which agent to restart
// from, and prepares injected context for the partial re-run.
// Powered by Groq (fast, low-latency routing decision).

import { getProviderForAgent } from "@/lib/llm/provider";
import type { LLMMessage } from "@/lib/llm/index";
import type { AgentName } from "@/types";
import { logger } from "@/lib/logger";

export interface FeedbackIntegratorResult {
    restartFrom: AgentName;
    reason: string;
    injectedContext: string;
    confidence: number;
}

const FEEDBACK_SYSTEM_PROMPT = `You are the Feedback Integrator — a routing specialist for Agent OS.
 
CHARACTER:
  Traits: fast, precise, analytical, decisive.
  Temperature: 0.2 (low — routing decisions should be deterministic).
  Forbidden: Never give vague answers. Always pick a specific agent to restart from.
 
TASK:
A user has reviewed their product brief and provided feedback.
Determine which pipeline stage to restart from to incorporate the feedback efficiently.
 
Routing rules:
  - "requirement_analyst" — feedback changes the core problem, goals, or constraints
  - "product_strategist"  — feedback changes users, features, or MVP scope
  - "technical_architect" — feedback changes the tech stack or data model only
  - "prompt_engineer"     — feedback is cosmetic (wording, tone, formatting only)
 
You MUST respond with valid JSON:
{
  "restartFrom": "requirement_analyst" | "product_strategist" | "technical_architect" | "prompt_engineer",
  "reason": "One sentence explaining the routing decision",
  "injectedContext": "The key information from the feedback to inject into the restarted agent's prompt",
  "confidence": 90,
  "warnings": []
}`;

export async function runFeedbackIntegrator(
    feedback: string,
    currentBriefSummary: string,
    traceId: string
): Promise<FeedbackIntegratorResult> {
    try {
        const provider = await getProviderForAgent("feedback_integrator");

        const messages: LLMMessage[] = [
            { role: "system", content: FEEDBACK_SYSTEM_PROMPT },
            {
                role: "user",
                content: `Current brief summary:\n${currentBriefSummary}\n\nUser feedback:\n${feedback}\n\nWhich agent should restart?`,
            },
        ];

        const result = await provider.chatJSON<FeedbackIntegratorResult>(messages);

        logger.info("FeedbackIntegrator: routing decision", {
            restartFrom: result.restartFrom,
            confidence: result.confidence,
        }, traceId);

        return result;
    } catch (err) {
        logger.error("FeedbackIntegrator failed — defaulting to product_strategist", {
            error: err instanceof Error ? err.message : String(err),
        }, traceId);

        // Safe default: restart from product_strategist (catches most feedback types)
        return {
            restartFrom: "product_strategist",
            reason: "Feedback integrator failed — defaulting to product strategy re-run.",
            injectedContext: feedback,
            confidence: 50,
        };
    }
}