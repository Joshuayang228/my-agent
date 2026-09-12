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

Playground 状态切换回归逐页比较共享控制器的计算样式（高度、字号、行高、内边距、圆角和描边），验证可换行与选中反馈；深浅主题、1166/600 宽度覆盖 Chat、记忆、模型、Skills、MCP、工作区和基础故事，并确认可关闭工作区标签仍无常驻描边。

工作区标签回归补充常驻关闭按钮、关闭后台标签不切换当前内容、无重复收起入口；地址栏验证居中、无效协议、未知样张、Enter 提交与 Esc 恢复，截图覆盖无边框标签和菜单。

工作区 Playground E2E 覆盖五个入口、21 种形态、文件切换、网页与图片实际加载、多终端独立输出、停止、聊天发送与失败重试；另外验证窄栏 Chat、收起恢复、添加菜单、Esc 焦点返回与多实例、左树右预览位置和文件标签去重/关闭。深浅主题、1166/600 宽度及窄栏保存截图并检查溢出。全部使用隔离夹具，不证明真实浏览器导航、Shell 执行或模型调用成功。

Skills 详情布局回归同时检查返回按钮位于标题上方、标题与开关垂直居中对齐。

MCP Playground E2E 覆盖 17 个场景直接切换、各场景服务数与工具数、多服务独立开关、确认选择、取消、重试及场景重置；添加表单验证远程 URL/认证、本地环境变量、字段修改使旧测试失效、工具选择保存与取消保留已有服务。深浅主题、1166/600 宽度检查无嵌套服务卡片与横向溢出，并保存截图。全部为隔离状态，不证明 MCP 网络或认证成功。

Skills Playground 的 UI E2E 对照两个内置 SKILL.md 的完整原文，验证独立开关、详情与返回状态、触发条件顺序、标题开关对齐和窄宽溢出；深浅主题截图保存在 Playwright test-results，仅验证隔离 UI，不代表正式 Skill 执行效果。

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
Debug 入口与壳变化时，Renderer E2E 必须验证侧栏进入全页 `DevPanel`、Chat 不出现 `conversation-debug-toggle` 或 `ConversationDebugAside` 半屏、默认显示只读“运行概览”、概览证据入口可达，以及 Debug 内部分区仍可切换；右坞回归只验证文件 / 预览 / 审阅 / 终端，不得重新引入 Debug 覆盖。运行概览的 Unit 必须覆盖真实来源成功、局部来源失败、全部来源不可用、空 Trace 列表、凭据未配置和仅统计明确 `error` 状态，不能把缺失证据误报为运行错误。
生产导航收口时，Renderer E2E 必须验证 Primary Sidebar 产品区只保留人物世界 / 设置、SecondaryNav 不挂载，记忆与 Skills 仍可从 Settings 的「记忆」/「工具」分区进入。
Sidebar 底部入口应直接呈现，不额外渲染“开发 / 产品”分组标题；这类纯结构文案不应占用导航空间。

