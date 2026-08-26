# Frontend Guidelines

> 施工合同：`docs/requirements/frontend-visual-language.md`  
> 理念来源：Alice 方法论 Ch.19《UI/UX 设计哲学》（有信仰的克制）  
> 布局决策：DEC-018（Codex 居中输入 + Alice 侧栏 / 多 View）

## 技术栈

- 框架：React，Electron 渲染进程。
- 样式：TailwindCSS 4 + CSS 变量，集中在 `src/index.css`。
- 图标：**仅** `lucide-react` SVG；禁止 Emoji 当图标。跨页面复用的语义图标优先登记到 `src/shared/icon-registry.ts`，不要再引入第二套生产图标库。
- UI 组件资产：稳定语义、来源、采用状态和无障碍约束登记到 `src/shared/ui-component-registry.ts`；注册表不复制组件实现，候选外部 Primitive 不得冒充已安装依赖。
- 字体：UI 用 `--font-ui`；空态问候 / 伙伴身份展示可用 `--font-display`（衬线），勿污染表单。

---

## 七公理（我方释义）

| # | 公理 | 可执行 |
|---|------|--------|
| 1 | 结构自显，拒绝贴标签 | **禁止**卡片 / 列表行左侧 accent 竖线（`border-l-*` 色条）标层级；用底色、字重、留白。布局分隔（侧栏 `border-r`）除外 |
| 2 | 时间连续，拒绝硬切 | View / 设置分栏 / 弹层用 `var(--motion-*)`；最低 fade；有输入的确认框禁点遮罩关闭 |
| 3 | 颜色是语义，不是装饰 | 每主题语义主色收拢为 bg / text / accent；生活点缀只用 `--companion-accent-warm`；禁止同页多套相近强调色 |
| 4 | 图标统一 | Lucide；尺寸阶梯 12 / 14 / 16 / 20 |
| 5 | 信息分层 | 设置基础 / 高级；Chat 默认不抢开发入口（Phase 2–3） |
| 6 | 流式即时 | Callback 三通道保持；识别到工具名即出卡 |
| 7 | 视觉边界完整 | 确认 / Toast 在应用内，不用系统 `alert` |

**禁区速查**：紫光霓虹堆叠、无交互重卡片、方法论术语进 UI、假设置死链、左侧色条标状态。

---

## UI 架构

```text
PrimarySidebar(260px) [+ SecondaryNav(200px)?] + Main Area

Primary（对齐 Alice 侧栏）:
- 品牌/主角区 + 大号「新对话」CTA
- 会话列表（标题 + 时间戳 + 摘要）
- 底栏：Playground/Debug 字钮 + 生活宫格（朋友圈/物什/名册/记忆/角色架/设置）
- Skills 不进宫格 → Secondary「工具」或设置入口

Secondary（非 chat / 非 settings 全屏时）:
- 生活 | 工具 | 开发 分组导航

Main Area:
- chat: CompanionStatusBar + 消息流（`space-y-8`）+ 居中输入（max-w-3xl）
- 生活面 / 工具面 / DevPanel 全页
- settings: 独立全屏（无 Secondary）
```

### Chat 工具卡放置（Alice Phase B）

- 工具卡**挂在发起调用的 assistant 回合内**（正文后），解析见 `resolve-tools-for-message.ts`
- 历史：`assistant.toolCalls` + 紧随 `role=tool`；进行中：`activeTools` 挂 `findLiveToolHostId`
- `role=tool` **不单独占消息行**；产品态默认折叠，对话 Debug 可展开历史卡
- **禁止**只挂消息流底部并在 `done` 时清空（会蒸发）

### Playground（基础 → 产品体验 → Agent 实验 · 轻量，非 Storybook）

施工合同：`docs/requirements/playground-navigation-world-polish-v1.md`

