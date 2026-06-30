# Frontend Guidelines

## 技术栈

- 框架：React 19，Electron 渲染进程。
- 样式：TailwindCSS 4 + CSS 变量，集中在 `src/index.css`。
- 图标：优先使用 `lucide-react` SVG 组件，避免 Emoji 和手写原始 SVG。
- 设计参考：OpenAI Codex + Alice，卡片式输入、气泡对话。

## UI 架构

```text
Sidebar(260px) + Main Area

Main Area:
- chat: 消息流 + Thinking / 工具卡片 + 居中输入卡片
- settings: SettingsPanel 全屏
- skills / memory: 对应面板全屏
- DevPanel: 侧推面板例外
```

## 设计原则

1. 气泡对话：用户消息右对齐圆角气泡，AI 消息左对齐 Markdown。
2. activeView 全屏：设置、技能、记忆占据整个主内容区，不使用侧推面板，DevPanel 除外。
3. 输入区卡片：居中 `max-w-2xl`，工具栏集成审批模式、模型快切、附件、语音、发送。
4. 信息分层：核心内容突出，辅助信息淡化。
5. 克制动效：短动画即可，例如 150ms 到 200ms。
6. hover 交互：消息操作栏、Token 用量等低频信息 hover 时出现。
7. 无底部状态栏：模型选择和 Token 用量留在输入区附近。

## CSS 变量

新增 UI 元素必须使用 `src/index.css` 中的 CSS 变量，禁止硬编码颜色。

关键变量组：

- 背景：`--bg-primary`、`--bg-secondary`、`--bg-tertiary`、`--bg-inset`
- 文字：`--text-primary`、`--text-secondary`、`--text-muted`
- 边框：`--border-color`、`--border-subtle`
- 语义色：`--accent`、`--success`、`--warning`、`--danger`
- 消息：`--msg-user-bg`、`--msg-ai-bg`
- 交互：`--sidebar-active`、`--sidebar-hover`、`--hover-overlay`、`--card-bg`、`--dropdown-bg`

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
