# Multiple Quizzes per Chat & Quiz isSaved — Development Manual

## Current vs Expected Behavior

| | Current | Expected |
|---|--------|----------|
| **Quizzes per conversation** | One logical quiz per chat: generating a new quiz **deletes** all existing `quiz_questions` for that conversation and inserts the new set. | Each chat can have **multiple quizzes**. Each "考我" creates a **new** quiz (no delete); user can see and switch between quizzes for the same conversation. |
| **Quiz entity** | No separate quiz entity; questions are tied only to `conversation_id`. | Introduce a **quiz** entity (table `quizzes`) so that one conversation has many quizzes, and each quiz has many questions. |
| **isSaved** | N/A | Add **isSaved** (boolean) to the quiz schema so the user can mark a quiz as saved; default `false` for newly generated quizzes. |

---

## 储存方式：现在 vs 改完后

**现在（current）：**

- 只有 **quiz_questions** 表，**一题一行**。每行有 **conversationId**，表示「这道题属于哪个会话」。
- 因为每次「考我」时都会**先 delete 该 conversation 下所有 quiz_questions，再 insert 新一轮的题目**，所以同一时刻一个 conversation 只会有一份 quiz（多行题目共享同一个 conversationId）。  
- 总结：一题一行，用 **conversationId** 表示属于哪个会话；通过「先删后插」保证每个 chat 只保留一份 quiz。

**改完后（expected）：**

- 新增 **quizzes** 表：**一行代表一份 quiz**（一次「考我」生成的一整套题），字段有 id、conversationId、createdAt、**isSaved**。
- **quiz_questions** 仍是**一题一行**，但改为带 **quizId**（FK 到 quizzes），表示「这道题属于哪一份 quiz」；不再用 conversationId（conversation 通过 quiz 关联）。
- 每次「考我」：**不再 delete**。先 **insert 一行 quizzes**（得到 quizId），再 **insert 多行 quiz_questions**，每行都带这个 **quizId**。这样同一 conversation 下会累积多份 quiz，每份 quiz 有多道题。
- 总结：一题一行不变；每道题用 **quizId** 表示属于哪一份 quiz；每份 quiz 用 **quizzes** 表的一行表示，并带 **isSaved**。

**“insert quiz row then questions (no delete)” 的含义：**

- **insert quiz row**：先往 **quizzes** 表插入一行（得到 quizId），代表「这一轮生成的 quiz」。
- **then questions**：再往 **quiz_questions** 插入这一轮的每一道题，每行都带上刚得到的 **quizId**，表示这些题目属于这份 quiz。
- **no delete**：不再先删掉该 conversation 下的旧题目，因此旧 quiz 会保留，新 quiz 作为新一批题目加入。这样每个 chat 才能有多个 quiz。

---

## Architecture Overview (Relevant Files)

```
src/db/schema.ts               — Add quizzes table; add quiz_id to quiz_questions; add isSaved to quiz.
src/lib/chat.server.ts         — Add getQuizzes(conversationId); change getQuizQuestions to take quizId; add updateQuizSaved(quizId, isSaved).
src/lib/chat.impl.server.ts    — getQuizzesImpl; getQuizQuestionsImpl(quizId); sendMessageImpl: insert quiz row then questions (no delete); submitQuizAnswerImpl unchanged; add updateQuizSavedImpl.
src/routes/index.tsx           — State: selectedQuizId; fetch quizzes when conversation changes; fetch questions for selectedQuizId; onQuizGenerated set selectedQuizId to new quiz; showQuizPanel when selected quiz has questions.
src/components/QuizPanel.tsx   — Receive questions for one quiz; optionally show isSaved and allow toggle (or parent handles toggle); may need quizId prop for save action.
```

**Data flow (expected):**

