#!/usr/bin/env bash
# =============================================================
# Agent OS — Full Modular Refactor Script
# Run from the ROOT of the repo: bash refactor.sh
# =============================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[refactor]${NC} $1"; }
done_() { echo -e "${GREEN}[done]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }

# ── 0. Safety check ──────────────────────────────────────────
if [ ! -f "package.json" ]; then
  echo "ERROR: Run this script from the root of the Agent OS repo."
  exit 1
fi

log "Starting Agent OS modular refactor..."


# =============================================================
# STEP 1 — Create folder structure
# =============================================================
log "Creating directory structure..."

mkdir -p features/workspace/hooks
mkdir -p features/workspace/services
mkdir -p features/workspace/components

done_ "Directories created"


# =============================================================
# STEP 2 — types/workspace.ts  (new file)
# =============================================================
log "Writing types/workspace.ts..."

cat > types/workspace.ts << 'ENDOFFILE'
// ===========================================
// Agent OS — Workspace UI Types
// ===========================================
// Extracted from app/page.tsx to keep types/index.ts clean.

export type WorkspacePhase = "idea" | "chatting" | "processing" | "done" | "error";

export interface AgentStatus {
  name: string;
  status: "pending" | "running" | "done";
}

export const DEFAULT_AGENT_STATUSES: AgentStatus[] = [
  { name: "Requirement Analyst", status: "pending" },
  { name: "Product Strategist", status: "pending" },
  { name: "Technical Architect", status: "pending" },
  { name: "Prompt Engineer", status: "pending" },
];
ENDOFFILE

done_ "types/workspace.ts"


# =============================================================
# STEP 3 — features/workspace/services/chat.service.ts
# =============================================================
log "Writing chat.service.ts..."

cat > features/workspace/services/chat.service.ts << 'ENDOFFILE'
// ===========================================
// Agent OS — Chat Service
// ===========================================
// Handles all communication with /api/chat.
// No UI logic, no JSX, no state mutations.

import type { ChatMessage } from "@/types";

export interface ChatServiceResult {
  content: string;
}

export async function sendChatMessage(
  messages: ChatMessage[]
): Promise<ChatServiceResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { error?: string })?.error ?? `Chat failed (${res.status})`
    );
  }

  const data = await res.json();
  return { content: data.content as string };
}

// Detect whether the orchestrator is signalling pipeline readiness
export function shouldTriggerPipeline(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("enough information") || lower.includes("generate your")
  );
}
ENDOFFILE

done_ "chat.service.ts"


# =============================================================
# STEP 4 — features/workspace/services/pipeline.service.ts
# =============================================================
log "Writing pipeline.service.ts..."

cat > features/workspace/services/pipeline.service.ts << 'ENDOFFILE'
// ===========================================
// Agent OS — Pipeline Service
// ===========================================
// Handles communication with /api/pipeline.
// Agent-status animation logic also lives here
// because it belongs to pipeline orchestration, not UI.

import type { ChatMessage } from "@/types";
import type { PipelineResult } from "@/agents/orchestrator";

export type AgentStatusUpdater = (
  index: number,
  status: "pending" | "running" | "done"
) => void;

export async function runPipelineRequest(
  messages: ChatMessage[],
  onStatusUpdate: AgentStatusUpdater
): Promise<PipelineResult> {
  // Animate agent statuses one-by-one while real API call runs
  for (let i = 0; i < 4; i++) {
    onStatusUpdate(i, "running");
    await new Promise((r) => setTimeout(r, 800));
  }

  const res = await fetch("/api/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const traceId = res.headers.get("x-trace-id");
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      (errBody as { error?: string })?.error ??
        `Pipeline failed (${res.status})${traceId ? ` — TraceID: ${traceId}` : ""}`
    );
  }

  return res.json() as Promise<PipelineResult>;
}
ENDOFFILE

done_ "pipeline.service.ts"


# =============================================================
# STEP 5 — features/workspace/services/project.service.ts
# =============================================================
log "Writing project.service.ts..."

cat > features/workspace/services/project.service.ts << 'ENDOFFILE'
// ===========================================
// Agent OS — Project Service
// ===========================================
// Wraps project-related server actions.
// Handles localStorage + router side-effects
// so hooks and components stay clean.

import {
  createProjectAction,
  getProjectsAction,
  getProjectMessagesAction,
  saveMessagesAction,
} from "@/actions/db";
import type { ChatMessage, Project, Message } from "@/types";

// ---- Project creation -------------------------------------------------------

export interface CreateProjectResult {
  project: Project;
  newId: string;
}

