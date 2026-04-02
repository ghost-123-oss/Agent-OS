'TYPESCRIPT'
// =============================================================================
// Agent OS — Core TypeScript Types
// =============================================================================

// ── Database entities ────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

export type ProjectStatus =
  | "draft"
  | "gathering"
  | "processing"
  | "completed"
  | "error";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  idea_raw: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant" | "system";
export type SenderType = "user" | "orchestrator" | "system";

export interface Message {
  id: string;
  project_id: string;
  role: MessageRole;
  sender_type: SenderType;
  content: string;
  created_at: string;
}

export type AgentName =
  | "orchestrator"
  | "requirement_analyst"
  | "product_strategist"
  | "technical_architect"
  | "prompt_engineer"
  | "feedback_integrator";

export interface AgentOutput {
  id: string;
  project_id: string;
  agent_name: AgentName;
  output_json: Record<string, unknown>;
  model_used?: string;
  duration_ms?: number;
  used_fallback?: boolean;
  trace_id?: string;
  version?: number;
  created_at: string;
}

export interface FinalPrompt {
  id: string;
  project_id: string;
  prompt_markdown: string;
  version: number;
  created_at: string;
}

// ── Agent structured outputs ─────────────────────────────────────────────────

export interface RequirementAnalysis {
  problem_statement: string;
  goals: string[];
  constraints: string[];
  missing_details: string[];
  confidence?: number;
  warnings?: string[];
}

export interface ProductStrategy {
  target_users: string[];
  mvp_scope: string[];
  feature_priorities: {
    feature: string;
    priority: "must" | "should" | "nice";
  }[];
  user_flow: string[];
  confidence?: number;
  warnings?: string[];
}

export interface TechnicalArchitecture {
  suggested_stack: Record<string, string>;
  system_modules: string[];
  integrations: string[];
  data_model_overview: string[];
  confidence?: number;
  warnings?: string[];
}

export interface FinalPromptData {
  product_name: string;
  concept: string;
  problem_statement: string;
  target_users: string[];
  mvp_goal: string;
  features: string[];
  core_flows: string[];
  suggested_stack: Record<string, string>;
  pages_and_components: string[];
  data_model: string[];
  constraints: string[];
  future_enhancements: string[];
  build_instruction: string;
  confidence?: number;
  warnings?: string[];
}

// ── Phase 1: AgentContext — the typed pipeline envelope ──────────────────────
// Created once per pipeline run and passed sequentially through all agents.
// No agent stores its own state — everything flows through this object.

export interface AgentContext {
  // Identity
  projectId: string;
  pipelineRunId: string;   // UUID for this specific pipeline execution
  traceId: string;         // Correlates all log lines for this run

  // Source material (built once, shared across all agents)
  conversationText: string;  // Last 30 messages pre-formatted
  rawIdea: string;

  projectType: string;

  // Agent outputs — filled in progressively as pipeline runs
  requirementOutput?: RequirementAnalysis;
  strategyOutput?: ProductStrategy;
  architectureOutput?: TechnicalArchitecture;
  finalPromptOutput?: FinalPromptData;

  // Quality tracking — agents append to these as they run
  warnings: string[];
  confidenceScores: Partial<Record<AgentName, number>>;  // 0-100 per agent
  usedFallback: Partial<Record<AgentName, boolean>>;
  durationMs: Partial<Record<AgentName, number>>;
}

// ── Phase 1: AgentMessage — inter-agent communication envelope ───────────────
// Every message passed between agents is saved to the agent_messages table.
// This gives a full audit trail and enables the Phase 3 Feedback Integrator.

export type AgentMessageType =
  | "input"
  | "output"
  | "feedback"
  | "correction"
  | "approval";

export interface AgentMessage {
  from: AgentName | "user";
  to: AgentName;
  type: AgentMessageType;
  payload: Record<string, unknown>;
  meta: {
    pipelineRunId: string;
    sequenceNumber: number;
    modelUsed: string;
    durationMs: number;
    confidence: number;    // 0-100
    usedFallback: boolean;
  };
}

// ── UI state ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: MessageRole;
  sender_type: SenderType;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ProjectBrief {
  title: string;
  concept: string;
  problem: string;
  users: string[];
  features: string[];
  flow: string[];
  stack: Record<string, string>;
  constraints: string[];
  future: string[];
}

// Re-export workspace UI types
export type { WorkspacePhase, AgentStatus } from "./workspace";