1. User selects a conversation → frontend fetches **quizzes** for that conversation (`getQuizzes(conversationId)`).
2. Frontend picks a **selected quiz** (e.g. latest by `createdAt` or user choice), fetches **questions** for that quiz (`getQuizQuestions(quizId)`).
3. User sends "考我" → backend creates a **new** row in **quizzes** (conversationId, isSaved: false), then inserts **quiz_questions** with that **quiz_id**. Returns **quizId** (and conversationId, assistantMessage).
4. Frontend receives quizId, sets **selectedQuizId**, refetches questions for that quiz → Quiz panel shows the new quiz.
5. User can switch which quiz is selected (e.g. dropdown or list in Quiz panel) and optionally **toggle isSaved** via `updateQuizSaved(quizId, isSaved)`.

---

## Part A: Schema Changes

### A.1 New table `quizzes`

- **File:** `src/db/schema.ts`
- **Add** a table **quizzes**:
  - **id** (serial, primary key)
  - **conversationId** (integer, FK to conversations.id, onDelete: cascade)
  - **createdAt** (timestamp, default now)
  - **isSaved** (boolean, default false)
- **Relations:** conversation has many quizzes; quiz has many quizQuestions.

### A.2 Change `quiz_questions` to belong to a quiz

- **File:** `src/db/schema.ts`
- **Add** **quizId** (integer, FK to quizzes.id, onDelete: cascade) to **quiz_questions**.
- **Remove** **conversationId** from **quiz_questions** (conversation is derived via quiz.conversationId). Alternatively keep conversationId as a denormalized column for simpler queries; the manual assumes **removing** it and always joining through **quizzes**.
- **Relations:** quiz_questions belong to one quiz; update **conversationsRelations** so conversation has many **quizzes** (and optionally many quizQuestions through quizzes, or leave as-is and query via quizzes).

### A.3 Migration

- Generate and run a migration (e.g. `pnpm drizzle-kit generate` then `pnpm db:migrate` or equivalent). Migration must:
  - Create **quizzes** table.
  - Add **quiz_id** to **quiz_questions**; backfill or create a default quiz per conversation if you need to preserve existing data (see Part A.4).
  - Drop **conversation_id** from **quiz_questions** if removed.

### A.4 Data migration (if existing data exists)

- If there are existing **quiz_questions** rows: for each distinct **conversation_id**, insert one **quizzes** row (conversationId, isSaved: false), then update **quiz_questions** to set **quiz_id** to that new quiz’s id. Then drop **conversation_id** from **quiz_questions** in a second step, or do it in one migration with a temporary column.

---

## Part B: Backend — Impl and Server Fn

### B.1 getQuizzes(conversationId)

- **File:** `src/lib/chat.impl.server.ts`
- **New:** **getQuizzesImpl(data: { conversationId: number })**. Select from **quizzes** where conversationId = data.conversationId, order by createdAt desc (or asc). Return array of **{ id, conversationId, createdAt, isSaved }**.
- **File:** `src/lib/chat.server.ts`
- **New:** **getQuizzes** server fn with inputValidator(conversationId), handler calling getQuizzesImpl.

### B.2 getQuizQuestions(quizId)

- **File:** `src/lib/chat.impl.server.ts`
- **Change:** **getQuizQuestionsImpl** to accept **data: { quizId: number }** instead of conversationId. Select from **quiz_questions** where **quiz_id** = data.quizId, order by questionOrder. Return same shape as today (id, title, options, correctAnswer, questionOrder, status, userAnswer, score, createdAt). Include **quizId** in the select if the frontend needs it.
- **File:** `src/lib/chat.server.ts`
- **Change:** **getQuizQuestions** inputValidator and handler to use **quizId** instead of conversationId.

### B.3 sendMessageImpl: 先 insert 一份 quiz，再 insert 该份的题目（不再 delete）

- **File:** `src/lib/chat.impl.server.ts`
- **当前逻辑：** 当用户「考我」时，先 **delete** 该 conversation 下所有 **quiz_questions**，再 **insert** 新一轮题目（每行带 conversationId）。因此同一 conversation 只保留一份 quiz。
- **改为：**
  - **删除**「delete 该 conversation 下所有 quiz_questions」这一步。
  - 当生成 quiz（isQuizGenerationRequest 为 true）时：
    1. **Insert** 一行到 **quizzes**（conversationId, isSaved: false），用 `.returning({ id: quizzes.id })` 得到 **quizId**。
    2. **Insert** 多行到 **quiz_questions**，每行带 **quizId**（以及 title, options, correctAnswer, questionOrder, status），不再写 conversationId。
  - 这样每次「考我」都会新增一份 quiz 和多道题，不会删掉之前的 quiz（参见上文「储存方式」）。
