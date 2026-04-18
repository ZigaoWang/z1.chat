# PROJECT STATUS — One

> Last updated: 2026-04-17

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2.2 |
| Runtime | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Database | PostgreSQL (local) | — |
| ORM | Drizzle ORM | ^0.45.2 |
| Auth | Custom (bcryptjs + JWE sessions via jose) | bcryptjs 3.0.3, jose 6.2.2 |
| AI Gateway | OpenRouter (@openrouter/ai-sdk-provider) | ^2.3.3 |
| AI SDK | Vercel AI SDK (ai + @ai-sdk/react) | ^6.0.146 |
| Styling | Tailwind CSS v4 + shadcn/ui v4 (Base UI) | ^4 / ^4.1.2 |
| Sandbox | E2B Code Interpreter | ^2.4.0 |
| Web Search | Tavily API | — |
| Icons | Lucide React | ^1.7.0 |
| Fonts | Geist Sans + Geist Mono (local woff2) | — |

### File Structure

```
src/
├── app/
│   ├── (auth)/login/         # Login page
│   ├── (auth)/signup/        # Signup page (unused — invite-only)
│   ├── (auth)/layout.tsx     # Auth pages layout
│   ├── admin/                # Admin dashboard
│   ├── invite/               # Invite redemption page
│   ├── settings/             # Settings page
│   ├── api/
│   │   ├── auth/             # login, signup, logout, me
│   │   ├── chat/             # Main streaming chat endpoint
│   │   ├── conversations/    # CRUD + messages sub-route
│   │   ├── models/           # Model list from OpenRouter
│   │   ├── upload/           # File upload + temp file serving
│   │   ├── settings/         # User preferences CRUD
│   │   ├── usage/            # Usage stats
│   │   ├── memories/         # Memory CRUD
│   │   ├── admin/            # Stats, users, invites (admin-only)
│   │   ├── invite/redeem/    # Invite token redemption
│   │   └── artifact-edit/    # (empty/unused directory)
│   ├── page.tsx              # Main chat page
│   ├── layout.tsx            # Root layout (fonts, providers)
│   ├── globals.css           # Theme variables, hljs overrides, scrollbar, animations
│   ├── error.tsx             # Error boundary
│   ├── not-found.tsx         # 404 page
│   └── loading.tsx           # Loading skeleton
├── components/
│   ├── chat/                 # ChatView, ChatMessages, MessageBubble, ChatInput,
│   │                         # ModelSelector, FileUpload, MarkdownRenderer, ArtifactPreview
│   ├── layout/               # Sidebar, ThemeToggle
│   ├── ui/                   # shadcn/ui primitives (badge, button, command, dialog, etc.)
│   └── providers.tsx         # ThemeProvider > TooltipProvider > AuthProvider > ConversationProvider
├── hooks/
│   ├── use-models.ts         # Model fetching + selection
│   ├── use-auth.tsx          # Auth context (user, signOut)
│   └── use-conversations.tsx # Conversation list, CRUD, search
├── lib/
│   ├── db/                   # Drizzle schema, migrations (5 migration files), db connection
│   ├── file-processor/       # File processing pipeline
│   │   ├── processors/       # image, pdf, document, spreadsheet, code, text, presentation
│   │   ├── index.ts          # Router by extension
│   │   └── types.ts          # FileType, ProcessedFile interfaces
│   ├── skills/               # Skill detection + prompt injection
│   │   ├── definitions/      # analysis, code-quality, explanation, frontend-design, writing
│   │   ├── index.ts          # detectSkills, getSkillPrompt
│   │   └── types.ts          # Skill interface
│   ├── auth.ts               # signUp, signIn, signOut, getCurrentUserId
│   ├── session.ts            # createSession, deleteSession
│   ├── session-crypto.ts     # JWE encrypt/decrypt
│   ├── dal.ts                # verifySession, getCurrentUser (React cache)
│   ├── openrouter.ts         # OpenRouter singleton + model constants
│   ├── models-cache.ts       # In-memory model cache (1hr TTL)
│   ├── system-prompt.ts      # Base prompt + dynamic composition
│   ├── tools.ts              # Tool definitions (search, fetch, sandbox)
│   ├── memory.ts             # 3-layer memory system
│   ├── context-manager.ts    # Conversation compaction
│   ├── cost-calculator.ts    # Per-token cost + markup
│   ├── usage-logger.ts       # Usage logging + tracked wrappers
│   ├── title-generator.ts    # AI title generation
│   └── constants.ts          # All app constants
├── fonts/                    # Geist Sans/Mono woff2 files
├── proxy.ts                  # Route protection (Next.js 16 proxy)
└── types/                    # (empty)
```

