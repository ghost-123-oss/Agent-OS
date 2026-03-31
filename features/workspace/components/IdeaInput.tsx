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
