// ===========================================
// Agent OS — Pipeline API Route
// ===========================================
// POST /api/pipeline — Run the full multi-agent pipeline

import { NextRequest, NextResponse } from "next/server";
import { runFullPipeline } from "@/agents/orchestrator";
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

    const result = await runFullPipeline(messages);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/pipeline] Error:", error);
    return NextResponse.json(
      { error: "Failed to run agent pipeline" },
      { status: 500 }
    );
  }
}
