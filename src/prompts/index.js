import { getSystemPrompt } from "./system.js";
import { GOAL_SINGLE } from "./goalSingle.js";
import { GOAL_WG } from "./goalWG.js";
import { GOAL_COMMERCIAL } from "./goalCommercial.js";

const GOAL_MAP = {
  single: GOAL_SINGLE,
  wg: GOAL_WG,
  commercial: GOAL_COMMERCIAL
};

export function buildPrompt({ listing, profile, goalType, language = "de" }) {
  const goalPart = GOAL_MAP[goalType] || GOAL_MAP.single;
  const langInstruction =
    language === "en"
      ? "Write the final message in clear, polite English."
      : "Schreibe die finale Nachricht klar und höflich auf Deutsch.";

  // Return separate system and user messages
  return {
    system: getSystemPrompt(language),
    user: `
TENANT PROFILE:
${profile}

GOAL:
${goalPart}

LISTING:
${JSON.stringify(listing, null, 2)}

TASK:
${langInstruction}
Write a concise message (6–10 lines). No meta commentary. Respond with the message only.
    `.trim()
  };
}
