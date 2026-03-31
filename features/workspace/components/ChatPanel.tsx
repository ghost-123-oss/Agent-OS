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
