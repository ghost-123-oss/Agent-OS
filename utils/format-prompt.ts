// ===========================================
// Agent OS — Prompt Formatter
// ===========================================
// Converts FinalPromptData into a polished Markdown string.

import type { FinalPromptData } from "@/types";

export function formatFinalPrompt(data: FinalPromptData): string {
  const stackLines = Object.entries(data.suggested_stack)
    .map(([key, val]) => `- **${capitalize(key)}:** ${val}`)
    .join("\n");

  const featuresLines = data.features.map((f) => `- ${f}`).join("\n");
  const flowLines = data.core_flows.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const pagesLines = data.pages_and_components.map((p) => `- ${p}`).join("\n");
  const dataLines = data.data_model.map((d) => `- ${d}`).join("\n");
  const constraintLines = data.constraints.map((c) => `- ${c}`).join("\n");
  const futureLines = data.future_enhancements.map((f) => `- ${f}`).join("\n");
  const userLines = data.target_users.map((u) => `- ${u}`).join("\n");

  return `# ${data.product_name}

> ${data.concept}

---

## Problem Statement
${data.problem_statement}

## Target Users
${userLines}

## MVP Goal
${data.mvp_goal}

## Core Features
${featuresLines}

## Core User Flow
${flowLines}

## Suggested Tech Stack
${stackLines}

## Pages & Components
${pagesLines}

## Data Model
${dataLines}

## Constraints
${constraintLines}

## Future Enhancements
${futureLines}

---

## Build Instruction

${data.build_instruction}
`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
