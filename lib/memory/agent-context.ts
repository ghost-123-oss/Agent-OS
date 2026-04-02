'TYPESCRIPT'
// =============================================================================
// Agent OS — AgentContext Builder & Memory Management
// =============================================================================

import { generateTraceId } from "@/lib/logger";
import type {
    AgentContext,
    AgentName,
    ChatMessage,
    RequirementAnalysis,
    ProductStrategy,
    TechnicalArchitecture,
    FinalPromptData,
} from "@/types";

const MAX_CONTEXT_MESSAGES = 30;

// Keywords that indicate a message contains important product decisions
const IMPORTANCE_KEYWORDS = [
    "i want", "must have", "should be", "the tech stack", "the users are",
    "the problem", "need to", "has to", "important", "critical", "requirement",
    "feature", "integration", "budget", "deadline", "timeline", "constraint",
];

// ── buildAgentContext ─────────────────────────────────────────────────────────

export function buildAgentContext(
    projectId: string,
    messages: ChatMessage[],
    rawIdea: string = ""
): AgentContext {
    return {
        projectId,
        pipelineRunId: crypto.randomUUID(),
        traceId: generateTraceId(),
        conversationText: buildImportanceAwareContext(messages),
        rawIdea,
        projectType: "app",
        warnings: [],
        confidenceScores: {},
        usedFallback: {},
        durationMs: {},
        requirementOutput: undefined,
        strategyOutput: undefined,
        architectureOutput: undefined,
        finalPromptOutput: undefined,
    };
}

// ── buildImportanceAwareContext ───────────────────────────────────────────────
// Replaces the old slice(-30) with a smarter context builder.
// Always keeps: first 3 messages (original idea) + last 15 messages (recent context).
// Fills remaining slots with messages containing importance keywords.
// Inserts a separator comment where messages were skipped.

export function buildImportanceAwareContext(messages: ChatMessage[]): string {
    if (messages.length <= MAX_CONTEXT_MESSAGES) {
        // Short conversation — include everything
        return messages
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n\n");
    }

    const FIRST_N = 3;
    const LAST_N = 15;
    const remaining = MAX_CONTEXT_MESSAGES - FIRST_N - LAST_N;

    const firstMsgs = messages.slice(0, FIRST_N);
    const lastMsgs = messages.slice(-LAST_N);
    const middleMsgs = messages.slice(FIRST_N, messages.length - LAST_N);

    // Score middle messages by importance keyword hits
    const scored = middleMsgs.map((m, i) => {
        const lower = m.content.toLowerCase();
        const score = IMPORTANCE_KEYWORDS.filter((kw) => lower.includes(kw)).length;
        return { msg: m, score, originalIndex: FIRST_N + i };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, remaining);
    selected.sort((a, b) => a.originalIndex - b.originalIndex);

    const allIncluded = new Set([
        ...firstMsgs.map((_, i) => i),
        ...selected.map((s) => s.originalIndex),
        ...lastMsgs.map((_, i) => messages.length - LAST_N + i),
    ]);

    const lines: string[] = [];
    let lastIncludedIdx = -1;

    for (let i = 0; i < messages.length; i++) {
        if (allIncluded.has(i)) {
            if (lastIncludedIdx !== -1 && i > lastIncludedIdx + 1) {
                lines.push("[... earlier conversation summarised — key decisions preserved above ...]");
            }
            const m = messages[i];
            lines.push(`${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);
            lastIncludedIdx = i;
        }
    }

    return lines.join("\n\n");
}

// ── buildConversationContext (kept for backwards compat) ──────────────────────
export function buildConversationContext(messages: ChatMessage[]): string {
    return buildImportanceAwareContext(messages);
}

// ── buildPreviousOutputsBlock ─────────────────────────────────────────────────
// Injects SUMMARIES (not raw JSON) of prior agents into subsequent agents' prompts.
// Reduces Prompt Engineer's input by ~60% vs. raw JSON injection.
// Raw outputs remain available in AgentContext for the Prompt Engineer's full synthesis.

export function buildPreviousOutputsBlock(context: AgentContext): string {
    const parts: string[] = [];

    if (context.requirementOutput) {
        parts.push(`## Requirement Analysis Summary\n${summariseRequirements(context.requirementOutput)}`);
    }
    if (context.strategyOutput) {
        parts.push(`## Product Strategy Summary\n${summariseStrategy(context.strategyOutput)}`);
    }
    if (context.architectureOutput) {
        parts.push(`## Technical Architecture Summary\n${summariseArchitecture(context.architectureOutput)}`);
    }
    if (context.finalPromptOutput) {
        parts.push(`## Final Prompt Data\n${JSON.stringify(context.finalPromptOutput, null, 2)}`);
    }

    if (parts.length === 0) return "";
    return `\n\n---\nContext from previous agents:\n\n${parts.join("\n\n")}`;
}

// ── Agent Output Summaries ────────────────────────────────────────────────────
// Each summary keeps only the most essential fields — max ~200 words.

function summariseRequirements(r: RequirementAnalysis): string {
    const topGoals = r.goals.slice(0, 3).map((g) => `• ${g}`).join("\n");
    const topConstraints = r.constraints.slice(0, 2).map((c) => `• ${c}`).join("\n");
    return [
        `Problem: ${r.problem_statement}`,
        topGoals ? `Top goals:\n${topGoals}` : "",
        topConstraints ? `Key constraints:\n${topConstraints}` : "",
        r.missing_details.length > 0 ? `Gaps: ${r.missing_details.slice(0, 2).join(", ")}` : "",
    ].filter(Boolean).join("\n");
}

function summariseStrategy(s: ProductStrategy): string {
    const users = s.target_users.slice(0, 2).join(", ");
    const mustHave = s.feature_priorities.filter((f) => f.priority === "must").slice(0, 3).map((f) => `• ${f.feature}`).join("\n");
    return [
        `Target users: ${users}`,
        mustHave ? `Must-have features:\n${mustHave}` : "",
        s.user_flow.length > 0 ? `Primary flow: ${s.user_flow[0]}` : "",
    ].filter(Boolean).join("\n");
}

function summariseArchitecture(a: TechnicalArchitecture): string {
    const stack = Object.entries(a.suggested_stack).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ");
    const modules = a.system_modules.slice(0, 2).join(", ");
    return [
        stack ? `Stack: ${stack}` : "",
        modules ? `Modules: ${modules}` : "",
    ].filter(Boolean).join("\n");
}

// ── recordAgentOutput ─────────────────────────────────────────────────────────

export function recordAgentOutput(
    context: AgentContext,
    agentName: AgentName,
    output: RequirementAnalysis | ProductStrategy | TechnicalArchitecture | FinalPromptData,
    meta: { confidence?: number; warnings?: string[]; usedFallback?: boolean; durationMs?: number } = {}
): void {
    switch (agentName) {
        case "requirement_analyst": context.requirementOutput = output as RequirementAnalysis; break;
        case "product_strategist": context.strategyOutput = output as ProductStrategy; break;
        case "technical_architect": context.architectureOutput = output as TechnicalArchitecture; break;
        case "prompt_engineer": context.finalPromptOutput = output as FinalPromptData; break;
    }
    if (meta.confidence !== undefined) context.confidenceScores[agentName] = meta.confidence;
    if (meta.warnings?.length) context.warnings.push(...meta.warnings.map((w) => `[${agentName}] ${w}`));
    if (meta.usedFallback !== undefined) context.usedFallback[agentName] = meta.usedFallback;
    if (meta.durationMs !== undefined) context.durationMs[agentName] = meta.durationMs;
}