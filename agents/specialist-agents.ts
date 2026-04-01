// =============================================================================
// Agent OS — Specialist Agent Runner Functions
// =============================================================================
// PHASE 2: Each agent now calls getProviderForAgent(agentName) instead of
// getLLMProvider(). The routing logic lives entirely in provider.ts.
//
// PHASE 3: Agents extract confidence + warnings from LLM JSON responses
// and write them back to AgentContext.confidenceScores and warnings[].

import { getProviderForAgent } from "@/lib/llm/provider";   // PHASE 2: was getLLMProvider
import type { LLMMessage } from "@/lib/llm/index";
import { AGENT_PROMPTS } from "./prompts";
import { logger } from "@/lib/logger";
import { buildPreviousOutputsBlock } from "@/lib/memory/agent-context";
import type {
    AgentContext,
    AgentName,
    RequirementAnalysis,
    ProductStrategy,
    TechnicalArchitecture,
    FinalPromptData,
} from "@/types";

// ── Fallback values ──────────────────────────────────────────────────────────

const FALLBACK_REQUIREMENTS: RequirementAnalysis = {
    problem_statement: "Could not extract problem statement.",
    goals: [],
    constraints: [],
    missing_details: ["Agent failed — please regenerate."],
};

const FALLBACK_STRATEGY: ProductStrategy = {
    target_users: [],
    mvp_scope: [],
    feature_priorities: [],
    user_flow: [],
};

const FALLBACK_ARCHITECTURE: TechnicalArchitecture = {
    suggested_stack: {},
    system_modules: [],
    integrations: [],
    data_model_overview: [],
};

const FALLBACK_FINAL_PROMPT: FinalPromptData = {
    product_name: "Untitled Project",
    concept: "",
    problem_statement: "",
    target_users: [],
    mvp_goal: "",
    features: [],
    core_flows: [],
    suggested_stack: {},
    pages_and_components: [],
    data_model: [],
    constraints: [],
    future_enhancements: [],
    build_instruction: "Insufficient data — please try regenerating.",
};

// ── PHASE 3: Helper to extract confidence + warnings from agent JSON ─────────
// Agents now return { ...result, confidence: number, warnings: string[] }
// We strip these meta fields before storing the typed result in context.

function extractMetaFields<T extends object>(
    raw: T & { confidence?: number; warnings?: string[] }
): { result: Omit<T, "confidence" | "warnings">; confidence: number; warnings: string[] } {
    const confidence = typeof raw.confidence === "number"
        ? Math.min(100, Math.max(0, raw.confidence))
        : 70; // default if agent didn't include it
    const warnings: string[] = Array.isArray(raw.warnings) ? raw.warnings : [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confidence: _c, warnings: _w, ...result } = raw as Record<string, unknown>;
    return { result: result as Omit<T, "confidence" | "warnings">, confidence, warnings };
}

// ── Safe wrapper ─────────────────────────────────────────────────────────────

async function safeRun<T>(
    fn: () => Promise<T>,
    fallback: T,
    agentName: AgentName,
    context: AgentContext
): Promise<{ result: T; usedFallback: boolean; durationMs: number }> {
    const start = Date.now();
    try {
        logger.info(`Agent starting: ${agentName}`, undefined, context.traceId);
        const result = await fn();
        const durationMs = Date.now() - start;
        logger.info(`Agent completed: ${agentName}`, { durationMs }, context.traceId);
        return { result, usedFallback: false, durationMs };
    } catch (err) {
        const durationMs = Date.now() - start;
        logger.error(
            `Agent failed: ${agentName} — using fallback`,
            { error: err instanceof Error ? err.message : String(err), durationMs },
            context.traceId
        );
        context.warnings.push(
            `${agentName} failed after ${durationMs}ms — fallback data used`
        );
        return { result: fallback, usedFallback: true, durationMs };
    }
}

// ── Agent 1: Requirement Analyst (Mistral) ───────────────────────────────────

