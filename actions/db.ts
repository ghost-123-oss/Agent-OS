"use server";

// ===========================================
// Agent OS — Supabase Database Server Actions
// ===========================================

import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type {
  Project,
  Message,
  AgentName,
  FinalPrompt,
  RequirementAnalysis,
  ProductStrategy,
  TechnicalArchitecture,
} from "@/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// FIX: agent output type union replaces `any`
type AgentOutputJson = RequirementAnalysis | ProductStrategy | TechnicalArchitecture;

/**
 * Creates a new project in Supabase.
 */
export async function createProjectAction(
  title: string,
  idea_raw: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .insert([{ title, idea_raw }])
    .select()
    .single();

  if (error) {
    logger.error("createProjectAction failed", { message: error.message, code: error.code });
    return null;
  }

  return data as Project;
}

/**
 * Saves a batch of chat messages to Supabase.
 *
 * FIX: The previous version dropped the `id` field on insert, meaning
 * Supabase generated a new UUID that didn't match the one stored in
 * React state. This broke project reload (React key mismatches, duplicate
 * messages). Now the frontend-generated ID is explicitly included.
 */
export async function saveMessagesAction(
  projectId: string,
  messages: Message[]
): Promise<void> {
  const insertData = messages.map(m => ({
    id: m.id,              // FIX: preserve the ID from React state
    project_id: projectId,
    role: m.role,
    sender_type: m.sender_type,
    content: m.content,
  }));

  const { error } = await supabase.from("messages").insert(insertData);

  if (error) {
    logger.error("saveMessagesAction failed", {
      message: error.message,
      code: error.code,
      projectId,
    });
  }
}

/**
 * Saves structured agent output to Supabase.
 *
 * FIX: parameter was typed as `any` — now uses the AgentOutputJson union
 * and AgentName enum so callers get compile-time type checking.
 */
export async function saveAgentOutputAction(
  projectId: string,
  agent_name: AgentName,
  output_json: AgentOutputJson
): Promise<void> {
  const { error } = await supabase
    .from("agent_outputs")
    .insert([{ project_id: projectId, agent_name, output_json }]);

  if (error) {
    logger.error(`saveAgentOutputAction failed for ${agent_name}`, {
      message: error.message,
      code: error.code,
      projectId,
    });
  }
}

/**
 * Saves the final markdown prompt to Supabase.
 */
export async function saveFinalPromptAction(
  projectId: string,
  prompt_markdown: string
): Promise<FinalPrompt | null> {
  const { data, error } = await supabase
    .from("final_prompts")
    .insert([{ project_id: projectId, prompt_markdown, version: 1 }])
    .select()
    .single();

  if (error) {
    logger.error("saveFinalPromptAction failed", {
      message: error.message,
      code: error.code,
      projectId,
    });
    return null;
  }

  return data as FinalPrompt;
}

/**
 * Fetches all projects ordered by most recent.
 */
export async function getProjectsAction(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("getProjectsAction failed", { message: error.message, code: error.code });
    return [];
  }

  return data as Project[];
}

/**
 * Fetches all messages for a project, ordered chronologically.
 */
export async function getProjectMessagesAction(
  projectId: string
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("getProjectMessagesAction failed", {
      message: error.message,
      code: error.code,
      projectId,
    });
    return [];
  }

  return data as Message[];
}