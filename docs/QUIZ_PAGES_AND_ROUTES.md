# Quiz 独立页面与路由 — 开发手册

## 目标

**当前：** 没有统一入口查看所有 quiz；quiz 仅在首页（/）的侧边 Quiz 面板中按当前会话展示。

**预期：** 新增 Quiz 主板块，通过独立路由可浏览「全部 Quiz（按 Chat 分类）」「已保存 Quiz」以及单个 Quiz 详情。

---

## 路由设计

| 路径 | 说明 | 对应板块 |
|------|------|----------|
| `/quiz` | Quiz 主页面 | 主页面：侧边导航 + 默认子板块（如重定向到 /quiz/all 或展示 All / Saved 入口） |
| `/quiz/all` | 全部 Quiz | 「All Quizzes」子板块：按 Chat 分组展示（如 Chat 1 下有 2 个 quiz） |
| `/quiz/saved` | 已保存 Quiz | 「Saved Quizzes」子板块：仅 isSaved === true 的 quiz，可带所属 Chat 信息 |
| `/quiz/$quizId` | 单个 Quiz 详情 | 查看某一 quiz 的题目列表，可答题、看对错、切换 isSaved |

---

## 架构概览

```
src/
├── routes/
│   ├── __root.tsx                    — 不变（Header 等）
│   ├── index.tsx                     — 不变（首页 Chat）
│   └── quiz/
│       ├── index.tsx                 — /quiz：Quiz 主页面（侧边 All / Saved，中间默认内容或 <Outlet />）
│       ├── all.tsx                   — /quiz/all：All Quizzes（按 chat 分组列表）
│       ├── saved.tsx                 — /quiz/saved：Saved Quizzes 列表
│       └── $quizId.tsx                — /quiz/:quizId：单个 Quiz 详情（题目 + 作答 + 保存状态）
├── lib/
│   ├── chat.server.ts                — 新增：getAllQuizzesGroupedByConversation, getSavedQuizzes；可选 getQuizById
│   └── quiz.service.ts               — 新增对应 Impl
├── components/
│   ├── Header.tsx                    — 改：导航中增加「Quizzes」入口（如 /quiz）
│   └── (可选) QuizList.tsx / QuizDetailView.tsx  — 可抽成组件供路由页使用
```

- **路由**：TanStack Router 文件路由。`quiz/index.tsx` 为 /quiz 主页面；`quiz/all.tsx`、`quiz/saved.tsx`、`quiz/$quizId.tsx` 为子路由。若希望 /quiz 为带侧栏的 layout，可用 `quiz.tsx` 作 layout（渲染 Outlet），其下 `index.tsx`、`all.tsx`、`saved.tsx`、`$quizId.tsx` 为子页面。
- **后端**：新增「全量 / 按 chat 分组」「仅已保存」的查询，以及按 quizId 查单条 quiz（若尚未有）。

---

## 数据与 API

### 已有

- `getQuizzes(conversationId)` — 某会话下所有 quiz
- `getQuizQuestions(quizId)` — 某 quiz 的题目
- `updateQuizSaved(quizId, isSaved)` — 更新保存状态
- `getConversations()` — 会话列表（id, title, mode, createdAt）

### 需新增

| API | 用途 | 返回建议 |
|-----|------|----------|
| **getAllQuizzesGroupedByConversation** | /quiz/all：按 chat 分组展示 | `{ conversationId, title?, mode, createdAt, quizzes: { id, createdAt, isSaved }[] }[]`，按会话 createdAt 或 quiz 数量排序 |
| **getSavedQuizzes** | /quiz/saved：仅已保存 | `{ id, conversationId, createdAt, isSaved: true, conversationTitle? }[]`，按 createdAt desc |
| **getQuizById**（可选） | /quiz/:quizId：详情页头部展示 quiz 元信息 | `{ id, conversationId, createdAt, isSaved } \| null`；若暂无，可用 getQuizQuestions 存在即视为有效，conversationId 从现有 getQuizzes 反查或在新 API 里一并返回 |

说明：

