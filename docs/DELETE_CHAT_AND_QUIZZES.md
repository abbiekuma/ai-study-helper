# 删除 Chat（及未保存的 Quizzes）— 开发手册

## 目标

**当前：** Chat 没有删除功能；用户无法从侧边栏移除某个会话。

**预期：**

1. 在 **ConversationList** 里每个 chat 旁边增加一个**按钮**，点击后出现 **dropdown**。
2. Dropdown 里先增加一项 **「删除」**；点击后弹出**确认窗口**。
3. 确认文案：  
   **"Are you sure to delete this chat? If you choose to delete this chat, the quizzes within this chat will also be deleted. You can save the quiz you would like to keep before deleting the chat."**
4. 用户确认后：**删除该 chat（conversation）**；该 chat 下的 **quiz 一并删除**，**除非该 quiz 已被用户 save 过**（`isSaved === true` 的 quiz 保留，且之后仍可在「Saved」等入口使用）。

---

## 现状与约束

- **DB 结构**（`src/db/schema.ts`）  
  - `conversations`：会话。  
  - `messages`：`conversationId` → `conversations.id`，`onDelete: 'cascade'`。  
  - `quizzes`：`conversationId` → `conversations.id`，`onDelete: 'cascade'`。  
  - `quiz_questions`：`quizId` → `quizzes.id`，`onDelete: 'cascade'`。  

- **业务规则**  
  - 若直接 `DELETE FROM conversations WHERE id = ?`，DB 会级联删除该会话下**所有** messages 和 **所有** quizzes（以及 quiz_questions）。  
  - 需求是：**已 save 的 quiz 不删**。因此不能单靠 cascade；需要在删会话前把「要保留的 quiz」从该会话上「解绑」。

- **结论**  
  - 保留已保存 quiz：将它们的 `conversationId` 置为 `NULL`（即「孤儿 quiz」仍保留在 `quizzes` 表，仅不再属于任何会话）。  
  - 这要求 **`quizzes.conversationId` 允许 NULL**（目前是 `notNull()`，需要一次 schema 迁移）。  
  - 删除流程：  
    1. 将该 conversation 下所有 `isSaved === true` 的 quiz 的 `conversationId` 置为 `NULL`。  
    2. 再删除该 conversation；cascade 会删掉所有 messages 以及仍指向该 conversation 的 quizzes（即未保存的）及其 quiz_questions。

---

## 数据流与影响

1. **删除 conversation**  
   - 先 `UPDATE quizzes SET conversation_id = NULL WHERE conversation_id = ? AND is_saved = true`。  
   - 再 `DELETE FROM conversations WHERE id = ?` → 级联删除 messages、未保存的 quizzes、对应 quiz_questions。

2. **保留的 quiz（conversationId = null）**  
   - 仍出现在「Saved」列表（`getSavedQuizzesImpl` 按 `isSaved = true` 查，需改为能包含 `conversationId` 为 null 的行，见下）。  
   - 仍可在 `/quiz/saved`、`/quiz/$quizId` 等页面正常打开；`getQuizByIdImpl` 需支持 `conversationId` 为 null（见下）。

3. **依赖 conversation 的 API**  
   - `getQuizzes(conversationId)`：只查「某会话下的 quiz」，不会查到已置为 null 的 quiz，符合预期。  
   - `getAllQuizzesGroupedByConversationImpl`：按会话分组，可继续只处理 `conversationId IS NOT NULL` 的 quiz；已解绑的 quiz 只出现在 Saved，不参与「按会话分组」即可。  
   - `getSavedQuizzesImpl`、`getQuizByIdImpl`：当前用 `INNER JOIN conversations`，会排除 `conversationId` 为 null 的 quiz；需改为 **LEFT JOIN**，并允许 `conversationId` / `conversationTitle` 为 null。

---

## 实现思路总览

| 层级 | 内容 |
|------|------|
| **Schema** | `quizzes.conversationId` 改为可空；生成并运行迁移。 |
| **后端** | 新增 `deleteConversation(conversationId)`：先解绑已保存 quiz，再删 conversation；`getSavedQuizzesImpl` / `getQuizByIdImpl` 用 LEFT JOIN 支持 null conversationId。 |
| **Server API** | `chat.server.ts` 暴露 `deleteConversation` 的 createServerFn。 |
| **ConversationList** | 每行 chat 旁加「更多」按钮 → dropdown，其中一项「删除」→ 调确认弹窗 → 调 `deleteConversation`，成功后刷新列表并通知父组件。 |
| **首页 index** | 若当前选中的正是被删的 conversation，清空选中并（可选）刷新会话列表；若列表由父组件管理则通过 callback 刷新。 |

---

## 相关文件