export async function runRequirementAnalyst(
    context: AgentContext
): Promise<RequirementAnalysis> {
    const agentName: AgentName = "requirement_analyst";
    const provider = getProviderForAgent(agentName); // PHASE 2

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.requirement_analyst },
        {
            role: "user",
            content: `Analyze the following conversation and extract structured requirements:\n\n${context.conversationText}`,
        },
    ];

    const { result: raw, usedFallback, durationMs } = await safeRun(
        () => provider.chatJSON<RequirementAnalysis & { confidence?: number; warnings?: string[] }>(messages),
        { ...FALLBACK_REQUIREMENTS, confidence: 0, warnings: [] },
        agentName,
        context
    );

    // PHASE 3: extract confidence + warnings
    const { result, confidence, warnings } = extractMetaFields(raw);

    context.requirementOutput = result as RequirementAnalysis;
    context.confidenceScores[agentName] = confidence;
    context.usedFallback[agentName] = usedFallback;
    context.durationMs[agentName] = durationMs;
    if (warnings.length > 0) context.warnings.push(...warnings);

    return context.requirementOutput;
}

// ── Agent 2: Product Strategist (Gemini) ─────────────────────────────────────

export async function runProductStrategist(
    context: AgentContext
): Promise<ProductStrategy> {
    const agentName: AgentName = "product_strategist";
    const provider = getProviderForAgent(agentName); // PHASE 2: routes to Gemini

    const previousOutputs = buildPreviousOutputsBlock(context);

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.product_strategist },
        {
            role: "user",
            content: `Based on this conversation:\n\n${context.conversationText}\n\n${previousOutputs}\n\nDefine the product strategy.`,
        },
    ];

    const { result: raw, usedFallback, durationMs } = await safeRun(
        () => provider.chatJSON<ProductStrategy & { confidence?: number; warnings?: string[] }>(messages),
        { ...FALLBACK_STRATEGY, confidence: 0, warnings: [] },
        agentName,
        context
    );

    const { result, confidence, warnings } = extractMetaFields(raw);

    context.strategyOutput = result as ProductStrategy;
    context.confidenceScores[agentName] = confidence;
    context.usedFallback[agentName] = usedFallback;
    context.durationMs[agentName] = durationMs;
    if (warnings.length > 0) context.warnings.push(...warnings);

    return context.strategyOutput;
}

// ── Agent 3: Technical Architect (Groq) ──────────────────────────────────────

export async function runTechnicalArchitect(
    context: AgentContext
): Promise<TechnicalArchitecture> {
    const agentName: AgentName = "technical_architect";
    const provider = getProviderForAgent(agentName); // PHASE 2: routes to Groq

    const previousOutputs = buildPreviousOutputsBlock(context);

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.technical_architect },
        {
            role: "user",
            content: `Based on this conversation:\n\n${context.conversationText}\n\n${previousOutputs}\n\nDefine the technical architecture.`,
        },
    ];

    const { result: raw, usedFallback, durationMs } = await safeRun(
        () => provider.chatJSON<TechnicalArchitecture & { confidence?: number; warnings?: string[] }>(messages),
        { ...FALLBACK_ARCHITECTURE, confidence: 0, warnings: [] },
        agentName,
        context
    );

    const { result, confidence, warnings } = extractMetaFields(raw);

    context.architectureOutput = result as TechnicalArchitecture;
    context.confidenceScores[agentName] = confidence;
    context.usedFallback[agentName] = usedFallback;
    context.durationMs[agentName] = durationMs;
    if (warnings.length > 0) context.warnings.push(...warnings);

    return context.architectureOutput;
}

// ── Agent 4: Prompt Engineer (Mistral) ───────────────────────────────────────

export async function runPromptEngineer(
    context: AgentContext
): Promise<FinalPromptData> {
    const agentName: AgentName = "prompt_engineer";
    const provider = getProviderForAgent(agentName); // PHASE 2

    const previousOutputs = buildPreviousOutputsBlock(context);

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.prompt_engineer },
        {
            role: "user",
            content: `Synthesize these agent outputs into a final build prompt:\n\n${previousOutputs}`,
        },
    ];

    const { result: raw, usedFallback, durationMs } = await safeRun(
        () => provider.chatJSON<FinalPromptData & { confidence?: number; warnings?: string[] }>(messages),
        { ...FALLBACK_FINAL_PROMPT, confidence: 0, warnings: [] },
        agentName,
        context
    );

    const { result, confidence, warnings } = extractMetaFields(raw);

    context.finalPromptOutput = result as FinalPromptData;
    context.confidenceScores[agentName] = confidence;
    context.usedFallback[agentName] = usedFallback;
    context.durationMs[agentName] = durationMs;
    if (warnings.length > 0) context.warnings.push(...warnings);

    return context.finalPromptOutput;
}