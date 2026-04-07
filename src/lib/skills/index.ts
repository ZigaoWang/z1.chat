import { Skill } from "./types";
import { MAX_SKILLS_PER_MESSAGE } from "../constants";
import { frontendDesign } from "./definitions/frontend-design";
import { codeQuality } from "./definitions/code-quality";
import { writing } from "./definitions/writing";
import { analysis } from "./definitions/analysis";
import { explanation } from "./definitions/explanation";

export const ALL_SKILLS: Skill[] = [
  frontendDesign,
  codeQuality,
  writing,
  analysis,
  explanation,
];

/**
 * Detect which skills match a user message based on keyword and pattern triggers.
 * Returns matched skills sorted by priority, capped at MAX_SKILLS_PER_MESSAGE.
 */
export function detectSkills(userMessage: string): Skill[] {
  if (!userMessage || userMessage.trim().length === 0) return [];

  const messageLower = userMessage.toLowerCase();
  const matched: Skill[] = [];

  for (const skill of ALL_SKILLS) {
    let triggered = false;

    // Check keyword triggers (case-insensitive word boundary match)
    for (const keyword of skill.triggers.keywords) {
      if (messageLower.includes(keyword.toLowerCase())) {
        triggered = true;
        break;
      }
    }

    // Check regex pattern triggers
    if (!triggered && skill.triggers.patterns) {
      for (const pattern of skill.triggers.patterns) {
        if (pattern.test(userMessage)) {
          triggered = true;
          break;
        }
      }
    }

    if (triggered) {
      matched.push(skill);
    }
  }

  // Sort by priority (lower number = higher priority), cap at limit
  return matched
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_SKILLS_PER_MESSAGE);
}

/**
 * Format matched skills into a system prompt section.
 */
export function getSkillPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const sections = skills.map((s) => s.prompt).join("\n\n");
  return `\n\n${sections}`;
}
