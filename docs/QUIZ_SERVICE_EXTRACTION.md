# Quiz 逻辑抽离至 quiz.service — 开发手册

## 目标

**当前：** 所有 server 实现都写在 `chat.impl.server.ts` 中（会话、消息、发送消息、quiz 列表/题目/提交答案/保存状态、以及 sendMessage 里的「考我」分支）。

**预期：** 将 **quiz 相关** 的实现抽离到 `quiz.service.ts`，使职责更清晰：`chat.impl.server.ts` 只负责会话与消息，quiz 的 CRUD 与生成逻辑集中在 `quiz.service.ts`。

---

## 架构概览（改完后）

```
src/lib/
├── chat.server.ts         — 不变：仍为所有 createServerFn 的入口；quiz 的 handler 改为从 quiz.service 取实现
├── chat.impl.server.ts    — 仅保留：会话/消息 + sendMessageImpl（sendMessageImpl 在「考我」分支里调用 quiz.service）
└── quiz.service.ts        — 新增：quiz 的查询/提交/保存 + 考我上下文/是否考我请求/生成并落库
```

- **chat.server.ts**：不新增、不删除任何 server fn；仅把 getQuizzes / getQuizQuestions / submitQuizAnswer / updateQuizSaved 的 handler 从 `import('./chat.impl.server')` 改为 `import('./quiz.service')`。
- **chat.impl.server.ts**：删除所有 quiz 专属实现；保留 getConversationsImpl、getMessagesImpl、sendMessageImpl；sendMessageImpl 在 mode === 'quiz' 且 isQuizGenerationRequest 时调用 quiz.service 的「生成并落库」接口。
- **quiz.service.ts**：承载所有 quiz 相关实现；对外提供 getQuizzes、getQuizQuestions、submitQuizAnswer、updateQuizSaved，以及供 sendMessageImpl 调用的「上下文 / 是否考我 / 生成并落库」函数。

前端仍从 `../lib/chat.server` 引用 getQuizzes、getQuizQuestions、submitQuizAnswer、updateQuizSaved，**无需改动**。

---

## 归属划分

### 留在 chat.impl.server.ts（仅 chat）

| 函数 | 说明 |
|------|------|
| getConversationsImpl | 会话列表 |
| getMessagesImpl | 消息列表 |
| sendMessageImpl | 发消息（含创建会话、写 user/assistant 消息）；在「考我」分支内**调用** quiz.service，不直接操作 quizzes / quiz_questions |

### 迁入 quiz.service.ts（quiz 专属）

| 函数 | 说明 |
|------|------|
| getConversationContextForQuiz | 按 conversationId 取「非 quiz 模式」的对话内容，供生成题目用 |
| isQuizGenerationRequest | 判断用户输入是否为「考我」类请求 |
| getQuizzesImpl | 按 conversationId 查 quiz 列表 |
| getQuizQuestionsImpl | 按 quizId 查题目列表 |
| submitQuizAnswerImpl | 提交单题答案、更新 correct/incorrect 与 score |
| updateQuizSavedImpl | 更新 quiz 的 isSaved |
| **createQuizFromContext**（新，见下） | 根据 conversationId + 上下文生成题目并落库，返回 { quizId, replyText } |

其中 **createQuizFromContext** 是把 sendMessageImpl 里「考我」分支中「取上下文 → 调 generateQuizMcqs → insert quizzes + quiz_questions → 生成回复文案」整段逻辑封装成一个函数，供 sendMessageImpl 调用，避免 chat.impl 直接依赖 db 的 quizzes/quizQuestions 和 gemini 的 generateQuizMcqs。

---

## 实现步骤

### Part A：新建 quiz.service.ts

**文件：** `src/lib/quiz.service.ts`

- **依赖：**  
  - `db`、`quizzes`、`quizQuestions`、`messages`（仅 getConversationContextForQuiz 用）  
  - `generateQuizMcqs`（来自 gemini.server）

- **迁移到本文件：**
  1. `getConversationContextForQuiz(conversationId)` — 从 chat.impl.server 移入（逻辑不变，仅改 import：用 db、messages）。
  2. `isQuizGenerationRequest(message)` — 从 chat.impl.server 移入（纯函数，无依赖）。
  3. `getQuizzesImpl(data: { conversationId: number })` — 从 chat.impl.server 移入。
  4. `getQuizQuestionsImpl(data: { quizId: number })` — 从 chat.impl.server 移入。
  5. `submitQuizAnswerImpl(data: { questionId, userAnswer })` — 从 chat.impl.server 移入。
  6. `updateQuizSavedImpl(data: { quizId, isSaved })` — 从 chat.impl.server 移入。
  7. **新增** `createQuizFromContext(data: { conversationId: number; context: string })`：
     - 内部调用 `generateQuizMcqs(context)` 得到 mcqs；
     - insert 一行 `quizzes`（conversationId, isSaved: false），拿到 quizId；
     - 对 mcqs 逐条 insert `quiz_questions`（quizId, title, options, correctAnswer, questionOrder, status: 'pending'）；
     - 返回 `{ quizId, replyText }`，其中 replyText 为现有成功文案（如 "I've added N questions..."）；  
     若 `generateQuizMcqs` 抛错，不在此处 catch，由上层 sendMessageImpl 统一 catch 并生成错误回复。

