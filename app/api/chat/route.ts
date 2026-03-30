// ===========================================
// Agent OS — Chat API Route
// ===========================================
// POST /api/chat — Send a message, get orchestrator response

import { NextRequest, NextResponse } from "next/server";
import { getOrchestratorResponse } from "@/agents/orchestrator";
import { logger, generateTraceId } from "@/lib/logger";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") ?? generateTraceId();

  logger.info("Chat route called", undefined, traceId);

  try {
    const body = await req.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      logger.warn("Chat route: invalid request body", undefined, traceId);
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    // FIX: Guard against oversized requests
    if (messages.length > 50) {
      logger.warn("Chat route: too many messages", { count: messages.length }, traceId);
      return NextResponse.json(
        { error: "Too many messages — maximum 50 allowed" },
        { status: 400 }
      );
    }

    const response = await getOrchestratorResponse(messages, traceId);

    logger.info("Chat route completed successfully", undefined, traceId);

    return NextResponse.json(
      { content: response },
      { headers: { "x-trace-id": traceId } }
    );
  } catch (error) {
    logger.error(
      "Chat route unhandled error",
      { error: error instanceof Error ? error.message : String(error) },
      traceId
    );
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}