- **三类工作域**：`基础` 生产设计语言、图标与视觉资产、基础组件；`产品体验` 组合 Chat、人物世界、记忆、设置、工作区和业务状态；`Agent 实验` 负责对话、模型和工具试验。
- **两层设计边界**：设计基础提供可复用的样式、组件和交互能力；产品体验只负责业务语义、数据、页面组合和流程，不另造基础组件。业务专属结构（伙伴状态条、生活事件卡、角色卡、记忆引用芯片、完整工作坞）属于 Experience，不得伪装成 Foundation。
- **先基础后体验**：开发产品体验前必须先检查基础资产；基础能力缺失时，先在“基础组件”建立故事、登记来源并完成 Playground 验收，再回到产品体验引用。
- **依赖登记门禁**：每个活跃产品体验必须在 `src/shared/product-experience-registry.ts` 声明 `usesFoundation`；依赖 key 必须存在、属于 `foundation` 层且生命周期兼容。反向“被哪些体验使用”只能自动派生，禁止手工维护第二份。
- **禁止重复实现**：产品体验层不得直接新造通用按钮、Dialog、Toast、颜色语义、图标语义或基础交互；允许在业务层组合已有基础并注入业务文案、数据和行为。
- **反向升级**：仅一个业务场景需要的结构留在产品体验；多个场景反复需要且可脱离业务复用的能力，先回流基础侧再登记。Experience 只能引用注册表中 `layer: foundation` 的资产；缺失依赖不得在产品页临时造一个同名组件。
- **壳**：Playground 与 Settings 一样独立全屏，只显示自身单一侧栏 + 内容区；禁止与产品 Primary Sidebar 同时出现形成双层侧栏。工作台内部只允许筛选和状态切换，不再嵌套承担页面跳转职责的二级导航。
- **故事格**：一状态一格；import 正式组件/class；边缘态必有；格旁标源路径
- **组件目录**：`candidate → playground → adopted → deprecated → archived`；已采用必须指向真实源码，候选只记录参考来源，不动态安装或写入正式页面
- **采用标记**：只在有直接生产证据的具体 token、组件或故事项上显示统一小图标；禁止给目录、分组标题或整页批量标“已采用”，也不提供全局显隐开关。无图标只表示“未登记采用证据”，不得推断成实验中、备用或候选。
- **Tab 事实表**：设计语言只放颜色 / 主题 / 圆角动效；图标与视觉只放可复用图标；基础组件只放脱离业务的组件故事；人物世界内部并列展示朋友圈 / 物什 / 名册 / 角色架；工作区内部固定为文件 / 预览 / 审阅 / 终端；需要并行任务时允许同类型 Tab 多实例，但每个实例必须有独立稳定标识。每次新增或迁移 Tab，必须同步施工合同、对应注册表和 E2E。
- **布局收口**：Playground 由壳统一提供页面标题、工作域、目的说明和 `max-w-6xl` 内容边界；面板不得各自再造页面级标题或使用互相冲突的 max-width。故事筛选在数据层保留“基础控件 / 状态反馈 / 开发基础”等分组归类，但界面只呈现一条无分组标题的可横向滚动状态切换行，不升级为二级页面；基础组件页优先展示可交互预览，完整资产登记由注册表 / Debug 承担；开发证据采用紧凑摘要或可展开区，不抢故事预览主层级；相近 Foundation story 可以按任务合并导航入口，但不能删除底层 story、assetKey、renderer 或可见预览，分组必须从 Foundation story 注册表派生。
- **Foundation 补齐门**：基础组件页优先覆盖真实已用控件（Select、Form Field、Checkbox、Switch、Diff Viewer）；经确认的候选交互（Dialog、Popover、Dropdown Menu、Combobox、Command、Context Menu、Scroll Area、Tooltip、Skeleton、Progress）可以先以隔离故事进入 Playground，但必须保留 candidate 生命周期，不得把样张当成生产采用。补齐后先进入统一样式验收，除非出现新的真实场景，不继续为了目录数量扩张。
- **纪律**：新交互/动效先建场 → 同轮同步更新 → catalog **只增不删**（可 `archived`）
- **硬禁**：不装 `@storybook/*`，不以 `npm run storybook` / :6006 为验收

### Debug（生产真相 · 只读）

- Prompt 资产目录、当前装配预览、真实请求上下文、世界态、系统配置和运行记录全部归 Debug；装配预览不得冒充某次实发内容。
- Debug 可搜索、筛选、复制和刷新真实数据，但不在此直接改生产配置。
- Playground 不复制 Debug 的生产资产目录；需要试验时显式载入为隔离草稿。

## 一级界面与导航边界

- 持久存在的产品目的地、开发实验页和设置域都必须是**一级界面**：进入后替换产品主壳，采用类似 Settings 的单一侧栏 + 内容区结构；禁止保留产品 Primary Sidebar 后再叠加第二根功能侧栏。
- 禁止在一个一级界面里再嵌套一套承担页面跳转职责的二级导航（例如「Playground → 组件 → 按钮」）。需要独立验收、独立分享或独立恢复的故事必须提升为 Playground 一级入口。
- 任务域标题（如「设计」「Agent 实验」）只用于视觉分组，不是可折叠的二级菜单，也不承载额外页面层级；分组下的每个按钮都直接切换内容区。
- 当前页面内部允许使用**状态筛选**、分段控件和列表过滤（如「默认态 / 空态」「列表 / 敏感项」），但它们不能再承担另一个持久页面或工具入口的职责。
- 新增导航前先回答：它是否需要独立地址 / 独立验收 / 独立生命周期？如果是，放到一级；如果只是同一页面的状态，使用内联筛选，不新增二级页。
## 设计原则（布局与交互）