Sidebar / IA 的新候选在 Phase P0 只增加 Playground Renderer E2E：覆盖候选入口顺序、底栏贴底、删除态、边缘视口和关键交互；Right Dock / Moments 等样张必须证明在无 Electron IPC 时仍能渲染。不得把尚未获用户确认的候选断言写成正式生产布局契约。
基础与产品体验分层候选还必须验证：基础 / 产品体验 / Agent 实验三个工作域可见；基础组件和业务状态在工作台内筛选；产品体验页面直接进入且不复制基础组件。本轮导航与生活面候选还必须验证：一级入口不出现组件二级导航；Right Dock 默认只有预览且可通过“+”重复添加文件 / 预览 / 审阅 / 终端实例；文件与预览彼此独立；审阅 / 终端不触发真实 IPC；朋友圈不出现生活广播标题或 Catch-up 独立卡；人物世界的朋友圈、衣柜、文化角、家居、通讯录、足迹六个业务 Tab 可以切换，朋友圈候选需验证 Playground 专用人物头图、三条动态卡、相对时间和 Alice 候选样式标识，角色架在设置样张中查看；业务状态页不展示已移除的伙伴状态条故事；记忆只使用三种主色与灰色；图标目录提供 12 / 14 / 16 / 20 固定尺寸与自定义滑杆且搜索默认收起；设计语言 motion token 有可交互动画样张且不提供无实际用途的手动重新读取按钮；Markdown 故事的代码块在浅色主题下不能退化为白底；产品体验页只在统一页头元信息行展示当前 Tab 的 Foundation 基础引用；内容区不再重复渲染依赖卡；页头不重复显示工作域或“隔离实验”徽标。 Chat 壳主内容区不保留独立“新对话”顶部框，但侧栏的新对话入口仍须可见。 Chat 空态不展示主角切换规则说明条或“换个主角”操作，相关规则和入口只在角色架 / 设置上下文出现。

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
- 每个活跃产品体验必须登记真实 source 与 `usesFoundation`；TypeScript 检查 key，Unit 检查依赖存在、foundation 层级、生命周期兼容和 Playground 入口一一对应；反向 usedBy 只能派生。新增 `src/assets/playground/` 媒体夹具时，对应体验必须在 `fixtureAssetPaths` 显式认领，并通过 `assets:check` 的 staged 漏登门禁。
- 图标目录的 adopted 状态必须逐项提供真实 `sourcePaths`；Unit 检查来源存在和状态一致性。禁止把整页、目录或全部图标批量标成已采用。
- Playground 回流正式 UI 必须补 UI 契约证据：正式右坞默认预览、文件 → 预览上下文保持、正式审阅 / 终端未替换为 fixture，并验证深浅主题下 Markdown 代码层级不与页面底色混淆。
- Foundation Design Language 候选主题、圆角和动效只能在 Playground 局部生效；Unit / Renderer E2E 必须证明它们不会污染正式 `design-asset-registry`、`documentElement` 或生产默认主题。
- Foundation Design Language 的主题选择只代表当前 Playground 比较状态；Renderer E2E 必须验证选中摘要与候选卡同步、故事 Tab 保持单行轻量导航，且不得新增持久化设置、正式主题写入或第二层导航。主题候选至少覆盖明显不同的色温与明暗方向；更换候选后 E2E 必须同步校验稳定 key 和默认选中摘要。设计语言页重构后，E2E 还必须覆盖形态 / 材质 / 动效入口、圆角滑杆、蒙版“仅浮层”边界和持续动效开关。Foundation 标签样张必须验证每个 tab 可点击并更新内容；产品体验页必须验证统一体验舞台、基础引用和来源省略布局；朋友圈互动行必须验证赞 / 评论靠左、Lucide 图标、赞状态切换和评论选中态，且不触发正式数据或 IPC。朋友圈媒体样张必须验证图片真实可见、存在有意义的 `alt`、单图尺寸受约束、地点位于图片下方左侧，并确认卡片不再显示无信息增量的“生活动态”标签。
- 正式 Chat Sidebar 的 Renderer E2E 必须验证会话搜索在顶部入口行内展开（不得新增独立搜索行），Escape 可关闭并恢复新对话入口；侧栏收起 / 展开必须验证轨道宽度过渡与 ResizeHandle 同步隐藏，不能只验证 DOM 卸载。
- Playground 人物世界候选的 Renderer E2E 必须验证六个并列 Tab 按“朋友圈 / 衣柜 / 文化角 / 家居 / 通讯录 / 足迹”顺序展示，足迹固定在最后；文化角同时展示读书、笔记、音乐、电影和摄影，家居展示当前空间，通讯录展示关系摘要，六个入口共享同一隔离主角；正式 WorldHub 不传候选 Tab 定义时默认入口不变。
- 产品体验 Chat 候选的 Renderer E2E 必须验证初次进入 / 正在聊天 / 处理中 / 需确认 / 已完成 / 未完成六种状态共享同一页面骨架；空态不出现换主角入口；欢迎快捷入口至少能把“看看朋友圈”切换到人物世界；人物世界头图不再提供「看记忆」或「近期生活」，进入记忆走 Playground 左侧设置导航；记忆页能进入设置；设置页不再提供独立「回到 Chat」按钮，回到对话走 Playground 左侧 Chat 导航；只有处理中出现五功能工作区（审阅 / 浏览器 / 文件 / 终端 / 侧边聊天），消息流内不再出现任务进度卡，完成 / 失败也不打开工作区；需确认的全局覆盖层允许 / 拒绝 / 返回、已完成的普通伙伴结果回复、未完成的失败恢复面板重试 / 返回都必须可操作；确认卡不得出现在消息流 DOM 内。角色架入口必须可从 Chat 伙伴身份到达，切换后 Chat、人物世界六个生活面使用同一隔离主角。
- Playground 设置候选的 Renderer E2E 必须验证新的日常 / 高级导航、开关依赖披露、模型高级控制折叠、权限规则样张、MCP 添加状态、数据备份反馈与低频关于入口，且侧栏不得出现 Debug / Playground 导航说明；记忆相处设置必须用可理解的回答例子说明选项，扩展页不得暴露内部归位说明，关于页不得沿用外部品牌标语；候选不得调用真实设置 / 记忆 / MCP / 模型 IPC，也不得把 Debug 变成设置一级导航。权限规则必须分成已有规则和新增规则两张卡；MCP 工具清单必须是独立条目，不得使用 divide-y 内部分割行。Playground UI 改动交付前必须扫设置、记忆、Skills、MCP、权限和当前相关页，确认没有新的“一块回答多个问题”回归。
- 角色架候选必须嵌入设置壳：左侧设置导航保持可见且“伙伴与相处”为当前项，右侧详情区展示角色列表；不得退化为覆盖整个设置区域的独立全屏样张。
- 设置候选的窄宽门禁还必须验证顶部导航不被内容撑开而保持横向滚动、键盘 Enter 可切换分区、Tab 与当前 `tabpanel` 建立 `aria-controls` / `aria-label` 关联，且内容切换使用既有动效变量。
- Playground 记忆管理候选还必须验证总览统计、搜索、四类归属、添加记忆、编辑、删除、敏感项和 Debug 来源开关；新增 / 修改 / 删除只更新隔离 Renderer 状态，不调用 memory IPC，不把 Chat 动态、任务状态或 Debug 运行记录放入记忆清单。
- 记忆列表布局还必须验证顶部无空白操作区、编辑 / 删除与日期同排，敏感场景显示保留提示且普通清单不误显示敏感警示。
- Skills / MCP 候选还必须验证 Settings 下两个一级入口、Skills 主行只保留名称与启用开关、Skills 列表行只展示名称与纯开关、不出现重复启用文案或嵌套卡片，并覆盖 Skills“单个 / 多个 / 详情”三种隔离审阅状态；详情开关同行、多个状态独立卡片和触发条件文案也必须通过 UI E2E 验证。 工作区候选必须验证审阅 / 浏览器 / 文件 / 终端 / 侧边聊天五个入口，不出现任务进度或完成结果，且所有交互不调用生产 IPC。
- 设置候选补充能力时还必须验证模型页的空态 / 单连接 / 多连接、添加来源、连接详情和模型用途切换只更新隔离样张；模型 ID 不由 Provider 预设写死，主视图不铺开文本 / 图片 / 工具能力诊断；模型预算输入只更新隔离样张、0 的“不限制”语义可见，Skills 的启用 / 隔离试跑状态可操作且不触发真实 Skill / MCP IPC；回答方式位于伙伴与相处并提供具体例子，记忆单独作为设置入口；作用范围标签只作为用户解释，不得变成新的权限判断来源。
- Playground 记忆 / 设置关系旅程的 Renderer E2E 必须验证“身份信息 / 协作习惯 / 沟通偏好 / 我们之间”四类 Tab 与唯一内容归属（样张必须分别验证稳定背景、协作规则、沟通偏好与共同约定，不能跨类兜底）、默认紧凑列表密度、普通模式来源隐藏、隔离 Debug 开启后右上角“查看来源”开关以及来源不泄露向量、Prompt、召回分数等内部词；“之后会”不再出现；“纠正记忆”必须可在 Renderer 内存夹具中实际保存；伙伴生活事件不进入记忆清单，当前进行中的动作和系统运行记录只在 Chat / 工作区 / Debug 语境出现；从人物世界进入设置时必须选中记忆管理场景和 Settings「记忆」分区；回到对话通过左侧 Chat 导航，而不是设置页内的「回到 Chat」按钮；记忆内容只在设置分区内承载；预览不得触发真实 memory / settings IPC 或改变正式默认分区；正式 MemoryPanel 不传 Playground preview props 时仍保留原有标题、技术分类筛选和 CRUD。

