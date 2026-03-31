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
