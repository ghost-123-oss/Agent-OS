// =============================================================================
// Agent OS — Mock LLM Provider (Development Fallback)
// =============================================================================
// Returns plausible placeholder responses when no API keys are configured.
// PHASE 2: No change needed here — MockProvider is returned by
// getProviderForAgent() when isMockMode() is true, so this file is used
// regardless of which provider would normally be selected.

import type { LLMMessage, LLMProvider, LLMResponse } from "./index";

export class MockProvider implements LLMProvider {
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));

    const lastMsg = messages[messages.length - 1]?.content ?? "";

    let content: string;
    if (lastMsg.length < 30) {
      content =
        "That's a great start! Can you tell me more about what problem this solves and who would use it?";
    } else {
      content = [
        "Thanks for sharing that! A few follow-up questions:",
        "",
        "1. **Who is the primary user** of this product?",
        "2. **What's the core problem** it solves?",
        "3. **Do you need user authentication?**",
        "4. **Any preferred tech stack?**",
        "",
        "I have enough information now. Let me process this and generate your structured brief and build prompt!",
      ].join("\n");
    }

    return { content, provider: "mock" };
  }

  async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

    const systemPrompt = messages[0]?.content ?? "";

    // ── Requirement Analyst ───────────────────────────────────────────────
    if (systemPrompt.includes("Requirement Analyst") || systemPrompt.includes("requirement")) {
      return {
        problem_statement:
          "Users need a simple, AI-powered way to organize daily tasks with smart prioritization.",
        goals: [
          "Simple task creation and management",
          "AI-based priority suggestions",
          "Daily summary view",
        ],
        constraints: ["Must work on mobile", "Fast load times required"],
        missing_details: ["Monetization model unclear", "Offline support not discussed"],
        // PHASE 3: confidence + warnings fields
        confidence: 78,
        warnings: ["Target age group not specified"],
      } as T;
    }

    // ── Product Strategist (Gemini in prod) ──────────────────────────────
    if (systemPrompt.includes("Product Strategist") || systemPrompt.includes("product")) {
      return {
        target_users: ["Busy professionals", "Students", "Freelancers"],
        mvp_scope: ["Task CRUD", "Priority tagging", "Daily digest view", "Basic auth"],
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
        // PHASE 3
        confidence: 82,
        warnings: [],
      } as T;
    }

    // ── Technical Architect (Groq in prod) ───────────────────────────────
    if (systemPrompt.includes("Technical Architect") || systemPrompt.includes("architect")) {
      return {
        suggested_stack: {
          frontend: "Next.js + Tailwind CSS",
          backend: "Next.js API Routes",
          database: "Supabase (PostgreSQL)",
          auth: "Supabase Auth",
          ai: "Mistral API",
          hosting: "Vercel",
        },
        system_modules: [
          "Auth module",
          "Task CRUD module",
          "AI priority engine",
          "Dashboard/summary module",
        ],
        integrations: ["Supabase", "Mistral AI API"],
        data_model_overview: [
          "users (id, email, name, created_at)",
          "tasks (id, user_id, title, description, priority, status, due_date)",
        ],
        // PHASE 3
        confidence: 85,
        warnings: [],
      } as T;
    }

    // ── Feedback Integrator (Phase 3, Groq in prod) ──────────────────────
    if (systemPrompt.includes("Feedback Integrator") || systemPrompt.includes("feedback")) {
      return {
        analysisOfFeedback: "User wants more focus on mobile-first design",
        restartFrom: "technical_architect",
        injectedContext: "Prioritize mobile-responsive components and PWA support",
        confidence: 90,
        warnings: [],
      } as T;
    }

    // ── Prompt Engineer (default) ────────────────────────────────────────
    return {
      product_name: "TaskFlow AI",
      concept: "AI-powered task management for busy people",
      problem_statement:
        "People struggle to prioritize tasks effectively, leading to missed deadlines.",
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
        "Build a Next.js app with Supabase auth and PostgreSQL. Implement task CRUD with AI-powered priority suggestions using the Mistral API. Deploy to Vercel.",
      // PHASE 3
      confidence: 88,
      warnings: [],
    } as T;
  }
}