export async function createProject(
  rawIdea: string
): Promise<CreateProjectResult | null> {
  const title = rawIdea.slice(0, 40) + (rawIdea.length > 40 ? "..." : "");
  const project = await createProjectAction(title, rawIdea);
  if (!project) return null;

  localStorage.setItem("agent_os_current_project", project.id);
  return { project, newId: project.id };
}

// ---- Project loading --------------------------------------------------------

export interface LoadedProject {
  messages: ChatMessage[];
  hasMessages: boolean;
}

export async function loadProjectMessages(
  projectId: string
): Promise<LoadedProject> {
  const dbMsgs = await getProjectMessagesAction(projectId);
  if (dbMsgs.length === 0) return { messages: [], hasMessages: false };

  const messages: ChatMessage[] = dbMsgs.map((m) => ({
    id: m.id,
    role: m.role,
    sender_type: m.sender_type,
    content: m.content,
    timestamp: new Date(m.created_at),
  }));

  return { messages, hasMessages: true };
}

// ---- Project history --------------------------------------------------------

export async function fetchProjectHistory(): Promise<Project[]> {
  return getProjectsAction();
}

// ---- Persist messages -------------------------------------------------------

export async function persistMessage(
  projectId: string,
  msg: ChatMessage
): Promise<void> {
  const row: Message = {
    id: msg.id,
    project_id: projectId,
    role: msg.role,
    sender_type: msg.sender_type,
    content: msg.content,
    created_at: new Date().toISOString(),
  };
  await saveMessagesAction(projectId, [row]);
}
ENDOFFILE

done_ "project.service.ts"


# =============================================================
# STEP 6 — features/workspace/hooks/useProject.ts
# =============================================================
log "Writing useProject.ts..."

cat > features/workspace/hooks/useProject.ts << 'ENDOFFILE'
// ===========================================
// Agent OS — useProject Hook
// ===========================================
// Manages project history, loading, and the
// active project context. Connects to project.service.ts.

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Project, ChatMessage } from "@/types";
import type { WorkspacePhase } from "@/types/workspace";
import {
  fetchProjectHistory,
  loadProjectMessages,
} from "../services/project.service";

export interface UseProjectReturn {
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  pastProjects: Project[];
  setPastProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  isLoadingHistory: boolean;
  loadProjectContext: (
    id: string,
    initialIdea: string,
    setPhase: (p: WorkspacePhase) => void,
    setMessages: (m: ChatMessage[]) => void,
    setRawIdea: (s: string) => void,
    resetPipeline: () => void
  ) => Promise<void>;
}

export function useProject(): UseProjectReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("id");

  const [projectId, setProjectId] = useState<string | null>(null);
  const [pastProjects, setPastProjects] = useState<Project[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    async function init() {
      setIsLoadingHistory(true);
      const projects = await fetchProjectHistory();
      setPastProjects(projects);

      const targetId =
        queryProjectId ?? localStorage.getItem("agent_os_current_project");

      if (targetId) {
        const found = projects.find((p) => p.id === targetId);
        if (found) setProjectId(found.id);
      }

      setIsLoadingHistory(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryProjectId]);

  const loadProjectContext = async (
    id: string,
    initialIdea: string,
    setPhase: (p: WorkspacePhase) => void,
    setMessages: (m: ChatMessage[]) => void,
    setRawIdea: (s: string) => void,
    resetPipeline: () => void
  ) => {
    setProjectId(id);
    localStorage.setItem("agent_os_current_project", id);
    router.replace(`/?id=${id}`, { scroll: false });

    const { messages, hasMessages } = await loadProjectMessages(id);

    if (hasMessages) {
      setMessages(messages);
      setPhase("chatting");
    } else {
      setMessages([]);
      setRawIdea(initialIdea);
      setPhase("idea");
    }

    resetPipeline();
  };

  return {
    projectId,
    setProjectId,
    pastProjects,
    setPastProjects,
    isLoadingHistory,
    loadProjectContext,
  };
}
ENDOFFILE

done_ "useProject.ts"


# =============================================================
# STEP 7 — features/workspace/hooks/useWorkspace.ts
# =============================================================
log "Writing useWorkspace.ts..."

