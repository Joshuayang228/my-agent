# Frontend Guidelines

## 技术栈

- 框架：React 19，Electron 渲染进程。
- 样式：TailwindCSS 4 + CSS 变量，集中在 `src/index.css`。
- 图标：优先使用 `lucide-react` SVG 组件，避免 Emoji 和手写原始 SVG。
- 设计参考：OpenAI Codex + Alice，卡片式输入、气泡对话。

## UI 架构

```text
Sidebar(260px) + Main Area

Sidebar（工具面）:
- 会话列表 + Skills / 记忆 / 设置入口

Main Area:
- chat: CompanionStatusBar + 消息流 + Thinking / 工具卡片 + 居中输入卡片
- 生活面: moments / assets / cast / shelf（角色架）
- 工具面: skills / memory / settings（settings 独立全屏）
- DevPanel: 侧推面板例外
```

## 设计原则

1. 气泡对话：用户消息右对齐圆角气泡，AI 消息左对齐 Markdown。
2. activeView 全屏：设置、技能、记忆、生活面占据整个主内容区，不使用侧推面板，DevPanel 除外。
3. 输入区卡片：居中 `max-w-2xl`，工具栏集成审批模式、模型快切、附件、发送（语音输入暂缓，见 wishlist）。
4. 信息分层：核心内容突出，辅助信息淡化。
5. 克制动效：短动画即可，例如 150ms 到 200ms。
6. hover 交互：消息操作栏、Token 用量等低频信息 hover 时出现。
7. 无底部状态栏：模型选择和 Token 用量留在输入区附近。
8. **生活面 / 工具面分离**：侧栏偏工具；朋友圈、衣柜、名册、角色架走主区专用 View + Chat 状态条快捷入口，禁止首屏做成能力仪表盘。

## 伴侣生活面（对照 Alice，方案见 `docs/requirements/frontend-companion-surfaces.md`）

### 双面原则

| 面 | 用户心智 | 视觉 | 典型 View |
|----|----------|------|-----------|
| 生活面 | 「她在过生活」 | 略暖、glass、卡片、主视觉优先 | chat 状态条 / moments / assets / cast / shelf |
| 工具面 | 「我在用工具」 | 略冷、密、表单 | skills / memory / settings |

### Token（`src/index.css`）

生活面组件优先用：

- `--companion-accent-warm` — 暖金点缀（徽标、分隔、Catch-up）
- `--companion-surface` / `--companion-blur` — 状态条薄雾底
- `--companion-shadow-card` — 朋友圈/角色卡阴影
- `--companion-catchup-bg` / `--companion-catchup-border` — Catch-up 暖色条（勿用 `--danger`）

禁止：紫光霓虹堆叠、无交互也套重卡片、把方法论术语写进 UI 文案。

### 组件约定

1. **CompanionStatusBar**（仅 chat）：`name · presence` + 朋友圈/名册/角色架快捷；高度约 36px，不抢气泡。
2. **Moments**：卡片时间线；类型色点；Catch-up 暖色条。
3. **CharacterShelf（shelf）**：换角**主入口**；3 槽卡片 + 活跃徽标；文案含流式禁止 / Catch-up / 召唤≠换角。设置页切换为次要入口。
4. **Wardrobe（assets）**：上「穿着中」主卡（由最近 Moment 的 `assetId`/`outfit` 推断），下库存网格；`style`/`occasion`/`color` 作场合标签芯片。
5. **Cast（名册）**：关系卡（头像字 + 关系徽标 + 短句）；展示最近召唤互动；可任主角者链到角色架，禁止把「开聊」做成换活跃。
6. **场景背景（P2）**：`CompanionSceneBackdrop` 铺在消息区底层；`resolveCompanionScene` 从 presence/location 映射 `home|office|cafe|street|commute|night|default`；只用 CSS 渐变/光晕，禁止引入 Alice 插画资产；对比度以气泡可读为先。

## CSS 变量

新增 UI 元素必须使用 `src/index.css` 中的 CSS 变量，禁止硬编码颜色。

关键变量组：

