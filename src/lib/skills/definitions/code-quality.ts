import { Skill } from "../types";

export const codeQuality: Skill = {
  id: "code-quality",
  name: "Code Quality",
  triggers: {
    keywords: [
      "function",
      "implement",
      "code",
      "script",
      "program",
      "algorithm",
      "refactor",
      "optimize",
      "debug",
      "fix the bug",
      "API endpoint",
      "class",
      "module",
      "library",
      "package",
      "backend",
      "server",
      "database",
      "query",
      "migration",
      "TypeScript",
      "JavaScript",
      "Python",
      "SQL",
    ],
    patterns: [
      /\b(write|create|build|implement|make)\b.*\b(function|class|module|script|program|endpoint|api|service|handler)\b/i,
      /\b(refactor|optimize|improve|clean up)\b.*\b(code|function|class|module)\b/i,
    ],
  },
  prompt: `## Skill: Code Quality

When writing or reviewing code, follow these principles:

**Naming & Clarity**
- Names should reveal intent. A reader should understand what a variable holds or what a function does without reading the implementation.
- Functions should do one thing well. If you need "and" to describe what it does, split it.
- Avoid abbreviations unless they're universally understood in the domain.

**Structure**
- Keep functions short and focused. Extract helpers when a block of code has a clear, nameable purpose.
- Prefer early returns over deep nesting. Guard clauses first, happy path last.
- Group related code together. A reader should be able to understand a module by reading top-to-bottom.

**Robustness**
- Handle edge cases: empty inputs, null/undefined, boundary values, concurrent access.
- Validate at system boundaries (user input, API responses, file I/O). Trust internal code.
- Use types to make invalid states unrepresentable. Prefer unions over booleans.

**Simplicity**
- Don't abstract prematurely. Three similar lines of code is fine — wait for the pattern to emerge.
- Prefer standard library and well-known patterns over clever tricks.
- Every line of code is a liability. The best code is code you didn't have to write.`,
  priority: 3,
};
