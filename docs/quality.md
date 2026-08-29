# 质量总控

> 质量维入口：定义 Unit / Eval / E2E / 安全审计的分层和必跑条件。具体 Case、测试文件和当前通过数量以仓库代码及命令输出为准，不在本文维护动态总数。
> 深 Why：`methodology/m17-testing-architecture.md`、`methodology/m18-eval.md`。

## 一、完成门禁

所有代码任务在声称完成前按顺序执行：

1. 对照 `agent-skills/code-review.md` 自审；
2. `npm run test`；
3. `npx tsc --noEmit`；
4. 涉及 import、主进程或打包结构时运行 `npm run build`；
5. 涉及 UI 时运行 `npm run test:e2e` 并做深色 / 浅色、溢出和主要交互检查；
6. 涉及产品能力或横切契约时更新对应模块卡、Progress 和 Changelog；
7. 运行 `npm run docs:validate`，确认 staged 变更影响也已收口。

真实模型、真实 API Key 和会产生费用的 Eval 不是默认门禁，只有任务明确涉及真实模型行为时才运行。

## 二、测试分层

| 层 | 证明什么 | 命令 | 触发条件 |
|---|---|---|---|
| Unit | 纯逻辑、状态机、边界和回归 | `npm run test` | 所有代码任务必跑 |
| Framework Eval | Agent Loop、工具、权限、错误和伙伴行为 | `npm run eval:run` | Agent 行为契约变化时 |
| Skill Eval | Skill 触发、指南注入、工具边界和回复证据 | `npm run eval:skill` | Skill 运行链路变化时 |
| Persona Real Eval | 真实 LLM + Judge + pass^k | `npm run eval:persona` | 人格 Prompt、Judge 或评分标准变化且用户允许费用时 |
| Renderer E2E | UI 页面、交互和布局 | `npm run test:e2e` | UI 变化时 |
| Electron E2E | 首次配置和可选真对话 | `npm run test:e2e:electron` | Electron 生命周期、首次配置或真对话链路变化时 |
| 文档一致性 | 链接、合同状态、DEC、Wishlist ID 和 canonical source | `npm run docs:check` | 文档或规则变化时 |
| 变更影响 | staged 代码与必须复核文档映射 | `npm run docs:impact` | commit 前；由 pre-commit 自动运行 |
| 周期复盘 | 最近提交、重复真相源候选和维护债务 | `npm run docs:self-review` | 每周或重大施工后；只读生成报告 |

UI 组件 / 图标语义注册表、Foundation 故事注册表、Playground 目录或故事发生变化时，Unit 必须验证稳定 key、分类、来源和生命周期，并验证 story key → assetKey → renderer → viewId 关系，Renderer 必须运行 `npm run test:e2e` 验证入口与筛选；不改变 Agent 行为契约时，不要求运行真实 Persona Eval。Foundation / Experience 边界变化时，Unit 还必须验证产品体验的 `experienceParts`、`usesFoundation`、层级和生命周期约束；Foundation 故事导航当前由注册表派生为 13 个任务入口；本轮新增的 IconButton、Card、Badge、Tag、Divider 必须有对应 assetKey、renderer、隔离可见预览和 E2E 入口证据，生命周期保持 `playground`，不得以样张冒充 `adopted`；Foundation 工作台必须覆盖所有已建故事并提供真实可见预览；本轮批准的 Select、Form Field、Checkbox、Switch、Dialog、Popover、Dropdown Menu、Combobox、Command、Context Menu、Scroll Area、Tooltip、Skeleton、Progress、Diff Viewer 也必须有隔离故事；候选和完整资产清单由注册表 / Debug 承担，不要求 Playground 重复渲染无预览登记卡；E2E 必须验证业务 Tab 可切换且 Playground fixture 不触发真实 IPC。布局收口时，E2E 还必须验证每个一级 Tab 有统一页头、主内容宽度稳定，Foundation 故事筛选在一条无分组标题的横向状态切换行中保持故事顺序，且不存在重复的页面级说明块；相近 Foundation story 只减少导航入口，不得减少底层 story 预览；Chat 页头的用途说明与标题同行；所有产品体验的实现来源路径在统一页头基础引用行最右侧，其他一级 Tab 也必须登记可定位的 `.tsx` 来源并与标题说明同行；基础引用必须以实际 Playground 组合中可见的调用关系为准，未在该体验样张中体现的基础资产不得登记为依赖；来源固定宽度省略并可通过 hover 查看，组合样张下方仅保留宽度切换；图标目录数量统计、来源路径和搜索都必须位于目录头部，固定尺寸必须在独立样张卡中展示，自定义滑杆只作用于少量预览图标且可用；圆角滑杆实时更新样张，motion 样张默认播放且提供统一开关（开时持续动、关时停止），不显示“点击播放”，不额外制造独立信息行；分隔线的边界规则必须与分隔线样张合并展示，使用正确 / 不当的可视化对照，不以独立纯文字卡代替预览。