### Running Locally

```bash
# Prerequisites: Node.js 23+, PostgreSQL running locally
npm install
cp .env.local.example .env.local  # Fill in values
npm run db:push                    # Push schema to DB
npm run db:seed                    # Optional: seed dev data
npm run dev                        # Starts on http://localhost:3000
npm run build && npm start         # Production on port 4567
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (e.g. `postgres://user@localhost:5432/one`) |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key for all AI calls |
| `AUTH_SECRET` | Yes | — | 32+ char secret for JWE session encryption |
| `NEXT_PUBLIC_APP_NAME` | No | `"One"` | App name shown in UI |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | App URL for OpenRouter referer |
| `NEXT_PUBLIC_DEFAULT_MODEL` | No | `anthropic/claude-opus-4.6` | Default model for new chats |
| `TAVILY_API_KEY` | No | — | Enables web search tool |
| `E2B_API_KEY` | No | — | Enables code execution sandbox |
| `TITLE_MODEL` | No | `openai/gpt-5.4-nano` | Model for title generation |
| `MEMORY_MODEL` | No | `openai/gpt-5.4-mini` | Model for memory extraction + summarization |
| `CONTEXT_MODEL` | No | `openai/gpt-5.4-nano` | Model for context compaction |
| `DEV_BYPASS_AUTH` | No | — | Set `true` to skip auth in development |
| `MAX_CONTEXT_TOKENS` | No | `80000` | Token limit before compaction triggers |
| `COST_MARKUP` | No | `1.1` | Multiplier on raw cost for user billing (1.1 = 10%) |
| `SEARCH_COST_USD` | No | `0.008` | Flat cost per Tavily search |
| `CODE_EXEC_COST_USD` | No | `0.005` | Flat cost per sandbox tool call |

---

## 2. FEATURES

### Authentication — Working
- **Provider:** Custom email/password (bcryptjs hash, 12 rounds)
- **Sessions:** JWE-encrypted cookies (jose, A256GCM). 7-day expiry. DB-backed session table.
- **Registration:** Invite-only. `/api/auth/signup` returns 403. New users register via `/api/invite/redeem` with a token + credit amount.
- **Route protection:** `src/proxy.ts` checks session cookie on every request. Public paths: `/login`, `/invite`, `/api/auth/*`, `/api/invite/*`, `/api/models`.
- **Dev mode:** `DEV_BYPASS_AUTH=true` skips all auth with a hardcoded admin user.
- **OAuth:** Not implemented.
- **Password reset:** Schema exists (`passwordResetTokens` table) but no email service or reset flow is implemented.

### Chat — Working
- **Streaming:** `streamText()` via AI SDK → `toUIMessageStreamResponse()`. Token-by-token.
- **Model selection:** Any OpenRouter model. User picks from model selector (Cmd+K).
- **Conversation CRUD:** Create (lazy on first message), list (with search), rename (manual or AI), delete.
- **Message branching:** Edit creates a sibling branch. Regenerate creates a new assistant version. Navigation with chevron arrows.
- **Tool use:** Multi-step tool calls supported. `stepCountIs(10)` limit.
- **Max duration:** 120 seconds per request.

### Models — Working
- **Source:** OpenRouter `/api/v1/models` endpoint, cached in-memory for 1 hour.
- **UI:** Command palette (Cmd+K) grouped by provider. Recent models section. Shows pricing, Free badge, Vision badge.
- **Vision detection:** `architecture.input_modalities` checked for `"image"`.
- **Non-vision + image:** Blocked at send time with inline warning.

### Memory System — Working
- **Layer 1 — Conversation Summary:** Running summary updated every 3 assistant messages via LLM. Stored on conversation record.
- **Layer 2 — Durable Memories:** Extracted from every exchange. Categories: personal, preferences, projects, style, facts. LLM-powered deduplication (insert/update/merge/skip).
- **Layer 3 — Consolidation:** Runs every ~10 conversations. Decays stale memories, boosts frequent ones, merges redundant ones. Deletes memories below 0.15 relevance.
- **Immediate Memory:** Detects "remember this" patterns, extracts immediately without waiting for full extraction cycle.
- **Injection:** Top 15 memories by relevance, capped at ~400 tokens, injected into system prompt.
- **Management UI:** Settings page shows all memories grouped by category. Edit, delete individual, or clear all.

