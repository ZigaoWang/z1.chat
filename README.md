# z1.chat

A fast, minimal AI chat app with multi-model support, memory, artifacts, code execution, and a credit system.

**Try it at [z1.chat](https://z1.chat)**

## Features

- **Multi-model chat** via OpenRouter — switch models per conversation
- **Artifacts** — live-rendered HTML, SVG, Mermaid diagrams, code, and documents
- **Code execution** via E2B sandboxed Linux environment — Python/JS with persistent state, pre-installed pandas, numpy, matplotlib, scipy, sympy, pillow; shell commands; file upload into sandbox
- **Memory** — automatically extracts and organizes facts from conversations (personal, preferences, projects, style, facts)
- **Web search** via Tavily
- **File attachments** — images, PDFs, documents, spreadsheets, code files
- **Branching conversations** — edit any message and fork from that point
- **Credit system** — pay-as-you-go with Alipay (ZPay), BYOK support
- **Admin panel** — user management, model curation, usage stats
- **Auth** — email/password with email verification, JWE session cookies, password reset
- **i18n** — English and Chinese

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19
- **PostgreSQL** + Drizzle ORM
- **Tailwind CSS v4** + shadcn/ui v4 (Base UI)
- **Vercel AI SDK v6** + OpenRouter
- **E2B** for sandboxed code execution
- **Tavily** for web search
- **jose** for JWE session encryption
- **nodemailer** / Mailtrap for transactional email

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL

### Setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run db:migrate
npm run dev
```

App runs at `http://localhost:3000`.