Chat / Sidebar / Settings 页面组合变化时，Renderer E2E 至少覆盖：开发入口与会话区的结构顺序、非 Chat 全页视图不继承空白 Chat 顶栏、设置无手动保存栏，以及自动保存的防抖落盘和离开页面前刷新最后一次修改。自动保存测试可 Mock settings IPC 作为外部 IO，但必须验证真实 Renderer 状态变化与写入参数，不能只断言静态文案。
Debug 入口与壳变化时，Renderer E2E 必须验证侧栏进入全页 `DevPanel`、Chat 不出现 `conversation-debug-toggle` 或 `ConversationDebugAside` 半屏，以及 Debug 内部分区仍可切换；右坞回归只验证文件 / 预览 / 审阅 / 终端，不得重新引入 Debug 覆盖。
生产导航收口时，Renderer E2E 必须验证 Primary Sidebar 产品区只保留人物世界 / 设置、SecondaryNav 不挂载，记忆与 Skills 仍可从 Settings 的「记忆」/「工具」分区进入。
Sidebar 底部入口应直接呈现，不额外渲染“开发 / 产品”分组标题；这类纯结构文案不应占用导航空间。

Sidebar / IA 的新候选在 Phase P0 只增加 Playground Renderer E2E：覆盖候选入口顺序、底栏贴底、删除态、边缘视口和关键交互；Right Dock / Moments 等样张必须证明在无 Electron IPC 时仍能渲染。不得把尚未获用户确认的候选断言写成正式生产布局契约。
基础与产品体验分层候选还必须验证：基础 / 产品体验 / Agent 实验三个工作域可见；基础组件和业务状态在工作台内筛选；产品体验页面直接进入且不复制基础组件。本轮导航与生活面候选还必须验证：一级入口不出现组件二级导航；Right Dock 默认只有预览且可通过“+”重复添加文件 / 预览 / 审阅 / 终端实例；文件与预览彼此独立；审阅 / 终端不触发真实 IPC；朋友圈不出现生活广播标题或 Catch-up 独立卡；人物世界的朋友圈、物什、名册三个业务 Tab 可以切换，角色架在设置样张中查看；业务状态页不展示已移除的伙伴状态条故事；记忆只使用三种主色与灰色；图标目录提供 12 / 14 / 16 / 20 固定尺寸与自定义滑杆且搜索默认收起；设计语言 motion token 有可交互动画样张且不提供无实际用途的手动重新读取按钮；Markdown 故事的代码块在浅色主题下不能退化为白底；产品体验页只在统一页头元信息行展示当前 Tab 的 Foundation 基础引用；内容区不再重复渲染依赖卡；页头不重复显示工作域或“隔离实验”徽标。 Chat 壳主内容区不保留独立“新对话”顶部框，但侧栏的新对话入口仍须可见。 Chat 空态不展示主角切换规则说明条，相关规则只在角色架 / 设置上下文出现。

Sidebar 候选获得明确许可并回流正式页面后，Renderer E2E 必须把对应断言从“候选位置”同步为“正式结构位置”，同时保留 Playground 候选态的边缘场景覆盖。

涉及 fire-and-forget 的主进程后台任务时，生产路径必须提供可等待的 drain 边界；单测 teardown 在关闭数据库或测试环境前先 drain，避免动态 import / 资源访问跨越 Vitest 生命周期。后台任务仍可在正常产品调用中非阻塞运行，drain 只用于生命周期收口。

Mock 只允许替代外部 IO 或构造确定性 Eval，不得 Mock 核心业务后宣称真实产品能力通过。

## 三、Eval 契约

- 普通 Scenario 唯一列表：`evals/scenario-registry.ts`。
- Skill Case 和 Grader 以 `evals/` 生产定义为准；Debug 只读取同一份报告，不在 Renderer 重新评分。
- `ModelBasedGrader` 使用“是否存在违规 / 是否缺失必要行为”的可判定问题；多个维度在一次 Judge 调用中返回结构化证据。
- Mock、Skill 和 Persona Real 必须在命令、报告和 UI 中明确区分，Mock 不能冒充真实人格通过。
- 真实 Persona 报告可以保存 Agent 可见输入、回复、配置和 Judge checks，但不得保存 API Key 或隐藏 reasoning。
- 人工审阅是独立注释层，不修改原始报告，也不改变自动 PASS / FAIL。

## 四、Prompt 与生产资产门禁