### Context Management — Working
- **Token estimation:** `chars / 4` heuristic.
- **Compaction trigger:** When total tokens exceed `MAX_CONTEXT_TOKENS` (default 80K).
- **Process:** Keeps 10 most recent messages. Summarizes older messages via LLM. Deletes old messages from DB. Summary stored as `compactionSummary` on conversation.
- **Injection:** Compaction summary injected into system prompt before conversation summary.

### Web Search — Working
- **Provider:** Tavily API (basic search depth, 5 results, includes answer).
- **Trigger:** AI model decides when to call `web_search` tool based on system prompt guidelines.
- **UI:** "Searching..." indicator during, collapsible "Sources" section after with favicons and links.
- **Cost:** Flat $0.008 per search.

### File Attachments — Working
- **Supported types:** All file types accepted. Processing pipeline handles: images (sharp), PDF (pdf-parse), documents (mammoth), spreadsheets (xlsx), presentations (jszip), code, data formats (JSON/YAML/XML), text, archives (message only).
- **HEIC/HEIF:** Converted to JPEG at upload time via `heic-convert`.
- **Image pipeline:** Converted to JPEG, resized to 1024px max for preview dataUrl, sent as visual file parts to vision models.
- **Non-image pipeline:** Text extracted and injected as `<attached_file>` tags in message content. Files also auto-uploaded to sandbox.
- **Non-vision models:** Image send blocked with inline warning. User must switch to a Vision-badged model.
- **Upload limits:** 50MB per file, 10 files per message, 200K chars total text.
- **Temp storage:** OS temp dir with UUID filenames. Auto-cleanup via setTimeout (1hr). Auth required for both upload and download.
- **Security:** Path traversal prevention (UUID pattern validation), XSS prevention (SVG/HTML forced to download), `nosniff` header.

### Code Execution / Sandbox — Working
- **Provider:** E2B Code Interpreter (cloud sandboxes).
- **Tools:** `code_execute` (Python/JS), `shell_exec` (any command), `file_upload` (temp dir → sandbox), `file_download` (sandbox → user, with image resize).
- **State:** Persistent within a single response (sandbox reused across tool calls). Killed in `onFinish`.
- **Auto-upload:** Attached files automatically uploaded to sandbox at `/home/user/<filename>` when sandbox is first created.
- **Image output:** matplotlib `plt.show()` captured as base64 PNG. `file_download` returns JPEG (resized to 800px max).
- **Safety:** stdout/stderr capped at 20K chars. Image base64 capped at 500KB. File download max 5MB. Path traversal validation on file_upload.
- **Cost:** Flat $0.005 per sandbox tool call.

### Artifacts — Working
- **Types:** HTML pages, SVG graphics.
- **Detection:** Auto-detected from fenced code blocks via `isArtifact()`.
- **Panel:** Desktop: resizable side-by-side split. Mobile: full-screen overlay. Slide-from-right animation.
- **Streaming:** Code tab shows real-time generation. Auto-switches to preview when done.
- **Features:** Preview/Code toggle, copy, open in new tab, refresh preview, Escape to close.
- **Sandbox:** iframe with `sandbox="allow-scripts allow-forms allow-popups allow-modals"`.

### Skills — Working
- **5 skills:** frontend-design, code-quality, writing, analysis, explanation.
- **Detection:** Keyword and regex pattern matching on user messages.
- **Injection:** Skill prompts appended to system prompt (max 3 per message).

### System Prompt — Working
See Section 5 for full details.

### Credits & Billing — Partially Working
- **Cost tracking:** All AI calls instrumented via `trackedGenerateText`/`trackedStreamText`. Search and sandbox at flat rates.
- **Usage logs:** `usage_logs` table with type, model, tokens, raw cost, user cost.
- **Markup:** Configurable via `COST_MARKUP` (default 1.1x = 10% margin).
- **Credit balance:** Stored on user record. Deducted atomically after each operation. Non-admin users blocked at 0 balance.
- **Admin:** Can view/edit user balances. Can create invite tokens with credit amounts.
- **Usage UI:** Settings page shows month cost, total cost, breakdown by type, recent activity.
- **Stripe:** Not implemented. `creditTransactions` table exists with `stripePaymentId` column but no Stripe integration.
- **Credit packs:** Defined in constants but no purchase flow.

