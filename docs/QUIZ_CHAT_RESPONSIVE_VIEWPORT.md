# Quiz / Chat 随视窗与分割比例变化 — 开发手册

## 目标

**当前：** 在 Chat 页（首页）有可拖拽的左右分割（Quiz 面板 | Chat），但 **Quiz 面板不会随视窗大小变化**，表现像是宽度被固定，只有 Chat 随屏幕变化（或被挤压）。

**预期：** Quiz 面板和 Chat 区域都 **随屏幕（视窗）大小变化**；拖拽分割条时比例生效，视窗缩放时两侧也按同一比例缩放。

---

## 原因简述

- 布局容器（`index.tsx`）已用 **百分比**（`quizPanelPercent`）控制 Quiz 区域宽度，且 Chat 用 `flex-1 min-w-0`，理论上会随父容器变化。
- **QuizPanel 组件** 根节点使用了 **固定宽度**（如 `md:w-80`），在中等及以上视口会覆盖父级给的宽度，导致：
  - 父级虽然设置了「占 content 区域 50%」等，子组件仍渲染为 320px 宽；
  - 视窗变窄/变宽时，Quiz 区域不随 content 区域一起变化，表现就是「quiz 不会根据视窗大小变化」。

因此需要：**让 Quiz 面板的宽度完全由父级（可调比例 + 视窗）决定，组件自身不设固定宽度**。

---

## 架构与相关文件

```
src/routes/index.tsx
  — 布局：ConversationList | [ contentAreaRef: Quiz 容器 | 分割条 | main (ChatUI) ]
  — 状态：quizPanelPercent（分割比例）、resizing
  — Quiz 容器：flex: 0 0 ${quizPanelPercent}%, minWidth: 200, maxWidth: '80%'

src/components/QuizPanel.tsx
  — 根节点 <aside> 当前带 md:w-80（及 min-w-0 flex-shrink-0）
  — 在首页被放在上述「Quiz 容器」内
```

---

## 实现步骤

### Part A：QuizPanel 不占固定宽度，随父级变化

**文件：** `src/components/QuizPanel.tsx`

- **问题：** 根元素 `<aside>` 使用 `md:w-80`（以及可能存在的 `flex-shrink-0`），在 md 断点以上会固定为 320px，父级给的百分比宽度无法生效。
- **修改：**
  - 去掉 **固定宽度**：删除 `md:w-80`（若存在 `w-80` 也删除）。
  - 让面板 **填满父容器** 且能在 flex 下正确收缩：
    - 使用 **`w-full`** 或 **`min-w-0 flex-1`**（在父容器为 flex 子项时），使宽度 100% 由父级决定。
  - 保留 **`min-w-0`**：在 flex 布局中允许内容收缩，避免内容把面板撑开导致不随视窗变化。
  - 若当前有 **`flex-shrink-0`**：在首页布局里宽度由父级 `flex: 0 0 ${percent}%` 决定，子项不需要 shrink-0；可改为 **`flex-shrink` 默认或 `flex-1`**，使内部滚动区域（`overflow-auto`）占满剩余高度即可。
- **建议的根 className 示例：**  
  `flex min-w-0 flex-1 flex-col border-l border-gray-200 bg-gray-50 overflow-hidden`  
  内部已有 `overflow-auto` 的滚动区保持不变，根节点用 `overflow-hidden` 避免溢出影响父布局。

**验收：** 在首页打开 Quiz 面板后，仅缩小/放大浏览器窗口，Quiz 区域宽度应随中间 content 区域一起变化；拖拽分割条仍可改变比例。

---

### Part B：首页布局保证 content 区域随视窗变化

**文件：** `src/routes/index.tsx`

- **确认以下点即可（多为已有逻辑）：**
  1. **最外层**：`flex h-[calc(100vh-4rem)]`，保证整页占满视窗高度。
  2. **ConversationList**：固定宽度，不参与「随视窗变化」的宽度计算。
  3. **contentAreaRef 容器**：`flex min-w-0 flex-1 flex-row`
     - `flex-1`：占满剩余宽度，随视窗变宽/变窄。
     - `min-w-0`：允许在视窗变窄时收缩，避免被子项撑开。
  4. **Quiz 面板外层 div**：
     - `flex: 0 0 ${quizPanelPercent}%`：宽度由比例决定，且随 content 区域宽度变化。
     - `minWidth: 200`、`maxWidth: '80%'`：限制极窄/极宽，避免布局崩溃。
     - `min-h-0 shrink-0`：高度填满、宽度不额外收缩（由 flex-basis 控制）。
     - `overflow-auto`：内容过长时在内部滚动。
  5. **main (Chat)**：`flex min-h-0 min-w-0 flex-1`，占剩余宽度并可在视窗变窄时收缩。

若 Part A 已改对，Part B 通常无需改代码，只需确认上述结构未被覆盖。

---

### Part C：小屏与极窄 content 的边界（可选）

- 当 content 区域很窄（例如移动端或窗口拉得很小）时：
  - 若 `minWidth: 200` 导致 Quiz + Chat 总宽超过 content，会出现横向滚动或挤压。
- **可选优化：**
  - 使用 **媒体查询** 或 **container query** 在极窄时减小或取消 `minWidth`（例如改为 0 或 120px），或
  - 在极窄时隐藏 Quiz 面板、仅显示 Chat（需额外状态或断点逻辑）。

手册不强制实现 Part C，实现 Part A + B 即可满足「quiz 和 chat 一样根据屏幕大小而变化」。

---

## 文件变更清单

| 文件                           | 操作                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `src/components/QuizPanel.tsx` | 去掉根节点固定宽度（如 `md:w-80`）；改为填满父容器并允许收缩（如 `w-full min-w-0 flex-1`），保证随父级与视窗变化。 |
| `src/routes/index.tsx`         | 通常无需改；仅确认 content 区域与 Quiz/Chat 的 flex 和 min-w-0 如上所述。                                          |

---

## 验收

- 首页打开任意有 Quiz 的会话，显示 Quiz 面板与 Chat。
- **拖拽分割条**：Quiz 与 Chat 宽度比例改变，布局正常。
- **缩小/放大浏览器窗口**：Quiz 与 Chat 的宽度都随视窗变化（比例保持不变或按当前比例一起缩放），无「Quiz 固定宽度、只有 Chat 在变」的现象。
- 小屏下（若未做 Part C）至少不报错、不严重错位；若实现 Part C，可按设计验收极窄时的表现。

---

## 小结

- **根因：** QuizPanel 使用 `md:w-80` 等固定宽度，覆盖了首页的百分比布局。
- **做法：** QuizPanel 根节点不再设固定宽度，改为「填满父容器 + min-w-0」，由父级（index 的 content 区域 + quizPanelPercent）和视窗共同决定宽度。
- **结果：** Quiz 和 Chat 都会随屏幕大小和分割比例变化。
