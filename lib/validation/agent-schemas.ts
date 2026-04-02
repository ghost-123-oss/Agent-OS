'TYPESCRIPT'
// =============================================================================
// Agent OS — Agent Output Schema Validator
// =============================================================================
// Surface-level key-existence + type checks.
// NOT deep / recursive — that would be too slow and brittle.
// Called immediately after JSON parsing in specialist-agents.ts.

import type {
    AgentName,
    RequirementAnalysis,
    ProductStrategy,
    TechnicalArchitecture,
    FinalPromptData,
} from "@/types";

export interface ValidationResult {
    valid: boolean;
    missingFields: string[];
    wrongTypeFields: string[];
}

// ── Individual validators ─────────────────────────────────────────────────────

function validateRequirementAnalysis(o: unknown): ValidationResult {
    const missing: string[] = [];
    const wrongType: string[] = [];
    if (!o || typeof o !== "object") return { valid: false, missingFields: ["(root)"], wrongTypeFields: [] };
    const r = o as Record<string, unknown>;

    if (!("problem_statement" in r)) missing.push("problem_statement");
    else if (typeof r.problem_statement !== "string") wrongType.push("problem_statement");

    if (!("goals" in r)) missing.push("goals");
    else if (!Array.isArray(r.goals)) wrongType.push("goals");

    if (!("constraints" in r)) missing.push("constraints");
    else if (!Array.isArray(r.constraints)) wrongType.push("constraints");

    if (!("missing_details" in r)) missing.push("missing_details");

    return { valid: missing.length === 0 && wrongType.length === 0, missingFields: missing, wrongTypeFields: wrongType };
}

function validateProductStrategy(o: unknown): ValidationResult {
    const missing: string[] = [];
    const wrongType: string[] = [];
    if (!o || typeof o !== "object") return { valid: false, missingFields: ["(root)"], wrongTypeFields: [] };
    const r = o as Record<string, unknown>;

    if (!("target_users" in r)) missing.push("target_users");
    else if (!Array.isArray(r.target_users)) wrongType.push("target_users");

    if (!("mvp_scope" in r)) missing.push("mvp_scope");
    else if (!Array.isArray(r.mvp_scope)) wrongType.push("mvp_scope");

    if (!("feature_priorities" in r)) missing.push("feature_priorities");
    else if (!Array.isArray(r.feature_priorities)) wrongType.push("feature_priorities");

    if (!("user_flow" in r)) missing.push("user_flow");

    return { valid: missing.length === 0 && wrongType.length === 0, missingFields: missing, wrongTypeFields: wrongType };
}

function validateTechnicalArchitecture(o: unknown): ValidationResult {
    const missing: string[] = [];
    const wrongType: string[] = [];
    if (!o || typeof o !== "object") return { valid: false, missingFields: ["(root)"], wrongTypeFields: [] };
    const r = o as Record<string, unknown>;

    if (!("suggested_stack" in r)) missing.push("suggested_stack");
    else if (typeof r.suggested_stack !== "object" || Array.isArray(r.suggested_stack))
        wrongType.push("suggested_stack");

    if (!("system_modules" in r)) missing.push("system_modules");
    else if (!Array.isArray(r.system_modules)) wrongType.push("system_modules");

    if (!("integrations" in r)) missing.push("integrations");
    if (!("data_model_overview" in r)) missing.push("data_model_overview");

    return { valid: missing.length === 0 && wrongType.length === 0, missingFields: missing, wrongTypeFields: wrongType };
}

function validateFinalPromptData(o: unknown): ValidationResult {
    const missing: string[] = [];
    const wrongType: string[] = [];
    if (!o || typeof o !== "object") return { valid: false, missingFields: ["(root)"], wrongTypeFields: [] };
    const r = o as Record<string, unknown>;

    if (!("product_name" in r)) missing.push("product_name");
    else if (typeof r.product_name !== "string") wrongType.push("product_name");

    if (!("concept" in r)) missing.push("concept");
    else if (typeof r.concept !== "string") wrongType.push("concept");

    if (!("features" in r)) missing.push("features");
    else if (!Array.isArray(r.features)) wrongType.push("features");

    if (!("build_instruction" in r)) missing.push("build_instruction");

    return { valid: missing.length === 0 && wrongType.length === 0, missingFields: missing, wrongTypeFields: wrongType };
}

// ── Public dispatcher ─────────────────────────────────────────────────────────

export function validateAgentOutput(
    agentName: AgentName,
    output: unknown
): ValidationResult {
    switch (agentName) {
        case "requirement_analyst": return validateRequirementAnalysis(output);
        case "product_strategist": return validateProductStrategy(output);
        case "technical_architect": return validateTechnicalArchitecture(output);
        case "prompt_engineer": return validateFinalPromptData(output);
        default: return { valid: true, missingFields: [], wrongTypeFields: [] };
    }
}

/**
 * Returns true if the output is functionally empty:
 * all array fields are empty AND all string fields are blank.
 * Used by the quality gate to detect fallback bleed-through.
 */
export function isEffectivelyEmpty(output: unknown): boolean {
    if (!output || typeof output !== "object") return true;
    const values = Object.values(output as Record<string, unknown>);
    const nonEmpty = values.filter((v) => {
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "object" && v !== null) return Object.keys(v).length > 0;
        return false;
    });
    return nonEmpty.length === 0;
}