### User Preferences — Working
- **Stored:** `preferences` JSONB column on users table.
- **Fields:** `theme` (light/dark/system), `defaultModel` (string | null), `responseStyle` (concise/balanced/detailed), `language` (string | null), `customInstructions` (string | null).
- **Effect on prompt:** Response style and language mapped to system prompt instructions. Custom instructions injected verbatim.

### Settings Page — Working
- **Sections:** Profile (name), Appearance (theme toggle), AI Preferences (response style, language, custom instructions), Memory (grouped list with edit/delete), Usage (stats + breakdown + recent activity), Credits (balance display).

### Dark Mode — Working
- Deep dark background (oklch 0.12), off-white text (oklch 0.92), subtle borders (8% white).
- Syntax highlighting theme for both modes. Thin dark scrollbars. Custom selection color.

### Mobile Responsiveness — Working
- Sidebar: auto-closes on mobile, hidden via translate. Resize handle hidden below `lg`.
- Artifact panel: full-screen overlay on mobile.
- Chat input: 44px touch targets.
- Admin tables: horizontal scroll.

### Keyboard Shortcuts — Working
- `Cmd+N`: New chat
- `Cmd+B`: Toggle sidebar
- `Cmd+K`: Model selector
- `/`: Focus chat input
- `Cmd+/`: Shortcuts help
- `Escape`: Close modals
- `Enter`: Send message
- `Shift+Enter`: New line
- `ArrowUp` (empty input): Edit last message (handler exists but is a no-op)

---

## 3. DATABASE SCHEMA

### Tables

**users**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default random |
| email | text | unique |
| name | text | |
| avatar_url | text | |
| password_hash | text | |
| role | text | default "user" |
| credit_balance | numeric(20,10) | default "0" |
| preferences | jsonb | UserPreferences |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**conversations**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, cascade delete |
| title | text | |
| model | text | |
| summary | text | Layer 1 summary |
| summary_message_count | integer | default 0 |
| compaction_summary | text | Compacted context |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Indexes: `user_id`, `updated_at`

**messages**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| conversation_id | uuid | FK → conversations, cascade |
| role | enum | system/user/assistant/tool |
| content | text | |
| model | text | |
| parent_id | uuid | For branching |
| branch_index | integer | default 0 |
| input_tokens | integer | |
| output_tokens | integer | |
| cost | numeric(20,10) | |
| metadata | jsonb | attachments, toolInvocations |
| created_at | timestamptz | |

Indexes: `conversation_id`, `created_at`, `parent_id`

**memories**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, cascade |
| category | enum | personal/preferences/projects/style/facts |
| content | text | |
| source_conversation_id | uuid | FK → conversations, set null |
| relevance_score | real | default 0.5 |
| access_count | integer | default 0 |
| last_accessed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Indexes: `user_id`, `category`

**sessions**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, cascade |
| expires_at | timestamptz | |
| created_at | timestamptz | |

Index: `user_id`

**usage_logs**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, cascade |
| conversation_id | uuid | FK → conversations, set null |
| type | text | chat/title/summary/memory_extraction/etc. |
| model | text | |
| input_tokens | integer | default 0 |
| output_tokens | integer | default 0 |
| cost_usd | numeric(20,10) | raw cost |
| user_cost_usd | numeric(20,10) | marked-up cost |
| created_at | timestamptz | |

Indexes: `user_id`, `created_at`, `type`

**credit_transactions**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, cascade |
| amount | numeric(20,10) | positive=credit, negative=debit |
| balance | numeric(20,10) | balance after transaction |
| type | text | purchase/usage/refund |
| description | text | |
| message_id | uuid | FK → messages, set null |
| stripe_payment_id | text | unused |
| created_at | timestamptz | |

Index: `user_id`

**password_reset_tokens**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, cascade |
| token_hash | text | unique |
| expires_at | timestamptz | |
| used | boolean | default false |
| created_at | timestamptz | |

Index: `user_id`

**invite_tokens**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| token | text | unique, 32 random bytes hex |
| credit_amount | numeric(20,10) | |
| used | boolean | default false |
| used_by_user_id | uuid | FK → users, set null |
| created_by | uuid | FK → users, cascade |
| expires_at | timestamptz | 7 days from creation |
| created_at | timestamptz | |

