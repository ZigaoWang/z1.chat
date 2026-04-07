import { Skill } from "../types";

export const writing: Skill = {
  id: "writing",
  name: "Writing",
  triggers: {
    keywords: [
      "essay",
      "blog post",
      "article",
      "email",
      "letter",
      "story",
      "creative writing",
      "copywriting",
      "draft",
      "write a",
      "rewrite",
      "proofread",
      "edit this",
      "tone",
      "paragraph",
      "headline",
      "tagline",
      "slogan",
      "caption",
      "resume",
      "cover letter",
      "speech",
      "pitch",
      "proposal",
    ],
    patterns: [
      /\b(write|draft|compose|craft)\b.*\b(essay|post|article|email|letter|story|speech|pitch|proposal|memo)\b/i,
      /\b(rewrite|rephrase|paraphrase|improve)\b.*\b(this|the|my)\b/i,
    ],
  },
  prompt: `## Skill: Writing

When writing or editing text, follow these principles:

**Opening & Hook**
- Start with something concrete: a scene, a surprising fact, a bold claim, or a question that creates tension.
- Never open with a dictionary definition, a rhetorical question cliche, or "In today's world...".
- The first sentence should make the reader want the second sentence.

**Structure & Flow**
- Each paragraph should have a clear job. If you can't summarize its purpose in one phrase, it's doing too much.
- Use transitions that create momentum, not just connection. "But", "So", "Here's the thing" move the reader forward.
- Vary paragraph length. Short paragraphs create emphasis. Longer ones develop nuance.

**Voice & Style**
- Match the tone to the context. A casual blog post and a business proposal need different registers.
- Use active voice by default. Passive voice is fine when the action matters more than the actor.
- Be concrete and specific. "Revenue grew 40% in Q3" beats "Revenue grew significantly".
- Cut ruthlessly. If a word doesn't earn its place, remove it. Adverbs and filler phrases are usually the first to go.

**Rhythm & Impact**
- Vary sentence length deliberately. Long sentences build momentum. Short ones punch.
- End sections and paragraphs on strong notes — the last position gets the most emphasis.
- Read it aloud (mentally). If you stumble, the reader will too.`,
  priority: 4,
};