```
src/db/schema.ts                    — quizzes.conversationId 改为可空；迁移
src/lib/chat.impl.server.ts        — deleteConversationImpl(conversationId)
src/lib/chat.server.ts             — createServerFn deleteConversation
src/lib/quiz.service.ts            — getSavedQuizzesImpl / getQuizByIdImpl 使用 LEFT JOIN 支持 conversationId null
src/components/ConversationList.tsx — 每行 dropdown + 删除 + 确认弹窗；成功后 onDeleted?.(id) 或刷新列表
src/routes/index.tsx               — 传 onDeleted 或 onConversationsChange，删除当前选中会话时清空 selectedConversationId 并刷新列表
```

---

## 实现步骤

### Part 1：Schema — `quizzes.conversationId` 可空

**文件：** `src/db/schema.ts`

- 将 `quizzes` 表中 `conversationId` 的 `.notNull()` 去掉，改为可空，例如：
  - `conversationId: integer('conversation_id').references(() => conversations.id, { onDelete: 'cascade' })`  
  （不再链 `.notNull()`。）
- 生成并执行迁移（如 `pnpm drizzle-kit generate` / `pnpm drizzle-kit migrate`，依项目配置而定）。  
- 注意：现有数据中所有 quiz 的 `conversationId` 当前均有值，迁移后仍一致；只有「删除 chat 时被保留的 saved quiz」会在之后被更新为 null。

---

### Part 2：后端 — 删除会话 + 解绑已保存 quiz

**文件：** `src/lib/chat.impl.server.ts`（或单独 `conversation.service.ts`，按你现有分层习惯）

- 新增 `deleteConversationImpl(data: { conversationId: number })`：
  1. （可选）校验 `conversationId` 存在。
  2. `UPDATE quizzes SET conversation_id = NULL WHERE conversation_id = data.conversationId AND is_saved = true`（使用 drizzle：`db.update(quizzes).set({ conversationId: null }).where(and(eq(quizzes.conversationId, data.conversationId), eq(quizzes.isSaved, true)))`）。
  3. `DELETE FROM conversations WHERE id = data.conversationId`（drizzle：`db.delete(conversations).where(eq(conversations.id, data.conversationId))`）；DB 级联删除该会话的 messages 以及仍指向该会话的 quizzes（未保存的）和对应 quiz_questions。

**文件：** `src/lib/chat.server.ts`

- 新增 server fn，例如：
  - `export const deleteConversation = createServerFn({ method: 'POST' }).inputValidator((data: { conversationId: number }) => data).handler(async ({ data }) => { const m = await import('./chat.impl.server'); return m.deleteConversationImpl(data) })`  
  （返回类型可为 `void` 或 `{ success: true }`。）

---

### Part 3：Quiz 服务 — Saved / getQuizById 支持 conversationId 为 null

**文件：** `src/lib/quiz.service.ts`

- **getSavedQuizzesImpl**  
  - 当前：`from(quizzes).innerJoin(conversations, eq(quizzes.conversationId, conversations.id))`。  
  - 改为：`from(quizzes).leftJoin(conversations, eq(quizzes.conversationId, conversations.id))`，且 `where(eq(quizzes.isSaved, true))`。  
  - 返回类型中 `conversationId`、`conversationTitle` 允许 `null`（Saved 列表里可显示为 "Saved" 或 "—" 等）。

- **getQuizByIdImpl**  
  - 同样改为 `leftJoin(conversations, ...)`，返回的 `conversationId`、`conversationTitle` 可为 null；调用方（如 Quiz 详情页）若有关联「回到某会话」的链接，在 `conversationId == null` 时不显示或显示为「来自已删除的会话」即可。

- **getAllQuizzesGroupedByConversationImpl**  
  - 可在查询中加 `where(quizzes.conversationId != null)`（或等价条件），只对「仍属于某会话」的 quiz 分组；已解绑的 quiz 仅通过 Saved 展示。

---

### Part 4：ConversationList — Dropdown + 删除 + 确认弹窗

**文件：** `src/components/ConversationList.tsx`

- **UI 行为**  
  - 每个 chat 行：左侧/右侧增加一个「更多」按钮（例如三点或下拉箭头），点击后展示 **dropdown**。  
  - Dropdown 中至少一项：**「删除」**（或 "Delete"）。  
  - 点击「删除」后：  
    - 先关闭 dropdown；  
    - 弹出**确认窗口**（可用浏览器 `confirm()` 或你现有的 Modal/Dialog 组件）。  
    - 确认文案严格使用：  
      **"Are you sure to delete this chat? If you choose to delete this chat, the quizzes within this chat will also be deleted. You can save the quiz you would like to keep before deleting the chat."**  
  - 用户确认：调用 `deleteConversationFn({ data: { conversationId: c.id } })`；成功后从本地 state 移除该条或重新拉取列表（见下），并调用 `onDeleted?.(c.id)` 以便父组件处理「当前选中的正是被删会话」的情况。  
  - 用户取消：仅关闭弹窗，不请求。