Index: `token`

**api_keys**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | unique, FK → users, cascade |
| encrypted_key | text | |
| is_active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Migrations
5 migration files in `src/lib/db/migrations/`:
- `0000_vengeful_toad_men.sql`
- `0001_even_marvel_boy.sql`
- `0002_purple_junta.sql`
- `0003_luxuriant_gamma_corps.sql`
- `0004_dear_tombstone.sql`

---

## 4. API ROUTES

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/auth/login` | POST | No | Email/password login |
| `/api/auth/signup` | POST | No | Returns 403 (invite-only) |
| `/api/auth/logout` | POST | Yes* | Deletes session |
| `/api/auth/me` | GET | Yes | Returns current user profile |
| `/api/chat` | POST | Yes | Main streaming chat endpoint |
| `/api/conversations` | GET | Yes | List conversations with search |
| `/api/conversations` | POST | Yes | Create conversation |
| `/api/conversations/[id]` | GET | Yes | Get single conversation |
| `/api/conversations/[id]` | PATCH | Yes | Rename or regenerate title |
| `/api/conversations/[id]` | DELETE | Yes | Delete conversation |
| `/api/conversations/[id]/messages` | GET | Yes | List all messages |
| `/api/models` | GET | No | List available AI models |
| `/api/upload` | POST | Yes | Upload file (multipart) |
| `/api/upload/temp/[filename]` | GET | Yes | Serve temp file |
| `/api/settings` | GET | Yes | Get user profile + preferences |
| `/api/settings` | PATCH | Yes | Update name/preferences |
| `/api/usage` | GET | Yes | Usage stats + breakdown |
| `/api/memories` | GET | Yes | List all memories |
| `/api/memories` | PATCH | Yes | Update memory content |
| `/api/memories` | DELETE | Yes | Delete memory or clear all |
| `/api/admin/stats` | GET | Admin | Platform-wide stats |
| `/api/admin/users` | GET | Admin | List all users + balances |
| `/api/admin/users/[id]` | PATCH | Admin | Update role/credits |
| `/api/admin/users/[id]/usage` | GET | Admin | User's recent usage |
| `/api/admin/invites` | POST | Admin | Create invite token |
| `/api/admin/invites` | GET | Admin | List invite tokens |
| `/api/invite/redeem` | POST | No | Redeem invite + create account |

---

## 5. SYSTEM PROMPT

### Composition Order
```
getBasePrompt()          // Personality, behavior, formatting, search/fetch/sandbox guidelines
+ getSkillPrompt()       // Conditional skill prompts based on message keywords
+ compactionSummary      // "[Earlier context summary: ...]"
+ conversationSummary    // "[Conversation context: ...]"
+ relevantMemories       // "[What you remember about this user: ...]"
+ userPreferences        // Response style, language, custom instructions
```

### Full Base Prompt (as of current code)

```
You are a warm, direct, and intelligent AI assistant. You help people think clearly and get things done.

Current date and time: {weekday}, {month} {day}, {year}, {time}.

## Behavior
- Be direct. No filler phrases like "Great question!" or "I'd be happy to help!"
- Never say "As an AI" or "I'm just a language model" — just answer naturally
- Match the user's language
- Don't over-apologize or add unnecessary disclaimers
- If you're not sure about facts (dates, prices, specifications, current events), say so honestly rather than guessing
- NEVER fabricate information you don't have. You do not know the user's location, IP address, device, or any personal details unless they tell you. If asked, say you don't have that information.
- Do NOT use <think> or reasoning tags. Respond directly.

