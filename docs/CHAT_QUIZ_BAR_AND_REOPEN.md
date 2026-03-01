# Chat 顶部 Quiz 条与再次打开面板 — 开发手册

## 目标

**当前：** 在首页（/）当前 chat 刚生成 quiz 后，若用户关掉了右侧 Quiz 面板，**没有入口可以再次打开**；只能通过切换会话再切回来才能重新看到面板。

**预期：** 在 **ChatUI 顶部** 增加一条**横向 bar**，展示**当前 chat 关联的所有 quizzes**；点击其中某个 quiz 后，**左侧 Quiz 面板像刚生成时一样出现**，并显示该 quiz 的题目。

---

## 现状与数据流

- **index.tsx** 已有：`quizzes`（当前会话的 quiz 列表）、`selectedQuizId`、`setSelectedQuizId`。关闭面板时 `handleCloseQuizPanel` 只把 `selectedQuizId` 设为 `null`，**不清空** `quizzes`。因此关闭后面板不显示，但「当前 chat 有哪些 quiz」仍保存在 index 的 state 里。
- **ChatUI** 当前只接收：`conversationId`、`onConversationCreated`、`onQuizGenerated`，**不知道**当前会话的 quizzes 列表，也**无法**主动「打开某个 quiz」。
- **显示面板的条件**（index）：`showQuizPanel = selectedConversationId != null && selectedQuizId != null`。所以只要 index 执行 `setSelectedQuizId(quizId)`，面板就会重新出现并显示该 quiz（index 已有 useEffect 根据 selectedQuizId 拉取 questions）。

---

## 实现思路

1. **index** 把「当前 chat 的 quizzes」「当前选中的 quizId」「选中/打开某个 quiz 的回调」传给 **ChatUI**。
2. **ChatUI** 在顶部（在消息列表上方）增加一条 **Quiz bar**：仅当「有 conversation 且该 conversation 有 quizzes」时显示；bar 内横向列出这些 quizzes（如「Quiz 1」「Quiz 2」或带创建时间），当前选中的可高亮；点击某一项时调用父组件传入的「打开该 quiz」回调。
3. 回调在 index 中实现为：`(quizId: number) => setSelectedQuizId(quizId)`。这样点击后 `selectedQuizId` 有值，`showQuizPanel` 为 true，左侧 Quiz 面板出现，且 index 会拉取该 quiz 的 questions 并传给 QuizPanel，效果与「刚生成 quiz」时一致。

---

## 相关文件

```
src/routes/index.tsx     — 传 quizzes, selectedQuizId, onOpenQuiz(quizId) 给 ChatUI；onOpenQuiz = setSelectedQuizId
src/components/ChatUI.tsx — 新增顶部 Quiz bar；接收 quizzes, selectedQuizId?, onOpenQuiz(quizId)；仅当 quizzes.length > 0 时显示 bar
```

---

## 实现步骤

### Part A：index 向 ChatUI 传 quizzes、selectedQuizId、onOpenQuiz

**文件：** `src/routes/index.tsx`

- 在渲染 `ChatUI` 时增加 props：
  - **`quizzes={quizzes}`** — 当前会话的 quiz 列表（已有 state）。
  - **`selectedQuizId={selectedQuizId}`** — 当前选中的 quiz id（可为 null）；用于 bar 内高亮「当前打开的 quiz」。
  - **`onOpenQuiz={(quizId) => setSelectedQuizId(quizId)}`** — 或封装为 `handleOpenQuiz = useCallback((quizId: number) => { setSelectedQuizId(quizId) }, [])` 再传 `onOpenQuiz={handleOpenQuiz}`。子组件点击 bar 里某一项时调用此回调，index 设置 selectedQuizId，面板即显示并拉取该 quiz 的题目。

无需新增 state；`quizzes` 在切换会话时由现有 useEffect 更新，关闭面板时仍保留，故 bar 能正确显示「当前 chat 的 quizzes」。

### Part B：ChatUI 顶部增加 Quiz bar

**文件：** `src/components/ChatUI.tsx`

- **Props 扩展**  
  - `quizzes?: Array<{ id: number; createdAt: Date; isSaved: boolean }>`（与 index 里 `Quiz` 类型一致即可，可复用或从 chat.server 的 getQuizzes 返回类型取）。  
  - `selectedQuizId?: number | null`。  
  - `onOpenQuiz?: (quizId: number) => void`。

