// =============================================================================
// Agent OS — Feedback Integrator Agent (Phase 3)
// =============================================================================
// Receives user feedback on a generated brief and decides the minimal
// re-run point: which agent should restart with the feedback injected.
//
// This enables partial pipeline re-runs:
//   "Change the stack to use Firebase" → restart from technical_architect only
//   "Focus on enterprise users instead" → restart from product_strategist
//   "Fix the wording" → restart from prompt_engineer only
//
// Routed to: Groq (fast decision-making, same as technical_architect)

import { getProviderForAgent } from "@/lib/llm/provider";
import type { LLMMessage } from "@/lib/llm/index";
import { AGENT_PROMPTS } from "./prompts";
import { logger } from "@/lib/logger";
import type { AgentContext, AgentName } from "@/types";

export interface FeedbackAnalysis {
    analysisOfFeedback: string;
    restartFrom: AgentName;
    injectedContext: string;
    confidence: number;
    warnings: string[];
}

// ── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK_ANALYSIS: FeedbackAnalysis = {
    analysisOfFeedback: "Could not analyse feedback — restarting from the beginning.",
    restartFrom: "requirement_analyst",
    injectedContext: "",
    confidence: 0,
    warnings: ["Feedback integrator failed — full re-run triggered"],
};

// ── Main function ─────────────────────────────────────────────────────────────

export async function runFeedbackIntegrator(
    context: AgentContext,
    userFeedback: string
): Promise<FeedbackAnalysis> {
    const agentName: AgentName = "feedback_integrator";
    const provider = getProviderForAgent(agentName); // routes to Groq

    logger.info(
        "Feedback Integrator starting",
        { feedbackLength: userFeedback.length },
        context.traceId
    );

    const start = Date.now();

    const existingOutputsSummary = [
        context.requirementOutput
            ? `Requirements: ${JSON.stringify(context.requirementOutput)}`
            : "",
        context.strategyOutput
            ? `Strategy: ${JSON.stringify(context.strategyOutput)}`
            : "",
        context.architectureOutput
            ? `Architecture: ${JSON.stringify(context.architectureOutput)}`
            : "",
        context.finalPromptOutput
            ? `Final prompt product name: ${context.finalPromptOutput.product_name}`
            : "",
    ]
        .filter(Boolean)
        .join("\n\n");

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.feedback_integrator },
        {
            role: "user",
            content: `The user provided the following feedback on the generated project brief:\n\n"${userFeedback}"\n\nCurrent pipeline outputs for context:\n\n${existingOutputsSummary}\n\nAnalyse the feedback and decide which agent to restart from.`,
        },
    ];

    try {
        const raw = await provider.chatJSON<FeedbackAnalysis>(messages);

        const durationMs = Date.now() - start;
        logger.info(
            "Feedback Integrator completed",
            {
                restartFrom: raw.restartFrom,
                confidence: raw.confidence,
                durationMs,
            },
            context.traceId
        );

        context.confidenceScores[agentName] = raw.confidence ?? 0;
        context.durationMs[agentName] = durationMs;

        return raw;
    } catch (err) {
        const durationMs = Date.now() - start;
        logger.error(
            "Feedback Integrator failed — defaulting to full re-run",
            { error: err instanceof Error ? err.message : String(err), durationMs },
            context.traceId
        );
        context.warnings.push("Feedback integrator failed — full re-run triggered");
        return FALLBACK_ANALYSIS;
    }
}