## Formatting
- Use markdown when it genuinely helps readability (code blocks, lists, tables)
- Don't over-format simple conversational answers — plain text is fine for short responses
- For code, always use fenced code blocks with the language specified
- Use headers and bullet points for complex, structured information
- When creating full HTML pages, websites, or interactive demos, wrap the complete HTML in a fenced code block with ```html. The user's interface will detect it and show a live preview button automatically. Do NOT use <artifact> tags — just use a standard markdown code block.

## Tools & Search
You have a web_search tool. Use it aggressively — your training data is outdated. Search for anything that could be wrong, stale, or that you're not 100% sure about. This includes but is not limited to: news, prices, scores, people, companies, products, releases, regulations, science, health, travel, events, comparisons, specs, reviews, and general facts.

### When to search
- Anything time-sensitive or that changes (prices, scores, stock, weather, news, releases, schedules)
- Specific claims, numbers, statistics, or facts you'd need to verify
- Questions about real people, companies, products, places, or events
- Anything the user frames as "latest", "current", "recent", "now", or any relative time reference
- When in doubt, search. Over-searching is always better than hallucinating.

### How to write search queries
- Be specific and detailed. Pack the query with the right keywords a search engine needs to return relevant results.
- ALWAYS resolve relative time to real dates. You know the current date and time — do the math. Never put "yesterday", "today", "last week", "this month", "recently" in a query. Convert them.
- Use full proper names, not abbreviations or shorthand.
- Add qualifying terms that help narrow results: year, version, category, location, "vs", "price", "release date", "specifications", etc.
- If a first search returns poor results, refine and search again with different terms.
- For multi-part questions, run separate searches for each part rather than one vague query.

### What NOT to do
- NEVER assume the user's location.
- NEVER fabricate search results, URLs, sources, statistics, or quotes.
- NEVER announce tool usage. Don't say "Let me search for that", "No tools needed here", "I'll look that up". Just do it silently and answer.
- NEVER pass the user's raw message as the search query. Reformulate it into an effective search query.
- Do NOT guess or make up facts.
- When you use search results, cite your sources naturally in your response.
- If your search results don't contain information about something, it likely doesn't exist or hasn't been announced yet. Say so clearly.
- NEVER combine real information from one product with a made-up product name.

## Link Fetching
You have a fetch_page tool. When the user shares a URL or link, use it automatically to read the page content. Don't ask the user to paste the content — just fetch it.

## Code Execution & Sandbox
[Conditional — only when E2B_API_KEY is set]

You have a full Linux sandbox with Python, Node.js, and shell access. State persists across tool calls within a single response, but resets between messages.

Tools:
- code_execute(code, language?): Run Python or JavaScript.
- shell_exec(command): Run any shell command. Install anything with pip/apt freely.
- file_upload(fileUrl, sandboxPath?): Copy a file into the sandbox using its URL from an <attached_file> tag.
- file_download(sandboxPath): Read a file from the sandbox to show the user. MUST use this to return generated/modified images.

### IMPORTANT — When to use sandbox vs not:
- Images you can see: just look at them and answer. Do NOT run sandbox code to "open" or "view" an image you already see. Only use sandbox if the user asks you to MODIFY the image (resize, crop, convert, OCR, etc.).
- Text files with extracted content in <attached_file> tags: just read the text and answer. Only use sandbox for data analysis, charts, etc.
- Binary files, MIDI, audio, video, etc.: use sandbox to process them.
- Math, statistics, charts: use sandbox.

### File handling:
Non-image files appear as <attached_file> tags with extracted text or binary markers. These files are AUTOMATICALLY loaded into the sandbox at /home/user/<filename>. You do NOT need to call file_upload — just use the file directly in code.

### Returning results:
- Charts: plt.show() — images appear automatically.
- Modified/generated images: save to file, then call file_download(sandboxPath).
- Text results: print() in code — stdout is shown.
- Install packages freely via shell_exec. Never announce code — just do it.
- If code errors, fix and retry silently. Never show tracebacks.
```

---

## 6. KNOWN ISSUES AND BUGS

1. **`handleEditLastMessage` is a no-op** — The up-arrow-to-edit handler finds the message but does nothing (just `break`s).
2. **Lightbox has no keyboard dismiss** — Image lightbox only closes on click, no Escape handler or focus trap.
3. **Sidebar "more" menu uses `<span>` instead of `<button>`** — Not keyboard-focusable.
4. **`processMessages` called in render body** — Now wrapped in `useMemo` (fixed), but the `processMessages` function itself mutates slot objects in-place which could cause issues.
5. **Retry button in error banner** — Can silently drop legitimate empty assistant messages during tool-only responses.
6. **Conversation preview query is O(all messages)** — Fetches all messages for matched conversations, deduplicates in JS.
7. **No debounce on sidebar search** — Each keystroke fires a network request.
8. **`setTimeout` file cleanup doesn't survive restart** — Temp files leak if server restarts.
9. **In-memory consolidation counter** — `Map<userId, number>` grows forever, resets on restart.
10. **Settings page hydration mismatch** — Fixed with `themeMounted` guard, but the console may still show warnings from other dynamic content.
11. **Credit check TOCTOU race** — Balance checked at request start, cost deducted at end. Concurrent requests can overdraw.
12. **Token estimation** — `chars / 4` heuristic can be off 2-3x for CJK text, code, or URLs.
13. **`/signup` not in public paths** — By design (invite-only), but the signup page still exists and shows a form that will 403.

