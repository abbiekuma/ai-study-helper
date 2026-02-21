# AI Study Helper

An AI-powered study app that helps you learn a topic in two steps—**explain** and **go deeper**—then **quiz** you on what you just learned. You can keep asking questions in the chat while doing the quiz.

## How it works

1. **Learn** — Start a conversation. Use **Beginner** for simple, analogy-based explanations, then **Deep-dive** for detail and follow-up.
2. **Quiz** — Switch to **Quiz** and ask to be tested (e.g. “Quiz me” or “考我”). The AI generates multiple-choice questions from that conversation.
3. **Answer** — Questions appear in a **quiz panel** between the conversation list and the chat. Pick an option; you see right/wrong and the correct answer.
4. **Ask while quizzing** — The chat stays open. You can ask things like “What does question 1 mean?” without starting a new quiz.

## Features

- **Three modes**: Beginner (simple), Deep-dive (detailed), Quiz (generate and take MCQs).
- **Conversations**: Multiple chats; each can mix modes.
- **Quiz panel**: Shows only when the current conversation has quiz questions; you can do the quiz and chat at the same time.
- **Score and feedback**: Per-question correct/incorrect and an overall score.

## Tech stack

- **Frontend**: React, TanStack Start (Router, Server Functions), Tailwind CSS.
- **Backend**: TanStack Server Functions, Drizzle ORM, PostgreSQL.
- **AI**: Google Gemini API (one model, different prompts per mode).

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

| Command               | Description                            |
| --------------------- | -------------------------------------- |
| `npm run dev`         | Start dev server (port 3000)           |
| `npm run build`       | Production build                       |
| `npm run db:push`     | Sync schema to DB (no migration files) |
| `npm run db:migrate`  | Run migrations                         |
| `npm run db:generate` | Generate migrations                    |
| `npm run lint`        | Lint                                   |
| `npm run check`       | Format + lint                          |

## Project structure (main pieces)

- `src/routes/` — Pages and root layout.
- `src/components/` — ChatUI, QuizPanel, ConversationList, Header.
- `src/lib/chat.server.ts` — Server function definitions (get/send messages, quiz).
- `src/lib/chat.impl.server.ts` — Chat and quiz implementation (DB, AI).
- `src/lib/gemini.server.ts` — Gemini prompts and `generateReply` / `generateQuizMcqs`.
- `src/db/` — Drizzle schema and migrations.

## Adding UI components (Shadcn)

```bash
pnpm dlx shadcn@latest add button
```

(Use `npm` if you don’t use pnpm.)
