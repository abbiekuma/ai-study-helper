# Prompt Separation — Development Manual

## Current vs Expected Behavior

| | Current | Expected |
|---|--------|----------|
| **Prompt location** | All prompts live inside `src/lib/gemini.server.ts` as string constants (`SYSTEM_INSTRUCTION_BEGINNER`, `SYSTEM_INSTRUCTION_DEEP_DIVE`, `SYSTEM_INSTRUCTION_QUIZ`, `QUIZ_MCQ_GENERATION_SYSTEM`) and `getSystemInstruction(mode)`. | Prompts are moved to a **dedicated file** (e.g. `src/lib/gemini.prompts.server.ts`). `gemini.server.ts` only handles Gemini API calls, model config, and response parsing; it **imports** prompt text / helpers from the prompts file. |
| **Maintainability** | Editing or adding prompts requires opening and modifying `gemini.server.ts`, which also contains API and parsing logic. | Prompt copy and mode-to-prompt mapping live in one place; non-prompt changes to Gemini logic stay in `gemini.server.ts`. |

---

## Architecture Overview (Relevant Files)

```
src/lib/gemini.server.ts           — Current: holds 4 prompt constants + getSystemInstruction(mode);
                                      generateReply(getSystemInstruction), generateQuizMcqs(QUIZ_MCQ_GENERATION_SYSTEM).
                                      After: imports prompts / getSystemInstruction from prompts file; only API + parsing.
src/lib/gemini.prompts.server.ts   — New file: all prompt strings and getSystemInstruction(mode).
src/lib/chat.impl.server.ts        — Calls generateReply(mode) and generateQuizMcqs(context); no change to call sites.
```

**Data flow (unchanged):**

- **Chat reply:** `chat.impl.server` → `generateReply(userMessage, history, mode)` → `gemini.server` uses `getSystemInstruction(mode)` to get system prompt → calls Gemini → returns text.
- **Quiz MCQs:** `chat.impl.server` → `generateQuizMcqs(conversationContext)` → `gemini.server` uses MCQ system instruction + user message → calls Gemini → `parseAndValidateMcqArray` → returns `McqItem[]`.

Only the **source** of the prompt text moves; callers and flow stay the same.

---

## Part A: Create the Prompts File

### A.1 New file and exports

- **Create:** `src/lib/gemini.prompts.server.ts` (or `prompts.server.ts` if you prefer a generic name).
- **Move** the four string constants from `gemini.server.ts`:
  - `SYSTEM_INSTRUCTION_BEGINNER`
  - `SYSTEM_INSTRUCTION_DEEP_DIVE`
  - `SYSTEM_INSTRUCTION_QUIZ`
  - `QUIZ_MCQ_GENERATION_SYSTEM`
- **Move** (or re-export) **`getSystemInstruction(mode)`** so it returns the correct system instruction for `'beginner' | 'deep-dive' | 'quiz'`. The function depends on `ChatMode`; either define/import `ChatMode` in the prompts file or accept a string and keep the type in `gemini.server.ts` and pass `mode` through.
- **Export** all constants and `getSystemInstruction` so `gemini.server.ts` can import them.

### A.2 Optional: quiz user message template

- **Current:** In `generateQuizMcqs`, the user message is built inline:  
  `` `Based on the following learning conversation, generate ...\n\n---\n\n${conversationContext}` ``.
- **Optional:** In the prompts file, add a constant (e.g. `QUIZ_MCQ_USER_MESSAGE_PREFIX` or a template) and export it; `gemini.server.ts` then builds the user message as `QUIZ_MCQ_USER_MESSAGE_PREFIX + '\n\n---\n\n' + conversationContext`. This keeps all quiz-generation copy in one file.

### A.3 Type dependency

- **ChatMode** is currently exported from `gemini.server.ts`. Options:
  - **Option 1:** Export `ChatMode` from `gemini.server.ts` and have the prompts file import it for `getSystemInstruction(mode: ChatMode)`.
  - **Option 2:** Define a minimal type in the prompts file (e.g. `type ChatMode = 'beginner' | 'deep-dive' | 'quiz'`) and re-export from `gemini.server.ts` as `export type { ChatMode } from './gemini.prompts.server'` (or define in a shared types file). Choose one and keep a single source of truth.

---

## Part B: Update gemini.server.ts

