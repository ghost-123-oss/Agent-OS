// ===========================================
// Agent OS — Chat Service
// ===========================================
// Handles all communication with /api/chat.

import type { ChatMessage } from "@/types";
import { logger } from "@/lib/logger";

export interface ChatServiceResult {
  content: string;
}

export async function sendChatMessage(
  messages: ChatMessage[]
): Promise<ChatServiceResult> {
  const startTime = Date.now();
  logger.info("Chat service: Sending request", { messageCount: messages.length });
  
  try {
    // Add timeout to prevent indefinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    logger.info("Chat service: Response received", { status: res.status, duration });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errorMessage = (errBody as { error?: string })?.error ?? `Chat failed (${res.status})`;
      logger.error("Chat service: API error", { status: res.status, error: errorMessage, duration });
      throw new Error(errorMessage);
    }

    const data = await res.json();
    logger.info("Chat service: Success", { contentLength: data.content?.length, duration });
    return { content: data.content as string };
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("Chat service: Request timed out", { duration });
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    logger.error("Chat service failed", { 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      duration 
    });
    throw error;
  }
}

// Basic input validation
export function validateChatInput(input: string): { valid: boolean; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false, error: "Message cannot be empty." };
  if (trimmed.length > 2000) return { valid: false, error: "Message is too long." };
  return { valid: true };
}