**No TODO/FIXME/HACK/XXX comments in the codebase.**

---

## 7. TECH DEBT

### Security
- No rate limiting on any route (login brute force, chat cost abuse, upload disk abuse)
- No CSRF protection beyond `sameSite: lax` cookies
- Proxy doesn't verify sessions in DB — revoked sessions valid until JWE expiry (7 days)
- User-supplied model ID passed to OpenRouter without validation against an allowlist
- Error messages may leak internal details (DB errors returned to client in catch blocks)

### Code Quality
- `chat-view.tsx` is 1059 lines with 63 hooks — should be split into smaller components
- `rehypeRaw` removed from markdown renderer (was a security risk) — done
- Duplicate bounce animation in `chat-messages.tsx` and `message-bubble.tsx`
- `tool-result.tsx` file exists but is unused
- `config` export in `proxy.ts` may be dead code (Next.js 16 uses `proxy()` not `middleware()`)
- Individual DB updates in memory consolidation loops (should be batched)

### Hardcoded Values That Should Be Configurable
- Session duration: 7 days (hardcoded in `session.ts`)
- Invite token expiry: 7 days (hardcoded in invite route)
- Bcrypt rounds: 12 (hardcoded in `auth.ts`)
- File cleanup delay: 1 hour (hardcoded in upload route)
- Compaction keep-recent: 10 messages (in constants, but not env-configurable)

### Missing
- No expired session cleanup (sessions table grows forever)
- No pagination on messages endpoint
- Context compaction permanently deletes messages (no soft-delete or archive)
- No error boundaries on sub-pages (only root `error.tsx`)

---

## 8. WHAT'S NOT BUILT YET

### Critical for Launch
- **Rate limiting** — Login, chat, upload all unprotected
- **Stripe payment integration** — Schema exists, constants defined, no checkout flow
- **Password reset** — Schema exists, no email service or UI

### Nice to Have
- **OAuth** (Google, GitHub) — Not started
- **Conversation export** — Markdown/JSON download
- **Message virtualization** — For long conversations (200+ messages)
- **Search full-text indexing** — `ILIKE` scans are slow at scale

### Can Wait
- **Landing page** — No public marketing page
- **Mobile app / PWA** — No manifest, no service worker
- **BYOK (Bring Your Own Key)** — `api_keys` table exists but no UI or logic
- **Conversation sharing** — No public link generation
- **Voice input/output** — Not started
- **Image generation** — Not integrated (could be added as a tool)

---

## 9. DEPENDENCIES

### Runtime (45 packages)

| Package | Purpose |
|---------|---------|
| `@ai-sdk/openai` | OpenAI-compatible provider for AI SDK |
| `@ai-sdk/react` | React hooks for AI SDK (`useChat`) |
| `@base-ui/react` | Base UI primitives (shadcn/ui v4 foundation) |
| `@e2b/code-interpreter` | E2B sandbox for code execution |
| `@openrouter/ai-sdk-provider` | OpenRouter provider for AI SDK |
| `@tailwindcss/typography` | Prose classes for markdown rendering |
| `ai` | Vercel AI SDK core (streaming, tools, messages) |
| `bcryptjs` | Password hashing |
| `class-variance-authority` | Component variant utilities (shadcn) |
| `clsx` | Conditional classnames |
| `cmdk` | Command palette component |
| `date-fns` | Date formatting and manipulation |
| `decimal.js` | Arbitrary-precision cost calculations |
| `dompurify` | HTML sanitization for highlight.js output |
| `drizzle-orm` | TypeScript ORM for PostgreSQL |
| `heic-convert` | Pure JS HEIC/HEIF to JPEG conversion |
| `highlight.js` | Syntax highlighting |
| `jose` | JWE encryption for session tokens |
| `jszip` | ZIP extraction for PPTX/DOCX processing |
| `lucide-react` | Icon library |
| `mammoth` | DOCX to text extraction |
| `nanoid` | Short ID generation |
| `next` | React framework (App Router) |
| `next-themes` | Dark mode / theme management |
| `openai` | OpenAI SDK (transitive dependency) |
| `pdf-parse` | PDF text extraction |
| `postgres` | PostgreSQL client (postgres.js) |
| `react` | UI library |
| `react-dom` | React DOM renderer |
| `react-markdown` | Markdown → React rendering |
| `rehype-highlight` | Syntax highlighting in markdown |
| `rehype-katex` | LaTeX/math rendering in markdown |
| `rehype-raw` | Raw HTML passthrough in markdown (installed but removed from plugins) |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough) |
| `remark-math` | Math expression parsing |
| `server-only` | Prevents server code from running on client |
| `shadcn` | Component CLI and primitives |
| `sharp` | Image processing (resize, convert, compress) |
| `sonner` | Toast notifications |
| `tailwind-merge` | Merge Tailwind classes without conflicts |
| `tw-animate-css` | Animation utilities |
| `uuid` | UUID generation |
| `xlsx` | Spreadsheet parsing |
| `zod` | Schema validation |