编程套餐连接候选的 UI E2E 覆盖六个套餐的名称 / 专用地址联动、普通 Ark 与 Coding Plan 分组、名称左置、预设不暴露适配器、自定义三协议切换保留地址、保存后空模型清单、获取失败后的手动添加与用途引用、取消重开和 Key 清除；深浅主题各验收 1165px / 520px。该测试只证明 Renderer 隔离交互，不证明套餐真实调用或模型发现可用。

连接卡片 UI E2E 还须验证：连接详情常驻，获取 / 测试按钮在各卡片头部右侧且不与卡片内容折叠耦合；已有连接提供编辑入口，复用添加表单，保存后保留原模型清单；获取成功展示候选项，点击候选直接加入、不自动批量加入；已添加项禁用并保留勾选标记，手填模型用加号或 Enter 提交，重复项不可提交；不同连接草稿不串用，获取中重置样张不会回填旧结果。深浅主题各覆盖 1165px / 520px 的位置、溢出和截图检查；缺凭据获取失败后仍能手动添加。

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

模型配置解耦候选还必须验证：Provider 预设分类必须验证阿里云百炼、硅基流动出现在聚合 / 中转入口而不出现在官方服务商入口；运行预算字段必须明确标注 Token，并说明按输入与输出 Token 合计计算、0 表示不限制；官方、聚合 / 中转和本地入口提供常见预设，连接名称随预设生成默认值且仍可编辑；官方服务商使用官方预设和官网地址，适配器只在自定义连接中出现；三种用途各自支持多模型路由与顺序优先级；连接下可维护多个模型；“获取已有模型”成功后可逐项加入清单，添加连接使用适配器且不要求首个模型 ID；聚合 / 中转 / 统一网关作为同一连接入口。上述交互只能使用隔离 fixture，不得触发真实 Provider、凭据或 Settings IPC。

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