- **导出：** 以上 7 个函数均 export，供 chat.impl.server 与 chat.server 使用。

### Part B：精简 chat.impl.server.ts

**文件：** `src/lib/chat.impl.server.ts`

- **删除：**  
  getConversationContextForQuiz、isQuizGenerationRequest、getQuizzesImpl、getQuizQuestionsImpl、submitQuizAnswerImpl、updateQuizSavedImpl，以及 sendMessageImpl 内「考我」分支里直接操作 quizzes/quiz_questions 的整段实现（保留「插入 assistant 消息 + return conversationId + assistantMessage + quizId」的返回形状）。
- **依赖调整：**  
  - 不再 import `quizzes`、`quizQuestions`。  
  - 若 sendMessageImpl 仍需要「插入 assistant 消息」的常量（如 model 名），可保留现有常量或从 gemini 取，与 quiz 无关的保留在 chat.impl。
- **sendMessageImpl 中「考我」分支改为：**
  1. `const context = await getConversationContextForQuiz(conversationId)` — 从 `import('./quiz.service')` 取得 getConversationContextForQuiz。
  2. 若 `!context.trim()`：保持现有逻辑（generateReply 等），不涉及 quiz。
  3. 若 `isQuizGenerationRequest(userMessage)`（从 quiz.service 引入）：
     - `try { const { quizId, replyText } = await createQuizFromContext({ conversationId, context })`（从 quiz.service 引入）；
     - 然后在本文件内：插入 assistant 消息（content = replyText），并 `return { conversationId, assistantMessage: { ... }, quizId }`；
     - `catch`：保持现有错误回复逻辑（replyText = "Quiz generation failed: ..."），不 return quizId，继续走到下面插入 assistant 消息并正常 return。
  4. 否则（quiz 模式但不是考我请求）：保持现有 generateReply + 插入消息逻辑不变。

- **导出：** 仅保留并导出 getConversationsImpl、getMessagesImpl、sendMessageImpl。不再导出任何 quiz 相关函数。

### Part C：chat.server.ts 的 handler 指向 quiz.service

**文件：** `src/lib/chat.server.ts`

- 以下 4 个 server fn 的 handler 中，将动态 import 从 `'./chat.impl.server'` 改为 `'./quiz.service'`，并调用同名函数（参数不变）：
  - getQuizzes → getQuizzesImpl
  - getQuizQuestions → getQuizQuestionsImpl
  - submitQuizAnswer → submitQuizAnswerImpl
  - updateQuizSaved → updateQuizSavedImpl

- 其余 server fn（getConversations、getMessages、sendMessage）的 handler 仍从 `'./chat.impl.server'` 引入并调用对应 Impl，不变。

### Part D：类型与错误

- **quiz.service.ts** 中若需要 ChatMode / HistoryMessage 等类型，仅从 gemini.server 或已有类型文件 import，不要从 chat.impl 引入，避免循环依赖。
- **createQuizFromContext** 的抛错：不吞掉，让 sendMessageImpl 的 try/catch 统一处理并写入 assistant 消息。

---

## 数据流（改完后，仅「考我」相关）

1. 用户发送「考我」 → 前端调用 `sendMessage`（chat.server）。
2. sendMessage 的 handler 调用 `sendMessageImpl`（chat.impl.server）。
3. sendMessageImpl 发现 mode === 'quiz' 且 isQuizGenerationRequest：
   - 调用 quiz.service 的 `getConversationContextForQuiz(conversationId)`；
   - 调用 quiz.service 的 `createQuizFromContext({ conversationId, context })` → 内部 generateQuizMcqs、insert quizzes + quiz_questions，返回 { quizId, replyText }；
   - sendMessageImpl 写入 assistant 消息，并 return { conversationId, assistantMessage, quizId }。
4. 前端 getQuizzes / getQuizQuestions / submitQuizAnswer / updateQuizSaved 的请求 → chat.server 的对应 handler → quiz.service 的对应 Impl，不再经过 chat.impl.server。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/lib/quiz.service.ts` | **新建**：7 个函数（见 Part A）。 |
| `src/lib/chat.impl.server.ts` | **删** 6 个 quiz 函数；**改** sendMessageImpl 的「考我」分支为调用 quiz.service；**删** 对 quizzes、quizQuestions 的 import。 |
| `src/lib/chat.server.ts` | **改** 4 个 quiz 相关 server fn 的 handler：import 从 `./chat.impl.server` 改为 `./quiz.service`，调用名不变。 |
| 前端（routes/index.tsx, QuizPanel, ChatUI, ConversationList） | **不改**（仍从 chat.server 引用）。 |

---

## 验收

- 行为与当前一致：同一会话下可生成多份 quiz、可切换 quiz、可提交答案、可切换 isSaved；新会话 + 考我仍能正确创建会话并返回 quizId、展示题目。
- `chat.impl.server.ts` 中不再出现对 `quizzes`、`quizQuestions` 的引用；quiz 相关实现全部在 `quiz.service.ts`。
- 无循环依赖：quiz.service 可 import chat.impl 用到的 gemini/db/schema 子集，但不要 import chat.impl；chat.impl 仅 import quiz.service。
