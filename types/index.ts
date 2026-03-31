// ===========================================
// Agent OS — Core TypeScript Types
// ===========================================

// --- Database Entities ---

export interface User {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
}

export type ProjectStatus = "draft" | "gathering" | "processing" | "completed";

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
  | "prompt_engineer";

export interface AgentOutput {
  id: string;
  project_id: string;
  agent_name: AgentName;
  output_json: Record<string, unknown>;
  created_at: string;
}

export interface FinalPrompt {
  id: string;
  project_id: string;
  prompt_markdown: string;
  version: number;
  created_at: string;
}

// --- Agent Structured Outputs ---

export interface RequirementAnalysis {
  problem_statement: string;
  goals: string[];
  constraints: string[];
  missing_details: string[];
}

export interface ProductStrategy {
  target_users: string[];
  mvp_scope: string[];
  feature_priorities: { feature: string; priority: "must" | "should" | "nice" }[];
  user_flow: string[];
}

export interface TechnicalArchitecture {
  suggested_stack: Record<string, string>;
  system_modules: string[];
  integrations: string[];
  data_model_overview: string[];
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
}

// --- UI State ---

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
