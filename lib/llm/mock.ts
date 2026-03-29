// ===========================================
// Agent OS — Mock LLM Provider (Fallback)
// ===========================================
// Used when no API key is configured.
// Returns plausible placeholder responses so the UI remains functional.

import { LLMMessage, LLMProvider, LLMResponse } from "./index";

export class MockProvider implements LLMProvider {
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));

    const lastMsg = messages[messages.length - 1]?.content ?? "";

    // Provide context-aware mock responses
    let content: string;

    if (lastMsg.length < 30) {
      content =
        "That's a great start! Can you tell me a bit more about what problem this solves and who would use it?";
    } else {
      content = [
        "Thanks for sharing that! Let me ask a few follow-up questions to better understand your vision:",
        "",
        "1. **Who is the primary user** of this product? (e.g., students, businesses, creators)",
        "2. **What's the core problem** it solves for them?",
        "3. **Do you need user authentication** (login/signup)?",
        "4. **Any preferred tech stack**, or should I suggest one based on your needs?",
        "",
        "Take your time — the more detail you give, the better the final build prompt will be.",
      ].join("\n");
    }

    return { content, provider: "mock" };
  }

  async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

    // Check system prompt to determine which agent is calling
    const systemPrompt = messages[0]?.content ?? "";

    if (systemPrompt.includes("requirement")) {
      return {
        problem_statement:
          "A platform to help users organize and track their daily tasks with AI-powered prioritization.",
        goals: [
          "Simple task creation",
          "AI-based priority suggestions",
          "Daily summary view",
        ],
        constraints: ["Must work on mobile", "Must be fast to load"],
        missing_details: [
          "Target user age group",
          "Monetization model",
          "Offline support needed?",
        ],
      } as T;
    }

    if (systemPrompt.includes("product") || systemPrompt.includes("strategist")) {
      return {
        target_users: ["Busy professionals", "Students", "Freelancers"],
        mvp_scope: [
          "Task CRUD",
          "Priority tagging",
          "Daily digest view",
          "Basic auth",
        ],
        feature_priorities: [
          { feature: "Task creation & management", priority: "must" },
          { feature: "AI priority suggestions", priority: "must" },
          { feature: "Daily summary", priority: "should" },
          { feature: "Team sharing", priority: "nice" },
        ],
        user_flow: [
          "User signs up",
          "Creates first task",
          "AI suggests priority",
          "Views daily summary",
        ],
      } as T;
    }

    if (systemPrompt.includes("architect") || systemPrompt.includes("technical")) {
      return {
        suggested_stack: {
          frontend: "Next.js + Tailwind CSS",
          backend: "Next.js API Routes",
          database: "Supabase (PostgreSQL)",
          auth: "Supabase Auth",
          ai: "Mistral API",
        },
        system_modules: [
          "Auth module",
          "Task CRUD module",
          "AI priority engine",
          "Dashboard/summary module",
        ],
        integrations: ["Supabase", "Mistral AI API"],
        data_model_overview: [
          "users (id, email, name)",
          "tasks (id, user_id, title, description, priority, status, due_date)",
        ],
      } as T;
    }

    // Default: prompt engineer
    return {
      product_name: "TaskFlow AI",
      concept: "AI-powered task management for busy people",
      problem_statement:
        "People struggle to prioritize tasks effectively, leading to missed deadlines and stress.",
      target_users: ["Busy professionals", "Students", "Freelancers"],
      mvp_goal: "A simple task manager with AI-powered priority suggestions",
      features: [
        "Task CRUD",
        "AI priority suggestions",
        "Daily summary view",
        "User authentication",
      ],
      core_flows: [
        "Sign up → Create task → Get AI priority → View daily summary",
      ],
      suggested_stack: {
        frontend: "Next.js + Tailwind CSS",
        backend: "Next.js API Routes",
        database: "Supabase",
      },
      pages_and_components: [
        "Landing page",
        "Auth pages",
        "Dashboard",
        "Task list",
        "Task detail",
      ],
      data_model: [
        "users (id, email, name, created_at)",
        "tasks (id, user_id, title, priority, status, due_date)",
      ],
      constraints: ["Mobile-friendly", "Fast load times"],
      future_enhancements: [
        "Team collaboration",
        "Calendar integration",
        "Voice input",
      ],
      build_instruction:
        "Build a Next.js app with Supabase auth and database. Implement task CRUD with AI-powered priority suggestions using Mistral API.",
    } as T;
  }
}
