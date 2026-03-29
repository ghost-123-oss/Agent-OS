// ===========================================
// Agent OS — Chat API Route
// ===========================================
// POST /api/chat — Send a message, get orchestrator response

import { NextRequest, NextResponse } from "next/server";
import { getOrchestratorResponse } from "@/agents/orchestrator";
import type { ChatMessage } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const response = await getOrchestratorResponse(messages);

    return NextResponse.json({ content: response });
  } catch (error) {
    console.error("[/api/chat] Error:", error);
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}