1. 气泡对话：用户右对齐圆角气泡，AI 左对齐 Markdown。
2. activeView 全屏：设置、Playground、技能、记忆和生活面进入独立工作区；DevPanel 可侧推。
3. 输入区卡片：居中 `max-w-3xl`（Alice 壳 Phase A）；克制工具条。
4. 生活面 / 工具面分离：侧栏偏工具；朋友圈、衣柜、名册、角色架走专用 View + 状态条入口，禁止首屏仪表盘。
5. hover 显辅助：消息操作、Token 等低频信息。
6. IME：`event.isComposing` 时不提交。

## 伴侣生活面

对照 `docs/requirements/frontend-companion-surfaces.md`。

| 面 | 心智 | 视觉 | 典型 View |
|----|------|------|-----------|
| 生活面 | 「她在过生活」 | 暖金、glass、卡片 | chat 状态条 / moments / assets / cast / shelf |
| 工具面 | 「我在用工具」 | 略冷、表单 | skills / memory / settings |

生活面优先 token：`--companion-accent-warm`、`--companion-surface`、`--companion-blur`、`--companion-shadow-card`、`--companion-catchup-*`。

组件要点：CompanionStatusBar ≈36px；Moments 卡片时间线；shelf 为换角主入口；场景背景仅 CSS（`CompanionSceneBackdrop`）。

---

## CSS Token（`src/index.css`）

新增 UI **必须**用变量，禁止硬编码选中色（如 `border-violet-500`）。

### 全局

| 组 | 变量 |
|----|------|
| 背景 | `--bg-primary` / `--bg-secondary` / `--bg-tertiary` / `--bg-inset` |
| 文字 | `--text-primary` / `--text-secondary` / `--text-muted` |
| 边框 | `--border-color` / `--border-subtle` |
| 卡片 | `--card-bg` / `--card-border` |
| 输入 | `--input-bg` / `--input-border`（`.theme-input`） |
| 语义 | `--accent` / `--accent-emphasis` / `--accent-subtle` / `--accent-fg` / `--success` / `--warning` / `--danger` |
| 圆角 | `--radius-sm` (6) / `--radius-md` (10) / `--radius-lg` (16) / `--radius-xl` (22) / `--radius-full` |
| 动效 | `--motion-fast` (150ms) / `--motion-normal` (220ms) / `--motion-slow` (280ms) / `--motion-ease` |
| 字体 | `--font-ui` / `--font-display` |
| 伴侣 | `--companion-*` |
| 消息 / 侧栏 | `--msg-*` / `--sidebar-*` / `--hover-overlay` |

### 浅色纸感（Phase 1）

`light` / `mist` / `golden` 对齐 Alice 纸白暖底；`dark` / `night-feast` / `blue-pool` 保留工具向深色。不强制改用户已选主题。

### 画布框与设置

| 层 | 实现 |
|----|------|
| 页面壳 | `--bg-primary`；侧栏可用 `--bg-secondary` |
| 内容卡 | `.settings-field`（`radius-md`） |
| 控件 | `.theme-input` + `border-radius: var(--radius-md)` |
| 选项芯片 | `.settings-option` + `data-selected` / `data-danger` |

网格：`repeat(auto-fill, minmax(7.5rem, 1fr))`。`FieldGroup` = 内容卡；`SectionTitle` 不加框。

---

## 动效约定

- View / 设置 section：`.view-transition` → `fade` + `--motion-fast`～`normal`
- 侧栏宽：`.sidebar-transition` → `--motion-normal`
- 主题切换：根容器背景 / 文字色 `transition` 用 `--motion-normal`（勿整页闪白）
- 展开列表：优先 max-height + opacity，忌 `display` 硬切

---

## 编码原则

- KISS / DRY / YAGNI；state 不可变更新。
- 组件文件约 500 行上限；Settings Phase 2 拆 `settings/*`。
- 下拉优先向上弹出。

## 流式输出

- 必须流式；`sendMessage` 的 `finally` 兜底 `setIsStreaming(false)`。

## 滚动条

- **嵌套长文块 / Debug 侧栏列表**：用 `scrollbar-hover`——**槽位常占位**（防文字被挤），拇指默认透明，仅悬停 / `focus-within` 显色。
- **主滚动容器**（会话列表、消息流、设置正文）：用 `scrollbar-thin`，始终可感知但样式克制。
- 滚动条颜色走 token：`text-muted` 低透明 + 全圆角；禁止系统默认粗条 / 硬边实心拇指。
- 禁止靠「悬停才从 width:0 变成有宽度」实现隐藏——会挤动正文布局。
- 禁止为「好看」给短内容强加 overflow 滚轮。

## 可拖分界

- 侧栏宽 / 右坞宽 / 文件树↔预览 / 审阅列表↔diff：用 `ResizeHandle` + `usePersistedNumber`（`layout.*` localStorage）。
- 有 min/max；拖动热区用 `.resize-handle`，勿自造粗分割条。

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

深色 + 至少一种浅色（`light` 或 `golden`）：溢出 / 遮挡 / 硬切 / 左侧色条 / 主要交互可点。