- 背景：`--bg-primary`、`--bg-secondary`、`--bg-tertiary`、`--bg-inset`
- 文字：`--text-primary`、`--text-secondary`、`--text-muted`
- 边框：`--border-color`、`--border-subtle`
- 卡片：`--card-bg`、`--card-border`（内容块外框只用这对，不要混用 `--border-color` 当卡片边）
- 输入：`--input-bg`、`--input-border`（经 `.theme-input`）
- 语义色：`--accent`、`--accent-subtle`、`--accent-fg`、`--success`、`--warning`、`--danger`
- 伴侣生活面：`--companion-accent-warm`、`--companion-surface`、`--companion-blur`、`--companion-shadow-card`、`--companion-catchup-*`
- 消息：`--msg-user-bg`、`--msg-ai-bg`
- 交互：`--sidebar-active`、`--sidebar-hover`、`--hover-overlay`、`--dropdown-bg`

禁止在组件里写死 `border-cyan-500` / `border-violet-500` 等选中色；选中态走 `--accent*`（危险例外走 `--danger`）。

## 画布框与设置页规范（强制统一）

后续凡新增设置区块、侧栏卡片、列表行，按本节约定，避免「有的有底、有的只有线、圆角/选中色各一套」。

### 三层框

| 层 | 用途 | 实现 |
|----|------|------|
| 页面壳 | 全屏视图背景 | `var(--bg-primary)`；侧栏可用 `--bg-secondary` |
| 内容卡 | 一组表单项 / 说明块 | `.settings-field` 或 `theme-card rounded-lg border p-4`（`card-bg` + `card-border`） |
| 控件 | input / textarea / select | `.theme-input` + **统一 `rounded-lg`**（禁止同页混用 `rounded`） |

列表行（如 MCP 服务器）：也用 `theme-card rounded-lg border`，与内容卡同 token。

### 选项芯片（主题 / 人格 / 沙箱 / 预设等）

- 类名：`.settings-option`；选中：`data-selected="true"`；危险选项另加 `data-danger="true"`。
- 未选：透明底 + `--border-color`；选中：`--accent` 描边 + `--accent-subtle` 底（勿硬编码 cyan/violet）。
- 主题色块预览可以保留各主题 swatch 颜色，但**选中环优先仍用 accent**，或仅用 swatch 色做点缀，不要整页混多套选中语义。

### 网格

选项网格用 `grid` + `repeat(auto-fill, minmax(7.5rem, 1fr))`（或等价），避免写死 `grid-cols-4` 却只剩 3 个导致末行空缺难看。

### 设置页结构约定

- `FieldGroup` = 一块内容卡（标题 + 可选 hint + 控件）。
- 分区标题用 `SectionTitle`，不要再给标题单独套边框。
- 空状态用 `border-dashed` + `--border-color`，仍保持 `rounded-lg`。

参考实现：`src/components/SettingsPanel.tsx` + `src/index.css` 中 `.settings-field` / `.settings-option`。

## 编码原则

- 遵守 KISS / DRY / YAGNI。
- 修改 React state 时创建新对象。
- 组件文件上限约 500 行，超过则拆分。
- 工具函数组件可以放在同文件底部。
- 下拉菜单优先向上弹出，避免被容器截断。

## 流式输出

- AI 响应必须流式返回，让用户看到实时输出。
- 结构性事件，例如工具开始、工具结束、完成、错误，应立即发送。
- `sendMessage` 的 finally 块必须兜底 `setIsStreaming(false)`，防止 IPC 竞态。

## IME 处理

输入框键盘事件必须检查 `event.isComposing` 或 `event.nativeEvent.isComposing`。中文输入法组合状态下不触发快捷键或提交。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建会话 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+F` | 搜索消息 |
| `Ctrl+,` | 设置 |
| `Ctrl+Shift+D` | 调试面板 |
| `Ctrl+Shift+M` | 记忆 |
| `Ctrl+Shift+K` | 技能 |
| `Esc` | 关闭面板、搜索或回到 chat |

## 验收

涉及 UI 的改动，应检查深色和浅色主题。重点看文本溢出、遮挡、错位和主要交互是否真实可用。