cat > features/workspace/hooks/useWorkspace.ts << 'ENDOFFILE'
// ===========================================
// Agent OS — useWorkspace Hook
// ===========================================
// Central state coordinator for the workspace.
// Orchestrates chat, pipeline, and project flows.
// No JSX. No direct fetch() calls (delegates to services).

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@/types";
import type { WorkspacePhase, AgentStatus } from "@/types/workspace";
import { DEFAULT_AGENT_STATUSES } from "@/types/workspace";
import type { PipelineResult } from "@/agents/orchestrator";
import { formatFinalPrompt } from "@/utils/format-prompt";
import {
  saveAgentOutputAction,
  saveFinalPromptAction,
} from "@/actions/db";
import { sendChatMessage, shouldTriggerPipeline } from "../services/chat.service";
import { runPipelineRequest } from "../services/pipeline.service";
import { createProject, persistMessage } from "../services/project.service";

export interface UseWorkspaceReturn {
  // State
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  phase: WorkspacePhase;
  setPhase: (p: WorkspacePhase) => void;
  rawIdea: string;
  setRawIdea: (s: string) => void;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  inputValue: string;
  setInputValue: (s: string) => void;
  isAiTyping: boolean;
  pipelineResult: PipelineResult | null;
  finalMarkdown: string;
  copied: boolean;
  agentStatuses: AgentStatus[];
  activeTab: "brief" | "prompt";
  setActiveTab: (t: "brief" | "prompt") => void;
  // Actions
  handleStartProject: () => Promise<void>;
  handleSendChat: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleGenerateNow: () => void;
  handleRegenerate: () => void;
  handleRetryPipeline: () => void;
  handleCopy: () => Promise<void>;
  handleExport: () => void;
  handleNewProject: () => void;
  resetPipeline: () => void;
}

