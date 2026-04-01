'TYPESCRIPT'
// =============================================================================
// Agent OS — Agent Context Builder
// =============================================================================
// Builds the AgentContext envelope that is passed sequentially through
// all pipeline agents. Created once per pipeline run.

import { generateTraceId } from "@/lib/logger";
import type { AgentContext, ChatMessage } from "@/types";

const MAX_CONTEXT_MESSAGES = 30;

/**
 * Formats the last N messages into a plain-text block.
 * Shared across all four agents to avoid redundant processing.
 */
export function buildConversationContext(messages: ChatMessage[]): string {
    const capped = messages.slice(-MAX_CONTEXT_MESSAGES);
    return capped
        .map((m) =>
            m.role === "user"
                ? `User: ${m.content}`
                : `Assistant: ${m.content}`
        )
        .join("\n\n");
}

/**
 * Formats all previous agent outputs into a readable JSON block.
 * Each agent receives the outputs from agents that ran before it.
 */
export function buildPreviousOutputsBlock(context: AgentContext): string {
    const parts: string[] = [];

    if (context.requirementOutput) {
        parts.push(
            `## Requirement Analysis\n${JSON.stringify(context.requirementOutput, null, 2)}`
        );
    }
    if (context.strategyOutput) {
        parts.push(
            `## Product Strategy\n${JSON.stringify(context.strategyOutput, null, 2)}`
        );
    }
    if (context.architectureOutput) {
        parts.push(
            `## Technical Architecture\n${JSON.stringify(context.architectureOutput, null, 2)}`
        );
    }

    return parts.length > 0
        ? `Previous agent outputs:\n\n${parts.join("\n\n")}`
        : "";
}

/**
 * Creates a fresh AgentContext for a new pipeline run.
 * Called once in runFullPipeline() before any agents execute.
 */
export function buildAgentContext(
    projectId: string,
    rawIdea: string,
    messages: ChatMessage[],
    traceId?: string
): AgentContext {
    return {
        projectId,
        pipelineRunId: crypto.randomUUID(),
        traceId: traceId ?? generateTraceId(),
        conversationText: buildConversationContext(messages),
        rawIdea,
        warnings: [],
        confidenceScores: {},
        usedFallback: {},
        durationMs: {},
    };
}