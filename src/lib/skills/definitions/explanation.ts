import { Skill } from "../types";

export const explanation: Skill = {
  id: "explanation",
  name: "Explanation",
  triggers: {
    keywords: [
      "explain",
      "how does",
      "what is",
      "teach me",
      "help me understand",
      "ELI5",
      "walk me through",
      "tutorial",
      "guide",
      "introduction to",
      "basics of",
      "fundamentals",
      "concept",
      "how to",
      "why does",
      "what are",
      "definition of",
      "overview of",
    ],
    patterns: [
      /\b(explain|describe|teach)\b.*\b(how|what|why|when)\b/i,
      /\bhow\s+(does|do|is|are|can|could|would|should)\b/i,
      /\bwhat\s+(is|are|does|do)\b.*\b\?\s*$/i,
      /\bwhy\s+(does|do|is|are|can|would|should)\b/i,
    ],
  },
  prompt: `## Skill: Explanation

When explaining concepts or teaching, follow these principles:

**Start with Motivation**
- Before explaining HOW something works, explain WHY it exists. What problem does it solve? What was the world like before it?
- Connect to something the reader already knows. "You know how X works? This is similar, but for Y."
- Give the punchline first. State the key insight upfront, then unpack it.

**Progressive Complexity**
- Start simple, add nuance. First explain the 80% case, then edge cases and exceptions.
- Use concrete examples before abstract definitions. Show, then tell.
- Layer the explanation: intuition → mechanism → details → exceptions.

**Analogies & Mental Models**
- Use analogies that illuminate, not just decorate. A good analogy makes the reader go "oh, THAT's what it's doing."
- Be honest about where analogies break down. "This is like X, except for Y" prevents misconceptions.
- Provide mental models the reader can reason with independently, not just facts to memorize.

**Clarity Checks**
- Anticipate misconceptions and address them explicitly. "You might think X — but actually Y, because Z."
- After a complex point, briefly restate it differently. Two angles of explanation catch more people.
- Use concrete numbers and specific examples. "A 200ms delay" is clearer than "a small delay."`,
  priority: 6,
};
