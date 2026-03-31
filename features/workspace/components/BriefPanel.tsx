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
