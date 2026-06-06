# AI Study Helper

An AI-powered study app: learn a topic in **Beginner** and **Deep-dive** modes, then **quiz** yourself. You can keep chatting while taking the quiz, save quizzes you like, and manage multiple conversations.

## How it works

1. **Learn** — Start a conversation. Use **Beginner** for simple, analogy-based explanations, then **Deep-dive** for detail and follow-up.
2. **Quiz** — Switch to **Quiz** and send any message. The app generates multiple-choice questions from your learning chat and opens the **quiz panel**.
3. **Answer** — Questions appear in a **quiz panel** beside the chat. Pick an option; you see right/wrong and the correct answer.
4. **Ask while quizzing** — After a quiz appears, choose **Follow-up** to ask about questions in chat, or **New Quiz** to generate another set.
5. **Save & manage** — Save quizzes from the panel or from the quiz detail page. Delete chats from the sidebar (⋯ → Delete); saved quizzes are kept.

## Features

- **Three modes**: Beginner (simple), Deep-dive (detailed), Quiz (generate and take MCQs).
- **Conversations**: Multiple chats; each can mix modes. Delete a chat from the list (⋯ → Delete); quizzes you saved stay in “Saved”.
- **Quiz panel**: Shows when the current conversation has quizzes; resizable. Close it and reopen from the **Quiz bar** above the chat.
- **Save quiz**: Mark a quiz as saved so it appears under **Quizzes → Saved** and survives when you delete its chat.
- **Quiz pages**: **Quizzes → All** (grouped by conversation), **Quizzes → Saved**, and a detail page per quiz (`/quiz/$quizId`).
- **Score and feedback**: Per-question correct/incorrect and overall score.

## Tech stack

- **Frontend**: React, TanStack Start (Router, Server Functions), Tailwind CSS.
- **Backend**: TanStack Server Functions, Drizzle ORM, PostgreSQL.
- **AI**: Google Gemini API (one model, different prompts per mode).

## Deploying to Vercel (portfolio demo)

### Architecture

- **App**: TanStack Start + Nitro on Vercel (Serverless Functions).
- **Database**: [Neon](https://neon.tech) or Vercel Postgres — set `DATABASE_URL` (use the **pooler** connection string).
- **Gemini**: **Bring your own key** — visitors paste a key in **Settings**; it stays in `sessionStorage` (cleared when the browser closes) and is sent with each chat request. The server does **not** store API keys.
- **Privacy**: Anonymous **browser session cookie** scopes chats/quizzes to the current browser session; closing the browser starts fresh. Other visitors cannot see your conversations.

### Vercel environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Neon pooler URL for production |
| `GEMINI_API_KEY` | No | Omit in production (BYOK). Optional in `.env.local` for local dev only. |

### Deploy steps

1. Create a Neon database and run migrations against it:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

2. Connect the GitHub repo to Vercel; set `DATABASE_URL` in project settings.

3. Build uses the Nitro `vercel` preset when `VERCEL` is set (see `vite.config.ts`).

4. Optional: enable **Vercel Deployment Protection** to limit public access to the demo.

### Local vs production

| | Local | Production |
|---|--------|------------|
| Database | `.env.local` → local Postgres | Vercel → Neon |
| Gemini key | Settings and/or `GEMINI_API_KEY` in `.env.local` | Settings only (BYOK) |

After pulling these changes, run **`npm run db:migrate`** (or `db:push`) once so `session_id` columns exist.

## Getting started

### Prerequisites

- Node.js
- PostgreSQL
- A [Google AI API key](https://ai.google.dev/) (Gemini)

### Setup

1. Clone and install:

   ```bash
   npm install
   ```

2. Environment variables (e.g. in `.env.local`):

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/your_db
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. Database:

   ```bash
   npm run db:push
   # or
   npm run db:migrate
   ```

   If **deleting a chat** later fails with an error about `conversation_id`, ensure the column allows NULL on the DB you’re actually using:

   ```bash
   npx tsx scripts/check-quizzes-nullable.ts
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
```

## Scripts

| Command                        | Description                                      |
| ------------------------------ | ------------------------------------------------- |
| `npm run dev`                  | Start dev server (port 3000)                     |
| `npm run build`                | Production build                                 |
| `npm run preview`              | Preview production build                          |
| `npm run db:push`              | Sync schema to DB (no migration files)             |
| `npm run db:migrate`           | Run migrations                                    |
| `npm run db:generate`         | Generate migrations from schema                   |
| `npm run db:studio`            | Open Drizzle Studio                              |
| `npx tsx scripts/check-quizzes-nullable.ts` | Fix `quizzes.conversation_id` NULL if needed |
| `npm run lint`                 | Lint                                              |
| `npm run check`                | Format + lint                                     |
| `npm run test`                 | Run tests                                         |

## Project structure

| Path | Description |
|------|-------------|
| `src/routes/` | Pages: `/`, `/settings`, `/quiz` layout, `/quiz/all`, `/quiz/saved`, `/quiz/$quizId`. |
| `src/components/` | ChatUI, QuizPanel, ConversationList (with delete dropdown), Header. |
| `src/contexts/GeminiKeyContext.tsx` | BYOK key state (sessionStorage). |
| `src/lib/anonymous-session.server.ts` | Browser session cookie for chat isolation. |
| `src/lib/chat.server.ts` | Server function definitions (messages, quizzes, deleteConversation). |
| `src/lib/chat.impl.server.ts` | Chat + delete implementation (DB, AI). |
| `src/lib/quiz.service.ts` | Quiz CRUD, getQuizzes by conversation, getSaved, getQuizById, LEFT JOIN for nullable conversationId. |
| `src/lib/gemini.server.ts` | Gemini prompts, `generateReply`, `generateQuizMcqs`. |
| `src/db/` | Drizzle schema and `drizzle/` migrations. |
| `scripts/check-quizzes-nullable.ts` | One-off: ensure `quizzes.conversation_id` allows NULL (see docs if delete chat fails). |
| `docs/` | Feature and bug docs (e.g. DELETE_CHAT_AND_QUIZZES.md, BUG_DELETE_CHAT_CONVERSATION_ID_NOT_NULL.md). |

## Documentation

- `docs/DELETE_CHAT_AND_QUIZZES.md` — Delete chat feature and data flow.
- `docs/BUG_DELETE_CHAT_CONVERSATION_ID_NOT_NULL.md` — If delete chat fails, cause and fix (run `scripts/check-quizzes-nullable.ts`).
- `docs/CHAT_QUIZ_BAR_AND_REOPEN.md` — Quiz bar above chat to reopen panel.
- `docs/QUIZ_PAGES_AND_ROUTES.md` — Quiz routes and pages.

## Adding UI components (Shadcn)

```bash
pnpm dlx shadcn@latest add button
```

(Use `npm` if you don’t use pnpm.)
