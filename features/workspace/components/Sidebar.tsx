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