export function useWorkspace(
  projectId: string | null,
  setProjectId: (id: string | null) => void
): UseWorkspaceReturn {
  const router = useRouter();
  const { toast } = useToast();

  const [phase, setPhase] = useState<WorkspacePhase>("idea");
  const [rawIdea, setRawIdea] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [finalMarkdown, setFinalMarkdown] = useState("");
  const [copied, setCopied] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>(
    DEFAULT_AGENT_STATUSES.map((a) => ({ ...a }))
  );
  const [activeTab, setActiveTab] = useState<"brief" | "prompt">("brief");

  // ── Helpers ──────────────────────────────────────────────

  const updateAgentStatus = useCallback(
    (index: number, status: AgentStatus["status"]) => {
      setAgentStatuses((prev) =>
        prev.map((a, i) => (i === index ? { ...a, status } : a))
      );
    },
    []
  );

  const resetPipeline = useCallback(() => {
    setPipelineResult(null);
    setFinalMarkdown("");
    setAgentStatuses(DEFAULT_AGENT_STATUSES.map((a) => ({ ...a })));
  }, []);

  // ── Pipeline ─────────────────────────────────────────────

  const runPipeline = useCallback(
    async (chatMessages: ChatMessage[], activeProjectId?: string | null) => {
      setPhase("processing");

      try {
        const result = await runPipelineRequest(chatMessages, updateAgentStatus);

        setPipelineResult(result);
        setAgentStatuses((prev) => prev.map((a) => ({ ...a, status: "done" })));

        const md = formatFinalPrompt(result.finalPrompt);
        setFinalMarkdown(md);

        const pid = activeProjectId ?? projectId;
        if (pid) {
          saveAgentOutputAction(pid, "requirement_analyst", result.requirements);
          saveAgentOutputAction(pid, "product_strategist", result.strategy);
          saveAgentOutputAction(pid, "technical_architect", result.architecture);
          saveFinalPromptAction(pid, md);
        }

        setPhase("done");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        console.error("Pipeline error:", err);
        toast({ variant: "destructive", title: "Pipeline failed", description: message });
        setPhase("error");
        setAgentStatuses(DEFAULT_AGENT_STATUSES.map((a) => ({ ...a })));
      }
    },
    [projectId, toast, updateAgentStatus]
  );

  // ── Chat ─────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (
      content: string,
      existingMessages?: ChatMessage[],
      currentProjectId?: string | null
    ) => {
      const activeProjectId = currentProjectId ?? projectId;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        sender_type: "user",
        content,
        timestamp: new Date(),
      };

      const allMsgs = [...(existingMessages ?? messages), userMsg];
      setMessages(allMsgs);
      setInputValue("");
      setIsAiTyping(true);

      if (activeProjectId) {
        await persistMessage(activeProjectId, userMsg);
      }

      try {
        const { content: aiContent } = await sendChatMessage(allMsgs);

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          sender_type: "orchestrator",
          content: aiContent,
          timestamp: new Date(),
        };

        const updatedMsgs = [...allMsgs, aiMsg];
        setMessages(updatedMsgs);

        if (activeProjectId) {
          await persistMessage(activeProjectId, aiMsg);
        }

        if (shouldTriggerPipeline(aiContent)) {
          setTimeout(() => runPipeline(updatedMsgs, activeProjectId), 1500);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reach the AI.";
        console.error("Chat error:", err);
        toast({ variant: "destructive", title: "Message failed", description: message });

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            sender_type: "orchestrator",
            content: "Something went wrong. Please try sending your message again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsAiTyping(false);
      }
    },
    [messages, projectId, runPipeline, toast]
  );

  // ── Handlers ─────────────────────────────────────────────

  const handleStartProject = useCallback(async () => {
    if (!rawIdea.trim()) return;
    const result = await createProject(rawIdea);
    if (!result) return;

    const { project, newId } = result;
    setProjectId(newId);
    setPhase("chatting");
    router.replace(`/?id=${newId}`, { scroll: false });
    sendMessage(rawIdea, [], newId);

    return project;
  }, [rawIdea, setProjectId, router, sendMessage]);

  const handleSendChat = useCallback(() => {
    if (!inputValue.trim() || isAiTyping) return;
    sendMessage(inputValue);
  }, [inputValue, isAiTyping, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (phase === "idea") handleStartProject();
        else handleSendChat();
      }
    },
    [phase, handleStartProject, handleSendChat]
  );

  const handleGenerateNow = useCallback(() => {
    if (messages.length < 2) return;
    runPipeline(messages);
  }, [messages, runPipeline]);

  const handleRegenerate = useCallback(() => {
    resetPipeline();
    runPipeline(messages);
  }, [messages, resetPipeline, runPipeline]);

  const handleRetryPipeline = useCallback(() => {
    setAgentStatuses(DEFAULT_AGENT_STATUSES.map((a) => ({ ...a })));
    runPipeline(messages);
  }, [messages, runPipeline]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(finalMarkdown);
    setCopied(true);
    toast({ title: "Copied!", description: "Prompt copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  }, [finalMarkdown, toast]);

  const handleExport = useCallback(() => {
    const blob = new Blob([finalMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${
      pipelineResult?.finalPrompt.product_name
        ?.replace(/\s+/g, "-")
        .toLowerCase() ?? "project"
    }-prompt.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [finalMarkdown, pipelineResult]);

  const handleNewProject = useCallback(() => {
    localStorage.removeItem("agent_os_current_project");
    router.replace("/", { scroll: false });
    setProjectId(null);
    setPhase("idea");
    setRawIdea("");
    setMessages([]);
    setInputValue("");
    resetPipeline();
    setActiveTab("brief");
  }, [router, setProjectId, resetPipeline]);

  return {
    projectId,
    setProjectId,
    phase,
    setPhase,
    rawIdea,
    setRawIdea,
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isAiTyping,
    pipelineResult,
    finalMarkdown,
    copied,
    agentStatuses,
    activeTab,
    setActiveTab,
    handleStartProject,
    handleSendChat,
    handleKeyDown,
    handleGenerateNow,
    handleRegenerate,
    handleRetryPipeline,
    handleCopy,
    handleExport,
    handleNewProject,
    resetPipeline,
  };
}
ENDOFFILE

done_ "useWorkspace.ts"


# =============================================================
# STEP 8 — features/workspace/components/Header.tsx
# =============================================================
log "Writing Header.tsx..."

cat > features/workspace/components/Header.tsx << 'ENDOFFILE'
// ===========================================
// Agent OS — Header Component
// ===========================================
import { BrainCircuit, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { WorkspacePhase } from "@/types/workspace";

const PHASE_LABELS: Record<WorkspacePhase, string> = {
  idea: "New Project",
  chatting: "Gathering Requirements",
  processing: "Agents Processing...",
  done: "Prompt Ready",
  error: "Pipeline Error",
};

interface HeaderProps {
  phase: WorkspacePhase;
  onNewProject: () => void;
}

export function Header({ phase, onNewProject }: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-13 px-4 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="size-7 rounded-md bg-primary flex items-center justify-center">
            <BrainCircuit className="size-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Agent OS</span>
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm text-muted-foreground">{PHASE_LABELS[phase]}</span>
      </div>
      {phase !== "idea" && (
        <Button variant="ghost" size="sm" onClick={onNewProject}>
          <Plus className="size-3.5 mr-1.5" />
          New
        </Button>
      )}
    </header>
  );
}
ENDOFFILE

done_ "Header.tsx"


# =============================================================
# STEP 9 — features/workspace/components/Sidebar.tsx
# =============================================================
log "Writing Sidebar.tsx..."

cat > features/workspace/components/Sidebar.tsx << 'ENDOFFILE'
// ===========================================
// Agent OS — Sidebar Component
// ===========================================
import { Loader2, CheckCircle2, Sparkles, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Project } from "@/types";
import type { AgentStatus, WorkspacePhase } from "@/types/workspace";

interface SidebarProps {
  phase: WorkspacePhase;
  projectId: string | null;
  pastProjects: Project[];
  agentStatuses: AgentStatus[];
  messageCount: number;
  onNewProject: () => void;
  onSelectProject: (id: string, idea: string) => void;
  onGenerateNow: () => void;
  onRetryPipeline: () => void;
}

export function Sidebar({
  phase,
  projectId,
  pastProjects,
  agentStatuses,
  messageCount,
  onNewProject,
  onSelectProject,
  onGenerateNow,
  onRetryPipeline,
}: SidebarProps) {
  return (
    <aside className="w-56 border-r border-border/50 p-3 hidden lg:flex flex-col gap-3 bg-sidebar/50">
      <Button
        variant="outline"
        size="sm"
        className="justify-start text-xs"
        onClick={onNewProject}
      >
        <Plus className="size-3 mr-1.5" />
        New Project
      </Button>

      <div className="pt-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-2 mb-2">
          My Projects
        </h3>
        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
          {pastProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectProject(p.id, p.idea_raw)}
              className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors truncate ${
                projectId === p.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-2 mb-2">
          Agent Status
        </p>
        {agentStatuses.map((agent) => (
          <div
            key={agent.name}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
          >
            {agent.status === "pending" && (
              <div className="size-2 rounded-full bg-muted-foreground/30" />
            )}
            {agent.status === "running" && (
              <Loader2 className="size-3 text-primary animate-spin" />
            )}
            {agent.status === "done" && (
              <CheckCircle2 className="size-3 text-green-500" />
            )}
            <span
              className={
                agent.status === "done" ? "text-foreground" : "text-muted-foreground"
              }
            >
              {agent.name}
            </span>
          </div>
        ))}
      </div>

      {phase === "chatting" && messageCount >= 4 && (
        <>
          <Separator />
          <Button
            size="sm"
            variant="secondary"
            className="text-xs"
            onClick={onGenerateNow}
          >
            <Sparkles className="size-3 mr-1.5" />
            Generate Now
          </Button>
        </>
      )}

      {phase === "error" && (
        <>
          <Separator />
          <Button
            size="sm"
            variant="destructive"
            className="text-xs"
            onClick={onRetryPipeline}
          >
            <RotateCcw className="size-3 mr-1.5" />
            Retry Pipeline
          </Button>
        </>
      )}
    </aside>
  );
}
ENDOFFILE

done_ "Sidebar.tsx"


# =============================================================
# STEP 10 — features/workspace/components/IdeaInput.tsx
# =============================================================
log "Writing IdeaInput.tsx..."

cat > features/workspace/components/IdeaInput.tsx << 'ENDOFFILE'
// ===========================================
// Agent OS — IdeaInput Component  (Phase 1)
// ===========================================
import { useRef } from "react";
import { Sparkles, Send, Loader2, Folder } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types";

interface IdeaInputProps {
  rawIdea: string;
  onIdeaChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  pastProjects: Project[];
  isLoadingHistory: boolean;
  onSelectProject: (id: string, idea: string) => void;
}

export function IdeaInput({
  rawIdea,
  onIdeaChange,
  onSubmit,
  onKeyDown,
  pastProjects,
  isLoadingHistory,
  onSelectProject,
}: IdeaInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex-1 flex flex-col lg:flex-row">
      {/* Recent projects sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border/50 flex-col bg-sidebar/30">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Projects
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {isLoadingHistory ? (
            <div className="p-4 flex justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : pastProjects.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No projects yet.
            </div>
          ) : (
            pastProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id, p.idea_raw)}
                className="w-full text-left px-3 py-2 text-sm rounded-md transition-colors hover:bg-muted text-foreground/80 hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Folder className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{p.title}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Idea input */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background/50">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 mb-2">
              <Sparkles className="size-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">What do you want to build?</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Describe your idea in plain language. Our AI agents will help you
              refine it into a structured, build-ready prompt.
            </p>
          </div>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={rawIdea}
              onChange={(e) => onIdeaChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g., I want to build a habit tracking app where users can set daily goals..."
              className="min-h-[140px] resize-none text-base p-4 pr-14 rounded-xl border-border/80 focus:border-primary/50 bg-card"
              autoFocus
            />
            <Button
              onClick={onSubmit}
              disabled={!rawIdea.trim()}
              size="icon"
              className="absolute right-3 bottom-3 size-9 rounded-lg"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Press Enter to start • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
ENDOFFILE

done_ "IdeaInput.tsx"


# =============================================================
# STEP 11 — features/workspace/components/ChatPanel.tsx
# =============================================================
log "Writing ChatPanel.tsx..."

cat > features/workspace/components/ChatPanel.tsx << 'ENDOFFILE'
// ===========================================
// Agent OS — ChatPanel Component
// ===========================================
import { useRef, useEffect } from "react";
import {
  Bot, User, Loader2, AlertCircle, RotateCcw, Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/types";
import type { WorkspacePhase } from "@/types/workspace";

interface ChatPanelProps {
  messages: ChatMessage[];
  isAiTyping: boolean;
  phase: WorkspacePhase;
  inputValue: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onRetry: () => void;
}

export function ChatPanel({
  messages,
  isAiTyping,
  phase,
  inputValue,
  onInputChange,
  onKeyDown,
  onSend,
  onRetry,
}: ChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background/50">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 animate-fade-in-up ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="size-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/60"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="markdown-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "user" && (
              <div className="size-7 rounded-md bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <User className="size-3.5 text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isAiTyping && (
          <div className="flex gap-3 animate-fade-in-up">
            <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="size-3.5 text-primary" />
            </div>
            <div className="bg-card border border-border/60 rounded-xl px-4 py-3">
              <div className="flex gap-1.5">
                <div className="size-2 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
                <div className="size-2 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
                <div className="size-2 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex items-center justify-center py-8 animate-fade-in-up">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border/60">
              <Loader2 className="size-6 text-primary animate-spin" />
              <p className="text-sm font-medium">Agents are analyzing your requirements...</p>
              <p className="text-xs text-muted-foreground">This may take 10–20 seconds</p>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex items-center justify-center py-8 animate-fade-in-up">
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-destructive/40">
              <AlertCircle className="size-6 text-destructive" />
              <p className="text-sm font-medium">Pipeline failed</p>
              <p className="text-xs text-muted-foreground text-center max-w-[240px]">
                Your conversation is safe — you can retry.
              </p>
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcw className="size-3 mr-1.5" />
                Retry Pipeline
              </Button>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {phase === "chatting" && (
        <div className="p-4 border-t border-border/50 bg-card/30">
          <div className="relative max-w-3xl mx-auto">
            <Textarea
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your response..."
              className="min-h-[52px] max-h-[120px] resize-none pr-12 rounded-xl border-border/80 bg-card text-sm"
              disabled={isAiTyping}
            />
            <Button
              onClick={onSend}
              disabled={!inputValue.trim() || isAiTyping}
              size="icon"
              className="absolute right-2 bottom-2 size-8 rounded-lg"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
ENDOFFILE

done_ "ChatPanel.tsx"


# =============================================================
# STEP 12 — features/workspace/components/BriefPanel.tsx
# =============================================================
log "Writing BriefPanel.tsx..."

cat > features/workspace/components/BriefPanel.tsx << 'ENDOFFILE'
// ===========================================
// Agent OS — BriefPanel Component (Right Panel)
// ===========================================
import {
  Copy, Download, RotateCcw, CheckCircle2, FileText, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import type { PipelineResult } from "@/agents/orchestrator";
import type { WorkspacePhase } from "@/types/workspace";

// ── Section helper ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Brief content ───────────────────────────────────────────

function BriefContent({ result }: { result: PipelineResult }) {
  const { requirements, strategy, architecture, finalPrompt } = result;
  return (
    <div className="space-y-5 text-sm">
      <div>
        <h2 className="text-lg font-bold">{finalPrompt.product_name}</h2>
        <p className="text-muted-foreground mt-1">{finalPrompt.concept}</p>
      </div>
      <Separator />
      <Section title="Problem Statement">
        <p className="text-muted-foreground">{requirements.problem_statement}</p>
      </Section>
      <Section title="Goals">
        <div className="flex flex-wrap gap-1.5">
          {requirements.goals.map((g) => (
            <Badge key={g} variant="secondary" className="text-xs font-normal">
              {g}
            </Badge>
          ))}
        </div>
      </Section>
      <Section title="MVP Features">
        <div className="space-y-1.5">
          {strategy.feature_priorities.map((f) => (
            <div key={f.feature} className="flex items-center gap-2">
              <Badge
                variant={f.priority === "must" ? "default" : "secondary"}
                className="text-[10px] uppercase w-12 justify-center"
              >
                {f.priority}
              </Badge>
              <span className="text-muted-foreground">{f.feature}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Suggested Stack">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(architecture.suggested_stack).map(([key, val]) => (
            <div key={key} className="rounded-lg bg-muted/50 p-2">
              <p className="text-[10px] uppercase font-medium text-muted-foreground">{key}</p>
              <p className="text-xs font-medium mt-0.5">{val}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────

interface BriefPanelProps {
  phase: WorkspacePhase;
  pipelineResult: PipelineResult | null;
  finalMarkdown: string;
  activeTab: "brief" | "prompt";
  copied: boolean;
  onTabChange: (tab: "brief" | "prompt") => void;
  onCopy: () => void;
  onExport: () => void;
  onRegenerate: () => void;
}

export function BriefPanel({
  phase,
  pipelineResult,
  finalMarkdown,
  activeTab,
  copied,
  onTabChange,
  onCopy,
  onExport,
  onRegenerate,
}: BriefPanelProps) {
  const isDone = phase === "done" && pipelineResult;

  return (
    <aside className="w-[420px] border-l border-border/50 hidden xl:flex flex-col bg-card/30">
      {isDone ? (
        <>
          {/* Tabs */}
          <div className="flex items-center border-b border-border/50 px-1">
            {(["brief", "prompt"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={`flex-1 py-3 text-xs font-medium text-center transition-colors ${
                  activeTab === tab
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "brief" ? "Structured Brief" : "Final Prompt"}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {activeTab === "brief" ? (
              <BriefContent result={pipelineResult} />
            ) : (
              <div className="markdown-content text-sm">
                <ReactMarkdown>{finalMarkdown}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-border/50 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onCopy}>
              {copied ? (
                <CheckCircle2 className="size-3 mr-1.5 text-green-500" />
              ) : (
                <Copy className="size-3 mr-1.5" />
              )}
              {copied ? "Copied!" : "Copy Prompt"}
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onExport}>
              <Download className="size-3 mr-1.5" /> Export .md
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={onRegenerate}>
              <RotateCcw className="size-3 mr-1.5" /> Redo
            </Button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="size-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
              {phase === "error" ? (
                <AlertCircle className="size-5 text-destructive" />
              ) : (
                <FileText className="size-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-medium">
              {phase === "processing" && "Generating your brief..."}
              {phase === "error" && "Pipeline failed"}
              {phase === "chatting" && "Your structured brief will appear here"}
            </p>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              {phase === "processing" && "Agents are analyzing your conversation."}
              {phase === "error" && "Check the chat area and retry the pipeline."}
              {phase === "chatting" &&
                "Keep chatting. Once enough info is gathered the agents will process everything, or hit Generate Now."}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
ENDOFFILE

done_ "BriefPanel.tsx"


# =============================================================
# STEP 13 — Rewrite app/page.tsx as the thin shell
# =============================================================
log "Rewriting app/page.tsx as thin shell..."

cat > app/page.tsx << 'ENDOFFILE'
// ===========================================
// Agent OS — Main Workspace Page (thin shell)
// ===========================================
// This file only composes components.
// All state lives in useWorkspace + useProject.
// All API calls live in features/workspace/services/.

"use client";

import { Suspense } from "react";
import { useProject } from "@/features/workspace/hooks/useProject";
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace";
import { Header } from "@/features/workspace/components/Header";
import { Sidebar } from "@/features/workspace/components/Sidebar";
import { IdeaInput } from "@/features/workspace/components/IdeaInput";
import { ChatPanel } from "@/features/workspace/components/ChatPanel";
import { BriefPanel } from "@/features/workspace/components/BriefPanel";

function WorkspaceInner() {
  const {
    projectId,
    setProjectId,
    pastProjects,
    setPastProjects,
    isLoadingHistory,
    loadProjectContext,
  } = useProject();

  const ws = useWorkspace(projectId, setProjectId);

  const handleSelectProject = (id: string, idea: string) => {
    loadProjectContext(
      id,
      idea,
      ws.setPhase,
      ws.setMessages,
      ws.setRawIdea,
      ws.resetPipeline
    );
  };

  const isActivePhase =
    ws.phase === "chatting" ||
    ws.phase === "processing" ||
    ws.phase === "done" ||
    ws.phase === "error";

  return (
    <div className="h-screen flex flex-col">
      <Header phase={ws.phase} onNewProject={ws.handleNewProject} />

      <div className="flex-1 flex overflow-hidden">
        {ws.phase === "idea" && (
          <IdeaInput
            rawIdea={ws.rawIdea}
            onIdeaChange={ws.setRawIdea}
            onSubmit={ws.handleStartProject}
            onKeyDown={ws.handleKeyDown}
            pastProjects={pastProjects}
            isLoadingHistory={isLoadingHistory}
            onSelectProject={handleSelectProject}
          />
        )}

        {isActivePhase && (
          <>
            <Sidebar
              phase={ws.phase}
              projectId={projectId}
              pastProjects={pastProjects}
              agentStatuses={ws.agentStatuses}
              messageCount={ws.messages.length}
              onNewProject={ws.handleNewProject}
              onSelectProject={handleSelectProject}
              onGenerateNow={ws.handleGenerateNow}
              onRetryPipeline={ws.handleRetryPipeline}
            />
            <ChatPanel
              messages={ws.messages}
              isAiTyping={ws.isAiTyping}
              phase={ws.phase}
              inputValue={ws.inputValue}
              onInputChange={ws.setInputValue}
              onKeyDown={ws.handleKeyDown}
              onSend={ws.handleSendChat}
              onRetry={ws.handleRetryPipeline}
            />
            <BriefPanel
              phase={ws.phase}
              pipelineResult={ws.pipelineResult}
              finalMarkdown={ws.finalMarkdown}
              activeTab={ws.activeTab}
              copied={ws.copied}
              onTabChange={ws.setActiveTab}
              onCopy={ws.handleCopy}
              onExport={ws.handleExport}
              onRegenerate={ws.handleRegenerate}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceInner />
    </Suspense>
  );
}
ENDOFFILE

done_ "app/page.tsx"


# =============================================================
# STEP 14 — Delete the duplicate workspace page
# =============================================================
log "Removing duplicate app/workspace/page.tsx..."

if [ -f "app/workspace/page.tsx" ]; then
  rm app/workspace/page.tsx
  # Remove the directory if it's now empty
  rmdir app/workspace 2>/dev/null || true
  done_ "app/workspace/page.tsx deleted"
else
  warn "app/workspace/page.tsx not found — skipping"
fi


# =============================================================
# STEP 15 — Add WorkspacePhase export to types/index.ts
#            (small sed patch — re-export from workspace.ts)
# =============================================================
log "Patching types/index.ts to re-export workspace types..."

# Only patch if the re-export isn't already there
if ! grep -q "workspace" types/index.ts; then
  # Append re-export at end of file
  echo "" >> types/index.ts
  echo "// Re-export workspace UI types" >> types/index.ts
  echo 'export type { WorkspacePhase, AgentStatus } from "./workspace";' >> types/index.ts
  done_ "types/index.ts patched"
else
  warn "types/index.ts already has workspace re-export — skipping"
fi


# =============================================================
# STEP 16 — tsconfig path alias for features/
# =============================================================
log "Checking tsconfig.json for @/features alias..."

if ! grep -q '"@/features/\*"' tsconfig.json; then
  # Use python (available everywhere) to insert the alias cleanly
  python3 - << 'PYEOF'
import json, sys

with open("tsconfig.json", "r") as f:
    config = json.load(f)

paths = config.setdefault("compilerOptions", {}).setdefault("paths", {})
if "@/features/*" not in paths:
    paths["@/features/*"] = ["./features/*"]
    with open("tsconfig.json", "w") as f:
        json.dump(config, f, indent=2)
    print("  tsconfig.json updated with @/features/* alias")
else:
    print("  @/features/* alias already present")
PYEOF
  done_ "tsconfig.json"
else
  warn "@/features/* already in tsconfig.json — skipping"
fi


# =============================================================
# DONE
# =============================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN} Refactor complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "New files created:"
echo "  types/workspace.ts"
echo "  features/workspace/services/chat.service.ts"
echo "  features/workspace/services/pipeline.service.ts"
echo "  features/workspace/services/project.service.ts"
echo "  features/workspace/hooks/useProject.ts"
echo "  features/workspace/hooks/useWorkspace.ts"
echo "  features/workspace/components/Header.tsx"
echo "  features/workspace/components/Sidebar.tsx"
echo "  features/workspace/components/IdeaInput.tsx"
echo "  features/workspace/components/ChatPanel.tsx"
echo "  features/workspace/components/BriefPanel.tsx"
echo ""
echo "Modified:"
echo "  app/page.tsx          (rewritten as ~50-line shell)"
echo "  types/index.ts        (re-export added)"
echo "  tsconfig.json         (@/features/* alias added)"
echo ""
echo "Deleted:"
echo "  app/workspace/page.tsx"
echo ""
echo "Unchanged (safe):"
echo "  agents/  lib/  actions/  utils/  components/ui/"
echo ""
echo -e "${CYAN}Next step:${NC} run 'npm run dev' and verify the app loads correctly."