### B.1 Remove prompt definitions

- **File:** `src/lib/gemini.server.ts`
- **Remove:** The four prompt constants and the local `getSystemInstruction` implementation.
- **Keep:** `GEMINI_MODEL`, `generateReply`, `generateQuizMcqs`, `HistoryMessage`, `McqItem`, `parseAndValidateMcqArray`, `stripJsonBlock`, `MCQ_KEYS`, and all Gemini API usage.

### B.2 Add imports

- **File:** `src/lib/gemini.server.ts`
- **Add:** Import from the new prompts file, e.g.  
  `import { getSystemInstruction, QUIZ_MCQ_GENERATION_SYSTEM } from './gemini.prompts.server'`  
  (and `QUIZ_MCQ_USER_MESSAGE_PREFIX` or template if you moved it in A.2).
- **Ensure:** `generateReply` still calls `getSystemInstruction(mode)` to get the system instruction before building the model.
- **Ensure:** `generateQuizMcqs` still receives the MCQ system instruction (and optional user-message template) from the prompts file; only the **source** of the string changes, not the logic.

### B.3 ChatMode export

- If `ChatMode` is defined in the prompts file and re-exported from `gemini.server.ts`, update the export so existing imports (e.g. `chat.impl.server`, `ChatUI`) still resolve. If `ChatMode` stays in `gemini.server.ts`, the prompts file imports it from there (avoid circular dependency: prompts → gemini is fine; gemini → prompts).

---

## Part C: No Changes to Other Files

- **`src/lib/chat.impl.server.ts`** — Calls `generateReply(..., mode)` and `generateQuizMcqs(context)`; no API change. No edits required.
- **`src/components/ChatUI.tsx`** — Uses `ChatMode` type if imported from gemini; ensure the type still exports from `gemini.server.ts` (or wherever the UI imports it). No prompt-related change.
- **`src/lib/chat.server.ts`** — No reference to prompts or Gemini. No change.

---

## Implementation Checklist

- [ ] **A.1** Create `src/lib/gemini.prompts.server.ts`; move the four prompt constants and `getSystemInstruction(mode)`; export them.
- [ ] **A.2** (Optional) Move the quiz MCQ user message text into the prompts file as a constant or template.
- [ ] **A.3** Decide where `ChatMode` lives (gemini.server.ts vs prompts file) and avoid circular imports.
- [ ] **B.1** Remove the four constants and `getSystemInstruction` from `gemini.server.ts`.
- [ ] **B.2** Add imports from the prompts file; wire `generateReply` and `generateQuizMcqs` to use imported prompts.
- [ ] **B.3** Keep or adjust `ChatMode` export so `chat.impl.server` and `ChatUI` still resolve the type.
- [ ] Run app and test: Beginner / Deep-dive / Quiz chat replies and “考我” quiz generation still work; no runtime errors or missing prompts.

---

## File Change Summary

| File | Changes |
|------|--------|
| **New: `src/lib/gemini.prompts.server.ts`** | Define and export `SYSTEM_INSTRUCTION_BEGINNER`, `SYSTEM_INSTRUCTION_DEEP_DIVE`, `SYSTEM_INSTRUCTION_QUIZ`, `QUIZ_MCQ_GENERATION_SYSTEM`, and `getSystemInstruction(mode)`. Optionally add quiz user-message constant/template. |
| `src/lib/gemini.server.ts` | Remove the four prompt strings and local `getSystemInstruction`. Import `getSystemInstruction` and `QUIZ_MCQ_GENERATION_SYSTEM` (and optional template) from `./gemini.prompts.server`. Ensure `ChatMode` is still exported for consumers. |
| `src/lib/chat.impl.server.ts` | No change (still calls `generateReply`, `generateQuizMcqs`). |
| `src/components/ChatUI.tsx` | No change (unless `ChatMode` import path changes; then update import if needed). |

---

## Notes

- **Server-only:** Keep the new prompts file under `src/lib` and name it with `.server.ts` so it is only bundled/run on the server (same as `gemini.server.ts`). No client should import prompts.
- **Single source of truth:** All prompt copy and mode-to-prompt mapping live in the prompts file; future edits (e.g. adding a mode, tuning wording) happen there.
- **Testing:** After implementation, verify all three chat modes and quiz generation still behave as before; only the file layout changes.
