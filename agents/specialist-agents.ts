'TYPESCRIPT'
// =============================================================================
// Agent OS — Specialist Agent Runners
// =============================================================================
// Each function accepts AgentContext, runs its designated LLM provider,
// validates the output schema, and writes results back into the context.

import { getProviderForAgent } from "@/lib/llm/provider";
import type { LLMMessage } from "@/lib/llm/index";
import { AGENT_PROMPTS } from "./prompts";
import { buildPreviousOutputsBlock, recordAgentOutput } from "@/lib/memory/agent-context";
import { validateAgentOutput, isEffectivelyEmpty } from "@/lib/validation/agent-schemas";
import { logger } from "@/lib/logger";
import type {
    AgentContext,
    RequirementAnalysis,
    ProductStrategy,
    TechnicalArchitecture,
    FinalPromptData,
} from "@/types";

// ── Internal helper ───────────────────────────────────────────────────────────

interface AgentRunResult<T> {
    output: T;
    durationMs: number;
    usedFallback: boolean;
    confidence: number;
    warnings: string[];
}

async function safeRunSpecialist<T>(
    fn: () => Promise<T>,
    fallback: T,
    agentName: string,
    traceId: string
): Promise<AgentRunResult<T>> {
    const start = Date.now();
    try {
        logger.info(`Specialist starting: ${agentName}`, undefined, traceId);
        const output = await fn();
        const durationMs = Date.now() - start;

        // Extract self-reported confidence and warnings if present
        const raw = output as Record<string, unknown>;
        const confidence = typeof raw?.confidence === "number" ? (raw.confidence as number) : 75;
        const warnings = Array.isArray(raw?.warnings) ? (raw.warnings as string[]) : [];

        logger.info(`Specialist completed: ${agentName}`, { durationMs, confidence }, traceId);
        return { output, durationMs, usedFallback: false, confidence, warnings };
    } catch (err) {
        const durationMs = Date.now() - start;
        logger.error(
            `Specialist failed: ${agentName} — using fallback`,
            { error: err instanceof Error ? err.message.slice(0, 300) : String(err), durationMs },
            traceId
        );
        return { output: fallback, durationMs, usedFallback: true, confidence: 0, warnings: [`${agentName} failed — fallback used`] };
    }
}

// ── Fallback values ───────────────────────────────────────────────────────────

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

// ── Requirement Analyst ───────────────────────────────────────────────────────

export async function runRequirementAnalyst(
    context: AgentContext
): Promise<RequirementAnalysis> {
    const provider = await getProviderForAgent("requirement_analyst");
    const previousOutputs = buildPreviousOutputsBlock(context);

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.requirement_analyst },
        { role: "user", content: `Analyze the following conversation and extract structured requirements:\n\n${context.conversationText}${previousOutputs}` },
    ];

    const { output, durationMs, usedFallback, confidence, warnings } =
        await safeRunSpecialist(
            () => provider.chatJSON<RequirementAnalysis>(messages),
            FALLBACK_REQUIREMENTS,
            "RequirementAnalyst",
            context.traceId
        );

    // Schema validation — if invalid, treat as fallback
    const validation = validateAgentOutput("requirement_analyst", output);
    if (!validation.valid) {
        logger.warn("RequirementAnalyst schema invalid", { ...validation }, context.traceId);
        warnings.push(`Schema invalid: missing ${validation.missingFields.join(", ")}`);
    }

    recordAgentOutput(context, "requirement_analyst", output, { usedFallback: usedFallback || !validation.valid, durationMs, confidence, warnings });
    return output;
}

// ── Product Strategist ────────────────────────────────────────────────────────

export async function runProductStrategist(
    context: AgentContext
): Promise<ProductStrategy> {
    const provider = await getProviderForAgent("product_strategist");
    const previousOutputs = buildPreviousOutputsBlock(context);

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.product_strategist },
        { role: "user", content: `Based on this conversation:\n\n${context.conversationText}${previousOutputs}\n\nDefine the product strategy.` },
    ];

    const { output, durationMs, usedFallback, confidence, warnings } =
        await safeRunSpecialist(
            () => provider.chatJSON<ProductStrategy>(messages),
            FALLBACK_STRATEGY,
            "ProductStrategist",
            context.traceId
        );

    const validation = validateAgentOutput("product_strategist", output);
    if (!validation.valid) {
        logger.warn("ProductStrategist schema invalid", { ...validation }, context.traceId);
        warnings.push(`Schema invalid: missing ${validation.missingFields.join(", ")}`);
    }

    // ── Quality gate: Product Strategist is critical ──────────────────────────
    // If the output is effectively empty, flag it in context.
    if (isEffectivelyEmpty(output) || usedFallback) {
        context.warnings.push("CRITICAL: ProductStrategist produced empty output — brief quality will be degraded.");
        logger.warn("ProductStrategist quality gate: empty output detected", undefined, context.traceId);
    }

    recordAgentOutput(context, "product_strategist", output, { usedFallback: usedFallback || !validation.valid, durationMs, confidence, warnings });
    return output;
}

// ── Technical Architect ───────────────────────────────────────────────────────

export async function runTechnicalArchitect(
    context: AgentContext
): Promise<TechnicalArchitecture> {
    const provider = await getProviderForAgent("technical_architect");
    const previousOutputs = buildPreviousOutputsBlock(context);

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.technical_architect },
        { role: "user", content: `Based on this conversation:\n\n${context.conversationText}${previousOutputs}\n\nDefine the technical architecture.` },
    ];

    const { output, durationMs, usedFallback, confidence, warnings } =
        await safeRunSpecialist(
            () => provider.chatJSON<TechnicalArchitecture>(messages),
            FALLBACK_ARCHITECTURE,
            "TechnicalArchitect",
            context.traceId
        );

    const validation = validateAgentOutput("technical_architect", output);
    if (!validation.valid) {
        logger.warn("TechnicalArchitect schema invalid", { ...validation }, context.traceId);
        warnings.push(`Schema invalid: missing ${validation.missingFields.join(", ")}`);
    }

    recordAgentOutput(context, "technical_architect", output, { usedFallback: usedFallback || !validation.valid, durationMs, confidence, warnings });
    return output;
}

// ── Prompt Engineer ───────────────────────────────────────────────────────────

export async function runPromptEngineer(
    context: AgentContext
): Promise<FinalPromptData> {
    const provider = await getProviderForAgent("prompt_engineer");
    const previousOutputs = buildPreviousOutputsBlock(context);

    const messages: LLMMessage[] = [
        { role: "system", content: AGENT_PROMPTS.prompt_engineer },
        { role: "user", content: `Synthesize these agent outputs into a final build prompt:${previousOutputs}` },
    ];

    const { output, durationMs, usedFallback, confidence, warnings } =
        await safeRunSpecialist(
            () => provider.chatJSON<FinalPromptData>(messages),
            FALLBACK_FINAL_PROMPT,
            "PromptEngineer",
            context.traceId
        );

    const validation = validateAgentOutput("prompt_engineer", output);
    if (!validation.valid) {
        logger.warn("PromptEngineer schema invalid", { ...validation }, context.traceId);
        warnings.push(`Schema invalid: missing ${validation.missingFields.join(", ")}`);
    }

    recordAgentOutput(context, "prompt_engineer", output, { usedFallback: usedFallback || !validation.valid, durationMs, confidence, warnings });
    return output;
}