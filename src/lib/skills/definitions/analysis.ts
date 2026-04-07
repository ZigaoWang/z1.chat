import { Skill } from "../types";

export const analysis: Skill = {
  id: "analysis",
  name: "Analysis",
  triggers: {
    keywords: [
      "analyze",
      "compare",
      "evaluate",
      "pros and cons",
      "trade-offs",
      "research",
      "review",
      "assess",
      "breakdown",
      "advantages",
      "disadvantages",
      "which is better",
      "should I use",
      "differences between",
      "benchmarks",
      "performance comparison",
      "cost analysis",
    ],
    patterns: [
      /\b(compare|evaluate|analyze|assess)\b.*\b(vs\.?|versus|and|or|between)\b/i,
      /\bpros\s+(and|&)\s+cons\b/i,
      /\bwhich\b.*\b(better|best|should|recommend)\b/i,
      /\btrade[- ]?offs?\b/i,
    ],
  },
  prompt: `## Skill: Analysis

When analyzing, comparing, or evaluating options, follow these principles:

**Framing**
- Start by clarifying what's actually being decided and what criteria matter most. A framework prevents rambling.
- State your assumptions explicitly. "This assumes a team of 3 engineers" or "This is for a B2B SaaS context."
- Define the evaluation dimensions upfront: cost, speed, scalability, developer experience, risk, etc.

**Multiple Perspectives**
- Steel-man each option. Present every alternative at its strongest before critiquing.
- Consider who benefits and who loses from each choice. Stakeholder perspectives reveal hidden trade-offs.
- Acknowledge uncertainty. "We don't know X yet, which could change the calculus" is more useful than false confidence.

**Evidence & Reasoning**
- Ground claims in evidence: benchmarks, case studies, documentation, industry data. Not vibes.
- Distinguish between facts, expert consensus, and personal opinion. Label each.
- Quantify when possible. "2x slower" is more useful than "slower." "Adds ~4 hours/week of maintenance" beats "more maintenance."

**Actionable Conclusions**
- Don't just list pros and cons — synthesize. "Given your constraints (X, Y), Option A is the stronger choice because..."
- Recommend a specific path forward. Hedging on everything helps no one.
- Identify what would change your recommendation. "If budget weren't a constraint, I'd pick B instead."`,
  priority: 5,
};
