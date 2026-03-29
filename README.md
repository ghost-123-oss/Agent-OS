# 🧠 Agent OS 

> **Turn Vague Ideas into Crystal-Clear, Build-Ready Prompts for Code AIs**

Agent OS is a specialized multi-agent AI requirement counselor designed for the age of agentic coding. It operates on a simple premise: **AI code generators (like Cursor, Cline, or Antigravity) are only as good as the instructions you give them.** 

Instead of generating buggy code from a vague one-liner, Agent OS acts as your technical co-founder. It systematically interviews you, extracts your actual requirements, and orchestrates a backend pipeline of 4 specialized AI agents to generate a flawless, structured Markdown build prompt.

---

## 🛑 The Problem Statement 
The barrier to building software has plummeted thanks to AI code generators. However, a new bottleneck has emerged: **Non-technical builders do not know how to write comprehensive system prompts.**

When users feed tools like Cursor a basic idea ("I want a period tracking app"), the AI naturally hallucinates product decisions, guesses the tech stack arbitrarily, and fails to plan an MVP scope, leading to sprawling, unmaintainable codebases. 

## 💡 What We Provide (The Solution)
Agent OS solves this by being a **pre-computation layer for your ideas**. 

We provide a sleek, 3-panel workspace where a conversational **Orchestrator Agent** casually chats with you to extract your goals. Once it has enough context, it silently triggers a backstage "Software Studio" comprised of specialized agents:

1. **Requirement Analyst:** Distills the exact problem statement and goals.
2. **Product Strategist:** Scopes the MVP, defines target users, and prioritizes features (Must/Should/Nice).
3. **Technical Architect:** Selects the optimal tech stack and structures the data model.
4. **Prompt Engineer:** Synthesizes everything into a highly structured, strict Markdown prompt.

## 🚀 Why This is Different
**We do NOT generate code.** We generate the *blueprints*. 

Most AI coding platforms try to do everything from idea to deployment, resulting in a fragile "black box" where you have no idea what was actually built. Agent OS is different because it focuses 100% on **Requirement Engineering**. By decoupling the planning phase from the coding phase, we give founders total control and visibility over their product *before* a single line of code is written.

---

## 🛠️ Current Tech Stack (MVP)
- **Frontend Framework:** Next.js 16 (App Router), React 19
- **Styling & UI:** Tailwind CSS v4, shadcn/ui, Lucide Icons
- **Language:** TypeScript
- **Database & State:** Supabase (PostgreSQL) + Server Actions
- **AI Intelligence Layer:** Provider-agnostic design (currently utilizing **Mistral AI 7B / OpenAI**) with a robust local Mock fallback for offline testing.

---

## ⚡ Getting Started (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/agent.os.git
cd agent.os
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root of the project by copying the example file:
```bash
cp .env.example .env.local
```
Fill in the following variables:
```env
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
MISTRAL_API_KEY="your-mistral-api-key"
```

### 3. Database Setup
1. Go to your Supabase project dashboard.
2. Open the **SQL Editor**.
3. Copy the contents of `/supabase/schema.sql` and run it. This provisions the necessary tables (`projects`, `messages`, `agent_outputs`, `final_prompts`) and enables Anonymous Guest Mode for rapid hackathon testing.

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

---

## 🗺️ Roadmap & Current Status
- [x] **Phase 1-2:** Core Architecture & Next.js setup
- [x] **Phase 3:** Supabase Schema & Server Action wiring
- [x] **Phase 5:** Complex 3-Panel Workspace UI Implementation
- [x] **Phase 6-7:** Multi-Agent Pipeline & Conversational Orchestrator Engine
- [x] **Phase 8-9:** Structured JSON parsing & Final Markdown Generator
- [x] **Phase 10:** Persistent Session History and Workspace Hydration
- [ ] **Phase 4:** Formal User Authentication (Supabase Auth)
- [ ] **Phase 12:** Mobile Responsive Polish & Error Handling Toast Notifications