- **列表刷新**  
  - 删除成功后：要么 `fetchConversations()` 再 `setConversations` 刷新列表，要么由父组件通过 `onDeleted` 触发父组件自己的刷新并把新列表传给 ConversationList（若列表 state 在父组件）。当前 ConversationList 自带 `fetchConversations`，删除后直接再调一次 `fetchConversations().then(setConversations)` 即可。

- **Props**  
  - 增加可选 `onDeleted?: (conversationId: number) => void`，删除成功后调用，参数为被删的 conversation id。

- **组件选型**  
  - Dropdown：可用原生 HTML + state（点击按钮 toggle，点击外部关闭），或 shadcn DropdownMenu。  
  - 确认窗口：`window.confirm()` 最简单；若项目有 Dialog/AlertDialog，可替换为自定义弹窗以保持风格一致。

---

### Part 5：首页 index — 当前选中的是被删会话时的处理

**文件：** `src/routes/index.tsx`

- 若 ConversationList 的列表在父组件也有一份（当前是在 ConversationList 内部 state），只需在删除后由 ConversationList 调用 `onDeleted(id)`。  
- 父组件（index）传入：`onDeleted={(id) => { if (selectedConversationId === id) setSelectedConversationId(null); /* 若列表在父组件，再刷新列表 */ }}`。  
- 若列表完全在 ConversationList 内部，则删除后 ConversationList 自己 `fetchConversations()` 更新列表，并 `onDeleted(c.id)`；index 只负责：当 `selectedConversationId === id` 时 `setSelectedConversationId(null)`，避免继续展示已删会话或空白内容。

---

## 数据流简述（删除场景）

1. 用户在侧边栏某 chat 旁点击「更多」→ 选「删除」→ 看到确认文案。  
2. 用户确认 → 前端调用 `deleteConversation(conversationId)`。  
3. 服务端：将该会话下 `isSaved === true` 的 quiz 的 `conversationId` 置为 null；然后删除该 conversation；DB 级联删除 messages 与未保存的 quizzes。  
4. 前端：删除成功 → ConversationList 刷新列表（或由父组件刷新）并调用 `onDeleted(conversationId)`；index 若当前选中的是该 id，则 `setSelectedConversationId(null)`。  
5. 已保存的 quiz（conversationId 已为 null）仍可在「Saved」和 `/quiz/$quizId` 中正常显示；getSavedQuizzesImpl / getQuizByIdImpl 因 LEFT JOIN 能正确返回它们。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/db/schema.ts` | `quizzes.conversationId` 改为可空；生成并运行迁移。 |
| `src/lib/chat.impl.server.ts` | 新增 `deleteConversationImpl(conversationId)`：先解绑已保存 quiz，再删 conversation。 |
| `src/lib/chat.server.ts` | 新增 server fn `deleteConversation`。 |
| `src/lib/quiz.service.ts` | `getSavedQuizzesImpl`、`getQuizByIdImpl` 改为 LEFT JOIN 并允许 conversationId/conversationTitle 为 null；可选在 `getAllQuizzesGroupedByConversationImpl` 中只处理 conversationId 非 null。 |
| `src/components/ConversationList.tsx` | 每行增加 dropdown 按钮；dropdown 中「删除」→ 确认弹窗（固定文案）→ 调 `deleteConversation` → 刷新列表并 `onDeleted(id)`。 |
| `src/routes/index.tsx` | 传 `onDeleted` 给 ConversationList；当被删的是当前选中会话时 `setSelectedConversationId(null)`。 |

---

## 验收

- 侧边栏每个 chat 旁有按钮，点击出现 dropdown，其中有「删除」。  
- 点击「删除」后出现确认窗口，文案与需求一致（含 "quizzes within this chat will also be deleted" 与 "You can save the quiz you would like to keep before deleting"）。  
- 确认后该 chat 从列表消失；若当前正在看该 chat，主内容区清空或回到「未选会话」状态。  
- 该会话下未保存的 quiz 不再存在（如从 getQuizzes、getAllQuizzesGroupedByConversation 中消失）；该会话下已保存的 quiz 仍出现在 Saved 列表和 `/quiz/$quizId`，且可正常做题。

---

## 小结

- **功能**：ConversationList 每行 dropdown → 删除 → 确认弹窗（固定英文文案）→ 调用 `deleteConversation`；删除会话时保留已 save 的 quiz（置 `conversationId = null`），其余 quiz 随会话级联删除。  
- **数据**：schema 中 `quizzes.conversationId` 可空；删除逻辑先 UPDATE 再 DELETE；Saved/QuizById 用 LEFT JOIN 支持孤儿 quiz。  
- **UI**：ConversationList 负责 dropdown + 确认 + 刷新列表 + `onDeleted`；index 负责在删除当前会话时清空选中状态。