- **返回值：** 当生成了 quiz 时，返回值中增加 **quizId**（例如 `return { conversationId, assistantMessage, quizId }`），前端用来设置当前选中的 quiz 并拉取该 quiz 的题目。

### B.4 updateQuizSaved(quizId, isSaved)

- **File:** `src/lib/chat.impl.server.ts`
- **New:** **updateQuizSavedImpl(data: { quizId: number; isSaved: boolean })**. Update **quizzes** set isSaved = data.isSaved where id = data.quizId. Return the updated row or { success: true }.
- **File:** `src/lib/chat.server.ts`
- **New:** **updateQuizSaved** server fn (POST) with inputValidator(quizId, isSaved), handler calling updateQuizSavedImpl.

### B.5 submitQuizAnswerImpl

- **File:** `src/lib/chat.impl.server.ts`
- **No change** to logic. It still selects/updates by **questionId**; quiz_questions still have id. Ensure any references to conversationId in this function are removed if the column is dropped (currently it only uses questionId).

---

## Part C: Frontend — State and API

### C.1 List quizzes and select one

- **File:** `src/routes/index.tsx`
- **State:** Add **quizzes** (array of quiz summary) and **selectedQuizId** (number | null). When **selectedConversationId** changes, fetch **getQuizzes(conversationId)** and set quizzes; set **selectedQuizId** to the first (e.g. latest) quiz’s id, or null if no quizzes.
- **Fetch questions:** When **selectedQuizId** (or selectedConversationId) changes, if selectedQuizId is set call **getQuizQuestionsFn({ data: { quizId: selectedQuizId } })**, else set quizQuestions to [].
- **showQuizPanel:** Keep as “we have a selected quiz and it has questions” (e.g. selectedQuizId != null && quizQuestions.length > 0), or “selected conversation has at least one quiz” and show the selected one.

### C.2 onQuizGenerated: pass quizId and set selected quiz

- **File:** `src/components/ChatUI.tsx`
- **Change:** When in quiz mode and the server returns a **quizId**, call **onQuizGenerated(conversationId, quizId)** (or pass an object). So the parent can set **selectedConversationId** (if new conversation), **selectedQuizId** to the new quiz, and refetch quizzes + questions for that quiz.
- **File:** `src/routes/index.tsx`
- **Change:** **onQuizGenerated(conversationIdWithQuiz?, quizId?)**. Set selectedConversationId if needed; set **selectedQuizId(quizId)** when quizId is present; call **refetchQuizzes** (getQuizzes for the conversation) and **refetchQuizQuestions** (getQuizQuestions for selectedQuizId) so the new quiz appears and is selected.

### C.3 QuizPanel: which quiz is shown; optional isSaved toggle

- **File:** `src/components/QuizPanel.tsx`
- **Props:** Continue to receive **questions** (for the selected quiz). Add **quizId** (number | null) and **isSaved** (boolean) and **onToggleSaved?** callback so the panel can show “Saved” state and a button to toggle. Parent gets isSaved from the selected quiz in the quizzes list; onToggleSaved calls **updateQuizSaved(quizId, !isSaved)** then refetches quizzes.
- **Optional:** Add a **quiz selector** (dropdown or list) in the Quiz panel or above it so the user can switch **selectedQuizId**; parent would pass **quizzes**, **selectedQuizId**, **onSelectQuiz(quizId)**.

### C.4 Refetch after generate

- When **onQuizGenerated** is called with a new **quizId**, the parent should:
  1. Set **selectedConversationId** if the conversation is new.
  2. Set **selectedQuizId** to the returned **quizId**.
  3. Refetch **quizzes** for the conversation (so the list includes the new quiz).
  4. Refetch **questions** for the selected quiz (so the panel shows the new questions).

