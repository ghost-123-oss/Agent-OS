'TYPESCRIPT'
// =============================================================================
// Agent OS — Pipeline API Route
// =============================================================================
// POST /api/pipeline — Run the full or partial multi-agent pipeline

import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline, runPipelineWithFeedback } from "@/agents/orchestrator";
import type { PipelineResult } from "@/agents/orchestrator";
import { logger, generateTraceId } from "@/lib/logger";
import type { ChatMessage, AgentName } from "@/types";

export async function POST(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") ?? generateTraceId();
  logger.info("Pipeline route called", undefined, traceId);

  try {
    const body = await req.json();
    const {
      messages,
      projectId,
      // Phase 3: feedback re-run params
      feedback,
      previousResult,
      restartFrom,
    } = body as {
      messages: ChatMessage[];
      projectId?: string;
      feedback?: string;
      previousResult?: PipelineResult;
      restartFrom?: AgentName;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    if (messages.length > 50) {
      return NextResponse.json({ error: "Too many messages — maximum 50 allowed" }, { status: 400 });
    }

    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 50_000) {
      return NextResponse.json({ error: "Conversation context too large — please start a new project" }, { status: 400 });
    }

    let result: PipelineResult;

    if (feedback && previousResult) {
      // Phase 3: partial re-run with user feedback
      logger.info("Pipeline: feedback re-run mode", { feedback: feedback.slice(0, 100) }, traceId);
      result = await runPipelineWithFeedback(messages, projectId ?? "unknown", feedback, previousResult, traceId);
    } else {
      // Normal full pipeline run (potentially with manual restart point)
      result = await runFullPipeline(messages, projectId ?? "unknown", traceId, { restartFrom });
    }

    logger.info("Pipeline route completed", undefined, traceId);
    return NextResponse.json(result, { headers: { "x-trace-id": traceId } });
  } catch (error) {
    logger.error(
      "Pipeline route error",
      { error: error instanceof Error ? error.message : String(error) },
      traceId
    );
    return NextResponse.json({ error: "Failed to run agent pipeline" }, { status: 500 });
  }
}