- **渲染逻辑**  
  - 在 ChatUI 最外层 flex 列布局中，在**消息列表区域之上**增加一条横条（Quiz bar）：  
    - 仅当 **`conversationId != null && quizzes && quizzes.length > 0`** 时渲染。  
    - 横条内横向排列当前 chat 的 quizzes（如按 `createdAt` 或 `id` 排序）。每个 item 可显示为按钮或可点击块，文案如「Quiz 1」「Quiz 2」或「Quiz · 日期」；若某 item 的 `id === selectedQuizId`，可加高亮样式（如背景色、边框）表示「当前打开的 quiz」。  
    - 点击某 quiz 时调用 **`onOpenQuiz?.(quiz.id)`**。  
  - 横条样式：flex 横排、不占过多高度（如一行）、与下方消息区有分隔（border-bottom 或间距），避免与现有 mode 按钮/输入区混淆（bar 在消息列表上方，mode 与输入区在下方保持不变）。

- **与现有布局的关系**  
  - 当前结构大致为：`[消息列表 flex-1 overflow-y-auto] [底部 mode + 输入]`。  
  - 在「消息列表」区块的**上方**插入 Quiz bar（可放在同一 flex 子容器内：上 bar、下为 scroll 区域），或 bar 作为 flex 的第一个子元素，消息列表为第二个。保证 bar 在视觉上位于 Chat 顶部、且仅在「有 quizzes」时出现。

### Part C：类型与边界

- **类型**：ChatUI 的 `quizzes` 与 index 的 `Quiz[]` 一致（id, conversationId, createdAt, isSaved）；若只用于 bar 展示与点击，可只传 id、createdAt、isSaved，conversationId 可选。
- **边界**：无 quizzes 或未传 `quizzes`/`onOpenQuiz` 时不显示 bar；`onOpenQuiz` 未传时 bar 内点击可不做任何事或仍不渲染 bar（与 Part B 条件一致即可）。

---

## 数据流简述

1. 用户在某 chat 生成了 quiz，随后关掉 Quiz 面板 → index 中 `selectedQuizId = null`，`quizzes` 仍为该会话的列表。
2. ChatUI 收到 `quizzes`、`selectedQuizId`、`onOpenQuiz`，因 `quizzes.length > 0` 在顶部渲染 Quiz bar，列出该 chat 的 quizzes。
3. 用户点击 bar 中「Quiz 2」→ `onOpenQuiz(quiz2.id)` → index 执行 `setSelectedQuizId(quiz2.id)` → `showQuizPanel` 为 true → 左侧 Quiz 面板出现，index 的 useEffect 拉取 quiz2 的 questions 并传给 QuizPanel，表现与「刚生成 quiz 时」一致。
4. 若用户再次关闭面板，bar 仍在，可再次点击任意 quiz 重新打开。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/routes/index.tsx` | 给 ChatUI 传入 `quizzes`、`selectedQuizId`、`onOpenQuiz`（如 `(quizId) => setSelectedQuizId(quizId)` 或 `handleOpenQuiz`）。 |
| `src/components/ChatUI.tsx` | 扩展 Props（quizzes, selectedQuizId, onOpenQuiz）；在消息区域上方增加 Quiz bar，仅在「有 conversation 且 quizzes.length > 0」时渲染；bar 内列出 quizzes，点击调用 onOpenQuiz(quizId)；可选高亮 selectedQuizId。 |

---

## 验收

- 在首页选中一个有至少一个 quiz 的 chat，关掉右侧 Quiz 面板后，Chat 顶部出现一条横 bar，列出该 chat 的 quizzes（如 Quiz 1、Quiz 2）。
- 点击 bar 中某一项后，左侧 Quiz 面板出现并显示该 quiz 的题目，行为与「刚生成 quiz」时一致。
- 再次关闭面板后，bar 仍在，可再次点击任意 quiz 重新打开面板。
- 切换至无 quiz 的 chat 时，bar 不显示；切换回有 quiz 的 chat 时，bar 再次出现并列出该 chat 的 quizzes。

---

## 小结

- **问题**：关闭 Quiz 面板后无法再打开。
- **做法**：index 把 quizzes、selectedQuizId、onOpenQuiz 传给 ChatUI；ChatUI 在顶部增加「当前 chat 的 quizzes」横条，点击某项即调用 onOpenQuiz(quizId)，由 index 设置 selectedQuizId，面板重新显示并加载该 quiz。
- **效果**：用户始终能在有 quiz 的 chat 里通过顶部 bar 再次打开并切换 quiz，无需切换会话。