---

## Part D: Server Return Shape

- **sendMessage** (and sendMessageImpl) return type should include optional **quizId** when a quiz was generated, e.g.:
  - `{ conversationId: number; assistantMessage: { role; content; mode }; quizId?: number }`
- **getQuizzes** returns `{ id: number; conversationId: number; createdAt: Date; isSaved: boolean }[]`.
- **getQuizQuestions** now takes **quizId** and returns the same question shape as before (per quiz).

---

## Implementation Checklist

- [ ] **A.1** Add **quizzes** table (id, conversation_id, created_at, is_saved).
- [ ] **A.2** Add **quiz_id** to quiz_questions; remove conversation_id from quiz_questions (or keep and backfill); update relations.
- [ ] **A.3** Generate and run migration.
- [ ] **A.4** If needed, data migration for existing quiz_questions.
- [ ] **B.1** Implement getQuizzesImpl and getQuizzes server fn.
- [ ] **B.2** Change getQuizQuestionsImpl to take quizId; update getQuizQuestions server fn.
- [ ] **B.3** In sendMessageImpl, insert quiz row then insert questions with quiz_id; return quizId when quiz generated; remove delete of quiz_questions.
- [ ] **B.4** Implement updateQuizSavedImpl and updateQuizSaved server fn.
- [ ] **B.5** Confirm submitQuizAnswerImpl still works (no conversationId dependency on quiz_questions if column removed).
- [ ] **C.1** index: state quizzes + selectedQuizId; fetch quizzes on conversation change; fetch questions by selectedQuizId; showQuizPanel based on selected quiz having questions.
- [ ] **C.2** ChatUI and index: onQuizGenerated(conversationId?, quizId?); set selectedQuizId and refetch quizzes + questions.
- [ ] **C.3** QuizPanel: accept quizId, isSaved, onToggleSaved; optional quiz selector UI.
- [ ] **C.4** Refetch flow after generate.
- [ ] Manually test: generate quiz → new quiz appears; generate again → second quiz appears; switch between quizzes; toggle isSaved.

---

## File Change Summary

| File | Changes |
|------|--------|
| **src/db/schema.ts** | Add **quizzes** table (id, conversationId, createdAt, isSaved). Add **quizId** to quiz_questions; remove conversationId from quiz_questions. Update relations. |
| **drizzle/** (migration) | New migration: create quizzes; add quiz_id to quiz_questions; backfill if needed; drop conversation_id from quiz_questions. |
| **src/lib/chat.impl.server.ts** | getQuizzesImpl; getQuizQuestionsImpl(quizId); sendMessageImpl: insert quiz + questions (no delete), return quizId; updateQuizSavedImpl. |
| **src/lib/chat.server.ts** | getQuizzes(conversationId); getQuizQuestions(quizId); updateQuizSaved(quizId, isSaved). |
| **src/routes/index.tsx** | State: quizzes, selectedQuizId. Fetch quizzes when conversation changes; fetch questions for selectedQuizId. onQuizGenerated(conversationId?, quizId?) sets selectedQuizId and refetches. showQuizPanel from selected quiz. |
| **src/components/ChatUI.tsx** | Pass quizId from sendMessage result into onQuizGenerated (e.g. onQuizGenerated(conversationId, quizId)). |
| **src/components/QuizPanel.tsx** | Optional: quizId, isSaved, onToggleSaved props; optional quiz selector. Parent passes data for the selected quiz. |

---

## Notes

- **Default quiz:** When opening a conversation that has quizzes, the UI can default **selectedQuizId** to the most recently created (e.g. first item of quizzes ordered by createdAt desc).
- **Backward compatibility:** Once getQuizQuestions takes quizId, any caller that previously passed conversationId must be updated to pass a quizId (from the quizzes list). There is no “get questions for conversation” anymore unless you add a convenience API that returns the latest quiz’s questions.
- **isSaved:** Default false for new quizzes. Toggling isSaved does not delete the quiz; it only marks it. Future cleanup (e.g. hide or delete unsaved old quizzes) can be a separate feature.