- **All Quizzes**：需要「所有会话 + 每个会话下的 quizzes」。可先 `getConversations()` 再对每个 conversation 调 `getQuizzes(conversationId)` 并过滤无 quiz 的会话；或后端提供一次查询：`getAllQuizzesGroupedByConversation()`，返回上述分组结构。
- **Saved Quizzes**：可后端 `select from quizzes where is_saved = true` 并 join conversations 取 title，或前端用现有 getConversations + getQuizzes 过滤 isSaved。
- **Quiz 详情**：已有 `getQuizQuestions(quizId)` 即可渲染题目；若需显示「所属 Chat」「创建时间」「已保存」等，可新增 `getQuizById(quizId)` 或在上列接口中带上 conversation 信息。

---

## 实现步骤

### Part A：后端 — quiz.service + chat.server

**文件：** `src/lib/quiz.service.ts`

- **getAllQuizzesGroupedByConversationImpl()**  
  - 查询所有有 quiz 的 conversation（或先查 conversations 再按 conversationId 聚合同一 conversation 的 quizzes）。  
  - 返回形如：`Array<{ conversationId, title?, mode, createdAt, quizzes: Array<{ id, createdAt, isSaved }> }>`。  
  - 为减少 N+1，可用一条「quizzes + conversations」的 join 查询，再在内存里按 conversationId 分组；或两次查询（conversations 列表 + 所有 quizzes）再前端/服务端分组。

- **getSavedQuizzesImpl()**  
  - `select from quizzes where is_saved = true`，可 join conversations 取 title。  
  - 返回：`Array<{ id, conversationId, createdAt, isSaved, conversationTitle? }>`，按 createdAt desc。

- **getQuizByIdImpl(data: { quizId: number })**（可选但推荐）  
  - `select from quizzes where id = quizId`，返回单条或 null；若需要 conversation 标题，可 join conversations。

**文件：** `src/lib/chat.server.ts`

- 新增 server fn（createServerFn）：
  - **getAllQuizzesGroupedByConversation** — handler 调 `quiz.service.getAllQuizzesGroupedByConversationImpl()`。
  - **getSavedQuizzes** — handler 调 `quiz.service.getSavedQuizzesImpl()`。
  - **getQuizById**（可选）— handler 调 `quiz.service.getQuizByIdImpl(data)`。

---

### Part B：路由与页面结构

**约定：** 使用 TanStack Router 文件路由。若项目当前为单文件路由（如仅 `routes/index.tsx`），需支持 `routes/quiz/` 目录。

- **`src/routes/quiz.tsx`**（推荐）  
  - 作为 **layout**：path 为 `/quiz`，渲染左侧「All Quizzes」「Saved Quizzes」链接 + `<Outlet />`。  
  - 这样 `/quiz`、`/quiz/all`、`/quiz/saved`、`/quiz/123` 共享同一 layout。

- **`src/routes/quiz/index.tsx`**  
  - path 为 `/quiz`（index 子路由）。  
  - 内容：主页面，可重定向到 `/quiz/all`（`<Navigate to="/quiz/all" />`），或直接在该页渲染「All Quizzes」「Saved Quizzes」两个入口卡片/列表摘要。

- **`src/routes/quiz/all.tsx`**  
  - path 为 `/quiz/all`。  
  - 调用 `getAllQuizzesGroupedByConversation()`，按「Chat（标题或 id）」分组渲染 quiz 列表；每项可链接到 `/quiz/$quizId`。

- **`src/routes/quiz/saved.tsx`**  
  - path 为 `/quiz/saved`。  
  - 调用 `getSavedQuizzes()`，渲染已保存 quiz 列表；每项链接到 `/quiz/$quizId`。

- **`src/routes/quiz/$quizId.tsx`**  
  - path 为 `/quiz/:quizId`。  
  - 使用 `useParams()` 或 route 的 params 取 `quizId`；调用 `getQuizById(quizId)`（若有）和 `getQuizQuestions(quizId)`；渲染该 quiz 的元信息（所属 chat、是否已保存、创建时间）+ 题目列表（复用现有 QuizPanel 的题目展示与 submitQuizAnswer 逻辑，或抽成共用组件）；提供「保存/取消保存」按钮，调用 `updateQuizSaved(quizId, isSaved)`。

**重定向：** 若希望 `/quiz` 默认进入「All Quizzes」，在 `quiz/index.tsx` 中 `<Navigate to="/quiz/all" />` 或在 layout 的 index 子路由中做重定向。

---

### Part C：导航入口

**文件：** `src/components/Header.tsx`（或主导航组件）