- 自有模型可见自然语言保持简体中文；协议 token、代码标识、工具名、JSON key 和外部原文可保留英文。
- 每个生产 LLM 调用必须声明稳定 Prompt 资产 key，或显式声明 promptless 原因。
- Prompt、Role Pack、Memory Strategy、Permission / Sandbox、Tool、Skill、Eval、Provider 和 MCP 资产必须由真实生产注册表提供来源、版本和指纹；Debug 不维护第二套目录文案。
- 用户记忆正文、API Key、MCP secret、工具参数、命令、路径和隐藏 reasoning 不得进入静态资产目录或普通日志。
- 资产运行证据只记录稳定 key、关系、状态和允许的结构化元数据。
- 每次涉及生产资产的提交必须通过 `npm run assets:check`：治理清单、来源路径、ModelContextAssetType 覆盖、主题单一来源和 staged 注册同步均失败即阻断；报告写入被忽略的 `var/asset-audit/`，不作为第二事实源。
- Provider 预设扩充必须由共享注册表驱动 Settings / Chat / Debug；Unit 同时校验入口稳定 key、Provider 身份、分组数量、Provider 快切子集、Provider 卡片不带模型白名单和 Anthropic / Gemini 地址版本归一化，避免把协议入口或非聊天能力误显示为固定模型。
- 动态 Tool / Skill / MCP 明确依赖运行时自动发现；静态 Prompt、伙伴、Memory、Permission / Sandbox、Eval、Provider、SubAgent、Icon、UI、Design 必须有显式注册入口。
- 每个活跃产品体验必须登记真实 source 与 `usesFoundation`；TypeScript 检查 key，Unit 检查依赖存在、foundation 层级、生命周期兼容和 Playground 入口一一对应；反向 usedBy 只能派生。
- 图标目录的 adopted 状态必须逐项提供真实 `sourcePaths`；Unit 检查来源存在和状态一致性。禁止把整页、目录或全部图标批量标成已采用。
- Playground 回流正式 UI 必须补 UI 契约证据：正式右坞默认预览、文件 → 预览上下文保持、正式审阅 / 终端未替换为 fixture，并验证深浅主题下 Markdown 代码层级不与页面底色混淆。
- Foundation Design Language 候选主题、圆角和动效只能在 Playground 局部生效；Unit / Renderer E2E 必须证明它们不会污染正式 `design-asset-registry`、`documentElement` 或生产默认主题。
- Foundation Design Language 的主题选择只代表当前 Playground 比较状态；Renderer E2E 必须验证选中摘要与候选卡同步、故事 Tab 保持单行轻量导航，且不得新增持久化设置、正式主题写入或第二层导航。主题候选至少覆盖明显不同的色温与明暗方向；更换候选后 E2E 必须同步校验稳定 key 和默认选中摘要。设计语言页重构后，E2E 还必须覆盖形态 / 材质 / 动效入口、圆角滑杆、蒙版“仅浮层”边界和持续动效开关。Foundation 标签样张必须验证每个 tab 可点击并更新内容；产品体验页必须验证统一体验舞台、基础引用和来源省略布局。
- 正式 Chat Sidebar 的 Renderer E2E 必须验证会话搜索在顶部入口行内展开（不得新增独立搜索行），Escape 可关闭并恢复新对话入口；侧栏收起 / 展开必须验证轨道宽度过渡与 ResizeHandle 同步隐藏，不能只验证 DOM 卸载。

## 五、安全门禁

安全任务必须先读 `agent-skills/security-checklist.md`，审查细节以 `agent-skills/code-review.md` 为准。至少覆盖：

- IPC 运行时输入边界和主进程重新确认；
- 凭据、日志、导入导出和 Renderer 数据最小化；
- 文件 realpath / symlink、工作区和 `ToolContext.workdir`；永久删除白名单必须基于工作区相对路径，并覆盖 Linux `/tmp` 工作区回归；
- PermissionEngine、Headless、Shell、Git 和子进程环境；
- URL SSRF、重定向、DNS、MCP 外部内容和资源上限；
- 正则、Prompt、RAG、报告和批量输入的 DoS 边界；
- `npm audit` 与生产依赖审计。

发现剩余风险时先搜索 `docs/decisions.md` 和对应模块卡。明确接受或明确不做的边界，只有触发条件变化时才重新立项。

已完成安全审计快照见 [`../_archive/audits/security-audit-2026-08.md`](../_archive/audits/security-audit-2026-08.md)。

## 六、模块关系

- 伙伴 / 人格：`docs/modules/companion.md` 的必测点 + 相关 Persona Eval。
- 记忆：`docs/modules/memory.md` 的必测点 + memory Unit / Eval。
- 权限：`docs/modules/permission.md` 的必测点 + permission / security Unit。
- Agent 运行时：`docs/modules/agent-runtime.md` 的必测点 + Loop / Context / Provider / Tool 测试。

## 七、维护规则

- 新增或改变质量分层、门禁条件时更新本文。
- `docs:validate` 是文档收工入口；Git hook 和 GitHub Actions 负责自动触发，人工仍需判断产品语义。
- `docs:self-review` 是周期性只读复盘入口；报告写入 ignored 的 `var/docs-self-review/`，AI 提示词只提出建议，不自动写 canonical 文档。
- 新增 Case 或测试文件时只改代码注册表和测试，不在本文追加数量清单。
- dated audit 完成后归档；有效缺口先迁入 Wishlist 或 Decisions。
- 旧 `testing.md`、`eval-design.md` 和收口前 Quality 全文均已归档，不能作为当前门禁。
