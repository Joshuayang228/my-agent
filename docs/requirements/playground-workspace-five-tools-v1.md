# 施工合同：工作区五功能样张 v1

> 状态：进行中
> 生命周期：进行中
> 范围：用户已明确授权的 Playground → 正式工作区 P1 回流；先统一正式界面，再补齐真实后端能力。

## Why

旧工作区用文件任务、处理中和完成结果组织入口，把 Chat 的任务叙事塞进右侧工具区。用户明确要求参照 Codex，仅保留审阅、浏览器、文件、终端、侧边聊天。

## P0 候选来源（历史范围，不限制已批准的 P1）

以下保留已验收候选的设计来源，隔离限制只适用于 Playground；正式回流以文末 P1 为准。

### What

五个功能 Tab 固定平铺，每个功能有独立形态样张，可直接切换；另提供展开/窄栏宽度用于审阅。删除旧任务阶段、任务上下文卡片和模型快照说明，任务行为留在 Chat / Debug。

| 功能 | 样张 |
|---|---|
| 审阅 | 行内差异、并排差异、多文件、无变更 |
| 浏览器 | 网页、窄屏网页、加载中、加载失败 |
| 文件 | Markdown、代码、图片、空目录、无法预览 |
| 终端 | 输出、运行中、报错、多终端 |
| 侧边聊天 | 空态、对话、生成中、发送失败 |

## How

### 本轮补充（用户已授权）

- 标签按用户参考图收平：默认无描边，图标与名称同行，关闭图标在各标签内常驻；关闭非当前标签不改变当前内容。删除右端独立关闭按钮和重复的收起工作区按钮，保留 Chat 侧入口。添加菜单使用无描边菜单行。
- 地址栏居中可编辑，Enter 提交、Esc 恢复；校验 HTTP(S)，地址切换仍只查找本地样张，无对应样张时明确提示，不访问外站。
- 窄栏左侧保留可输入的隔离 Chat 壳；Chat 右上角通过工作区图标打开/收起右栏，收起不丢失已打开内容。
- 工作区内部提供加号菜单，选择五种功能后新建独立实例；可切换和关闭，多实例状态独立。顶部五功能仍为样张选择器，不替代真实入口交互。
- 文件区替换上下布局：左侧文件树，点击后在右侧新增文件预览标签；重复点击激活已有预览，关闭后可再次打开。窄栏仍保持左右结构。
- 本轮删除范围仅为候选的空白左侧、单内容容器和上下文件预览组合；正式 ChatRightDock / FileBrowser 默认布局不变。

`WorkspaceExperienceCandidate.tsx` 仅承载隔离状态；`SurfaceBaselinePanel` 的 DockSurface 引用它。复用 FileBrowser 的 previewData、MarkdownRenderer、基础主题 class 和 Lucide 图标；同步产品体验注册表、Playground 标题与隔离 E2E。

浏览器用本地静态 srcDoc 与严格 sandbox 显示实际页面样张，不导航外站。终端只处理明确的样张命令，无 shell；聊天只改变本地消息，不请求模型、不保存会话。所有模拟边界由 Playground 的“隔离样张”说明标记。

参考边界：Codex 当前可用 panel API 明确提供 file/browser/terminal/review 四种面板；侧边聊天按用户明确要求补充。此前 Codex 官方网站访问返回 403，本次不声称逐像素复制未见页面。项目正式 ReviewPanel / TerminalPanel 依赖真实会话 IPC，不为展示更改默认行为，使用隔离内容组合。文件预览直接复用已有正式组件。

## 验收

五个入口顺序稳定；各形态直达；文件切换、终端实例独立、聊天发送/停止/重试、浏览器失败重试可操作。深浅主题与窄宽截图，确认图片与浏览器非空、无横向溢出，任务阶段文案彻底退出工作区。

## 影响与风险

旧任务场景及对应断言删除属于 P0 明确授权。当时正式功能不回流；2026-09-13 用户已明确批准 P1，浏览器与侧边聊天真实接入纳入下文连续施工范围，不再等待回流许可。文档更新 module/progress/changelog/quality；类型、单测、构建、资产与文档门禁通过后提交推送。
## P1 正式回流范围

用户已明确授权启动目标模式，回流分为两个连续且各自可验收的阶段：

1. **正式界面统一**：将已确认的工作区布局、五功能入口、Tab 视觉、分隔线、PanelRight 开关、主题语义、窄宽约束、长内容滚动和无障碍行为落实到正式 ChatRightDock；不把 Playground fixture、场景切换器或来源说明带入正式页面。
2. **真实能力补齐**：逐项梳理并实现当前只有前端占位的能力，保留真实 FileBrowser、ReviewPanel、TerminalPanel 和现有 IPC 边界；浏览器、侧边聊天、多实例状态、任务关联和错误恢复若缺正式后端契约，先建立契约再接入，不能以静态样张冒充完成。

## 回流缺口清单

