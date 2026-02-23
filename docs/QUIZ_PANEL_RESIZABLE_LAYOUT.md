# Quiz Panel Visibility & Resizable Layout — Development Manual

## Current vs Expected Behavior

|                           | Current                                                                                                                         | Expected                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quiz panel visibility** | After sending a quiz-triggering message (e.g. "考我") in Quiz mode, the quiz panel may not appear between menu and chat.        | After sending, the quiz panel appears as a **separate area** next to the chat.                                                                  |
| **Layout**                | Menu (fixed width) + optional Quiz panel (fixed `md:w-80`) + Chat (flex-1). Quiz panel and chat widths are not user-adjustable. | Menu stays fixed; **Quiz panel and Chat each take ~50% of the remaining width**, with a **draggable divider** so the user can resize the split. |

---

## Architecture Overview (Relevant Files)

```
src/routes/index.tsx          — Layout: ConversationList | QuizPanel? | main (ChatUI)
                                 Owns: selectedConversationId, quizQuestions, getQuizQuestionsFn
                                 Decides: showQuizPanel, passes onQuizGenerated to ChatUI
src/components/ConversationList.tsx  — Left sidebar (menu)
src/components/QuizPanel.tsx    — Renders quiz questions; receives questions, onRefresh
src/components/ChatUI.tsx       — Chat area; calls onQuizGenerated?.() after send when mode === 'quiz'
src/lib/chat.server.ts         — Server fn definitions (getQuizQuestions, sendMessage, …)
src/lib/chat.impl.server.ts    — Quiz generation + DB insert; sendMessageImpl branches on isQuizGenerationRequest
```

**Data flow for “show quiz panel after 考我”:**

1. User selects Quiz mode, types "考我", sends.
2. `ChatUI` → `sendMessageFn({ conversationId, userMessage, mode: 'quiz' })`.
3. Server: `chat.impl.server.ts` → `isQuizGenerationRequest(userMessage)` true → `generateQuizMcqs(context)` → insert into `quiz_questions` → return.
4. `ChatUI` receives result, calls `onQuizGenerated?.()`.（目前尚未确认sse或websocket来倾听 ai 返回的结果, 可能还要做调查，看看如何满足结果倾听功能）
5. `index.tsx` in `onQuizGenerated` runs `getQuizQuestionsFn({ conversationId }).then(setQuizQuestions)`.
6. `quizQuestions.length > 0` → `showQuizPanel` true → `QuizPanel` is rendered.

If the panel does not show, the failure is in one of: (2) server error / no questions inserted, (4) `onQuizGenerated` not called, (5) refetch not updating state, or (6) layout/CSS hiding the panel.

---

## Part A: Ensure Quiz Panel Shows After Sending "考我"

### A.1 Verify backend

- **File:** `src/lib/chat.impl.server.ts`
- **Check:** When `mode === 'quiz'` and `isQuizGenerationRequest(userMessage)` is true, the code path runs `generateQuizMcqs(context)`, then `db.delete(quizQuestions)...` and `db.insert(quizQuestions)...`.
- **If quiz still doesn’t show:** Ensure `quiz_questions` table exists (`npm run db:migrate` or `db:push`). Check server logs for "Quiz generation failed" and fix the reported error (e.g. DB, Gemini API key, or JSON parse).

### A.2 Ensure frontend refetch runs

- **File:** `src/routes/index.tsx`
- **Check:** `ChatUI` is given `onQuizGenerated={() => { if (selectedConversationId != null) getQuizQuestionsFn({ data: { conversationId: selectedConversationId } }).then(setQuizQuestions) }}`.
- **Important:** When a **new** conversation is created by the same send (e.g. first message "考我"), `result.conversationId` is the new id but `selectedConversationId` in the closure might still be `null` until `onConversationCreated` runs. So either:
  - Pass the **returned** `conversationId` into the refetch (e.g. `onQuizGenerated?.(result.conversationId)` and in `index.tsx` refetch using that id and set both `selectedConversationId` and `quizQuestions`), or
  - Ensure `onConversationCreated(result.conversationId)` is called **before** `onQuizGenerated` and that state has updated (or call refetch with `result.conversationId` inside `ChatUI` and have a callback that accepts optional `conversationId` for refetch).
- **Recommendation:** Change `onQuizGenerated` to accept an optional `conversationId?: number`. When present (e.g. new conversation), use it for refetch and optionally set as selected; when absent, use `selectedConversationId` from state.

### A.3 ChatUI: call onQuizGenerated with conversation id

- **File:** `src/components/ChatUI.tsx`
- **Current:** `if (selectedMode === 'quiz') onQuizGenerated?.()`.
- **Change:** Pass the conversation id that has the new quiz: `onQuizGenerated?.(result.conversationId ?? conversationId ?? undefined)`. Parent can then refetch for that id and set quiz list (and selected conversation if new).

### A.4 index.tsx: refetch by id and show panel

- **File:** `src/routes/index.tsx`
- **Logic:** In `onQuizGenerated(conversationIdForQuiz?)`, call `getQuizQuestionsFn({ data: { conversationId: conversationIdForQuiz ?? selectedConversationId } })`. If `conversationIdForQuiz` is a new conversation, also call `setSelectedConversationId(conversationIdForQuiz)` so the UI shows that conversation and its quiz. Then `.then(setQuizQuestions)` so `showQuizPanel` becomes true.

