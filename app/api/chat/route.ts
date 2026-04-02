// ===========================================
// Agent OS — Chat API Route
// ===========================================
// POST /api/chat — Send a message, get orchestrator response

import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

import { getOrchestratorResponse } from "@/agents/orchestrator";
import { logger, generateTraceId } from "@/lib/logger";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  const traceId = req.headers.get("x-trace-id") ?? generateTraceId();
  const startTime = Date.now();

  logger.info("Chat route called", { 
    url: req.url,
    method: req.method,
    userAgent: req.headers.get("user-agent")
  }, traceId);

  try {
    const body = await req.json();
    const { messages } = body as { messages: ChatMessage[] };

    logger.info("Chat route: request body parsed", { messageCount: messages?.length }, traceId);

    if (!messages || !Array.isArray(messages)) {
      logger.warn("Chat route: invalid request body", { body: JSON.stringify(body).slice(0, 200) }, traceId);
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

    logger.info("Chat route: calling orchestrator", { messageCount: messages.length }, traceId);
    const response = await getOrchestratorResponse(messages, traceId);
    const duration = Date.now() - startTime;

    logger.info("Chat route completed successfully", { 
      responseLength: response.length,
      duration 
    }, traceId);

    return NextResponse.json(
      { content: response },
      { headers: { "x-trace-id": traceId } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      "Chat route unhandled error",
      { 
        error: error instanceof Error ? { 
          message: error.message, 
          stack: error.stack,
          name: error.name 
        } : String(error),
        duration
      },
      traceId
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get AI response" },
      { status: 500 }
    );
  }
}