### Dev (10 packages)

| Package | Purpose |
|---------|---------|
| `@tailwindcss/postcss` | Tailwind CSS PostCSS plugin |
| `@types/bcryptjs` | TypeScript types for bcryptjs |
| `@types/dompurify` | TypeScript types for DOMPurify |
| `@types/node` | Node.js types |
| `@types/react` | React types |
| `@types/react-dom` | React DOM types |
| `@types/uuid` | UUID types |
| `drizzle-kit` | Drizzle migration CLI |
| `eslint` + `eslint-config-next` | Linting |
| `prettier` | Code formatting |
| `tailwindcss` | CSS framework |
| `typescript` | TypeScript compiler |

---

## 10. COST STRUCTURE

### Models by Purpose

| Purpose | Model | Env Override | Notes |
|---------|-------|-------------|-------|
| Chat | User-selected (default: `claude-opus-4.6`) | `NEXT_PUBLIC_DEFAULT_MODEL` | Main conversation model |
| Title generation | `openai/gpt-5.4-nano` | `TITLE_MODEL` | 2-5 word titles, ~100 tokens output |
| Memory extraction | `openai/gpt-5.4-mini` | `MEMORY_MODEL` | Also used for summaries, dedup, consolidation |
| Context compaction | `openai/gpt-5.4-nano` | `CONTEXT_MODEL` | Summarize old messages, ~1500 tokens output |
| Memory deduplication | Same as `MEMORY_MODEL` | — | Runs per extracted memory |
| Immediate memory | Same as `MEMORY_MODEL` | — | For "remember this" requests |

### Flat-Rate Tool Costs

| Tool | Cost per call | Provider |
|------|-------------|----------|
| `web_search` | $0.008 | Tavily |
| `code_execute` | $0.005 | E2B |
| `shell_exec` | $0.005 | E2B |
| `file_upload` | $0.005 | E2B |
| `file_download` | $0.005 | E2B |

### Approximate Cost per Typical Message

A typical chat exchange (1 user message + 1 assistant response, no tools):
- **Chat:** ~1000 input tokens + ~500 output tokens at model pricing (varies widely by model)
- **Title generation:** ~200 tokens total, runs once per conversation, nano pricing
- **Memory extraction:** ~500 tokens total, runs every exchange, mini pricing
- **Summary update:** ~500 tokens, runs every 3rd exchange, mini pricing
- **Compaction:** ~2000 tokens, runs rarely (when context exceeds 80K tokens)

With Claude Opus 4.6 ($15/M input, $75/M output):
- Chat: ~$0.015 input + ~$0.038 output = ~$0.053 per exchange
- Background tasks: ~$0.001-0.003 total (cheap models)
- **User pays:** raw cost × 1.1 markup

### Cost Tracking

All costs flow through `usage-logger.ts`:
1. `trackedStreamText` wraps `streamText` → logs chat token usage in `onFinish`
2. `trackedGenerateText` wraps `generateText` → logs background task usage
3. `logSearchUsage` / `logSandboxUsage` → log flat-rate tool costs
4. Each log entry stores both `costUsd` (raw) and `userCostUsd` (with markup)
5. User credit balance decremented atomically via `GREATEST(0, balance - cost)`
6. Admins exempt from credit deduction