---

## Part B: Resizable 50/50 Split (Quiz Panel | Chat)

### B.1 Layout goal

- **Container:** One flex row: `[ConversationList] [Resizable: QuizPanel | Chat]`.
- **ConversationList:** Fixed width (e.g. 240px), no resize.
- **Resizable area:** Takes the rest (`flex-1 min-w-0`). Inside it: **left** = Quiz panel, **right** = Chat, with a **draggable vertical divider** in between. Initial widths: 50% / 50%. User drags to change the ratio.

### B.2 State for split

- **File:** `src/routes/index.tsx` (or a small layout component).
- **State:** e.g. `splitRatio: number` in `[0, 1]` (0 = all chat, 1 = all quiz), or `quizPanelWidthPercent: number` (default 50). Store in `useState`; optionally persist to `localStorage` so the ratio is remembered.

### B.3 Structure

- **Option 1 — CSS + mouse events in index:**
  - One wrapper div for “content area” (quiz + chat): `display: flex`, height 100%.
  - Left: `QuizPanel` in a div with `width: ${quizPanelWidthPercent}%` (or `flex: 0 0 ${ratio * 100}%`).
  - Divider: a narrow div (e.g. 4–8px) with `cursor: col-resize`, `user-select: none`; on `mousedown` set “resizing” and add global `mousemove` / `mouseup` to update width from `clientX`.
  - Right: Chat in a div with `flex: 1` and `min-width: 0`.
- **Option 2 — Resizable library:** Use a small dependency (e.g. `react-resizable-panels`, `allotment`, or `re-resizable`) in the content area: one panel for Quiz, one for Chat, with a resizable split. Keeps index.tsx simpler.

### B.4 Where to implement

- **File:** `src/routes/index.tsx`.
- **Current:** `{showQuizPanel && <QuizPanel ... />}` then `<main>...</main>`. Both are siblings in a flex row.
- **Change:**
  - Wrap “Quiz panel + divider + Chat” in a single flex container that always exists (e.g. `contentArea`). When `!showQuizPanel`, render only Chat (full width) inside that container.
  - When `showQuizPanel`: render `[QuizPanel container with width from state] [Divider] [main (Chat)]`. Attach resize logic to the divider (or use the chosen resizable component).
  - ConversationList stays the first child of the page flex; this content area is the second child with `flex: 1 min-w-0`.

### B.5 Sizing details

- **Quiz panel container:** Use percentage or flex basis from `splitRatio`; set `min-width` (e.g. 200px) and `max-width` (e.g. 80%) so it doesn’t collapse or overflow. Use `overflow: auto` for the quiz list.
- **Chat (main):** `flex: 1 min-w-0` and `overflow: hidden` so it doesn’t push the layout; inner scroll stays in the message list as it does today.
- **Divider:** Only render when `showQuizPanel`; vertical bar, draggable, no shrinking.

### B.6 Accessibility

- Divider: add `role="separator"`, `aria-valuenow` / `aria-valuemin` / `aria-valuemax` if you expose the ratio, and keyboard support (e.g. arrow keys to nudge) if required.

---

## Implementation Checklist

- [ ] **A.1** Backend: confirm quiz generation and DB insert; fix any DB/API errors so questions are saved.
- [ ] **A.2–A.4** Frontend: ensure `onQuizGenerated(conversationId?)` is called with the correct id; parent refetches `getQuizQuestions` for that id and updates `selectedConversationId` when it’s a new conversation; `showQuizPanel` becomes true when `quizQuestions.length > 0`.
- [ ] **B.1** Decide: custom resize (divider + mouse events) vs resizable library.
- [ ] **B.2** Add state for split ratio (and optional localStorage).
- [ ] **B.3–B.5** In `index.tsx`, introduce content area wrapper; when `showQuizPanel`, render Quiz panel + divider + Chat with resizable widths (default 50/50).
- [ ] **B.6** Add divider semantics and keyboard support if needed.
- [ ] Manually test: send "考我" in Quiz mode → panel appears; drag divider → widths change and layout remains correct.

---

## File Change Summary

| File                                              | Changes                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/index.tsx`                            | (A) Refetch by id in `onQuizGenerated(conversationId?)`; set selected conversation when new. (B) Content wrapper; when `showQuizPanel`, render Quiz + resizable divider + Chat; split state and resize logic (or integration of resizable component). |
| `src/components/ChatUI.tsx`                       | (A) Call `onQuizGenerated?.(result.conversationId ?? conversationId ?? undefined)`.                                                                                                                                                                   |
| `src/components/QuizPanel.tsx`                    | No API change; may be wrapped in a sized container (width from parent).                                                                                                                                                                               |
| Optional: new `src/components/ResizableSplit.tsx` | Encapsulate two children + draggable divider and ratio state (if not using a library).                                                                                                                                                                |

This manual is based on the current files and architecture; implement in the order above and adjust if you later move layout into a dedicated component.