- 记忆页回归覆盖统计卡减法、放大镜展开搜索、搜索过滤和添加按钮可达性。

- 记忆页回归确认统计区域已移除，分类、搜索展开、添加和列表流程仍可用。

- 记忆页回归确认边界提示移除后，分类、搜索和列表仍可达。

- 记忆回归覆盖底部新增行的展开、分类选择、保存和新增内容展示。

- 记忆回归覆盖当前分类内联新增行、保存后列表更新和隔离说明顺序。

- 内联新增记忆回归修正：从当前分类底部打开、输入并保存，验证列表更新与无分类下拉。

- 记忆搜索回归覆盖：点击放大镜后入口变成输入框，框内左侧放大镜、右侧清除；清除后收回搜索按钮。

- 记忆页回归确认分类 Tab 下方不再出现分组解释小字。

- 记忆清单回归覆盖独立条目卡、图标编辑/删除和无文字链操作。

- 记忆纠正态输入框必须与展示态正文同为 13px 字号。

- 记忆编辑态必须保持日期位置不变，保存/取消替换底栏图标槽，不得把操作按钮插入正文行。

- 记忆新增行的保存/取消必须使用图标按钮，不得再出现文字「保存」「取消」。

- 记忆新增输入焦点必须使用主题描边，不得叠加浏览器默认黑色 outline。

- 工作区文件预览关闭按钮必须和文件名处于同一标签内，不得再使用独立描边把关闭按钮挤到标签外，也不得再提供独立的「关闭文件预览」。
