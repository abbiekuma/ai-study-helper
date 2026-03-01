# Chat 页 Quiz 面板可关闭 — 开发手册

## 目标

**当前：** 在 Chat 页（首页）当有 Quiz 时，Quiz 面板会显示在右侧，**没有入口可以关掉**，用户无法主动收起面板以扩大 Chat 区域。

**预期：** 在 Chat 页展示 Quiz 时，提供**可关闭**的入口；关闭后面板隐藏，Chat 占满中间区域；可选提供「再次打开 Quiz」的入口。

---

## 现状与相关文件

- **`src/routes/index.tsx`**  
  - 状态：`selectedConversationId`、`selectedQuizId`、`quizzes`、`quizQuestions` 等。  
  - `showQuizPanel = selectedConversationId != null && selectedQuizId != null`，为 true 时渲染 Quiz 容器 + 分割条 + QuizPanel。  
  - 目前没有任何「把面板关掉」的操作。

- **`src/components/QuizPanel.tsx`**  
  - 接收 `quizId`、`quizzes`、`questions`、`onRefresh`、`onToggleSaved` 等，无 `onClose`。

---

## 实现思路（两种可选）

### 方案 A：关闭 = 清空当前选中的 Quiz（推荐，实现简单）

- **含义：** 用户点击「关闭」后，将 `selectedQuizId` 设为 `null`，则 `showQuizPanel` 变为 false，Quiz 面板不再渲染，Chat 占满 content 区域。
- **状态：** 不新增状态，沿用现有 `selectedQuizId`。关闭即 `setSelectedQuizId(null)`。
- **再次打开：**  
  - 方式 1：用户切换会话再切回该会话时，现有 `useEffect` 会重新拉取 quizzes 并设 `selectedQuizId = list[0]?.id`，面板会再次出现。  
  - 方式 2（可选）：当当前会话有 quizzes（`quizzes.length > 0`）但面板已关闭（`selectedQuizId === null`）时，在 Chat 区域显示一个「打开 Quiz」按钮，点击后 `setSelectedQuizId(quizzes[0].id)`（或让用户选一个 quiz）即可重新显示面板。

### 方案 B：独立「面板是否展开」状态

- **含义：** 新增 `quizPanelExpanded: boolean`（或 `quizPanelVisible`）。  
  - `showQuizPanel = selectedConversationId != null && selectedQuizId != null && quizPanelExpanded`。  
  - 关闭：`setQuizPanelExpanded(false)`；打开：`setQuizPanelExpanded(true)`。
- **特点：** 关闭后仍保留「当前选中的 quiz」，再次展开时无需重选。需要多维护一个状态，并在适当时机（如切换会话、或首次进入有 quiz 的会话）将 `quizPanelExpanded` 设为 true。

手册**推荐方案 A**，实现量小、逻辑清晰；若产品希望「关闭不丢失当前 quiz 选择」再考虑方案 B。

---

## 实现步骤（按方案 A）

### Part A：首页提供「关闭」回调并传给 QuizPanel

**文件：** `src/routes/index.tsx`

- 定义关闭行为：例如 `const handleCloseQuizPanel = useCallback(() => { setSelectedQuizId(null) }, [])`。
- 在渲染 QuizPanel 时传入新 prop：**`onClose={handleCloseQuizPanel}`**（仅当 `showQuizPanel` 为 true 时传入即可）。

### Part B：QuizPanel 支持 onClose 并展示关闭入口

**文件：** `src/components/QuizPanel.tsx`

- 在 Props 中新增可选 **`onClose?: () => void`**。
- 在面板头部区域（与 “Quiz” 标题、quiz 下拉、Save 等同一行或相邻）增加一个**关闭按钮**（例如图标 X 或文案「关闭」）：
  - 仅当 `onClose != null` 时渲染该按钮。
  - 点击时调用 `onClose()`。
- 使用无障碍属性（如 `aria-label="Close quiz panel"`），必要时给按钮加 `title` 提示。

### Part C（可选）：Chat 区域「打开 Quiz」入口

当当前会话有 quiz 但面板已关闭时，在 Chat 上方或输入区附近提供「打开 Quiz」入口，便于用户再次展开面板。

- **文件：** `src/routes/index.tsx` 或 `src/components/ChatUI.tsx`。
- **条件：** `selectedConversationId != null && quizzes.length > 0 && selectedQuizId == null`。
- **行为：** 显示按钮/链接，点击后执行 `setSelectedQuizId(quizzes[0].id)`（或取当前会话第一个 quiz）。若在 ChatUI 中实现，需由 index 传入 `quizzes`、`selectedQuizId` 以及 `onOpenQuiz?: (quizId: number) => void`（或直接传 `setSelectedQuizId`），由父组件控制状态。

若不做 Part C，用户仍可通过「切换会话再切回」或「再次发送考我」使面板重新出现（现有逻辑已支持）。

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/routes/index.tsx` | 新增关闭回调（如 `handleCloseQuizPanel`），并传给 QuizPanel 的 `onClose`；若做 Part C，可在此或通过 ChatUI 增加「打开 Quiz」的入口与状态更新。 |
| `src/components/QuizPanel.tsx` | 新增可选 prop `onClose`；在头部增加关闭按钮（仅当 `onClose` 存在时显示），点击调用 `onClose()`。 |

---

## 验收

- 在 Chat 页选中一个有 Quiz 的会话，Quiz 面板显示在右侧。
- 点击面板上的关闭按钮后，Quiz 面板消失，Chat 区域占满中间 content 区域。
- 切换至其他会话再切回该会话，Quiz 面板再次出现（或若实现 Part C，通过「打开 Quiz」也能再次出现）。
- 关闭按钮具备合适的无障碍与提示（如 aria-label / title）。

---

## 小结

- **需求：** Chat 页的 Quiz 面板支持用户主动关闭。
- **做法：** 用现有 `selectedQuizId`，关闭时设为 `null`；QuizPanel 增加 `onClose` 与关闭按钮；index 传入关闭回调。
- **可选：** 在面板关闭但当前会话有 quiz 时，提供「打开 Quiz」入口，便于再次展开面板。
