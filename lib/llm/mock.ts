'TYPESCRIPT'
// =============================================================================
// Agent OS — Mock LLM Provider
// =============================================================================
// Used when FORCE_MOCK_MODE=true or no API keys are set.
// Returns realistic per-agent mock data so the UI is fully exercisable.

import type { LLMMessage, LLMProvider, LLMResponse } from "./index";

// Realistic per-agent latencies (ms) — matches real provider behaviour
const MOCK_LATENCY: Record<string, number> = {
  requirement_analyst: 800,
  product_strategist: 3000,
  technical_architect: 2000,
  prompt_engineer: 2500,
  feedback_integrator: 600,
  default: 800,
};

function detectAgent(messages: LLMMessage[]): string {
  const sys = messages[0]?.content ?? "";
  if (sys.includes("Requirement Analyst") || sys.includes("Detective")) return "requirement_analyst";
  if (sys.includes("Product Strategist") || sys.includes("Visionary")) return "product_strategist";
  if (sys.includes("Technical Architect") || sys.includes("Systems Engineer")) return "technical_architect";
  if (sys.includes("Prompt Engineer") || sys.includes("Storyteller")) return "prompt_engineer";
  if (sys.includes("Feedback Integrator") || sys.includes("feedback")) return "feedback_integrator";
  if (sys.includes("Orchestrator") || sys.includes("requirement counselor")) return "orchestrator";
  return "default";
}

const MOCK_OUTPUTS: Record<string, unknown> = {
  requirement_analyst: {
    problem_statement: "Young students and professionals lack a simple, mobile-friendly tool to track both personal and group expenses, leading to financial disorganisation.",
    goals: ["Simple personal expense tracking", "Group expense creation and splitting", "Category-based analytics", "Email-based group invitations"],
    constraints: ["Mobile-only (Flutter)", "1-week MVP timeline", "No payment integrations in v1"],
    missing_details: ["Notification preferences", "Multi-currency support needed?"],
    confidence: 85,
    warnings: [],
  },
  product_strategist: {
    target_users: ["University students aged 18-25", "Young professionals in first job", "Friend groups who travel together"],
    mvp_scope: ["User auth (email + Google)", "Add personal expense with category", "Create group and invite via email", "View monthly spending summary"],
    feature_priorities: [
      { feature: "Personal expense tracking", priority: "must" },
      { feature: "Group expense management", priority: "must" },
      { feature: "Email invitations", priority: "must" },
      { feature: "Category analytics", priority: "should" },
      { feature: "Dark mode", priority: "nice" },
    ],
    user_flow: ["Sign up → Add first expense → Create group → Invite friends → Log shared expense → View analytics"],
    confidence: 80,
    warnings: ["No payment integration scoped — users will manually track who owes what"],
  },
  technical_architect: {
    suggested_stack: {
      frontend: "Flutter (Dart) with Riverpod state management",
      backend: "Firebase (Auth + Realtime Database + Cloud Functions)",
      database: "SQLite (local) + Firebase Realtime Database (cloud sync)",
      auth: "Firebase Authentication (email/password + Google Sign-In)",
      hosting: "Google Play Store + Apple App Store",
    },
    system_modules: ["Auth module", "Expense CRUD module", "Group management module", "Analytics module", "Sync engine"],
    integrations: ["Firebase Auth", "Firebase Realtime Database", "Firebase Cloud Functions"],
    data_model_overview: [
      "users (id, email, name, profile_picture_url, created_at)",
      "expenses (id, user_id, category, amount, date, description, is_group)",
      "groups (id, name, creator_id, created_at)",
      "group_members (id, group_id, user_id, joined_at)",
      "group_expenses (id, group_id, expense_id, contributor_id, amount_owed)",
    ],
    confidence: 85,
    warnings: [],
  },
  prompt_engineer: {
    product_name: "SplitPocket",
    concept: "A mobile-first expense tracker that makes personal and group finance effortless for students and young professionals.",
    problem_statement: "Young users lack a simple, beautiful tool to track personal spending and split group expenses without complexity or clutter.",
    target_users: ["University students", "Young professionals", "Friend travel groups"],
    mvp_goal: "Build a Flutter app with Firebase backend enabling personal expense tracking, group creation, email invites, and basic analytics.",
    features: ["Personal expense tracking with 6 predefined categories", "Group creation and email-based invitations", "Manual group expense splitting", "Monthly spending analytics", "Firebase auth (email + Google)"],
    core_flows: ["Sign up → Add expense → Create group → Invite via email → Log group expense → View analytics"],
    suggested_stack: { frontend: "Flutter", backend: "Firebase", database: "SQLite + Firebase", auth: "Firebase Auth" },
    pages_and_components: ["Login/Signup", "Home Dashboard", "Add Expense Form", "Group Management", "Expense Splitting", "Analytics Dashboard", "Profile/Settings"],
    data_model: ["users", "expenses", "categories", "groups", "group_members", "group_expenses"],
    constraints: ["Mobile-only Flutter app", "1-week MVP", "No payment integration", "No dark mode in MVP"],
    future_enhancements: ["Push notifications", "UPI/PayPal splitting", "Dark mode", "Multi-currency", "CSV export"],
    build_instruction: "Build a Flutter mobile app called SplitPocket with Firebase backend. Implement email/Google auth, personal expense tracking with 6 predefined categories, group creation with email invites, manual expense splitting, and a basic analytics dashboard. Use SQLite for offline storage and Firebase Realtime Database for sync.",
    confidence: 88,
    warnings: [],
  },
  feedback_integrator: {
    restartFrom: "product_strategist",
    reason: "User feedback relates to product scope and user targeting — requires strategy re-run.",
    injectedContext: "User wants to add budget reminder notifications as a must-have for MVP.",
    confidence: 90,
    warnings: [],
  },
};

export class MockProvider implements LLMProvider {
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const agent = detectAgent(messages);
    const latency = MOCK_LATENCY[agent] ?? MOCK_LATENCY.default;
    await new Promise((r) => setTimeout(r, latency));

    if (agent === "orchestrator") {
      return {
        content: "Thanks for sharing that! A few follow-up questions:\n\n1. **Who is the primary user?** (students, professionals, teams?)\n2. **Do you need user accounts** to sync across devices, or is offline-only fine?\n\nTake your time — the more detail you share, the better the final build prompt.",
        provider: "mock",
      };
    }

    return {
      content: JSON.stringify(MOCK_OUTPUTS[agent] ?? MOCK_OUTPUTS.prompt_engineer),
      provider: "mock",
    };
  }

  async chatJSON<T>(messages: LLMMessage[]): Promise<T> {
    const agent = detectAgent(messages);
    const latency = MOCK_LATENCY[agent] ?? MOCK_LATENCY.default;
    await new Promise((r) => setTimeout(r, latency));
    return (MOCK_OUTPUTS[agent] ?? MOCK_OUTPUTS.prompt_engineer) as T;
  }
}