- 在侧栏/顶栏中增加「Quizzes」或「所有 Quiz」入口，链接到 `/quiz`（或 `/quiz/all`），与现有「Home」并列。  
- 若使用 layout `quiz.tsx`，侧栏内可再放「All Quizzes」「Saved Quizzes」链接到 `/quiz/all`、`/quiz/saved`。

---

### Part D：UI 复用与组件

- **题目展示与作答**：首页 Quiz 面板（`QuizPanel`）已有题目列表、选项、提交答案、正确/错误展示。可在 `/quiz/$quizId` 中复用同一组件或抽成「只读题目列表 + 作答」组件（如 `QuizQuestionList`），接收 `questions`、`onSubmitAnswer`、`onRefresh` 等。  
- **列表项**：All Quizzes / Saved Quizzes 的每条 quiz 可展示：quiz 创建时间、所属 Chat 标题、是否已保存、链接到 `/quiz/$quizId`。  
- **保存状态**：详情页（`/quiz/$quizId`）可显示当前 isSaved，并提供按钮调用 `updateQuizSaved(quizId, !isSaved)` 后刷新或更新本地状态。

---

## 数据流简述

1. **/quiz**：进入主页面或重定向到 /quiz/all。  
2. **/quiz/all**：`getAllQuizzesGroupedByConversation()` → 按 Chat 分组渲染 → 点击某 quiz → 跳转 `/quiz/$quizId`。  
3. **/quiz/saved**：`getSavedQuizzes()` → 列表渲染 → 点击 → `/quiz/$quizId`。  
4. **/quiz/:quizId**：`getQuizById(quizId)` + `getQuizQuestions(quizId)` → 展示元信息 + 题目；提交答案用 `submitQuizAnswer`；切换保存用 `updateQuizSaved`。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/lib/quiz.service.ts` | **新增** getAllQuizzesGroupedByConversationImpl、getSavedQuizzesImpl、getQuizByIdImpl（可选）。 |
| `src/lib/chat.server.ts` | **新增** server fn：getAllQuizzesGroupedByConversation、getSavedQuizzes、getQuizById（可选）。 |
| `src/routes/quiz.tsx` | **新建**（推荐）：/quiz layout，侧栏 + Outlet。 |
| `src/routes/quiz/index.tsx` | **新建**：/quiz 主页面（或重定向到 /quiz/all）。 |
| `src/routes/quiz/all.tsx` | **新建**：/quiz/all，All Quizzes 按 Chat 分组。 |
| `src/routes/quiz/saved.tsx` | **新建**：/quiz/saved，Saved Quizzes 列表。 |
| `src/routes/quiz/$quizId.tsx` | **新建**：/quiz/:quizId，单 quiz 详情。 |
| `src/components/Header.tsx` | **改**：增加「Quizzes」链接到 /quiz。 |
| （可选）`src/components/QuizQuestionList.tsx` 等 | 从 QuizPanel 抽题目展示逻辑供首页与 /quiz/$quizId 复用。 |

---

## 验收

- 访问 `/quiz` 进入 Quiz 主板块（或重定向到 /quiz/all）。  
- `/quiz/all` 按 Chat 分组展示所有 quiz，点击可进入 `/quiz/:quizId`。  
- `/quiz/saved` 仅展示已保存 quiz，点击可进入详情。  
- `/quiz/:quizId` 展示该 quiz 元信息与题目，可作答、可切换保存状态。  
- Header 中有 Quizzes 入口，与现有首页并存。

---

## 附录：TanStack Router 文件路由约定

- `routes/quiz.tsx` → layout 路径 `/quiz`，需渲染 `<Outlet />` 给子路由。  
- `routes/quiz/index.tsx` → `/quiz`。  
- `routes/quiz/all.tsx` → `/quiz/all`。  
- `routes/quiz/saved.tsx` → `/quiz/saved`。  
- `routes/quiz/$quizId.tsx` → `/quiz/:quizId`，通过 `routeParams.quizId` 或 `useParams()` 取 id。  

若不用 layout，可仅建 `quiz/index.tsx`、`quiz/all.tsx`、`quiz/saved.tsx`、`quiz/$quizId.tsx`，则无单独 `/quiz` layout 包裹，各页独立；此时「主页面」可为 `quiz/index.tsx` 内做 All / Saved 入口卡片并链接到 `/quiz/all`、`/quiz/saved`。
