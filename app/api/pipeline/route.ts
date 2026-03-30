// ===========================================
// Agent OS — Pipeline API Route
// ===========================================
// POST /api/pipeline — Run the full multi-agent pipeline

import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/agents/orchestrator";
import { logger, generateTraceId } from "@/lib/logger";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  // FIX: Generate traceId at the route boundary so every log line
  // downstream (all 4 agents) can be correlated back to this request.
  const traceId = req.headers.get("x-trace-id") ?? generateTraceId();

  logger.info("Pipeline route called", undefined, traceId);

  try {
    const body = await req.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      logger.warn("Pipeline route: invalid request body", undefined, traceId);
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    // FIX: Input validation to prevent unbounded LLM cost and context overload.
    // 50 messages × ~500 chars = ~25k chars sent to 4 agents = ~100k chars total.
    if (messages.length > 50) {
      logger.warn("Pipeline route: too many messages", { count: messages.length }, traceId);
      return NextResponse.json(
        { error: "Too many messages — maximum 50 allowed" },
        { status: 400 }
      );
    }

    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 50_000) {
      logger.warn("Pipeline route: context too large", { totalChars }, traceId);
      return NextResponse.json(
        { error: "Conversation context too large — please start a new project" },
        { status: 400 }
      );
    }

    const result = await runFullPipeline(messages, traceId);

    logger.info("Pipeline route completed successfully", undefined, traceId);

    // Return traceId in response header so the client can reference it
    return NextResponse.json(result, {
      headers: { "x-trace-id": traceId },
    });
  } catch (error) {
    logger.error(
      "Pipeline route unhandled error",
      { error: error instanceof Error ? error.message : String(error) },
      traceId
    );
    return NextResponse.json(
      { error: "Failed to run agent pipeline" },
      { status: 500 }
    );
  }
}