| 候选能力 | 当前正式落点 | 当前判定 | 缺口 / 处理方式 |
|---|---|---|---|
| 对话与工作区分隔线 | Chat 壳 + ChatRightDock | 生产改造后回流 | 统一正式视觉和响应式布局 |
| PanelRight 打开／收起 | App.tsx 的 showFileBrowser | 生产改造后回流 | 区分隐藏与卸载，保留 Tab、预览和任务上下文 |
| 文件左树右侧多文件预览 | ChatRightDock + FileBrowser | 生产改造后回流 | 旧正式版文件／预览为独立顶层 Tab；目标合并为文件功能，内部多预览去重、切换、关闭与重开 |
| 审阅 | ReviewPanel | 已有真实能力 | 回流布局和错误／空态视觉，不替换真实数据 |
| 终端 | TerminalPanel | 已有真实能力 | 保留权限、沙箱和工作区 cwd，回流布局 |
| 浏览器 | BrowserPanel 受限只读查看器 | 生产改造后回流 | 主进程安全抓取已接入：URL/DNS 校验、手动拒绝重定向、超时与响应上限；Renderer 使用无脚本 sandbox + CSP。仍不支持脚本、登录、站内交互和任意导航 |
| 侧边聊天 | SideChatPanel + `workspace` 会话 | 生产改造后回流 | 已接真实 session/runtime、流式事件、停止和卸载清理；工作区会话不进入主会话列表。仍需补上下文关联、工具确认隔离和更完整失败恢复 |
| 多实例工作区 Tab | 正式右坞已有部分状态 | 部分已有 | 统一实例 ID、关闭策略、当前 Tab 和恢复生命周期 |
| Markdown／Diff 代码块 | MarkdownRenderer 的 CodeBlock / FileBrowser / ReviewPanel | 部分回流 | 原始代码与基础故事同源；局部四主题、Mermaid、完整审阅模式仍需验收 |

### P1 技术路径与交付边界

- 回流来源：本合同五功能候选、WorkspaceExperienceCandidate 与 Foundation 标签故事。用户授权：2026-09-13「开始回流工作区」「先把整个界面统一，然后再把后端的各项能力全部补齐」。P1 未完成，不提前冻结合同。
- 当前落点：App 的项目工作区按钮 → ChatRightDock → FileBrowser／ReviewPanel／TerminalPanel。现有真实数据来自 project、session file changes、terminal IPC；本批折叠不改其接口，只保留已挂载子树。
- 本批允许修改：src/App.tsx、src/components/chat/right-dock/ChatRightDock.tsx、__tests__/e2e/chat.test.ts，以及本合同、合同导览、agent-runtime 模块卡、quality、progress、changelog、wishlist。其它已有工作区文件只读，用户临时文件不纳入提交。
- 界面统一后续写入范围：共享 Foundation 控件、工作区容器、FileBrowser、MarkdownRenderer／ReviewPanel、对应 Playground renderer 与资产注册表、样张和正式 E2E。提取真实共享实现，不把候选文件作为生产依赖。
- 生命周期：折叠只隐藏，不取消任务；切换标签应保留实例状态，关闭才释放实例资源。会话／项目切换和一级导航的资源归属必须分别定义与验证，不把同页折叠证据外推为持久化。
- 后端补齐前逐项补充契约：浏览器需隔离外站、导航和权限决策、关闭清理；侧聊需真实 session／runtime 归属、事件过滤、停止、错误恢复、持久化和模型配置工厂；终端需实例事件隔离、早到输出、结束和关闭清理，并审计 WISH-019 的 PTY 差距。涉及 IPC 时同步四处类型与入口，禁止复用 Playground 模拟实现。
- 审阅真实契约：`session:getFileChangeDiff` 在原有 `diff/after` 外返回受长度上限保护的 `before`，供正式并排视图使用；列表读取和 diff 读取必须分别处理错误，按请求序号丢弃过期结果。新建文件无旧稿时仅提供 unified 视图，不以空字符串伪造旧稿。
- 浏览器真实契约：`browser:load` 只返回通过主进程 URL/DNS 校验、未跟随重定向且未超出大小／时间上限的 HTML/XHTML/纯文本；正式 Renderer 通过 `sandbox=""` 和文档 CSP 展示，禁止脚本、插件、表单和外部资源，不承担登录态或任意网页交互。
- 侧边聊天真实契约：`session:createWorkspace` 创建 `session_kind=workspace` 的临时会话；列表和主会话导览排除该类型，面板卸载调用现有 `session:delete` 清理。消息仍走现有 `chat:send`／`chat:event`／`chat:abort`，Renderer 按独立 sessionId 过滤事件；React 初始化清理产生的废弃 workspace 会话也必须删除。
- 当前不动：生产 Prompt、人格／记忆策略、权限规则、模型配置与真实用户数据。它们不是本批视觉折叠的必要修改；后续真实能力需要改动时先把具体契约补入本合同。

### P1 共享标签批次

