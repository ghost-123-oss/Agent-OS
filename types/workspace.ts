// =============================================================================
// Agent OS — Workspace UI Types
// =============================================================================
// PHASE 3: AgentStatus.confidence added for sidebar confidence badges.
//          SUBMIT_FEEDBACK action added for partial pipeline re-run UI.

import type { ChatMessage, AgentName } from "@/types";
import type { PipelineResult } from "@/agents/orchestrator";

export type WorkspacePhase =
  | "idea"
  | "chatting"
  | "processing"
  | "done"
  | "error";

export interface AgentStatus {
  name: string;
  status: "pending" | "running" | "done";
  // PHASE 3: populated after pipeline completes (0-100)
  confidence?: number;
}

export const DEFAULT_AGENT_STATUSES: AgentStatus[] = [
  { name: "Requirement Analyst", status: "pending" },
  { name: "Product Strategist", status: "pending" },
  { name: "Technical Architect", status: "pending" },
  { name: "Prompt Engineer", status: "pending" },
];

export interface WorkspaceState {
  phase: WorkspacePhase;
  projectId: string | null;
  rawIdea: string;
  messages: ChatMessage[];
  inputValue: string;
  pipelineResult: PipelineResult | null;
  finalMarkdown: string;
  copied: boolean;
  agentStatuses: AgentStatus[];
  activeTab: "brief" | "prompt";
  error: string | null;
  loading: {
    chat: boolean;
    pipeline: boolean;
    history: boolean;
  };
  // PHASE 3: feedback input value (controlled in Sidebar)
  feedbackValue: string;
}

export type WorkspaceAction =
  | {
    type: "LOAD_PROJECT";
    payload: {
      projectId: string;
      rawIdea: string;
      hasMessages: boolean;
      messages: ChatMessage[];
      pipelineResult: PipelineResult | null;
      finalMarkdown: string;
      isCompleted: boolean;
    };
  }
  | {
    type: "INIT_PROJECT";
    payload: {
      projectId: string;
      rawIdea: string;
      hasMessages: boolean;
      messages: ChatMessage[];
    };
  }
  | { type: "RESET_PROJECT" }
  | { type: "SET_PHASE"; payload: WorkspacePhase }
  | { type: "SET_RAW_IDEA"; payload: string }
  | { type: "SET_INPUT_VALUE"; payload: string }
  | { type: "SET_MESSAGES"; payload: ChatMessage[] }
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | {
    type: "SET_LOADING";
    payload: { chat?: boolean; pipeline?: boolean; history?: boolean };
  }
  | { type: "SET_ERROR"; payload: string | null }
  | {
    type: "SET_PIPELINE_RESULT";
    payload: { result: PipelineResult; markdown: string };
  }
  | {
    type: "UPDATE_AGENT_STATUS";
    payload: { index: number; status: AgentStatus["status"] };
  }
  | { type: "RESET_PIPELINE" }
  | { type: "SET_COPIED"; payload: boolean }
  | { type: "SET_ACTIVE_TAB"; payload: "brief" | "prompt" }
  // PHASE 3: feedback input
  | { type: "SET_FEEDBACK_VALUE"; payload: string };