- 允许修改：新增 src/components/foundation/TabStrip.tsx；改 UiControlsPanel、WorkspaceExperienceCandidate、ChatRightDock、ui-component-registry、对应 registry Unit 与 chat E2E，以及 architecture、模块卡、quality、progress、changelog、wishlist 和本合同。
- 移除对象：三处重复的标签按钮结构、正式右端独立关闭当前 Tab 按钮。理由与授权：用户已确认每个标签内部常驻关闭位；只替换呈现与焦点，文件／审阅／终端 IPC 不变，fixture 仍隔离。
- 回流链：Foundation 标签故事 → TabStrip 共享实现 → Playground 工作区及内部文件预览 → 正式 ChatRightDock。注册表指向实际基础文件；Unit 解析 import 与 JSX，负例覆盖未渲染的 import 和同名本地控件；E2E 验证三层真实渲染、hover 几何、键盘和后台关闭。
- 本批不宣称完成的内容：所有控件的全量复用门禁、正式五功能入口、切换标签后保留后台面板、终端早到输出竞态、浏览器与侧聊服务。文件内部多预览、终端实例事件隔离与 Markdown/Diff 共享渲染已分别回流并有测试证据。

### P1 文件工作区批次

- 目标：正式工作区仅保留文件功能，不再把预览作为独立顶层工具；内部左树右多文件预览，已打开文件去重、切换、关闭／重开，文件工具实例彼此独立。
- 允许修改：ChatRightDock、FileBrowser、新增 WorkspaceFilesPanel、WorkspaceExperienceCandidate 的 FilesSample、相关 E2E／Unit、资产注册和本合同／architecture／模块卡／quality／progress／changelog／wishlist。App 只移除已不需要的兼容开关。保留用户临时文件，不修改 IPC、真实文件、设置或模型配置。
- 删除与替换范围：正式 preview 顶层类型和重复面板、未被调用的旧 playgroundTabs／deferredTabs 兼容分支，以及候选 FilesSample 的重复文件预览 JSX；它们由真实共享 WorkspaceFilesPanel 替代，不删除文件格式、复制、HTML 沙箱和系统打开能力。
- 数据流：FileBrowser 文件树 → 选择路径 → WorkspaceFilesPanel 每路径读取状态 → 现有 project.readFile → FileBrowser 受控 preview。文件树与预览的数据转换共用函数，fixture 显式传入时不调用 IPC。
- 异步契约：每文件有独立读取标识；快速切换不让旧结果抢焦点，关闭后到达的结果不能重开标签，关闭再重开不能接收旧请求。项目切换重建文件实例，旧项目结果不能进入新项目；面板切换与同页折叠保留文件树／预览状态。
- 验收：真实 App Renderer＋Electron 边界替身覆盖两个文件、去重、左右位置、后台关闭、重开、错误／重试、异步乱序；既有 Playground 五功能和文件所有格式故事保持隔离。状态与数据流事实同步到模块卡；真实 Electron 文件读取安全门禁继续保留。

### P1 验收与回滚

生命周期批次：App、ChatRightDock、TerminalPanel 与 Renderer E2E 为允许改动范围。终端和文件属于当前项目；切换标签、折叠、进入设置或 Playground 只隐藏工作区，关闭标签或切换／取消项目才释放资源。审阅仍以 sessionId 重建，不把旧会话审阅带到新会话。启动尚未返回即关闭时，Renderer 在迟到响应提供 runId 后补发清理；启动拒绝和终止失败需可恢复。此批不改变现有 IPC／权限／沙箱，也不声称解决 runId 返回前的早到输出或操作系统进程树终止；后者归后端契约批次。

代码渲染批次：在本合同已批准的共享渲染范围内，替换正式审阅拼接 Markdown 围栏、文件预览原始 pre 和候选独立代码容器；统一为 MarkdownRenderer 同源导出的 CodeBlock。保留生产 IPC 与原始文本，不把原始文件当正文解析。基础故事、工作区候选和正式调用同步修改，UI 资产记录入口与原文故事；Unit 检查实际 symbol 绑定，E2E 检查原文／复制／固定槽／深浅和窄宽滚动。此批不改变 LLM、权限、存储或 IPC，不代表完整 Diff 编辑器和五功能后端已完成。

1. 同页折叠：正式 App 入口验证文件预览和终端草稿保留、隐藏期间输入 DOM 不卸载、键盘恢复；深浅主题和窄宽截图检查图标尺寸与分隔线。Electron 边界替身不构成真实命令执行证据。
2. 共享基础与界面：Foundation、产品体验、正式入口使用同一控件；验证固定关闭槽、后台标签关闭、文件左右结构、多预览去重、长内容和窄宽。
3. 真实能力：接真实 IPC／服务，按每功能完整流程验证成功、失败、取消、重复操作、资源释放和隔离。所有功能通过之前，目标保持进行中。
4. 各个可独立回滚的已验证变更单独提交；当前折叠批次不涉及数据迁移，回滚只影响界面状态生命周期。按序自审、Unit、tsc、正式与样张 E2E、build、资产及 staged 文档门禁，提交后推送。
