# 项目进度

R01 / R14 Debug 运行概览证据入口基础复用（2026-09-21）：正式 `DebugOverview` 的四个真实证据入口统一使用 Foundation `ActionButton`，保留 Prompt、请求与运行、伙伴世界和系统工具的真实导航，不引入 Playground fixture。正式 Debug 导航 UI 回归 1 项、Foundation / 产品注册定向单测 26 项、根 tsc 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R01 / R14 Debug 请求与运行切换基础复用（2026-09-21）：正式 `DevPanel` 的 LLM 调用 / 调用链 / 实时事件切换统一使用 Foundation `ActionButton`，保留真实诊断数据、焦点跳转和子视图状态。正式 Debug 导航 UI 回归 1 项、Foundation / UI 注册定向单测 34 项、根 tsc 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R01 / R14 全页 Debug LLM 调用控件基础复用（2026-09-21）：正式 `LLMCallsPanel` 的查询输入、状态筛选、调用列表、详情标签、复制、刷新 / 导出 / 分页和清空入口统一复用 Foundation `TextField` / `SelectField` / `ActionButton` / `IconButton`；保留真实 Debug 查询、资产证据和懒加载链路。正式 Debug 导航 UI 回归 1 项、定向 Foundation / 产品注册 / LLM Debug 存储单测 19 项、根 tsc 与 vite build 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R01 / R14 对话 Debug 源码控件基础收口（2026-09-21）：现有 `ConversationDebugAside` 源码组件的展开行、详情复制 / 导出动作、会话导出 / 清空 / 关闭入口统一复用 Foundation `ActionButton` / `IconButton`，清空记录改为应用内 `ConfirmPanel`；组件当前没有正式挂载点，不计入正式产品回流证据。定向调用链单测 6 项、根 `npx tsc --noEmit` 与 `npx vite build` 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R01 / R14 Chat 记忆引用与权限确认基础复用（2026-09-21）：正式 Chat 的记忆引用“记错了 / 改正”和权限确认“拒绝 / 允许执行”统一使用 Foundation `ActionButton`；保留记忆纠正 / 删除回调、审批危险色与原有尺寸语义。定向 Foundation 12 项与根 tsc 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R01 / R14 Chat 回调折叠控件基础复用（2026-09-21）：正式消息流的思考过程与工具调用折叠行统一使用 Foundation `ActionButton`，保留流式阶段、工具结果、图片结果和折叠状态；业务层仅覆盖卡片内边距，hover 前后不改变消息布局。定向 Foundation 11 项与根 tsc 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R06 / R14 Markdown / Diff Foundation 收口（2026-09-21）：共享 `DiffViewer` 的统一 / 并排视图切换改用 Foundation `IconButton`，固定 24px 操作槽；基础故事、正式 ReviewPanel、文件预览和工作区候选继续共用 `CodeBlock` 与语义主题清洗。定向 Foundation / 语法 / 工作区契约 21 项、根 tsc 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R06 / R14 审阅文件列表基础复用（2026-09-21）：正式工作区审阅面板的文件选择行统一使用 Foundation `ActionButton`，保留全宽多行文件信息、选中态和真实 diff 链路；hover 前后固定操作槽与列表几何，不改变 session 文件变更 IPC。定向工作区 Foundation / 后端契约 8 项与根 tsc 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

R12 / R14 通讯录操作基础复用（2026-09-21）：正式通讯录卡片的“最近互动”跳转统一使用 Foundation `ActionButton`，保留真实召唤会话入口、时间与标题展示；通讯录 Playground / 正式 UI 6 项通过，UI / 产品体验注册单测 26 项、根 tsc 通过，未改召唤 IPC、关系数据或角色切换契约。

设置导航 hover 基础复用（2026-09-21）：修复共享 `SettingsLayout` 中未选中导航项因 `ActionButton` 内联背景覆盖而失去 hover 反馈的问题；保持 active 状态、导航切换和保存保护不变。设置相关 UI 17 项中 15 项通过；2 项为现有未提交测试对已完成产品变化的旧断言（旧“返回聊天”入口、已删除品牌占位文案），未修改或混入。本批仍不提升整体设置体验为 `adopted`，RAG / MCP OAuth 后续保持暂缓。

R01 / R14 主侧栏导航基础复用（2026-09-21）：伙伴身份 / 角色架入口、开发入口 Debug / Playground 与人物世界 / 设置底栏统一使用 Foundation `ActionButton`，保留开发者模式门控、导航目标、active 状态和 hover 几何；新增 Foundation 门禁防止正式侧栏回退为裸按钮。定向侧栏 UI 7 项、Foundation Unit 4 项、全量 Unit 1244 项、根 tsc 与 vite build 通过；整体回流目标仍进行中，RAG / MCP OAuth 后续保持暂缓。

正式设置与人物世界组合复核（2026-09-21）：使用正确的 Electron 验收配置运行正式入口 18 项全部通过，覆盖 Skills、模型与伙伴设置、文化角 / 家居 / 足迹、生活资产备份、朋友圈、人物世界六面、角色架切角、开发者模式、工作区侧聊与终端、权限规则、记忆增改删、MCP 凭据恢复与异常断开。该证据关闭本批真实入口回归，不提升四个产品体验为 `adopted`；仍需 S6 的全产品组合审计，RAG / MCP OAuth 后续保持暂缓。

正式工作区组合复核（2026-09-21）：运行工作区后端契约、Foundation 控件审计和产品体验注册表单测 11 项全部通过；正式右坞侧聊创建 / 切换 / 迟到事件隔离 / 重试 / 停止，以及文件内预览、收起重开、审阅、终端和正式入口回归 5 项通过。确认五个工具均走真实 IPC / Runtime，正式面板不依赖 Playground fixture；前端继续运行于 `http://127.0.0.1:5174/`。该证据只关闭工作区本批复核，不提升四个产品体验为 `adopted`，RAG / MCP OAuth 后续仍暂缓。

文件提及弹层操作槽收口（2026-09-21）：正式 Chat 的文件提及弹层关闭按钮改用 Foundation IconButton，固定 28px 槽位；文件列表选择行和项目文件真实读取链路保持不变。整体回流目标继续进行，RAG / OAuth 后续保持暂缓。

关于页正式文案收口（2026-09-21）：移除“品牌标语待定”占位文案，改为“有性格、有记忆，也会和你一起成长。”；不改变开发者模式真实设置链路。该项属于正式页面体验收口，整体回流目标继续进行，RAG / OAuth 后续保持暂缓。

朋友圈操作槽基础复用（2026-09-21）：正式朋友圈的刷新、关闭和动态选项统一使用 Foundation IconButton 与 Lucide 图标，固定操作槽不随 hover 改变几何；真实赞评 IPC 与 Alice feed 展示保持不变。类型检查通过，完整 UI / Electron 回归仍按组合批次继续；RAG / OAuth 后续保持暂缓。

记忆页基础控件收口（2026-09-21）：正式记忆页关闭、分类筛选、预览编辑 / 删除及非紧凑编辑态统一复用 Foundation IconButton / ActionButton / TextField；保留记忆 IPC、敏感检测、长记忆多行编辑和日期操作槽布局。记忆清单专项 UI 4 项通过（两主题、宽窄视口、hover/focus、编辑态与长记忆切换），根 tsc 通过。本批仅收口控件来源与几何稳定性，其他正式页面和整体回流目标继续进行；RAG / OAuth 后续保持暂缓。

R01 / R14 主侧栏基础控件回流（2026-09-21）：PrimarySidebar 的搜索、 新对话、折叠、重命名和删除控件统一接入 Foundation TextField / ActionButton / IconButton；删除按钮使用固定 24px 槽位并以 visibility 控制显隐，hover 前后行几何保持不变。侧栏搜索、删除槽几何和折叠 3 项 UI 回归通过，根 tsc 通过；后续继续审计其他正式页面的局部裸控件。RAG / OAuth 后续保持暂缓。

R06 工作区入口基础复用（2026-09-21）：App 工作区开关改用现有 Foundation IconButton，保留原有状态、32px 尺寸与 aria-controls；折叠几何 UI 四个主题 / 宽度组合通过，证据 var/verification/workspace-toggle-foundation。仅统一入口控件，工作区候选内的浏览器、终端和侧聊样张仍需继续核对共享呈现，不将此项视为全产品采用完成。RAG / OAuth 后续保持暂缓。

工作区资产注册补全（2026-09-21）：产品体验注册表补登记正式浏览器、终端、侧边聊天面板及 App 入口，并声明工作区实际使用的 Foundation ActionButton；资产审计 37 项通过。注册表只补齐真实调用链映射，不改变工作区运行行为或 Playground 隔离边界。

R04 角色架入口回流验证（2026-09-21）：App 侧栏头像和人物世界通讯录的“去角色架”统一进入 SettingsPanel 的伙伴与相处 → 角色架；移除 WorldHub / ShellView 的旧 shelf 路由。快捷进入会记录原视图，关闭角色架后回到伙伴设置，设置返回再恢复原聊天或通讯录；正式 UI 宽屏 / 窄屏 2 项通过，真实 Electron 切角、重载保留与恢复原角色仍通过。Unit 1243、根 tsc、vite build 通过；本批不涉及 IPC、存储、RAG 或 OAuth。

Debug 新对话入口修复（2026-09-21）：从 Debug 页面点击侧栏“新对话”现在会先切回聊天，再创建并载入新会话；独立 UI 回归通过，避免会话已创建但仍停留在 Debug 的正式导航断链。证据 var/verification/debug-new-conversation；不涉及 IPC、存储、RAG 或 OAuth。

R10 MCP 清单共享验证（2026-09-20）：McpServiceList 已进入正式设置与候选真实 JSX，数量、添加与空态不再独立维护；保留真实列表来源、管理互斥和离页保护。45 项 MCP UI 回归通过（四主题宽窄、几何、失败重试与候选场景），深浅截图已检查；真实 Electron 普通新增、保存在途拒绝 reload / quit、完整重启恢复连接及工具许可 1 项通过（15.9 秒）。Unit 1243、根 tsc、vite build、资产 37 项通过，无独立 lint 脚本，构建保留既有警告。证据 var/verification/mcp-list-shared 与 mcp-list-electron；不运行 OAuth / RAG 专项，不提升整个设置体验 adopted。角色架旧导航已移除，后续继续做全产品组合审计。

R04 角色架共享回流（2026-09-20）：CharacterShelfPanel 与候选 RoleShelfFixture 共用 CharacterShelfContent，卡片复用 Foundation ActionButton、刷新 / 关闭复用 IconButton；正式旧卡片和 Catch-up 内部说明移除，后端切角与追赶逻辑不变。正式容器保留真实读取 / requestSwitch，新增读取失败重试、切换失败留页和同步单请求锁，卸载后忽略迟到显示。四主题宽窄、长文、hover、流式拒绝 / 异常 / 重试及候选入口 11 项 UI 通过，深浅截图已检查；独立 Electron 正式点击切角、身份更新、重载保留与切回通过（14.2 秒），Unit 1242、根 tsc / vite build 通过。证据 var/verification/character-shelf-shared 与 character-shelf-electron；未改 IPC / 主进程 / 角色资源 / 依赖，构建保留既有警告。本批未跑完整 UI / Electron，不提升整个设置体验 adopted，RAG / OAuth 后续继续暂缓。

S5 / S6 桌面收口复核（2026-09-20）：本地模型、生图、备份崩溃恢复、朋友圈备份、配置生命周期及凭据持久化 6 文件共 12 项通过（2.1 分钟、无重试），证据 var/verification/production-rollout-backend。六面入口单独运行通过；__lifeStore 实际由生产 engine 初始化，不是前序用例注入。伙伴偏好单独运行在重载后的隐藏设置按钮失败，根因缺失前序模型配置；用例自行通过真实 IPC 配置本地模型后独立通过（18.8 秒），整组 onboarding 21 项通过（58.8 秒）。证据 world-entry-standalone / companion-settings-standalone / companion-settings-independent / onboarding-companion-independent-full 均位于 var/verification/。仅改测试准备，未改产品启动、IPC、Prompt、阈值或权限；Unit 1241、根 tsc 通过。未运行 OAuth / RAG 专项及付费外部模型；其他 onboarding 用例独立性与全产品采用审计不据此自动关闭。

全产品组合复核（2026-09-20，代码 dc6a47f）：chat / markdown-theme / checkbox 三组 UI 共 363 项通过（8.2 分钟、无重试），证据 var/verification/production-rollout-combined-ui；排除 mcp-oauth-ui 专项。正式 Electron onboarding 21 项通过（1.8 分钟、无重试），证据 var/verification/production-rollout-onboarding，覆盖真实配置、Skills、六面资产 / 赞评、角色隔离、文件 / 终端 / 侧聊、权限、记忆重启和普通 MCP。未运行 OAuth / RAG 专项或付费外部模型，不冒充全部 Electron 文件通过。合同当前清单已按代码修正 starter、watcher、外部模型测试入口等旧描述；onboarding 共用 beforeAll 的前置依赖仍需收口，整体验证与 adopted 状态尚未关闭。

R01 审批入口共享（2026-09-20）：ChatApprovalControl 组合 Foundation ActionButton，App 与 ChatSurface 同源，候选仍禁用且零生产 API。正式 settings.set 成功后才更新模式；拒绝 / 取消保留旧值、显示通用错误并可重试，在途同步锁拒绝重复写入，关闭菜单后响应不抢焦点。定向 UI 17 项通过，Unit 单独重跑 1241 项通过，根 tsc 通过。首轮 UI 14 通过 / 2 外部点击坐标落入菜单，改点真实外部区域后全绿；首次 Unit 与 UI 并行时文件扫描一项超时，未改阈值和业务，独立全量通过。证据 var/verification/chat-approval-verified，深浅宽窄截图已检查。未改 IPC / 主进程 / 权限策略，不代替真实 Electron 高风险确认验收；全产品组合验收仍进行中，RAG / OAuth 后续暂缓。

R01 消息外框共享验证（2026-09-20）：App 与候选实际调用 ChatMessageFrame，正式保留 Markdown、记忆引用、工具回合与编辑操作。四主题宽窄、长文本 / 代码、hover 尺寸、编辑取消 / 删除、历史角色及历史生图等定向 UI 12 项通过；Unit 1240、根 tsc / vite build 通过，深浅截图已检查。证据 var/verification/chat-message-frame-final。首轮测试字符串语法错误已修正后重跑；本批未跑完整 UI / Electron，不借用之前 352 项作为本批全量证据。审批菜单共享与全产品组合验收继续，RAG / OAuth 后续仍暂缓。


R01 输入区最终验证（2026-09-20）：完整 UI 352 项通过（8.1 分钟、无重试），含新增图片粘贴载荷断言；证据 var/verification/chat-composer-full-ui。Unit 1239、根 tsc / vite build、资产 33 项与文档门禁通过。只证明本批共享呈现及 Renderer 回归，不替代真实 Electron / 外部模型验收，不提升整个 Chat 或全产品采用状态。

- R01 输入区共享回流（2026-09-20）：ChatComposer 统一正式与候选的输入卡片、Foundation 输入及附件 / 发送 / 停止按钮，正式回调和审批契约保持原入口。候选发送仅更新内存，附件只读文件名，无动作审批项明确禁用。定向 UI 14 项通过、四主题宽窄截图已检查；Unit 首轮发现 Provider 测试仍要求标签内联 App，调整为调用方传值与共享组件展示双断言后 1239 项通过，根 tsc / build 通过。消息流和审批菜单仍待复用核验，整体体验不提升 adopted；RAG / OAuth 后续保持暂缓。

2026-09-20 本批最终完整 UI 回归：342 项通过（8.0 分钟，无重试），证据 var/verification/chat-welcome-full-ui（npm 脚本未透传 output 参数，结果从 test-results 复制留存）。覆盖当前欢迎区共享和此前 MCP 管理互斥后的代码；不替代 Electron / 外部模型验收，不关闭全产品合同。

- R01 欢迎区共享回流（2026-09-20）：App 与 Playground 现在实际调用 ChatWelcome，统一候选图标、字号和 Foundation 快捷按钮，正式仍注入当前角色文案及真实发送 / 世界入口。7 项 UI 定向回归、Unit 1238 通过，深浅宽窄长文截图已检查。证据 var/verification/chat-welcome-shared；输入区与消息流仍有独立渲染，下一步沿实际状态和回调核验共享范围，不把欢迎区完成等同 Chat 或全产品完成。RAG / OAuth 后续仍暂缓。

- S5 协议验收入口独立化（2026-09-20）：单独运行 onboarding 自定义协议用例时，首屏已在设置，旧首句点击隐藏侧栏按钮超时。现等待启动后按设置实际可见性进入；首次保存等待遵循生产安全存储 15 秒上限，局部断言预算 20 秒。失败清理仅销毁独占测试 Electron 窗口，避免草稿保护导致 teardown 超时，不改产品 beforeunload。单独完整重启协议用例通过（11.7 秒），整组 onboarding 21 项通过（57 秒），Unit 1237 通过。electron.test.ts 已使用新连接表单和逐例独立目录，旧清单中的旧 UI 描述不再成立；本批不调用外部模型，不把其余 onboarding 用例宣称为全部独立。 全产品目标仍进行中，RAG / OAuth 后续继续暂缓。

- S4 MCP 向导与管理互斥（2026-09-20）：受控 Renderer 红测复现新连接已提交、向导响应未返回时删除旧服务，实际 settings.set 载荷 [] 将 old / new 一起清空。SettingsPanel 在 mcpAdding 期间拒绝 runMcpAction 并禁用服务卡，mcpBusy 期间禁止打开向导；刷新完成或取消后释放。红测转绿，双向入口互斥、保存失败重试及四主题卡片共 10 项通过，Unit 1237、根 tsc / build 通过。未改主进程 / IPC / 配置格式或 OAuth 登录逻辑；这是当前正式设置路径证据，不外推所有配置写入。 全产品最终验收仍进行中，RAG / OAuth 后续暂缓。

- 当前完整 UI 组合回归 337 项通过（2026-09-20，代码 18230aa，7.7 分钟，无重试）。正式身份区、设置、记忆、人物世界、工作区、Markdown 及候选隔离在同一批次通过。下一步定向核验 S4 MCP 向导与已有服务管理的重叠写入；现仅代码线索，不先判定故障。其余合同验收继续，四项体验不提升 adopted，RAG / OAuth 后续仍暂缓。

- R12 身份区共享回流（2026-09-20）：新增 WorldProfileHeader，App 将当前角色名称 / 简介传给 WorldHub；Playground 同组件只传隔离 persona。删除候选重复头部 JSX、写死头像字符和固定人设，使用姓名首字占位与语义底色，不复制装饰圆形或假地点。返回按钮保持 Foundation 固定尺寸；四主题宽窄、真实入口身份与候选切角 9 项 UI 通过，深浅截图已检查，Unit 1237 通过。仅修改 Renderer，不新增后端 / IPC / 上传功能；全产品 S6 仍进行中。

- R12 六标签定义统一（2026-09-20）：候选独立 PLAYGROUND_WORLD_TABS 已删除，直接采用 WorldHub 默认定义；足迹图标从正式宫格对齐候选 MapPin。未改数据 / IPC / 依赖。四主题宽窄导航与候选切角 9 项通过，查看浅色宽屏和深色窄屏截图，Unit 1237 通过。人物头部仍未回流：候选 MomentsProfileHero 的写死头像 / 人设文案不能进入生产，需共享结构并接真实角色字段；该项继续归 S6，不提升 adopted。

- S4 普通 MCP 新增向导桌面验收（2026-09-20）：独立 Electron 用户目录与本地 SDK 服务，从正式向导测试工具、取消单工具许可并保存；仅延迟原 mcp:save-tested handler 验证 reload / quit 被拒绝，释放后真实落盘、重载及完整重启恢复连接和 allowedTools。专项 mcp-wizard-desktop 1 项通过（13.8 秒），Unit 1237 通过。无生产代码 / IPC / 依赖变更，不覆盖跨入口写入竞争或未提交草稿，不恢复 RAG / OAuth 后续，S4 / S6 总项仍进行中。

- S5 正式 Electron 组合核验（2026-09-20）：33 通过、4 外部模型条件跳过、朋友圈备份导入 1 项等待超时。带日志复现导入在 8521ms 正常完成，测试 5 秒预算小于生产加密持久化 15 秒等待上限；只调整新目录导入断言至 20 秒，完整重启及重复导入用例随后通过，Unit 1237 通过。生产代码未改，证据见质量总控；S4 新增 MCP 向导真实保存重启、S6 全产品采用仍未关闭，RAG / OAuth 后续继续暂缓。

- S4 MCP 向导 Renderer 保存保护（2026-09-20）：saving 原本只禁表单关闭按钮，beforeunload 红测放行；现以表单同步 ref 接入 Settings 离页 / 卸载判定。保存及刷新在途留页，失败重试，测试 / 取消仍可离页。12 项 UI、Unit 1237、根 tsc / build 通过；未改后端。普通向导真实 Electron 保存重启与跨入口竞争仍待核验，不能以本批关闭 S4 / S6；RAG / OAuth 后续暂缓。

- S4 MCP 普通管理在途保护（2026-09-20）：停用 / 删除 / 工具许可三条红测确认请求挂起但卸载放行；runMcpAction 新增独立导航保护，OAuth 启停与重试明确排除。UI 13、真实 Electron MCP 删除 / 权限保存的 reload / quit 保护及重启恢复 2、Unit 1237、根 tsc / build 通过。不改后端 / IPC；新增向导、未提交草稿和跨入口竞争继续核验，不关闭 S4 / S6，RAG / OAuth 后续暂缓。

- S4 权限在途保存保护（2026-09-20）：规则保存 pending 时 beforeunload 原本放行，受控红测复现后以独立计数保护卸载和内部导航；失败保留表单并可重试。UI 模式 / 规则 / 既有规则四主题与普通队列 11 项，真实 Electron 重载 / quit 拒绝、真实写盘与完整重启恢复 1 项，Unit 1237、根 tsc / build 通过。不改权限策略 / IPC / 后端；MCP 独立操作及其余总体验边界继续，RAG / OAuth 后续暂缓。

- 全产品当前 UI 组合回归（2026-09-20）：50f20c1 代码的完整 ui 项目 331 项通过，8.2 分钟，无重试，证据 var/verification/rollout-current-ui。不改产品代码、不提升四项 experience 状态。下一步具体核验 S4 权限独立保存的 pending / 离页 / 卸载边界：savePermissionSetting 绕过普通设置队列，现有 beforeunload 只检查普通队列；当前仅代码证据，尚未运行该故障复现。真实 Electron 总验收、其余合同缺口继续，RAG / OAuth 后续暂缓。

- S5 watcher 测试误报已定位并修复（2026-09-20）：真实日志显示文档阶段收到的是迟到的第二次 index.html change，不是被忽略的文档事件。测试改用真实服务刷新路径归因，不清空历史后猜来源；正常 / 交叠场景通过，Unit 1237、根 tsc / build 通过。未改产品监听配置；S5 其余验收可靠性和 S6 总体验仍待完成，RAG / OAuth 后续保持暂缓。

- R12 通讯录共享呈现（2026-09-20）：WorldSurface 删除独立姓名行并复用 CastPanel 的隔离 previewData，保留正式忙闲 / 摘要 / 开聊能力。深浅宽窄隔离与既有正式交互共 7 项 UI、Unit 1236、根 tsc / build 通过；检查深浅截图。候选现能展示真实组件形态，最终视觉确认与全产品 S6 仍未关闭，不提升 adopted；RAG / OAuth 后续保持暂缓。

- R12 人物世界内部术语清理（2026-09-20）：共享 MomentsPanel / AssetsPanel 将动态、穿着空态及书架说明改为用户文案，旧回顾标题也不再显示 Catch-up；不改变数据链或生成行为。正式红测转绿，四主题宽窄及 Playground 同源回归 11 项、Unit 1236、根 tsc / build 通过；检查深色窄屏截图。通讯录共享呈现仍待处理，不关闭 S6 或提升 adopted，RAG / OAuth 暂缓。

- R12 / R14 人物世界基础导航复用完成（2026-09-20）：WorldHub 手写 Tab 与返回按钮替换为已验收 Foundation TabStrip underline / IconButton，正式与候选同轮生效，体验注册表补真实 WorldHub source / formal 路径。四主题宽窄、键盘、hover 尺寸、溢出和返回 8 项通过，候选隔离与六面正式入口 3 项通过；已查看浅色宽屏与深色窄屏截图。Unit 1236、根 tsc / build 通过；通讯录呈现差异及内部术语已记录，不提升 adopted、不关闭 S6，RAG / OAuth 保持暂缓。

- S4 普通设置队列卸载保护已落地（2026-09-20）：有待保存 / 在途 / 失败保留项时阻止重载退出，原自动保存完成后放行。UI 红测转绿，最新值排队、失败重试及应用内离页 3 项通过；真实 Electron 局部扣住 800ms 防抖回调，验证 reload / quit 拒绝、释放后真实落盘与完整重启恢复，整组生命周期 3 项通过。Unit 1236、根 tsc / build 通过。未改主进程 / IPC / 依赖，MCP 与权限独立操作、其余 S4–S6 仍待核实；RAG / OAuth 后续暂缓。

- S6 新增资产跨角色误写已修复（2026-09-20）：真实 Electron 红测在小林旧表单提交后，主进程日志确认衣物写到 zhou。新增请求现绑定页面快照 roleId，主进程拒绝无效 / 过期角色，受理后固定归属。四页过期新增无落库、正常新增重载、跨角色编辑删除拒绝均经真实 IPC 验证；独立用例及完整 onboarding 21 项通过，UI 40、Unit 1236、Eval 23 + 1、根 tsc / build 通过。其他设置生命周期、总体验采用仍继续，RAG / OAuth 后续暂缓。

- S6 生活资产旧写入回调隔离已落地：四页红测证明切角后旧 busy 锁住新角色；新增、编辑、删除均使用写入代次，旧成功 / 失败不清新草稿，新请求 pending 时旧 finally 不解锁。定向 UI 39 项通过，含浅色宽屏、深色窄屏与既有切角读取；检查两张截图。Unit 首跑监听测试 1 失败，原断言复核 1236 全过；根 tsc / build 通过。后端受理角色竞争与总体验采用仍待验收，RAG / OAuth 不恢复。

- S4 模型草稿离开保护已落地（2026-09-20）：同一判定保护内部导航、桌面重载和显式退出；取消退出恢复普通关窗隐藏，后台索引只在最终退出停止。未提交凭据不写盘，强杀 / 崩溃不保证恢复。真实 Electron 生命周期及 onboarding 共 22 项、UI 保存中 / 手动输入 / 保存失败回归 3 项通过；其他设置队列及在途写入竞争仍未关闭，RAG / OAuth 后续保持暂缓。

- S6 三个生活面切角已修复：文化角 / 家居 / 足迹此前未订阅角色通知，现共用订阅并清旧展示与草稿。三条受控红测转绿；真实 Electron 单独验证四类资产页面切角更新、来回切换及重载归属，完整 onboarding 20 项通过；Unit 1236、根 tsc / build、UI 定向 12 项通过。未提升总体验采用状态，其他生命周期和总验收仍继续，RAG / OAuth 保持暂缓。

- S6 衣柜读取缺口已复现并修复：失败无反馈、混合角色响应、旧请求覆盖新角色共三条红测转绿；正式组件增加请求序号、角色校验与原位重试，切角清旧展示，普通刷新失败保留内容。Unit 1236、根 tsc / build、深浅宽窄及删除 / 候选定向 14 项通过。只收口读取边界，不关闭全产品验收或写入生命周期；RAG / OAuth 仍暂缓。

- S6 正式界面审计推进：改动前 chat / Markdown / checkbox 263 项通过，已人工检查正式文化角、家居长文、记忆编辑失败态和审阅代码截面。外观页遗漏的开发说明已从正式 / 候选共享组件清除，正式入口红测转绿；Unit 1236、根 tsc / build、定向四主题宽窄与候选隔离 6 项通过。尚不能关闭 S6：衣柜读取角色一致性及失败反馈需复现，UI 替身不能替代真实持久化验收；四个体验资产状态不变，RAG / OAuth 仍暂缓。

- S5 外部脚本迁移及 Stop 缺陷已收口：四项从独立目录经正式模型配置进入，事件断言替代旧样式选择器与用户文案误命中；验证中发现流读取取消被标成模型故障，已按真实信号返回 aborted。本地协议四项通过，无 Key 四项跳过，Unit 1236、Eval 23 + 1、根 tsc / build 通过。尚未运行外部供应商验收；不关闭其余 S5 / S6，RAG / OAuth 继续暂缓。

- S4 首次凭据强退子项已修复：敏感设置保存先等待 Windows 系统加密记录落盘，失败零提交；备份共用前置保护。正式 UI 首次保存后立即强退，重启真实认证通过；主回归 22 项通过，Unit 1235、根 tsc / build 通过，主进程本批对照 71 → 71 无新增但并非全绿。S4 的草稿 / 写入竞争和 S6 尚未完成，RAG / OAuth 继续暂缓。

- S5 工作区验收前置已解除：三项用例显式准备真实模型配置、独立项目及右坞，不再依赖先前测试成功。原侧聊用例独立运行失败，修复后三项分别单跑通过，完整 onboarding 19、Unit 1227、根 tsc / build 通过。未改正式产品行为；其余套件独立性、外部脚本和 S6 继续，RAG / OAuth 仍暂缓。

- S5 文档监听子项收口：Vite 不再监听 docs / methodology / agent-skills / .agents/skills，保留原验收产物排除及源码更新。真实 Vite 红测捕获四类文档 HTML 事件，修复后文档无 watcher / WebSocket 重载通知，入口 HTML 与源码 Markdown 仍可更新。Unit 1227、根 tsc / build 通过。未改正式 UI 或体验采用状态；onboarding 前置依赖与其余 S5 / S6 项仍待完成。

- S3 无来源生活默认值已移除：正式初始化不再为角色自动编造衣柜、书架及文化作品，用户 / 事件 / world.default 路径保留，Playground 样张不变。5 条角色空态红测转绿；Unit 1227、Eval 23 + 1、根 tsc / build、onboarding Electron 最终 19 项通过，主进程 72 → 72 无新增。证据 `var/verification/s3-living-source-final`；旧开发库残留未批量清理，人物世界总验收及其他收尾包仍进行中。RAG / OAuth 后续继续暂缓。

- 2026-09-20 用户调整优先级：RAG 与 MCP OAuth 后续工作暂缓，待共同研究并明确恢复后再做。已撤回本轮未提交的 RAG 代码与测试，保留已提交能力；暂缓不等于完成，也不继续追加相关实现或测试。其余 Playground 正式回流继续；范围与重启条件见 `docs/deferred/rag-mcp-oauth.md`。

- S2 配置提交唤醒已接通：模型双键保存、单键保存和实际写入模型设置的备份导入，仅成功落盘后通知索引 worker；取消旧请求、重读配置，失败保存恢复原值且不通知。Unit 182 文件 / 1222 项、Eval 23 + 1、根 tsc / build、正式 Electron 有 Key / 无 Key 2 项通过。证据 `var/verification/s2-model-save-index-electron`。独立嵌入配置、RAG 重建及 S3–S6 仍未完成。

- S2 已补向量空间隔离：记忆 / RAG 共用实际请求空间、返回模型和维度身份，查询先过滤再计算相似度；结构化源在核对时重建，旧对话和文档源保留。4 条真实库红测已转绿，全量 Unit 1215、Eval 23 + 1、根 tsc / build、Electron 恢复 2 项通过，主进程对照 71 → 71 无新增。当前尚未完成独立嵌入配置、配置变更唤醒及文档重建，不关闭 S2 或 S3–S6。

- S2 文档检索断点已修：真实 Vectra 红测复现已导入两份文档但查询返回空数组；补齐 queryItems 参数后，继续修正 rag_search 对无 Key 连接的拒绝。新增 4 条测试覆盖真实导入 / 检索、topK、重开磁盘索引、配置拒绝及既有失败返回；全量 Unit 182 文件 / 1210 项、根 tsc / build 通过。未改 UI 或 IPC，不以 Unit 代替正式全产品验收；独立嵌入配置、向量空间身份及 S3–S6 仍待收口。

- 2026-09-20 S2 定向修复：移除 Embedding 进程级永久 404 熔断，启动 / 提交后的记忆同步及 RAG 导入不再用 Key 非空替代连接就绪；不改 UI、IPC 形状或凭据持久化。旧判断在新增测试中出现 5 个确定失败，修复后全量 Unit 181 文件 / 1206 项、根类型检查 / Vite build、独立 Electron 有 Key / 无 Key恢复 2 项、Eval 23 + 1 通过。证据目录为 var/verification/s2-embedding-auth-electron。S2 仍需独立嵌入模型配置与切换后的向量空间一致性；S3–S6 未关闭，不以本批测试替代全产品正式验收。

- 2026-09-19 S1 记忆派生索引恢复收口：SQLite 作为唯一结构化源，主进程启动 / 成功提交触发串行核对，失败 30 秒退避并在退出时取消；Vectra 使用原子快照写入、稳定记忆 ID、分类 / 角色元数据和当前三参数检索 API。新增 9 条真实 SQLite / Vectra Unit 与独立 Electron 强退恢复测试；全量 Unit 180 文件 / 1200 项、S1 Electron 1 项、完整 Electron 27 通过 / 4 外部模型条件跳过、Eval 23 + 1、根 tsc / build 通过。发现的首次保存连接后立即强退导致系统加密状态未落盘缺口已记录到 S4，不混入 S1 通过结论。S2–S6 仍未完成。

- 2026-09-19 收口审计：原目标与 R01–R14 范围不变，已将当前已知剩余工作统一为 6 包及完成条件，见全产品回流施工合同文首「当前收口清单」：记忆索引恢复、模型 / 嵌入配置、生活数据来源、草稿生命周期、验收可靠性、全产品正式验收与采用。普通关窗实际隐藏到托盘，不能继续混称关窗丢稿；四个体验注册项仍未 adopted。此次只更新审计与进度，不修改产品代码，不以历史通过数字当作本轮验收。

- R06 模型诊断窗口生命周期：已接主框架归属、准备阶段存活复核、在途 AbortSignal 与监听清理；两条旧请求继续成功的红测已转绿。正式 Electron 已验证重载断开真实 HTTP 及重进成功重试。Unit 1191、根 tsc / build 通过，主进程 74 → 74 无新增；完整 Electron 26 通过 / 4 外部模型条件跳过，Eval 23 + 1、资产 31 通过。证据 `var/verification/model-diagnostic-electron-full`。没有修改页面视觉，未重跑纯 UI 套件；无独立 lint 脚本，构建保留已有拆包警告。关窗草稿保护、多窗口冲突、向量恢复及全产品审计仍继续。

- R07 朋友圈历史与用户赞评进入整份备份：只恢复已发布历史，不重放世界事件或奖励。独立 Electron 验证正式数据页导出、新目录导入、完整重启与重复导入保留新增评论；完整 Electron 25 通过 / 4 条件跳过，UI 结果文件 passed。Unit 1182、根 tsc / build 已通过，主进程类型对照 74 → 74 无新增。全产品回流仍进行中，继续模型生命周期、派生向量恢复和最终正式入口逐项审计。

> **当前状态入口**：只记录项目现在在哪、最近完成、下一步和阻塞项。完整历史见 [`../_archive/ledgers/progress-through-2026-08-16.md`](../_archive/ledgers/progress-through-2026-08-16.md)。

## 人读摘要（约 30 秒）
- 2026-09-19 R07 核心导入事务与进程崩溃恢复：以真实 SQLite 红测复现设置 / persist 失败残留半份数据，现改为所有核心表同步事务、一次快照落盘和失败补偿；记忆去重 / 设置加密共用存储原语，向量仅成功后发布。空库默认 [] 不再阻止备份配置恢复。带管理标记的图片目录在窗口启动前按持久引用核对，未提交才清理。真实 Electron 在快照替换前 / 后 SIGKILL 并重启，两种状态验证通过；完整 Electron 24 通过 / 4 条件跳过，证据 backup-atomic-crash-kill / backup-atomic-electron-full。最终 Unit 178 文件 / 1168 项、根 tsc、Eval 23 + 1 通过，主进程 75 → 74 无新增诊断；build 与 staged 文档门禁随提交复核。没有 UI 布局变化、无独立 lint、未重做打包 / 外部服务 / 断电验证。向量派生索引崩溃补齐、朋友圈互动备份及全产品验收仍未关闭，目标继续。
- 2026-09-19 R06 用户主动生图独立批次收口：正式设置、审批、真实 Images / Gemini 适配、项目 PNG、主 / 侧聊天共享展示、重启定位及媒体备份恢复已接通。最终 Unit 176 文件 / 1161 项、根 tsc 与 build 通过；追加在途取消和并发同名文件保护，真实 Electron 与 Windows 目录产物专项各 1 通过，取消关闭请求且不落图 / 不重试。完整 UI 267、Electron 22 通过 / 4 条件跳过、Eval 23 + 1、资产 31 沿本批最终生产代码验证；主进程类型对照 75 → 75 无新增，仍有存量债。打包取消证据 generated-image-packaged-cancel。下列同批施工记录为历史过程，不再代表当前缺口；提交推送结果以 Git 为准。下一步仍为 R07 跨存储恢复、R06 模型生命周期及 R01–R14 正式入口总验收，不冻结整个回流合同。无独立 lint；未做外部付费生成、安装向导 / 签名发布或新依赖审计。
- R06 媒体备份与 Windows 打包产物验收：导出保留工具配对、携带实际 PNG 字节且不暴露恢复路径；导入在解码 / 摘要 / 规模 / 归属校验后写 userData 独立目录，重复导入不复制，写文件或会话事务失败清理本批目录。正式 Electron 已覆盖删除原图与会话后导入、完整重启显示 / 定位，无再次生图请求；打包后的 `My Agent.exe` 同一流程通过，sharp 原生模块实际参与生成与恢复。首个中断包的 package.json 全零，启动失败，不计成功；重新 electron-builder --dir 明确退出 0 后验收通过。当前最终 Unit 176 文件 / 1160 项（直接 npx vitest run --maxWorkers 2）、完整 UI 267、Electron 22 通过 / 4 条件跳过、打包专项 1、Eval 23 + 1、资产 31 通过；根 tsc / build 通过，主进程对照 75 → 75 无新增。高并发单测两次超时 / worker 退出已保留证据，没有放宽断言或超时。证据 `var/verification/generated-image-backup-ui-final`、`generated-image-backup-electron-final`、`generated-image-packaged-complete`。没有运行安装向导、签名发布、外部付费生成或依赖重新审计；R07 跨存储原子性 / 崩溃恢复、R06 剩余生命周期和全产品最终清单继续，尚未提交推送。
- R06 文件定位与侧边聊天图片链路已验证，整体仍为未提交施工态：定位复用会话文件摘要校验，拒绝子框架与异步等待后的销毁 / 导航 / 脱离，失败可重试；侧边聊天使用共享工具事件与图片卡。新增红测复现下一批 index 0 覆盖已完成工具，已改为匹配 pending 流索引并按消息 callId 分配结果。独立 Electron 验证主聊天重启定位、侧聊天生成定位与关闭后保留项目文件，测试仍是本地协议而非外部模型质量证据。全量 Unit 175 文件 / 1142 项、UI 267、Electron 22 通过 / 4 外部模型条件跳过、Eval 23 + 1、资产 31、根 tsc / build 通过；主进程原配置对照 75 → 75 无新增根诊断，仍非全绿。证据 `var/verification/generated-image-reveal-ui-full`、`generated-image-reveal-electron-full`，专项深浅宽窄与侧聊天截图已检查。前端 5174 直连 200；无独立 lint，未重跑依赖审计。下一步补媒体备份恢复与安装包 native 验收，再收口完整失败流程及全产品清单；未提交推送，不标整体完成。OAuth 首次登录保持已批准范围，后续按 WISH-045，不扩展。
- R06 已接通正式生图主链，仍为未提交施工态：image_generate 已注册，正式 / 候选统一生图用途，附图理解归主模型；共享图片结果支持固定区域、原图查看、读取重试和会话迟到隔离。独立 Electron 验证正式设置 → 审批前零请求 → 一次本地 Images 请求 → 实际 PNG → 完整重启恢复；不把测试图片当外部模型质量证据。请求前补配置等待期间的权限复核，并要求主进程显式 workspaceRoot，缺项目不能向进程回退目录生图，两项均先红后绿。最终 Unit 175 文件 / 1135 项、完整 UI 267、Electron 22 通过 / 4 外部模型跳过、Eval 23 + 1、资产 31、根 tsc / build 通过；主进程原配置 75 → 75 无新增根诊断，仍非全绿。证据 `var/verification/generated-image-ui-full` 与 `generated-image-electron-full`；深浅宽窄及真实重启截图已检查，前端 5174 直连 200。文件定位、侧边聊天工具图片、媒体备份、安装包 native 验收及全产品清单仍待继续，未提交推送；本轮无独立 lint，未重跑依赖审计。
- R06 本轮最终底层门禁：174 个 Unit 文件 / 1131 项通过；原主进程 tsconfig 与 HEAD 对照 75 → 75，无新增根诊断，仍非全绿。生产入口尚未开放生图，当前改动继续按施工态保留，不作为功能交付或提交推送。
- R06 生图继续施工（未提交、未开放正式入口）：新增 sharp 0.35.4 完整解码、8MB / 16M 像素 / 8192 边长限制及 PNG 重编码；独立 image_generate 实现真实落盘、拒绝覆盖 / 目录链接、取消与权限变化复核、临时文件清理，尚未加入 builtin 注册。session:readGeneratedImage 四处同步，只从本会话工具引用查文件并复核摘要，不能传任意路径。Unit 全量 1130 通过后补 IPC 主框架专项 1 通过；根 tsc / build 通过，最终 Electron 21 通过 / 4 条件跳过，证据 `var/verification/image-generation-external-electron`。修正主进程 Vite 8 配置被旧 rollupOptions 遮蔽导致 external 无效的问题，产物现实际 externalize sharp；Electron 42.9.1 的 Node 模式实际编码解码 3×2 PNG 通过，但不是安装包验收。生产依赖审计仍 4 项既有风险。下一步：正式共享图片展示、工具消息保存后发布时序、用途切换 / 注册及正式生图端到端；全产品目标保持进行中。
- R06 当前施工态的既有 Electron 回归：21 通过 / 4 外部模型条件跳过，证据 `var/verification/image-generation-scaffold-electron`。这证明网络抽取、工具结果扩展与 schema 变更未破坏已覆盖入口，不是正式生图流程验收；尚未重跑完整 UI / Eval / 依赖审计，无独立 lint。
- R06 生图已进入未提交施工态，尚非可交付功能：新增 Images / Gemini 生成请求适配器与独立配置工厂，OAuth 受限网络提取为共享工具且保留原接口。结构化图片引用已接 Registry → Loop → callback / 历史还原，以及 Runtime → SQLite schema v17 → 重载 / 分支复制；普通文本工具保持原结果形状。全量 Unit 1117 与根 tsc / build 通过，本地协议覆盖一次请求、取消、非法响应、大小限制与下载越界，SQLite 重开和分支引用有实测。主进程原配置诊断 75 → 75，仅导入来源说明变化，不宣称全绿。尚缺完整图片解码 / 像素限制、安全落盘、工具注册及权限、正式图片读取展示、image 用途切换和正式生图 Electron 验收；当前不暴露生图入口、不提交过程态。未跑外部供应商或付费生成；合同与全产品目标继续。
- 本轮依赖审计重新取得结果：全部依赖 7 项、生产依赖 4 项漏洞，继续登记 WISH-044；没有修改依赖或宣称发布门禁全绿。前端 5174 返回 HTTP 200。
- R10 MCP 首次 OAuth 登录闭环已接通：正式共享表单主动打开浏览器，授权回调后返回发起窗口，连接发现工具并按许可保存；取消、超时、拒绝、窗口失效和凭据过期均可恢复。SDK 处理协议，令牌仅主进程内存，重启需主动重新登录，后续持久化 / 自动刷新 / 账户管理见 WISH-045 与 DEC-043。Unit 1096、完整 UI 258、Electron 21 通过 / 4 外部模型条件跳过、Eval 23 + 1、资产 31、根 tsc / build 通过；主进程类型对照 75 → 75 无新增，非全绿。证据 `var/verification/mcp-oauth-ui-full` 与 `mcp-oauth-electron-full`，深浅宽窄截图已检查；本地协议证据不等于所有第三方服务兼容。未改依赖，无独立 lint；真实生图、备份跨存储恢复与全产品回流验收仍未完成。
- R03 / R14 外观共享收口：正式设置与候选共用 AppearanceSettingsContent，主题 / 字号来自设计资产并组合 Foundation ActionButton；选中图标始终占位，候选仅改内存。Unit 1078、完整 UI 254、根 tsc / build 通过，宽窄深浅截图已检查。Electron 首轮 19 通过 / 1 本地模型发现超时 / 4 外部模型条件跳过；原码原断言开启 trace 完整复核 20 通过 / 4 跳过，不据此关闭 WISH-042。证据 `var/verification/appearance-shared-ui`、`appearance-shared-electron`、`appearance-shared-electron-trace`。未改主进程 / IPC / 依赖，未重跑 Eval 或主进程类型对照；无独立 lint。OAuth 仅首次登录闭环的范围已确认并登记后续计划，尚未实现；全产品目标继续。
- R07 记忆备份预检已与真实存储同源：6 项红测复现正文长度 0 / 1 / 20,001 被备份放行后修复，非法备份在首次业务写入前整份拒绝。Unit 1077、根 tsc / build、Electron 20 通过 / 4 外部模型条件跳过；正式按钮验证三种非法备份零数据改动，随后合法导入与重复合并成功。主进程对照 75 → 75 无新增根诊断，仅移除重复 import 后依赖来源说明变化。无 UI / 依赖 / Prompt 改动，未重跑全量 UI、Eval 或依赖审计；无独立 lint。证据 `var/verification/backup-preflight-electron`。合法输入的跨存储原子导入与崩溃恢复仍未完成，全产品目标继续。
- R07 主进程备份归属与互斥已补齐：对话框绑定请求窗口，子框架拒绝；准备阶段失效不写入，commit 后持锁收尾，旧请求 finally 不释放新租约。5 项 handler 红测复现错误归属、并发进入和迟到写入后转绿；最终 Unit 1069、完整 UI 252、Electron 20 通过 / 4 外部模型条件跳过、Eval 23 + 1、根 tsc / build 通过。Electron 真实 IPC 验证对话框 pending 时 import 返回 busy，取消后正式按钮可完成真实文件往返。主进程 Compiler API 与 HEAD 对照 75 → 75 无新增，仍非全绿；无独立 lint，未改依赖。证据 `var/verification/backup-ownership-ui` 与 `backup-ownership-electron`。备份互斥不等于跨存储原子导入或崩溃回滚，R07 剩余恢复边界及全产品目标继续。
- R07 数据与隐私页已抽为共享 DataSettingsContent，正式与候选共用备份操作 / 范围说明和 Foundation 按钮；取消静默、失败重试与脱敏、同步防重入、跨设置子页 busy 和迟到反馈隔离均覆盖。Unit 1057、最终 UI 252、Electron 20 通过 / 4 外部模型条件跳过、资产 30、根 tsc / build 通过；正式按钮实际触发真实备份文件并在独立目录恢复，重复导入不新增生活资产。首轮 UI 的旧整段文案断言改为逐项检查；首轮 Electron 导入新目录已自动在设置却点击隐藏侧栏，修正初始化断言后完整通过，未改后续工作区失败路径或超时。证据 `var/verification/data-settings-ui-verified`、`data-settings-electron-verified`，原失败现场仍保留。截图已核验；无独立 lint，未改主进程 / IPC / 依赖，未重跑 Eval / 主进程类型对照 / 依赖审计。设置整体卸载 / 多窗口备份并发、OAuth、生图语义与全产品验收仍未完成。
- R01 / R14 快捷键导航修复：受控红测确认设置保存期间 Ctrl+b 重渲染会取消待执行离页；App 改为按已提交视图维护监听，普通渲染不取消保存后导航，回调读取当前状态，真实切页 / 卸载仍取消旧请求。Unit 1056、完整 UI 243、独立 Electron 20 通过 / 4 外部模型条件跳过、资产 29、根 tsc / build 通过；证据为 `var/verification/navigation-red`、`navigation-focused`、`navigation-ui-full` 与 `navigation-electron`。此前 Electron 偶发返回失败未取得同根因证据，WISH-042 不关闭。无主进程 / IPC / 依赖变化，未重跑 Eval、主进程类型对照或依赖审计；无独立 lint 命令。全产品回流目标仍进行中。
- R10 工具许可复选框已提取为 Foundation CheckboxField，MCP 服务卡 / 添加向导与基础故事实际共用；许可状态、IPC 与授权规则未改变。Unit 1056、完整 UI 241、资产 29、根 tsc / build 通过；四主题宽窄覆盖 label / Space / disabled、16px 固定尺寸、失败保留与空许可提交，截图已查看。早期定向发现 rem 实际为 15px，已改明确像素尺寸；测试导航与禁用标签点击问题已按现场修正。Electron 独立回归 20 通过 / 4 外部模型条件跳过；证据为 var/verification/checkbox-ui-full 与 checkbox-electron。本批未改主进程、IPC 或依赖，未重跑 Eval / 主进程类型对照 / 依赖审计；无独立 lint 命令。全产品目标仍进行中。
- R04 伙伴设置的回答方式与提醒数字字段已从原生控件改为 Foundation，正式和候选共用同一组件；候选补充说明 / 时段 / 次数可隔离编辑。Unit 1055、完整 UI 233、资产 28、根 tsc / build 通过，四主题宽窄截图与键盘 / hover / 保存失败恢复已覆盖。首次 Electron 为 16 通过 / 4 失败 / 4 外部模型跳过；UI 结束后原码原断言带 trace 完整复核为 20 通过 / 4 跳过，不能据此关闭 WISH-042。证据 `var/verification/companion-foundation-ui-full`、`companion-foundation-electron` 与 `companion-foundation-electron-repeat`。本批未改主进程、IPC 或依赖，未重跑 Eval / 主进程类型对照 / 依赖审计；无独立 lint 命令。MCP 复选框提取、OAuth、窗口生命周期、生图语义及全产品验收仍未完成。
- R06 高级区已采用共享 ModelAdvancedSettings，Foundation 输入 / 按钮和候选三个参数同源，正式旧 Top P / 最大输出控件移除；测试接已保存主用途首选，筛选函数与配置工厂同源。参数前后端校验、Temperature 零值、行内失败重试与换 Key 后测试失效已接通。Unit 1054、完整 UI 229、Electron 20（4 外部模型跳过）、资产 27、Eval 23 + 1 通过。证据为 `var/verification/model-advanced-ui-full` 与 `model-advanced-electron`。主进程对照 75 → 75 无新增；新增共享文件显式纳入 composite 后根检查曾报 TS6305，已拆开根 / 主进程检查入口并复验构建。审计仍全量 7 / 生产 4，无独立 lint 命令。生图语义、关窗 / 多窗口、旧外部模型脚本及全产品回流继续。
- R06 空配置已停止旧身份回退：正式清单不再生成 legacy-primary，主用途只读保存的路由，辅助 / 图片未独立配置时沿用新主用途，Chat 和 Debug 显示实际配置。独立 Electron 覆盖删空、完整重启、未配置无请求及重新配置；同时修复 invoke 回执早于 error / done 导致提示丢失，三个受控时序用例通过。Unit 1038、完整 UI 221、Electron 20（4 外部模型条件跳过）、根 tsc / build、Eval 23 + 1、资产 26 项通过，证据为 `var/verification/model-empty-ui-verified` 与 `model-empty-electron-verified`。主进程对照 75 → 75 无新增，依赖审计仍全量 7 / 生产 4，无独立 lint 命令；文档及 diff 门禁通过。被跳过的旧外部模型脚本需单独更新，不作为供应商验收证据。存量嵌入字段物理清理、高级模型控制、生图语义与全产品回流继续。
- R06 清单外层已共用 ModelConnectionList：标题右侧添加、连接数量、空态及新增 / 编辑禁用采用同一实现，添加来自 Foundation。Unit 1028、完整 UI 218、根 tsc / build、资产 26 项通过；Electron 首次 16 通过 / 4 失败 / 4 跳过，既有 Playground 快捷键返回失败导致后续缺前置，原码完整重跑 20 通过 / 4 跳过。证据 `var/verification/connection-list-ui-full`、`connection-list-electron`、`connection-list-electron-repeat`；不关闭 WISH-042。本批不改主进程、IPC 或依赖，未重跑 Eval / 主进程类型对照 / 依赖审计，无独立 lint 命令。下一步优先处理空数组重开时旧连接与全局模型回退，随后继续高级设置及全产品差异。
- R06 连接卡片已回流为共享 ModelConnectionCard：正式与候选同源，Foundation 操作与输入、请求状态固定操作槽、长名称截断、模型增删启停与内联编辑均有覆盖。Unit 1027、完整 UI 218、最终 Electron 20（4 外部模型条件跳过）、根 tsc / build、Framework Eval 23、Skill Eval 1、资产 25 项通过。首次 Electron 旧拼接文案断言导致首次配置未完成，已改为标题及真实启用状态双断言；其他失败现场保留在 `var/verification/connection-card-electron`，最终证据为 `connection-card-electron-verified`，不关闭 WISH-042。未改主进程、依赖或 IPC，未重新执行主进程类型对照和依赖审计；无独立 lint 命令。模型整页外层布局 / 高级设置、生图语义、多窗口 / 关窗保护及全产品回流继续。
- R06 用途安排界面已回流：正式页和候选共同渲染 ModelUsageArrangements，使用 Foundation 选择 / 按钮 / 固定图标操作槽；正式保留整组保存失败恢复，候选只改内存。符号级 Unit 校验真实绑定并拒绝未使用 import / 遮蔽；四主题宽窄、长名称、hover / pending 几何与排序启停删除有 9 项定向 UI 证据。完整 Unit 1026、UI 210、Electron 20（4 外部模型条件跳过）、根 tsc / build、Framework Eval 23、Skill Eval 1、资产检查通过；证据位于 `var/verification/usage-arrangements-ui-full` 与 `usage-arrangements-electron`。本轮未改主进程、依赖或 IPC，未重跑依赖审计；既有类型与审计问题不关闭。连接卡片其余结构、生图语义、多窗口 / 关窗保护与全产品回流继续。
- R06 用途备用链已接通：三用途按保存顺序装配独立连接，辅助 thinking 按目标计算；一次性连接覆盖隔离备用池，取消 / 已交付模型事件后不再切换。独立 Electron 验证正式添加排序、重启、首选 503 后备用回答及认证头隔离。Unit 1025、完整 UI 201、完整 Electron 20（4 外部模型条件跳过）、Framework Eval 23、Skill Eval 1、根 tsc / build、资产检查通过。主进程对照 75 → 75，无新增；依赖审计仍全量 7 / 生产 4，未改依赖，无独立 lint 命令。证据位于 `var/verification/fallback-electron-full`、`fallback-ui-full`。模型整页其余差异、多窗口 / 关窗保护、OAuth 和全产品回流继续。
- R06 本机兼容无 Key 调用链已接通：共享认证判断贯穿正式测试 / 发现、Runtime 与已有辅助入口；App 首启和顶栏使用主配置工厂派生的就绪状态及实际模型。独立 Electron 覆盖正式配置、模型发现、连接测试、完整重启后对话与 401 后补 Key 重试；真实请求诊断发现的空 Embedding Bearer 也已修复。Unit 1013、完整 UI 201、完整 Electron 20（4 条件跳过）、Framework Eval 23、Skill Eval 1、根 tsc / build 通过；主进程对照仍 75 条存量诊断，无新增。依赖审计仍全量 7 / 生产 4 项，WISH-042 稳定性问题不因本次跑通关闭。备用用途链、模型整页剩余差异、本地向量配置及全产品回流继续。
- R06 本地连接审计：直接运行生产共享校验，localhost / IPv4 / IPv6 回环无 Key 均复现拒绝；追踪发现 Runtime 和 App 首启仍依赖密钥存在，放开测试 / 发现不足以接通真实对话。已把认证判断、请求头、首次启动和完整重启后流式对话纳入合同验收；本轮仅修正施工边界，尚未修改此项生产行为。
- 2026-09-19：R06 应用内草稿离页保护已接通：连接草稿、手动模型输入和保存中状态阻止设置切页、返回与导航快捷键，不自动写入草稿 Key；未修改编辑可离开。Unit 990、UI 201、Electron 19（4 条件跳过）、根 tsc / build 与资产检查通过。Electron 确认拦截前后真实配置不变。关窗 / 崩溃保护、多窗口冲突、模型整页剩余差异及全产品回流继续；WISH-042 偶发失败、主进程 75 条存量类型诊断与依赖审计风险未关闭。
- 2026-09-19：R06 模型测试 / 发现请求增加按连接令牌，换端点 / 协议 / Key 或删除后拒绝旧结果，取消 / 失败保存保留原结果，IPC rejection 可重试；首个测试模型变化只清理测试，不影响发现列表连续添加。Unit 990、最终 UI 199、最终 Electron 19（4 条件跳过）、根 tsc / build 通过。此前完整 Electron 两次快捷键返回失败及一次终端完成标记超时仍记录 WISH-042，未宣称修复；临时 App 探针已移除，增加测试失败的无正文 Renderer 诊断摘要。草稿离页保护、多窗口旧快照冲突及全产品回流继续。
- 2026-09-19：R06 正式模型页已切换专用整组保存 IPC，连接 / 路由一次落盘，SQL 或文件替换失败恢复已写键原值；凭据合并与单键模型入口共用写队列。Unit 990、UI 198、Electron 19（4 项条件跳过）、Framework Eval 23、Skill Eval 1、根 tsc / build 通过。主进程仍 75 条存量诊断，同一 TS6307 引用链因新增类型 import 改变，无新增诊断项。真实 SQLite 覆盖写入 / 落盘失败、重试与重开，Electron 覆盖整组保存 / 非法载荷拒绝 / 完整重启 / 关联删除；离页草稿、迟到响应、多窗口旧快照冲突及全产品目标仍未完成。
- 2026-09-19：R06 原子保存前置检查发现数据库 rename 失败会退回 copy 覆盖旧库；3 项故障注入红测复现后删除该回退，临时写 / 替换失败保留旧快照并提示重试。Unit 982、Electron 19（4 项外部模型条件跳过）、Framework Eval 23、Skill Eval 1、根 tsc / build 通过；主进程对照仍 75 条、无新增。无 UI 改动，本批不重复静态 UI。连接 / 路由整组保存与失败后内存恢复仍未实现；已确认 sql.js 未提交事务内 export 会结束事务，后续不能直接套事务加 persist。全产品目标继续。
- 2026-09-19：R06 连接添加 / 编辑表单已由 Playground 与正式设置共用，五类来源、预设和自定义协议实际回流；测试 IPC 保留协议，保存 / 测试 / 发现只在端点与协议一致时复用已存密钥。Unit 979、UI 198、Electron 19（外部模型 4 项条件跳过）、Framework Eval 23、Skill Eval 1、根 tsc / build 与资产检查通过。主进程对照仍为 75 条存量诊断，无新增；依赖审计全量 7 / 生产 4 项未解决。模型整页、路由原子保存、离页草稿与迟到结果隔离仍在合同和待办中，全产品目标不收口。
- 2026-09-18：R06 工厂红测复现独立用途借用全局 / 主连接密钥及显式协议丢失，已改为同连接整体装配；没有有效用途路由才整体回退。Unit 970、Framework Eval 23、Skill Eval 1、UI 190、Electron 18（外部模型 4 项条件跳过）、根 tsc / build 和资产检查通过。主进程同工作树对照前后 75 条存量诊断，无新增；依赖审计仍全量 7 / 生产 4 项，不宣称通过。整页核对表新增协议 IPC、本地无 Key、备用路由链和共享表单差异；全产品目标继续。
- 2026-09-18：正式模型保存红测确认写入失败仍关闭编辑态；改为保存成功再更新列表和清理草稿，保存中串行且禁用相关控件，失败提示且可重试。Unit 960、UI 190、Electron 18（外部模型 4 项条件跳过）、根 tsc / build 通过；模型候选来源分类 / 添加表单差异和连接路由原子保存仍未完成，不能把共享基础输入当作整页回流。
- 2026-09-18：模型连接文本输入、用途选择与 MCP 认证选择接入基础组件，新增符号引用负例、Bearer 载荷与 hover 几何检查。Unit 960、根 tsc / build、UI 189 通过；Electron 首轮 14 通过 / 4 失败 / 4 条件跳过，未改代码的 trace 定向 1 项及完整复跑 18 项通过（4 条件跳过）。首次快捷键返回失败及测试前置依赖继续记入 WISH-042，不宣布稳定性已修复。OAuth 新授权边界仍待确认，全产品目标不收口。
- 2026-09-18：回流管理补齐四个体验的正式入口、真实数据路径与测试导航字段，保留未 adopted 状态；路径存在只作导航检查，不替代行为验收。R10 OAuth 的回调、凭据、取消、刷新与真实 Electron 验收方案已写入总合同，新的浏览器授权边界待确认，尚未编码。
- 2026-09-18：全产品入口复核发现开发者模式关闭后快捷键仍可进入 Debug / Playground；真实 Electron 红测复现后补保存后配置核验与离页失效保护。Unit 959、UI 189、Electron 18（外部模型 4 项条件跳过）、根 tsc / build、资产与文档门禁通过。MCP OAuth 和全产品逐项采用核验继续进行，不把入口修复当成全产品完成。
- 2026-09-18：R10 MCP Bearer 凭据完整重启专项通过：真实 Electron + 本地认证服务覆盖无认证 401、SQLite 密文、Renderer 脱敏、完整重启后自动认证和工具发现。Unit 959、完整 Electron 18（外部模型 4 项条件跳过）、根 tsc / build 通过；未改生产代码，本批不重复 Renderer UI。OAuth、第三方认证及全产品采用核验仍进行中。
- 2026-09-18：R01/R02 设置快捷键保存保护通过验收：正式入口红测复现 Ctrl+, 保存失败时卸载设置；改用同一保存队列后失败留页、成功才新建并重开恢复。Unit 959、完整静态 UI 189、Electron 18（外部模型 4 项条件跳过）、根 tsc / build 通过。全产品采用核验、MCP OAuth 和凭据完整重启证据仍未完成。
- 2026-09-18：R13 上下文批次验证通过：Unit 959、静态 UI 188、Electron 18（外部模型 4 项条件跳过）、根 tsc / build、资产与文档检查通过。覆盖文件乱序 / 缓存 / 关闭来源、审阅多实例 / 主会话切换 / 清空失败重试与迟到 diff。UI 改为独立 ui-e2e 静态构建，补 Markdown 夹具入口及压缩后秒单位的动效显示；此前开发服务器中途重载的来源仍由 WISH-042 管理。OAuth、凭据完整重启和全产品采用核验仍未完成。
- 2026-09-18：人物世界验收修复：朋友圈共享卡片 hover 不再 translateY，评论槽严格几何断言通过；衣柜删除验收同步真实按钮名称和脱敏错误文案，补齐入口夹具。全量 Unit 959、UI 186、Electron 18（外部模型 4 项跳过）及根类型 / 构建通过；全产品目标仍进行中。
- 2026-09-18：R10 本批验收收口：Unit 161 文件 / 959 项、完整 UI 186 项、真实 Electron 18 项通过（4 项外部模型按凭据条件跳过），根 tsc / build、资产检查、Framework Eval 23 项与 Skill Eval 1 项通过。主进程类型对照前后 75 条，无新增主诊断，不代表主进程门禁通过。Electron 首启测试按当前模型添加与路由优先级更新；stdio 夹具使用绝对模块地址，消除项目切换后的模块解析失败。OAuth、safeStorage 凭据完整重启恢复、R13 与全产品 adopted 仍未完成。
- 2026-09-17：R10 补齐停止 / 替换连接归属保护与设置页迟到查询隔离，失败复现后修复；Unit 161 文件 / 959 项通过。朋友圈卡片 hover 位移已定位为 translateY(-1px) 并移除，衣柜删除测试按真实契约修正，连同 Foundation Markdown 定向 3 项通过。此前完整 UI 183 通过 / 3 失败；完整回归仍待本批收口，Markdown 偶发超时未因重跑通过而关闭。
- 2026-09-17：R10 MCP 异常断开 UI 已接入：意外 transport close / 可重连 callTool 失败会保持快照行为 error + reconnecting，设置页显示连接失败和重试，不再静默变成未连接。手动断开仍移除快照。OAuth 与全产品 adopted 仍未完成。
- 2026-09-17：共享 Prism 主题清洗已进入 CodeBlock：oneLight 容器白底去掉，内部 token 透明，Diff 语义高亮保留。正式审阅、文件预览、Foundation Markdown / Diff 与 Playground 工作区审阅共用同一入口。全产品 adopted、MCP OAuth 和工作区跨页状态仍未完成。
- 2026-09-17：R06 正式模型发现收口主进程 `settings:fetch-models`：OpenAI Compatible / Anthropic 读 `/v1/models`，Gemini 明确不支持；无 Key 不发请求，已存 Key 只按连接注入，401 可重试且不回传凭据。Playground 获取仍是隔离 fixture。MCP OAuth / 异常断开与全产品 adopted 仍未完成。
- 2026-09-17：R12 人物 starter 来源复核收口无 `world.default.json` 的运行态泄漏：lin / zhou / xia 默认居所和当前位置改为「未设定」，Catch-up 空居所不再写「日常住处」。衣柜 / 文化分味播种仍不是已确认人物事实。全产品目标保持进行中。
- 2026-09-17：R11 正式关于页与 Playground 共用开发者模式开关；真实 `settings.developerMode` 控制侧栏 Debug / Playground 整组入口和 Chat 顶栏 Debug 按钮，候选只改内存样张。Electron 独立目录覆盖开关、隐藏入口和完整重启恢复。UI E2E 的 `ui-e2e` 模式仍显式保留开发入口。全产品目标保持进行中。
- 2026-09-17：R12 六面正式入口 Electron 从侧栏人物世界点齐六个生活面，断言真实 companion 数据；文化 starter 去掉无证据数量，小林家居 / 常去保持空态。人物 starter 来源复核仍未完成，全产品目标保持进行中。
- 2026-09-17：R12 正式朋友圈赞 / 评论落独立用户表，正式入口走真实 IPC，Playground 仍用本地夹具。Electron 覆盖播种、赞评、空值 / 超长拒绝和重载保留。通讯录忙闲预检与衣柜 / 文化角 / 家居 / 足迹真实增改删已落地。人物 starter 复核当时仍未完成，全产品目标保持进行中。
- 2026-09-17：R07 正式备份补齐生活资产与播种标记。导出导入按 id / 播种键合并，会话与资产同一事务失败回滚；旧备份缺字段仍可导入。Electron 覆盖独立目录真实往返与二次导入不覆盖。朋友圈互动、MCP、权限、凭据和项目路径仍不进入备份。人物 starter 复核当时仍未完成，全产品目标保持进行中。
- 2026-09-16：确认流程收尾完成。正式记忆敏感新增绑定不可变草稿快照，改稿 / 换组 / 取消会使旧确认失效；衣柜删除与通讯录强制开聊失败后保留确认，处理中禁止取消和重复提交。Playground 候选不写真实 IPC。全产品目标仍进行中。
- R10 MCP 添加向导已完成核心生产闭环：正式 preload / 主进程测试连接、工具与资源发现、保存接管、配置并发锁及完整重启后的配置恢复均有证据；新增真实 Electron 用例后整套 Electron 回归为 11 项通过、4 项外部模型跳过。OAuth、第三方认证和异常断开 UI 恢复仍未完成，全产品目标保持进行中。
- 2026-09-17：R08 正式权限页规则卡片与新增草稿已收口：正式入口复用共享编辑器，覆盖四主题宽窄、添加 / 取消几何不跳、空 pattern 不提交、保存失败保留草稿和原规则、重试不重复写入。Playground 仍只改本地列表；MCP OAuth / 异常断开与全产品 adopted 未完成。
- R08 文件规则后端已接入原生修改 / 删除 / 旧 path 的真实消费，补目录子项、symlink、一次性确认及执行前复核；共享枚举与补丁目标保持唯一来源。页面卡片与新增草稿不再视为待回流；全产品目标保持进行中。
- 2026-09-16：R05 记忆整页已回流四类导航、同行搜索、独立卡片与列表后新增行；正式与故事共用管理组件，旧类别 / 顶部表单 / 技术页脚不再进入正式页。旧六类唯一映射、各分组独立草稿、IME / Escape、分类计数、内部滚动与真实四类增改重启已覆盖；Unit 显式串行 152 文件 / 883 项、最终 UI 150 项（var/verification/memory-management-no-writes）、Electron 9 项（4 项外部模型跳过）、根 tsc / build、资产检查通过。前两轮 UI 被文档写入触发的 Vite full-reload 中断，该子因已受控复现、监听配置尚未修复，记录 WISH-042。下一项为 MCP OAuth / 异常断开恢复、Markdown / Diff 全入口无白底及工作区跨页状态；全产品目标仍进行中。
- 2026-09-16：R05 修复长文删短时编辑器卸载和异步写入重复提交；失败保留草稿、刷新失败只重读、离页迟到响应隔离。Unit 串行 150 文件 / 880 项、UI 142 项、Electron 9 项（4 项外部模型跳过）、根 tsc / build 与资产检查通过；真实独立目录验证增改、完整退出重启恢复和删除，四主题宽窄及操作槽几何由正式入口 E2E 验证。默认并发 Unit 出现既有 MCP 30ms 超时，仍记 WISH-042。正式四类导航、搜索与列表后新增行尚未回流，R05 整页及全产品目标均未完成。
- 2026-09-15：设置回流继续推进：正式权限页的自定义规则改为默认收起、展开后复用真实 `PermissionRulesEditor`，补正式入口 E2E 验证收起 / 展开 / 再收起；未改变权限引擎或持久化契约。设置其余页面仍需逐页替换旧展示壳，整体目标未完成。
- 2026-09-15：R10 纠偏：正式与 Playground 添加表单真正共享同一组件，修复测试成功后被 effect 清理的问题；补取消失败恢复、迟到响应隔离、字段失效重测、卸载禁止新测试、保存后独立刷新，以及草稿参数保真。最终 Unit 149 文件 / 870 项、根 tsc / build、资产与文档检查、Eval 23 + 1 项和既有 Electron 8 项通过（4 项外部模型用例跳过）；全量 UI 首次 130 通过 / 1 偶发退出超时，原断言带 trace 复跑 3 次通过，随后完整 trace 回归 131 项通过（var/verification/mcp-shared-form-full）。偶发退出仍归 WISH-042，不能称为已修复。未修改主进程实现，旧主进程类型诊断仍由 WISH-043 管理；审计全量 7 / 生产 4，未改依赖。配置写入锁覆盖、资源接管、保存幂等和新向导真实 Electron 恢复继续列在 R10 / WISH-045，整体目标未完成。
- 2026-09-15：R10 添加向导所需的生产 Streamable HTTP / Bearer 契约已接入共享类型、传输工厂、连接 IPC 与安全存储视图；真实本地 SDK 协议和 stdio 子进程验证通过。修复资源专用服务被 tools/list 误判连接失败的问题；无工具能力和已声明工具但发现失败分别验证。最终 Unit 147 文件 / 856 项、UI 120 项、既有 Electron 回归 8 项、根 tsc / build、Eval 23 + 1 项通过。主进程独立 tsc 仍失败，同一编译器前后对比无新增且消除 MCP 环境变量类型诊断；不将本批当作向导或全产品完成。审计仍为全量 7 / 生产 4，未改依赖。
- 2026-09-15（初版记录，后续纠偏见上）：R10 正式向导替换旧直接连接表单，主进程接入窗口 requestId、测试 / 保存和数量上限。最初 Renderer 替身未令取消使测试失效，漏检了成功后的提前取消，不能作为有效闭环验收；配置锁也未覆盖全部写入路径。新向导真实 Electron、OAuth 和异常恢复仍未完成。
- 2026-09-15：R10 MCP 服务列表接入与 Playground 同源的卡片，重试、启停、删除与工具许可沿用既有 IPC；保存失败不提前断开、许可快照不被后续启停覆盖。最终默认 Unit 146 文件 / 844 项、串行 UI 112 项、Electron 现有回归 8 项、根 tsc / build、Eval 23 + 1 项通过；MCP 的 Renderer IPC 替身不是外部服务验收证据。添加向导 / Streamable HTTP / 认证和主进程统一变更仍未完成。
- 2026-09-15：验收中定位并修复 trace HTML 进入 Vite watcher 导致重载，以及 Foundation 符号测试意外解析外部类型图的成本问题；分别保留真实 watcher 正反例与完整符号 / 遮蔽断言，不关闭源码 HMR、不增加超时。此前无对应 HMR 的偶发退出仍归 WISH-042；依赖审计仍为全量 7 项 / 生产 4 项，未改依赖。
- 2026-09-15：文化角真实 Electron 验收暴露旧资产更新统一截为 24 字的问题；文化 / 书架正文改为有界完整保存并拒绝超限，书架 Prompt 摘要单独限长。最终 Unit 串行 839 项、UI 104 项、Electron 本地回归 8 项通过；根类型检查、build、Eval 23 + 1 项通过。主进程独立类型检查仍有 71 条既有诊断，本批无新增；并发 Unit 稳定性与依赖审计未清零，继续由 WISH-042/043/044 管理。
- 2026-09-15：R12 文化角继续回流，正式页与 Playground 共用四类文化卡片和关联读书笔记，移除旧嵌套列表与英文类型展示；已有书架内容和笔记保留。本批不改人物内容与数据库结构，文化 starter 的来源复核、编辑流程及全产品验收仍未完成。
- 2026-09-15：R12 家居 / 足迹的正式页与 Playground 已共用展示组件，住所与常去地点接入真实角色资产及同库初始化标记；并发、删除后重载、事务失败与刷新重试已有专项测试。六生活面整体、编辑入口及用户备份恢复仍未完成，保持原总目标进行中。
- 2026-09-15：Electron 回流回归已收口为 7 项通过、4 项按外部模型凭据跳过；测试从正式入口恢复 Chat / Debug 状态，首启模型路由、伙伴设置、Debug、workspace、终端和侧聊均通过真实 Electron。

- 2026-09-15：模型设置用途选择改为替换该用途的旧兼容路由，避免 legacy-primary 优先级遮蔽用户新选择；连接密钥在提交后立即从 Renderer 状态脱敏，后续路由保存由主进程安全合并。真实 Electron 首启路由回归已通过。

- 2026-09-14：MCP 工具许可链路已接入配置校验、持久化、Registry 过滤、执行前校验和正式设置工具清单；认证、连接失败恢复及真实 MCP 服务 Electron 证据仍需继续补齐。
- 2026-09-14：正式数据与隐私页完成动作卡回流，导入/导出在忙碌期间互斥并保持真实 IPC；数据恢复的无效备份与取消路径仍由 Electron 数据测试持续覆盖。
- 2026-09-14：正式模型页补齐 Playground 的折叠高级设置，暴露真实预算与生成参数字段；模型多连接、用途路由、密钥安全存储、主对话真实消费与主进程模型发现 / 认证失败恢复已完成；Playground 获取仍是隔离 fixture，编程套餐真实调用仍见 WISH-027。
- 2026-09-14：正式设置继续收敛到 Playground 已确认的体验，移除语言占位与关于页重复运行信息；人物世界家居补充真实空间物件读取，足迹补充地点、摘要和日期。家居/足迹仍是派生只读视图，独立事实源未宣称完成。
- 2026-09-14 全产品回流目标启动时：正式设置已切九区共享导航，并接入共享伙伴设置；相处说明使用独立字段、增量自动保存和失败重试。彼时七个旧主题现已被四主题同源替代，人物世界 / 记忆 / 模型 / Skills / MCP 等继续逐项验收。不得以导航或右坞局部完成代替全产品回流，恢复入口：[全产品回流合同](./requirements/product-experience-production-rollout-v1.md)。
- 2026-09-15：正式外观页已回流 Playground 确认的四主题卡片样式，主题资产、全局 DOM、Markdown / Diff 读取同一注册表；旧主题持久化值仍通过归一化映射兼容。设置其它内容页仍需逐页完成 demo 样式回流。
- 2026-09-15：正式权限与自动化、数据与隐私、关于页面已改用 Playground 同源的 SettingCard / SettingRow 结构；真实权限编辑器、导入导出 IPC 和本机信息保留。模型与 MCP 内容页仍需继续回流。
- 正式模型与 MCP 页面已完成第一阶段样式回流：连接、密钥、测试、添加、启停和删除均改用同源卡片与固定操作槽；真实 Provider / 安全存储 / MCP IPC 保留。模型多连接与用途路由仍需在真实存储契约明确后回流。
- 2026-09-14：范围进一步收敛：正式设置不再为旧 UI 保留兼容展示；后续逐页以 Playground demo 为唯一体验基线，真实后端、用户数据和安全边界保留，重复入口与已被 demo 取代的旧展示可删除。当前仍需完成模型 / MCP 内容页和正式入口逐页验收。
- 2026-09-15：设置体验继续清理孤立展示：Playground 与正式开关滑块统一使用主题文本 token，正式关于页移除 demo 未采用的旧宣传卡；开发者模式等真实配置能力保留。
- 2026-09-15：基础控件主题审计继续收口：危险/生成动作、Surface 开关和权限确认按钮移除固定白色文字或滑块，统一从主题语义 token 取色；真实网页样张内容不受影响。
- 2026-09-15：正式 Skills 管理器继续对齐 Playground 列表到详情的视觉基线；真实校验、保存、版本历史、回滚和隔离试跑链路保留，旧 cyan / 固定圆角展示已移除。
- 2026-09-15：模型真实路由后端开始落地：新增加密连接配置与按用途路由协议，主/辅助配置工厂按顺序选择第一个有效连接，旧单连接字段为空时保持兼容；Renderer 脱敏连接密钥，备份保留连接结构但不导出密钥。正式模型多连接编辑 UI 尚待接入。
- 正式 MemoryPanel 已回流 Playground 已确认的长记忆编辑、敏感信息首行提示、日期右侧固定槽和图标操作；真实记忆 IPC / CRUD 保留。正式真实数据列表的几何、失败恢复和敏感确认仍需补 Electron 级回归证据。
- 正式人物世界已从旧的朋友圈 / 物什 / 名册入口扩为六个生活面：朋友圈、衣柜、文化角、家居、通讯录、足迹。衣柜和通讯录沿用真实 companion 数据；后三个新增生活面暂以真实书架、在场状态和动态地点派生只读展示，独立事实源和编辑能力仍登记为后续缺口。
- 2026-09-14：Agent 命令控制台增加当前实例命令历史回看；上下键只影响空闲输入，历史不进入会话、长期记忆或 Agent 上下文。 同批补充工作目录与退出状态表达。
- 2026-09-14：基于 Alice 源码审计确认，正式终端定位为 Agent 命令控制台；完整 PTY 暂缓，不再作为当前工作区回流阻塞项。后续优先打磨 Agent 命令的可见性、权限解释、失败恢复和任务关联。
- 2026-09-14：复核 Unix 终端进程组实机证据；当前 Windows 主机没有可用 WSL、bash 或 sh，不能把 Windows Electron 回归外推为 Unix 完成。代码路径仍保留类 Unix `detached` 进程组终止实现，待 Unix 环境补证。
- 共享 DiffViewer 批次：基础故事、候选和正式审阅已接入同一内容与模式控件；空稿误禁用和缺稿空白已复现并修复。审阅专项、基础深浅宽窄和真实符号复用专项通过，当前批次完整门禁待收口。
- 工作区当前状态：五工具已进入正式 ChatRightDock；文件、审阅、命令控制台、受限只读网页和独立侧聊均有真实 IPC。侧聊真实 Electron 验证发现并修复跳过记忆后对 undefined 调用 trim、异常处理 span 越域，以及关闭时删除早于 Runtime 收尾的问题；本地 SSE + 独立数据目录已验证正式文件读取、流中关闭、连接终止、删除与重新发送。
- 工作区 Foundation 复用继续收口：图标按钮已从正式右坞、审阅工具栏和 Playground 工作区候选抽出为固定尺寸 `IconButton`；业务语义与回调保持在 Experience 层。
- 工作区添加菜单已抽为 Foundation `WorkspaceToolMenu`，正式实例和 Playground 隔离实例共用交互行为；全量控件复用仍未完成。
- 正式工作区的文字恢复/打开动作已抽为 Foundation `ActionButton`，浏览器、审阅、侧聊和文件预览共用固定高度与语义色；真实回调和 IPC 未改变。
- 工作区输入控件已抽为 Foundation `TextField`，地址栏、命令控制台、侧边聊天和输入故事共用同一视觉与稳定几何实现；业务提交、IPC 和会话状态仍由正式页面保留。全量控件复用仍未完成。
- 正式浏览器刷新、终端运行/终止和侧边聊天发送/停止操作槽已统一接入 Foundation `IconButton`；图标按钮的固定尺寸和无障碍命名由基础层提供，真实回调仍由各面板保留。全量控件复用仍未完成。
- 正式文件浏览器的刷新、搜索、复制、系统打开和关闭预览也已复用 Foundation `TextField` / `IconButton`；文件树节点和 HTML 预览/源码切换仍保留业务层语义。全量控件复用仍未完成。
- 文件浏览器的 HTML “预览 / 源码”模式选择已抽为 Foundation `SegmentedControl`，Foundation 故事和正式预览共用同一选中态与固定操作槽。全量控件复用仍未完成。
- 新增正式工作区后端调用链门禁，静态验证五功能分别绑定真实 project/session/terminal/browser/chat IPC，且生产面板不依赖 Playground fixture；该门禁不替代 Electron 生命周期证据。
- 终端 Windows 真实生命周期已验证：权限拒绝后重试、2 万字符完整输出、停止和关闭标签后父子进程退出。主进程终止以 close 为准，失败/超时可重试，未握手记录到期清理；大块输出不再误触累计上限。
- 侧聊恢复与归属已验证：创建会话失败可以真正重建并发送；父会话切换清空旧正文/草稿/确认并隔离迟到错误。Renderer 故障注入和真实 Electron 流中切换/旧记录删除/新侧聊发送均通过。
- Markdown 代码块复制槽现在也复用 Foundation `IconButton`，复制失败提示和原文复制逻辑保持在 Markdown 层；固定操作槽由基础层统一。
- 2026-09-13：修复 Agent Loop 权限与工具资产记录读取错误上下文的问题：会话 ID 统一从 `toolContext.sessionId` 取值；相关 Runtime 测试通过。主进程全量类型检查仍受既有 `tsconfig.node.json` 文件集与跨模块诊断阻塞，未用排除项掩盖。
- 2026-09-13：全量 UI E2E `90/90` 通过，正式 ChatRightDock 的五功能入口、主题与窄宽、文件多预览、审阅、终端多实例、受限浏览器、侧边聊天失败恢复/流式/停止、折叠和 Playground 隔离均有回归证据；侧边聊天不再处于“视觉待验收”。完整 PTY、浏览器脚本/登录交互和 Unix 终端实机证据仍按合同保持为独立缺口或明确排除。
- 共享 Markdown 与 DiffViewer 已改为基础层同源：代码高亮、Mermaid、统一/并排差异内容和模式控件均由真实 Foundation 实现提供；空稿可并排，缺稿自动回退统一视图。当前批次自审、807 项 Unit（串行）、根类型检查/build、90 项 UI、6 项真实 Electron、23 项 Framework Eval、1 项 Skill Eval 和资产检查通过；4 项外部模型测试按条件跳过。四主题和差异长文件截图已检查，无新增独立 lint 命令；既有构建警告与 WISH-043/044 仍保留。
- 正式工作区界面统一阶段已收口：Foundation 控件、五功能入口、长内容滚动、固定操作槽和真实 UI 回归均有门禁；新增工作区 Foundation 控件审计，防止重新引入局部皮肤。受限浏览器又补齐 requestId 归属和关闭时取消，下一步仍是 Unix 终端实机证据、完整 PTY 和浏览器交互能力的独立合同，目标未完成。
- 门禁发现：默认 `npx tsc --noEmit` 只检查 src，单独主进程检查存在既有跨项目配置和类型错误；不得再以默认 tsc 通过声称主进程全量类型通过。见 WISH-043。

### 既有施工记录

- 2026-09-13：正式工作区错误恢复与外部打开动作统一接入 Foundation `ActionButton`；补充基础故事、资产注册和目录门禁，不改变浏览器、审阅、文件或侧聊的真实数据路径。


- 2026-09-13：正式工作区地址栏、命令控制台、侧边聊天和 Foundation 输入故事统一接入 `TextField`；补充事件类型与目录测试，未改变提交、停止、流式或 IPC 行为。全量基础控件复用仍在进行。
- 2026-09-13：正式浏览器、终端和侧边聊天的图标操作槽统一接入 `IconButton`；补充真实调用门禁与工作区 E2E，未改变 IPC、流式或进程生命周期行为。全量基础控件复用仍在进行。
- 2026-09-13：正式文件浏览器的通用操作槽和搜索输入统一接入 Foundation；补充文件多预览与内部预览回归，未改变项目读取 IPC 和预览状态契约。全量基础控件复用仍在进行。
- 2026-09-13：补充 `workspace-backend-contract.test.ts`，锁定正式五功能的真实 IPC / Runtime 入口和 Playground 隔离边界；完整 PTY、浏览器脚本交互与 Unix 实机证据仍按合同标记为缺口或明确排除。
- 2026-09-13：文件预览的 HTML 模式选择回流 Foundation `SegmentedControl`，补充故事、注册表和真实文件预览调用门禁；不改变文件读取或沙箱契约。

- 2026-09-13：补齐聊天 IPC 的窗口归属边界：活动会话绑定发起 Renderer，其他窗口不能发送同会话消息或中断；缺省会话 ID 不再触发全局中断；重复发送不会提前释放首个请求的归属。

- 2026-09-13：侧边聊天补齐失败恢复：错误态重试会复用失败消息重新调用真实 `chat:send`，避免只清空错误提示而不执行重试；新增 Renderer E2E 覆盖第一次错误后重试次数为 2；仍需补完整 Runtime 竞态和 Electron 边界回归。

- 2026-09-13：正式工作区生命周期继续回流。终端后台实例、设置／Playground 导航保持，项目切换重建与取消清理，启动迟到／失败／取消和终止失败重试已补 Renderer 实现与回归；主进程终止按发起窗口校验 run 归属，Windows 使用 taskkill `/t` 回收进程树，退出事件前不提前删除运行记录。完整 PTY、浏览器交互和侧聊完整失败恢复仍是后续缺口，目标保持进行中。
- 2026-09-13：正式审阅补齐真实 `before/after` 契约，支持 unified／并排视图、列表与 diff 错误重试及过期请求隔离；新文件没有旧稿时不伪造并排数据。浏览器／侧聊后端与完整 PTY 仍未完成；终端早到输出和进程树清理已补握手与主进程实现。
- 2026-09-13：浏览器工作区完成第一版受限只读真实链路：主进程 URL/DNS 校验、拒绝重定向、超时与响应上限，Renderer 使用无脚本 sandbox/CSP，并补成功、失败、重试和地址恢复回归。完整浏览器交互、登录和站内导航不在本批范围。
- 2026-09-13：侧边聊天完成第一版真实链路：独立 `workspace` 会话不进入主会话列表，消息走现有 Runtime 流式事件，支持停止、事件隔离和卸载清理；上下文关联、工具确认隔离和完整失败恢复仍需后续契约。
- 2026-09-13：补齐侧边聊天工具确认的会话归属，主 Chat 与 workspace 确认队列分离；上下文关联和完整失败恢复仍待补齐。
- 2026-09-13：补齐 workspace Runtime 的记忆副作用边界：不读取长期画像、不做向量召回、不排队画像提取、标题、向量索引或反思；上下文关联和完整失败恢复仍待补齐。
- 2026-09-13：侧边聊天接入父会话最近 6 条用户/伙伴消息、当前项目路径和当前文件／审阅焦点的受控上下文，作为本轮 Prompt 参考，不写回 workspace 历史或长期记忆；完整失败恢复仍待补齐。
- 2026-09-13：修复 workspace 会话写入归一化遗漏，存储层现在保留 `session_kind=workspace`，并补充创建后读取回归；侧边聊天上下文关联、工具确认隔离和完整失败恢复仍待补齐。

- 2026-09-13：工作区回流补齐原文渲染边界。共享 CodeBlock 同时用于基础故事、候选审阅、正式文件代码预览及正式审阅，避免将文件重新拼成 Markdown 导致围栏／aside 改写；新增实际绑定的源码检查和原文、复制、滚动回归。五功能菜单顺序与候选对齐并去除转义残留。浏览器／侧聊仍只有未接入壳，目标未完成。

- 2026-09-13：正式文件工作区完成一批回流：顶层只保留“文件”工具，内部左树右多预览；真实 project IPC 读取按路径隔离，支持乱序、关闭重开、失败重试和项目实例隔离。浏览器、侧边聊天和终端多实例契约仍未完成。

- 2026-09-13：工作区 P1 共享标签批次：TabStrip 同时接入基础故事、候选工作区和正式右坞；已加源码复用负例、固定关闭槽和键盘／后台关闭回归。五功能界面与后端尚未完成，继续处理文件左右多预览和实例生命周期。

- 2026-09-13：正式工作区 P1 回流进行中。当前落地 PanelRight 入口与同页折叠保留（文件预览、当前终端草稿），既有分隔线保留；尚未完成五功能界面统一。下一步从共享 Foundation 标签接入正式右坞，再补文件内部多预览、实例生命周期及真实浏览器／侧聊后端，缺口见工作区施工合同和 WISH-041。
- 2026-09-13：Chat 处理中样张补充对话与工作区分隔线，复用 icon registry 中的 PanelRight 图标提供右上角收起 / 打开；收起保留工作区标签和任务状态，宽窄窗口均验证不溢出。仅 Playground。

- 2026-09-13：Skills 详情样张的完整文件改为最高 48vh 的独立滚动区，支持键盘阅读并阻止边界滚动传递，不再随正文长度撑长设置页面。正式只读正文已有高度限制，本轮未改正式页。

- 2026-09-13：权限样张每条规则复用现有 SettingCard 独立包裹，自定义规则外层只作折叠分组；“添加”移到完整列表下方，展开与取消保持原位。仅 Playground，不涉及正式权限逻辑；全量基础复用施工合同仍待确认。

- 2026-09-13：基础复用链路审计确认 Markdown 变体遗漏、Diff 两套实现、局部主题与根主题读取不一致，以及注册表缺少真实调用校验。三个主要体验文件有 123 处直接交互 JSX 声明，需分类迁移；已写 `foundation-reuse-enforcement-v1.md`，待确认跨组件施工边界，尚未修改产品代码或宣称修复。

- 2026-09-13：设置候选与基础主题对照统一读取瓷青、曜石、松烟、绛紫四个候选；局部切换实际配色，不再展示七个旧生产选项。正式主题、全局 DOM 和用户设置不变。

- 2026-09-13：修复 Playground 自定义规则点击“添加”后已有列表上跳：固定入口尺寸，原位切换“取消添加”，表单仅向下展开；补齐深浅主题与宽窄屏的位置稳定性回归。

- 2026-09-13：记忆 Playground 候选将日期与正文保持同一行，并在右侧固定槽中与编辑 / 删除图标原位替换；新增“长记忆”样张，验证长文本换行、hover 和窄屏布局。仅 Playground，未回流正式记忆页。

- 2026-09-13：修复长记忆编辑态被压成单行输入框：长文本改用多行编辑区，短记忆保持紧凑输入，保存 / 取消继续固定在右侧操作槽。仅 Playground。

- 2026-09-13：敏感记忆候选使用卡片第一行提示“敏感信息：涉及健康隐私，请谨慎保留。”，移除重复标签和操作说明，编辑时保留提示占位。仅 Playground。

- 2026-09-12：更正记忆 Playground 候选的日期位置：正文左侧、日期同一行右对齐，底部不再重复显示日期。

- 2026-09-12：正式记忆条目的日期改为与正文同一行右对齐，避免日期单独落到下一行。

- 2026-09-12：工作区候选移除浏览器内容区重复图标，并让 Playground Diff 代码块跟随主题底色。

- 2026-09-13：权限与自动化候选将已有规则统一为“自定义规则”并默认收起；展开后看列表和“添加”，点击后才显示表单；保存追加规则并收起表单，取消不写入、空白禁存。仅 Playground，未回流正式设置。

- 2026-09-12：记忆紧凑卡默认显示日期，悬停或键盘聚焦时切换为编辑/删除图标；仅调整 Playground 候选交互，不回流正式页面。

- 2026-09-12：记忆清单取消嵌套预览画布；正文、日期、编辑和新增行为不变，仅调整 Playground 外层布局。

- 2026-09-12：模型连接编辑改为当前卡片内展开，不再跳到下方表单。

- 2026-09-12：记忆分类「协作习惯」改名为「工作方式」。

- 2026-09-12：记忆删除改为卡片内确认，不再使用全局弹层。

- 2026-09-12：记忆条目卡改为正文优先，来源收成下一行淡色说明，日期和操作仍在同一行。

- 2026-09-12：模型连接清单补了编辑入口，复用添加表单改已有连接。

- 2026-09-12：Chat「处理中」对齐五功能工作区，任务进度卡和旧预览坞已从 Playground 候选移除。

- 2026-09-12：人物世界头图删除「看记忆」和「近期生活」，进入记忆改走左侧设置。

- 2026-09-12：设置侧栏删除 Debug / Playground 导航说明，只保留关于入口。

- 2026-09-12：新增记忆输入焦点改为主题描边，去掉默认黑圈。

- 2026-09-12：新增记忆的保存/取消改为图标，与编辑态一致。

- 2026-09-12：工作区文件预览关闭收入同一标签，与工作区标签关闭方式一致。

- 2026-09-12：记忆编辑态日期位置保持不变，保存/取消改到原图标槽。

- 2026-09-12：工作区文件预览关闭改到对应标签，与工作区标签关闭方式一致。

- 2026-09-12：设置页删除独立「回到 Chat」按钮，回到对话改走 Playground 左侧导航。

- 2026-09-12：记忆纠正态输入框与展示正文对齐为 13px，避免编辑时字号跳变。

- 2026-09-12：修完 MCP 工具清单和权限规则卡的层级问题，并把“新规范必须回头修旧页”写进前端规则与质量门。

- 2026-09-12：记忆清单改为独立条目卡并对齐设置卡片语言；扫描后仍待处理：MCP 工具清单还在用内部分割行，权限规则卡内容偏多。

- 2026-09-12：记忆分类 Tab 下方解释小字已移除，分类本身足够说明；仍只改 Playground。

- 2026-09-12：记忆搜索展开后对齐对话搜索框，左侧放大镜、右侧清除；仍只改 Playground。

- Playground 状态切换统一候选已按 MCP 独立选项收口，覆盖 Chat、记忆、设置场景、工作区和公共故事选择；等待用户视觉审阅。

- 工作区按用户截图收平标签和添加菜单，关闭图标移入各标签，删除重复收起入口；浏览器地址栏居中且可编辑，等待 P0 视觉审阅。

- 2026-09-11：补齐 MCP 添加表单与校验/保存样张；工作区五功能方向已获认可，本轮新增窄栏 Chat 壳、开关入口、添加选择菜单和左右文件预览，等待审阅补充交互。

- 工作区五功能 P0 已实现，等待用户审阅：审阅、浏览器、文件、终端、侧边聊天，共 21 种形态；已撤掉旧任务阶段样张。正式接入边界见 WISH-041。

- Skills 详情审阅调整：恢复详情卡片；“返回 Skills”图标与文字独占上一行，名称与开关共同下移一行。

- 2026-09-10：MCP 候选改为 12 个场景 Tab，直接审阅多服务和工具数量，替换旧串行向导；后端缺口记入 WISH-040，等待用户审阅 P0。

- 2026-09-10：Skills 候选改用两个真实内置 SKILL.md，清除虚构描述、文件与死开关；触发条件置于描述上方，详情使用单张外层卡片。等待用户审阅，未回流正式设置。

| | |
|---|---|
| **当前阶段** | 公开 alpha；基础运行时、伙伴世界、记忆、权限、Debug / Playground、生产资产与安全边界主线已落地。 |
| **当前施工** | 产品体验 E0 / E1 正在 Playground 验收；模型配置解耦候选已完成，等待用户确认是否回流正式 Settings、Chat 与 Runtime。 |
| **产品主线** | 继续打磨伙伴体验、人物故事与 Pack 内容；真实 Persona Eval 结果仍需人工语气与审美验收。 |
| **明确暂缓** | 原生语音输入、Playground Prompt Lab 加厚、生图 Moments。 |
| **明确不做** | 当前威胁模型下不做 OS 级 Shell 强隔离和 Python 嵌入沙箱，见 DEC-037。 |
| **历史** | 完整施工流水和旧测试数字已冻结到归档，不再由本文件重复维护。 |

## 2026-09-07 · 连接卡片操作与模型候选

## 2026-09-09 · 扩展与工作坞用户故事候选

- 扩展与工具候选已拆为 Skills / 外部能力（MCP）两个内部 Tab；Skills 默认只展示名称、用途、来源、范围和启用状态，详情承载版本、校验、工具白名单与隔离试跑。
- MCP 候选补齐常用 / 自定义来源、连接方式、测试获取工具、工具选择和保存结果；全部状态仍为 Renderer fixture。
- 当时的工作区候选以文件任务按需出现；该候选已被五功能施工合同替代，当前入口不再与任务阶段绑定，确认与恢复动作仍留在 Chat。
- 正式 Settings、Chat、MCP / Skill IPC、任务队列与文件系统均未改变。
- 扩展页继续收平为直接命名的 Skills / MCP 两个 Tab；Skill 条目去掉“当前状态”，把更多信息降到辅助详情层，避免卡片套卡片。
- Skills Playground 使用独立卡片：名称查看详情，纯开关控制隔离启用状态；保留“单个 / 多个 / 详情”审阅状态，触发条件优先使用源 when_to_use，描述保留原文。

## 2026-09-08 · 记忆管理用户故事候选

- 按用户确认的第一性原理，将设置里的“记忆”从跳转空壳改为长期信息管理入口：第一屏提供分类、搜索和添加记忆。
- 复用已有四类记忆边界：身份信息、工作方式、沟通偏好、我们之间；添加记忆支持分类、搜索、编辑和删除，来源仍只在 Debug 样张开启后显示。
- 新增内容和操作只存在 Playground Renderer fixture；正式 MemoryPanel、memory IPC、存储、Prompt 和自动提取链路未改。
- 本轮继续收口记忆列表：移除条目顶部空白操作区，将编辑 / 删除与日期对齐；敏感 fixture 改为命中共享健康检测规则，并补充警示回归断言。

- 按用户浏览器注释，将获取已有模型 / 测试连接移到每个连接卡片右上角，手动添加改为加号；连接详情不再折叠。
- 参考 CC-Switch 的模型获取流程，但按用户确认收敛为候选项直接加入，不再引入下拉控件。已添加项禁用并显示勾选，未启用模型显示空心圆；手填 ID 和 Enter 提交保留，草稿 / 候选按连接隔离，重置样张清理未完成的获取。
- 仅 Playground、隔离 E2E 和文档；正式 Settings、共享预设、IPC、存储、Runtime 均未改变，真实模型发现仍属施工合同 P1。
- 验证：自审、780 项 Unit、类型检查、build、assets:check 和完整 UI E2E 25 项通过；深浅主题各完成 1165px / 520px 截图检查。首次专项有一条超时且快照回到 Chat，未改代码复跑及完整回归均通过，原因未确认；未用重试配置掩盖失败。仓库没有独立 lint 命令，构建仍有大包与混合导入警告。

## 2026-09-06 · 编程套餐连接候选

- 复核 Alice 本地 Provider 清单，复用已有六个套餐预设；添加连接按官方 / 编程套餐 / 聚合与中转 / 本地 / 自定义分开，名称左置并随预设更新地址。
- 去掉候选详情按 Provider ID 猜协议的展示分支，避免 MiniMax Token Plan 被误标为 OpenAI；预设展示服务入口，自定义才展示显式适配器。普通 Ark 仅在候选归聚合，生产注册表不改。
- 保存连接保持空模型清单，不改变上方用途；取消重开和跨渠道切换清除临时 Key。获取模型在测试左侧，手动添加按钮在输入右侧。
- 本轮仅 Playground 与隔离 E2E / 文档；正式 Settings、Chat、IPC、存储、Runtime 不改。真实套餐接入和官方使用限制验证进入 `WISH-027`，仍待人工候选验收与回流许可。
- 自审、Unit 136 文件 / 780 项、类型检查、build、assets:check 和完整 UI E2E 21 项通过；深浅主题各完成 1165px / 520px 截图检查。仓库没有独立 lint 命令；build 仍有大包和混合动态 / 静态导入警告。

## 2026-09-05 · Debug 运行概览第一阶段

- 正式 Debug 新增只读“运行概览”入口，默认先进入概览，并读取当前模型 / 凭据状态、伙伴快照、Trace 数量与错误数、当前窗口事件数，再跳转到 Prompt / 资产、请求与运行、伙伴状态、系统与工具真实证据面。
- 复用现有 Debug 分区和 IPC，不新增诊断动作、不改变 Settings、Prompt、权限、存储或 Runtime。
- 完整 Unit、类型检查、build 和 Debug 导航专项 E2E 已通过；完整 UI E2E 中另有 Playground 候选用例失败，未归因于本轮 Debug 改动。
- 受控诊断动作、跨请求统一运行关联和更完整的概览指标仍属于后续施工范围。

## 2026-09-05 · DSH / CC-Switch 模型与工作区研究

- 拉取官方 `deepseek-ai/deepseek-harness` 与 `farion1231/cc-switch` 到 `_reference/framework-harness/repos/`，结合 Alice 参考源码复核模型设置前端结构。
- 新增《模型与工作区用户故事重构 v2》施工合同：连接配置、模型清单、使用安排、任务运行快照四层分离；模型设置与工作区按职责分界。
- 下一步只在 Playground 验证空态、单 / 双连接、添加流程、模型用途和工作区状态矩阵；正式 Settings、IPC、存储与 Runtime 不变。

## 2026-09-06 · Playground 模型配置解耦候选收口

- 模型页已拆成上方“模型使用安排”和下方“连接与模型清单”：主对话、辅助任务、生图分别支持多模型与 fallback 优先级，连接只维护端点、适配器和模型列表。
- 添加连接不再要求“首个模型 ID”；自定义连接使用 OpenAI Compatible、Anthropic、Gemini 适配器，聚合 / 中转 / 统一网关统一作为用户命名的连接入口。
- Playground 已补齐按连接获取已有模型、逐项加入清单、手动添加、失败反馈，以及空态 / 单连接 / 多连接状态样张；获取交互仍是 Renderer 隔离 fixture，不调用真实 IPC 或保存真实设置。
- 同轮更新了相处补充说明的位置和模型候选 E2E 断言；正式 Settings、Chat、Runtime、IPC、存储与真实模型连接未改变，等待用户明确回流许可。

- Provider 入口分类调整为“聚合 / 中转 / 统一网关”优先：阿里云百炼、硅基流动归入聚合 / 中转预设，不再出现在官方服务商列表。
- 高级设置中的会话 / 每日预算已明确单位为 Token，按输入与输出 Token 合计统计，0 表示不限制。
- 添加连接进一步按入口类型提供常见预设：官方服务商、聚合 / 中转、本地服务都先选择已有入口，连接名称随预设生成清晰默认值且仍可手动修改；只有自定义连接显示协议适配器。
- 添加连接表单进一步区分入口来源与协议：官方服务商选择官方预设并使用官网地址，只有自定义连接需要选择 OpenAI Compatible、Anthropic 或 Gemini 适配器。
- 模型连接详情操作行已按使用顺序收口为“获取已有模型 → 测试连接 → 手动添加模型”，模型 ID 输入保持在同一行并支持窄宽换行。
## 2026-09-05 · Playground 设置模型与相处方式重构候选

- 将回答方式归入伙伴与相处，记忆单独作为长期信息管理入口，避免设置语义交叉。
- 模型候选改为连接入口列表 → 连接详情 → 连接中的模型，提供空态、单连接、多连接、来源选择和模型用途样张；主视图不再铺开模型能力诊断。
- Provider 仍只提供入口与端点，模型 ID 继续由用户账户实际提供；所有新增交互仅存在于 Renderer fixture。
- 正式 Settings、IPC、存储、真实凭据和模型连接未改变，等待 Playground 人工验收。

## 2026-09-04 · Playground 设置文案与交互澄清

- 记忆与相处把“解释粒度”改为“回答方式”，补充“自动 / 讲清楚一些 / 重点优先 / 直接一点”的使用例子，降低理解成本。
- 扩展与工具、关于页移除内部实现说明和沿用 Alice 的品牌标语，改用用户可理解的产品文案与待定占位。
- 权限页新增规则样张编辑：操作类型、处理方式、匹配内容均可在 Renderer 隔离状态中修改并即时反馈。
- 继续保持 Playground P0 边界：正式 Settings、权限引擎、生产配置和真实外部连接未改。

## 2026-09-03 · Playground 设置候选补充

- 复核 Alice 方法论 / 本地构建产物与 Codex 类配置的分层思路；确认设置一级 IA 不再扩张，缺口落在页面内部能力和作用范围表达。
- 设置候选新增模型“运行预算”（会话 / 每日）以及 Skills 管理样张（启用、版本、校验、隔离试跑），并在关键区域标明本机 / 伙伴 / 全局作用范围。
- 正式 Settings、IPC、存储、真实凭据、MCP 连接和模型请求均未改变；继续等待 Playground 人工验收后再决定是否回流。
- 角色架已归入设置壳内的“伙伴与相处”详情区，保留左侧设置导航，不再以全屏内容替换整个设置样张。

## 2026-09-02 · Playground 设置体系候选

- 完成设置现状审计：核对现有 11 个 Tab、真实设置存储 / IPC / 安全边界，以及 Alice 的模型、权限、MCP 和记忆分层启发。
- 新增《设置体系信息架构与体验候选 v1》施工合同；建议将设置收敛为 7 个主入口，伙伴成长调校、Debug / Playground 和关于信息下沉到合适层级。
- Playground 已建立隔离设置候选：日常 / 高级分组、外观、伙伴与相处、模型、记忆、数据与隐私、权限与自动化、扩展与工具及关于；开关、折叠、状态和 MCP 步骤只更新 Renderer 样张。
- 正式 Settings、IPC、存储、真实凭据、MCP 连接和数据导入导出均未改变；等待用户验收候选后再决定是否回流。
- 补齐窄宽导航的可滚动边界、键盘切换和 `tabpanel` 关联；浏览器验收确认宽屏 / 窄宽布局不再被内容撑开。

## 2026-09-01 · Playground 记忆信息架构候选

- 记忆候选从“关于你 / 关于我们”收敛为“身份信息 / 协作习惯 / 沟通偏好 / 我们之间”四类一级导航，每条隔离记忆只归一个展示主类。
- 多条记忆改为紧凑单列列表；普通模式移除“之后会”并隐藏来源，隔离 Debug 开启后才在右上角提供“查看来源”开关。
- 样张已按“稳定背景 / 如何协作 / 如何沟通 / 我们共同确认过什么”重写并通过隔离断言，四类 Tab 不再共享兜底内容。
- 正式记忆的数据分类、provenance、IPC、Prompt 和 UI 仍不变；当前完成 Playground 验收后等待用户决定是否回流。

## 2026-09-01 · Playground 记忆布局收口

- 记忆候选已收口为“关于你 / 关于我们”两类归属主导航；多条记录以两列中性卡片呈现，保留来源与后续影响证据。
- Playground 隐藏重复的 MemoryPanel 技术标题和分类筛选，状态样张降为隔离验收工具；正式 MemoryPanel、数据模型、IPC 和持久化不变。
- 类型、Unit、关键 Renderer E2E 和 Vite / Electron build 已通过；下一步继续按产品体验合同推进其余页面。

## 2026-08-31 · Playground 记忆系统与人物世界边界候选

- 重新建立记忆边界：用户长期信息与关系约定进入记忆；伙伴生活由人物世界呈现；当前进行中的动作与系统运行轨迹进入 Chat / 工作区 / Debug。
- Playground 记忆样张扩展为“关于你 / 关于我们”两种归属，每种展示 6 条隔离夹具，用于验收多条记录下的密度与层级。
- 生产 `MemoryCategory` 与 IPC 契约暂不迁移，先通过 Playground 验证用户心智和模块边界。

## 2026-08-31 · Playground 记忆与设置关系旅程候选

- 建立记忆与设置关系旅程施工合同：从人物世界 / Chat 进入记忆，理解“来自什么、之后会怎样相处”，必要时纠正，再进入记忆管理并回到 Chat。
- `MemoryPanel` 只在显式 Playground 夹具中展示关系证据，并支持 Renderer 内存级的编辑 / 删除；不读取、写入真实记忆或调用 IPC。
- Settings 候选新增“记忆管理”场景，直接定位记忆分区并可回到隔离记忆页；正式设置默认分区和行为保持不变。

## 2026-08-30 · 产品体验总图与用户旅程施工合同

- 建立产品体验总合同，明确“建立关系 → 自然聊天 → 记住重要的事 → 生活连续性 → 回来继续聊天 / 一起做事”的核心价值闭环。
- 固化正式产品的少量长期目的地：Chat、人物世界、设置；工作区按任务上下文出现，记忆归入设置，业务状态不作为正式一级目的地。
- 规划首次进入、日常陪伴、人物世界、记忆 / 设置、任务工作、角色切换六条主旅程；下一步只进入 Chat 主旅程施工，不同时扩改其他页面。

## 2026-08-31 · Playground 人物世界图标语义收敛

- 衣柜候选使用 `Shirt` 图标，朋友圈和通讯录候选分别使用 `Newspaper` 与 `Users`，让六个生活面入口的图标和语义一致。
- 本轮仍只改 Playground 候选，正式人物世界默认入口不变。

## 2026-08-30 · Playground 人物世界六维入口施工

- 冻结人物世界候选 IA 为“朋友圈 / 衣柜 / 文化角 / 家居 / 通讯录 / 足迹”，其中足迹置于最后。
- 文化角承载书、笔记、音乐、电影与摄影；家居承载空间与生活物件；足迹承载旅行、地点和移动连续性。
- 本轮只在 Playground 建立隔离样张，正式人物世界默认入口不变。

## 2026-08-30 · Playground 人物世界入口命名收敛

- 人物世界 Playground 将“名册”候选标签改为“通讯录”，保留内部 `cast` 语义 key 与正式页面默认文案；后续再根据候选验收决定是否回流正式 UI。

## 2026-08-30 · Chat 主旅程确认与结果语义收敛

- Playground 需确认态改为舞台级应用内全局确认层，和生产 App 根层确认队列、Alice 独立 permission request 的职责对齐，不再把权限卡伪装成 Chat 消息。
- 已完成态收敛为普通伙伴最终回复；未完成态保留为失败恢复面板，明确“失败原因 + 没有修改什么 + 重试 / 回到对话”的产品目的。
- 本轮仍只改 Playground 候选，不改变生产确认队列、权限引擎或 Chat 行为。

## 2026-08-30 · Chat 主旅程六态施工开始

- Chat Playground 从三态扩展为六态：初次进入、正在聊天、处理中、需确认、已完成、未完成。
- 本轮只做 UI 生命周期候选：需确认复用权限确认卡，完成 / 失败提供明确的下一步；只有处理中打开隔离工作区。
- Prompt / Runtime 只登记未来结构化状态接入边界，本轮不改生产提示词、任务识别、工具调用或权限策略。

## 2026-08-29 · 产品体验 E0 / E1 开始：Chat 主旅程候选

- 新增《产品体验骨架与主旅程 v1》施工合同，产品体验从局部页面调整切换为按主任务和用户旅程验收。
- Playground Chat 候选增加“初次进入 / 正在聊天 / 处理任务”三种共享骨架状态；处理任务状态按需显示隔离 Right Dock。
- 首次进入保持轻量，不展示换主角入口；角色架继续由设置承载。

## 2026-08-30 · Playground 朋友圈图片内容位

- 朋友圈动态卡增加可选图片内容位，首条隔离样张展示窗边茶杯与笔记的本地图片；单图使用受约束的 3:2 比例，多图预留最多九宫格布局。
- 移除动态卡右上角重复的“生活动态”标签，保留主角名、相对时间、地点、正文、评论和赞 / 评论操作。
- 朋友圈带图动态的地点信息移到图片下方左侧，时间行只保留相对时间，信息顺序更接近微信朋友圈。
- 本轮仍只增强 Playground fixture 与共享渲染能力，不新增生产生图、上传、存储或互动 IPC。

## 2026-08-29 · Playground 朋友圈 Alice 结构候选

- 参考本地 Alice 方法论第十八章与已保存源码，提取“人物身份头图 → 单一生活导航 → 近期动态流”的结构，不复制 Alice 的图片资产或产品文案。
- Playground 人物世界样张新增 CSS 头图 / 当前主角信息、相对时间和更接近社交流的动态卡；正式人物世界保持原有入口和数据边界不变。
- 新增第三条隔离动态夹具并补充 Alice 候选样式标识，便于验收信息密度、卡片节奏和浅 / 深主题表现。

## 2026-08-29 · Chat 空态移除换主角入口

- 首页空态只保留问候和当前主线建议，不再出现「换个主角」操作。
- 换主角统一从设置中的角色架进入，避免在首次进入 Chat 时打断主任务。

## 2026-08-29 · Chat 侧栏搜索与切换动效收口

- 会话搜索改为在 Primary Sidebar 顶部入口行内展开，输入、关闭和收起侧栏保持同一行，不再额外占用下一行。
- 侧栏收起 / 展开改为常驻轨道的宽度、透明度和位移动效；ResizeHandle 与侧栏同步进退，避免卸载 / 挂载造成硬切。
- 新增 Renderer E2E，验证搜索过滤、Escape 关闭、同一行布局，以及侧栏轨道收缩到 0 后可恢复。

## 2026-08-29 · 记忆与 Skills 入口收进设置

- Primary Sidebar 产品区只保留人物世界与设置，不再把记忆作为独立产品宫格入口。
- 底部开发 / 产品分组标题去除，仅保留 Debug、Playground、人物世界和设置四个实际入口。
- 移除 Memory / Skills 的 SecondaryNav 工具列，Settings 的「记忆」与「工具」分区成为统一入口；MemoryPanel、SkillsPanel 能力本身不删除。

## 2026-08-29 · Debug 入口全局化

- 移除 Chat 内 `conversationDebugMode` 与右侧半屏 `ConversationDebugAside`，避免把开发诊断叠进产品对话。
- Debug 统一由 Primary Sidebar / Settings / Chat 辅助入口进入全页 `DevPanel`；请求与运行域继续承载真实 LLM 调用、Trace 和事件。
- Debug 内部不再显示冗余的“Debug”身份行，刷新保留为返回按钮旁的轻量操作。

## 2026-08-28 · Playground 确认内容回流正式 UI

- 用户已明确授权回流；正式 UI 只接收可服务真实流程的视觉规则和交互，不复制 Playground 的来源路径、采用标记、目录、调试滑杆或隔离 fixture。
- Chat 右侧工作坞进入正式模式：默认预览，文件 / 预览 / 审阅 / 终端通过“+”按需添加；文件与预览共享选中文件，审阅 / 终端保持真实组件和真实 IPC 边界。
- Markdown 代码块改用 `--bg-tertiary`，正式人物世界默认使用朋友圈式动态流，正式记忆分类统一为四类语义色。
- 新增 `.agents/skills/playground-to-production`，固化“候选审计 → 选择性回流 → 真实数据边界 → 文档与门禁”的执行流程。

## 2026-08-29 · Playground 交互与产品体验页收口（候选）

- Chat 空态移除主角切换规则说明条，欢迎区回归轻量主视觉。

- 人物世界 Playground 收敛为朋友圈、物什、名册；角色架改放到设置样张，业务状态页移除伙伴状态条。
- 朋友圈样张补充微信式赞 / 评论操作行，并保持交互隔离在 Playground。


- 校准产品体验基础引用：Chat 不再显示未在样张中体现的 Markdown 渲染器；工作区登记其实际文件预览引用。

- 分隔线边界改为同卡内的正确 / 不当使用可视化对照，删除独立纯文字卡。

- 分栏拖拽的最小 / 最大边界说明已并入同一张拖拽预览卡，减少无意义的独立故事层。

- 修复主题比较假按钮：当前主题改为状态标签，其他主题才显示“设为比较”。
- 修复动效样张可见性：使用可观察的轨道内位移动画，并保留开关和真实 token 时长。
- 修复 Foundation 标签样张不可点击问题，补齐 tab 状态和内容切换。
- 产品体验页统一 Chat、人物世界、记忆、设置和工作区的体验舞台与基础引用信息层级，只改 Playground。

## 2026-08-29 · Playground 主题方向重新拉开（候选）

- 用户反馈宣纸与铜版过于接近；主题候选改为瓷青、曜石、松烟、绛紫四个差异更明显的方向。
- 新候选覆盖冷色浅色与莓果深色，避免继续堆叠暖白、铜棕和低饱和棕色。
- 同步更新主题比较 E2E；仍只影响 Playground 隔离样张。

## 2026-08-28 · Playground 高级感视觉收口（候选）

- 主画布增加低对比度主题氛围层，导航、页头、故事块和 token 卡统一材质、圆角与边界节奏；不新增 IA 层级。
- 故事块改为卡片底与细边界，移除可见“边缘”标签；边缘态仍通过 `data-edge` 和无障碍文本保留证据。
- 设计语言 token 卡增加克制的悬停层次；窄屏 Playground 导航选择器同步修正为 `aside`。
- 本轮只影响 Playground P0 候选，不改变正式 UI、生产主题或生产资产。

## 2026-08-28 · Foundation Design Language v2 开始施工

- 补充审美判断原则：层级、对齐、留白、克制、状态可感知和动效服从任务。
- 新增施工合同 `docs/requirements/foundation-design-language-v2.md`，记录 Radix / Ant Design / Primer / Carbon / Mantine / MUI / shadcn/ui 的研究结论与不引入整套依赖的边界。
- Playground 设计语言开始改为颜色角色、4 个主题候选微型界面、圆角角色和 easing 动效展示；Foundation 基础组件增加统一状态检查矩阵。
- 当前仍是 P0 候选施工，不改变正式主题、正式组件和生产页面。

## 2026-08-28 · Playground 视觉减噪与主题比较迭代

- Foundation 故事 Tab 改为轻量横向文字导航，减少灰色容器和胶囊按钮对内容预览的干扰。
- 主题候选增加 Playground 内的当前比较方向和选中反馈，方便在统一微型界面中做审美判断。
- 本轮不新增 IA 层级，不改变正式主题或正式组件。

## 最近完成

### 2026-08-27 · Alice 基础组件对照与 Foundation 补齐（候选）

- 对照 Alice 基础组件 Playground，按当前真实产品契约补入 IconButton、Card、Badge、Tag、Divider 五类通用 Foundation 故事；暂不复制 ToggleRow、NavItem、ThemePicker、划词工具条和 Kbd。
- Foundation 导航收敛为 13 个按任务拆分的入口，入口由 `foundation-story-registry.ts` 派生，仍保留每个底层 story 的真实预览。
- 新增组件资产注册、隔离 renderer fixture、Unit 和 Renderer E2E 覆盖；本轮仍停留在 Playground P0，未回流正式页面。
- 下一步从“补齐目录”切换到 Foundation 统一样式验收：颜色语义、尺寸密度、焦点 / 禁用 / 错误、窄宽和深浅主题。


### 2026-08-27 · Playground 来源与图标尺寸展示收口（候选）

- 页头基础引用与 `.tsx` 来源统一同一行，来源固定宽度、省略并支持 hover 查看完整路径。
- 图标尺寸独立为固定阶梯样张卡，自定义尺寸只影响少量预览图标，目录本身保持稳定视觉重量。
- motion 样张增加统一播放开关，开发者可以随时开启或停止持续动画。
- 基础与 Agent 实验页的来源路径与标题说明同行展示，统一固定长度省略和 hover 查看。
- 故事卡来源补齐可定位的 `.tsx` 路径。


### 2026-08-26 · Playground 控件与故事导航收口（候选）

- 图标目录将来源路径放到搜索按钮左侧，尺寸改为固定值 + 自定义滑杆；移除重复的独立尺寸故事卡和说明文字。
- 设计语言增加圆角实时滑杆，motion 样张改为自动播放，毫秒值与 token 名同行。
- Foundation 基础组件 Tab 按任务合并为按钮、输入与表单、标签与选择、弹层与菜单、状态与反馈、开发基础；底层故事仍完整渲染。
- Chat、工作区等产品体验的来源路径统一移到基础引用行最右侧，支持省略与 hover 查看。
- 其他一级 Playground Tab 同步采用同一页头规则，并登记可定位的 `.tsx` 来源；长路径固定长度省略、hover 查看完整值。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-26 · Chat Playground 页头信息归位（候选）

- Chat 用途说明与标题同行，基础引用行右侧展示真实实现来源路径。
- Chat 组合样张区域不再重复展示 `.tsx` 来源，下面只保留宽度切换与实际页面预览。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-26 · Playground 图标目录头部收口（候选）

- 图标搜索并入目录标题行，展开后使用紧凑的固定宽度输入，不再单独占用内容行。
- 隐藏图标目录中的 `.ts` 源路径；真实注册表、稳定 key 和采用证据仍保留给 AI / Debug 使用。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-25 · Playground 页面组合减层（候选）

- Chat 组合样张移除独立的“页面组合样张”来源行，来源仅作为工具行中的低对比路径，并与标准 / 分栏宽度切换合并，减少页面顶部层级。
- Lucide 图标目录数量统计移入目录标题同行，搜索区域不再额外占一行。
- 本轮仍只影响 Playground P0，未回流正式产品页面。


### 2026-08-24 · Playground 基础视觉减噪

- 移除设计语言页无实际产品流程的“重新读取”按钮，Token 展示改为随页面状态自然更新。
- Markdown 故事的代码块增加 Playground 专用层级色，修复浅色主题下代码区过白的问题，不改变正式 Chat 默认样式。
- 图标尺寸改为同一语义图标的 12 / 14 / 16 / 20 真实预览，搜索默认收起为放大镜，点击后展开输入。
- 设计语言的三档 motion token 增加可点击动画样张；页头去掉重复工作域小标题和“隔离实验”徽标。
- 产品体验页将基础能力依赖收进统一页头的轻量元信息行，移除内容区前额外的依赖卡和“这页如何组成 / 体验组成”摘要层。
- 清理 Playground 样张中的特定人物和外部参考产品名称；本轮仍只在 Playground P0，不回流正式页面。

### 2026-08-24 · Foundation 故事注册架构

- 新增 `src/shared/foundation-story-registry.ts`，统一维护 Foundation story key、组件 assetKey、Tab viewId、视觉分组和 renderer 关系。
- Foundation catalog、工作台分组和高级候选故事不再各自维护完整入口清单；一致性 Unit 会检查注册资产、renderer 分支和实际故事入口。
- 组件资产注册表继续负责组件身份与生命周期，故事注册表负责 Playground 展示事实，二者职责分离但通过 assetKey 关联。

### 2026-08-24 · Foundation 常用与候选组件补齐

- 基础组件工作台补齐下拉选择、表单字段、复选框、开关和差异查看器等已使用 / 高频控件故事。
- 同步加入对话框、弹出层、下拉菜单、可搜索选择、命令面板、右键菜单、滚动区域、提示浮层、骨架屏和进度条的隔离候选故事；候选生命周期不冒充生产采用。
- 本轮完成后，Foundation 下一阶段转入统一样式、焦点、禁用、错误、窄宽和深浅主题验收，暂不继续扩大目录。

### 2026-08-23 · Playground 布局收口

- Playground 壳统一提供工作域、当前一级 Tab、目的说明和内容宽度，面板不再各自漂移。
- 基础故事筛选在数据层保留基础控件 / 状态反馈 / 开发基础归类，但界面收敛为无灰色分组标题的单行横向切换；产品体验依赖改为紧凑证据摘要；页面组合移除外层故事卡套内层预览的重复包裹。
- 本轮仍停留在 Playground P0，未改变正式产品页面。

### 2026-08-23 · Foundation 基础模块补齐

- 基础组件工作台不再只展示按钮、输入和工具卡；新增标签切换、生成动作、提示条、加载指示器、Markdown 渲染、资产目录、文件树和分栏拖拽等可交互故事入口。
- Foundation 页面收敛为“单行横向故事切换 + 真实预览”，移除无预览价值的资产总览和候选文字区；完整登记继续由注册表 / Debug 承担。
- 图标采用标记统一放到具体图标卡右上角；Markdown、文件树等正式基础能力继续使用真实组件 + 隔离样张验收。
- 本轮仍停留在 Playground P0，不回流正式产品页面。

### 2026-08-21 · Playground 两层边界与 Tab 事实表收口

- 将 Playground 文档固化为 `Foundation → Experience` 两层产品设计模型；`Agent 实验` 只作为独立隔离工作域，不引入第三层架构。
- 新增施工合同中的 Tab 事实表：设计语言、图标与视觉、基础组件、Chat、人物世界、记忆、设置、工作区和 Agent 实验各自的职责与禁区。
- 原“设计令牌”改名为“设计语言”，移除不属于该层的“组合实验”；基础组件不再展示记忆芯片、伙伴状态条等业务结构。
- 产品体验摘要改为“体验组成 / 基础能力”两行，业务组成与 Foundation 依赖均从注册表派生；人物世界的朋友圈、物什、名册三个 Tab 增加隔离样张并可逐个切换，角色架改在设置样张中查看。
- Playground Right Dock 支持同类型 Tab 多实例，实例具备独立标识；仍保持只读样张，不连接真实审阅或终端。
- 本轮仍是 Playground P0 候选施工，不回流正式 Chat、设置或人物世界默认行为。

### 2026-08-19 · Playground 全屏壳与目录减噪

- Playground 改为与设置一致的独立全屏工作区，进入后不再保留产品 Primary Sidebar，消除双层侧栏。
- 删除页面顶部重复说明块、基础组件“组件索引”和全局采用标记开关；采用图标只保留在有直接证据的具体资产上。
- 图标目录收敛为紧凑的图标 + 中文名 + 灰色英文名，key / 用途 / 优先级继续留在注册数据和搜索中。

### 2026-08-19 · 产品体验基础依赖门禁

- 新增产品体验注册表，为 Chat、人物世界、记忆、设置、工作区和业务状态声明稳定 key、真实来源与 `usesFoundation`。
- UI 资产显式区分 foundation / experience；TypeScript 与 Unit 会阻止不存在、非基础层或生命周期不兼容的依赖。
- `assets:check` 增加产品体验资产家族；Playground 双向展示“使用的基础 / 被哪些体验使用”，反向关系完全派生。

### 2026-08-19 · Playground 两层设计工作台候选

- Playground 导航收敛为“基础 / 产品体验 / Agent 实验”三个工作域；基础组件和业务状态在工作台内筛选，不再把按钮、输入、确认框等混成一级导航。
- 产品体验按 Chat、人物世界、记忆、设置、工作区直接进入，页面组合去掉第二套内部页面导航。
- 已把“产品体验缺基础能力时先回基础侧创建并验收”的 AI 开发规则写入前端规范。

### 2026-08-19 · Playground 导航与生活面精修候选

- Playground 组件故事已提升为一级入口，保留“设计 / Agent 实验”作为视觉分组，不再嵌套第二套页面导航。
- Right Dock 候选拆分为文件、预览、审阅、终端四个 Tab，默认仅显示预览，文件 / 审阅 / 终端通过“+”添加；审阅与终端只渲染隔离占位。
- 人物世界候选移除重复“生活广播”标题和 Catch-up 独立卡，改为社交流样张；记忆候选收敛为三种主色 + 灰色。
- Chat 壳候选移除主内容区独立“新对话”顶部框，让欢迎区直接承接内容；侧栏入口不变。
- 新增 Renderer E2E 覆盖一级导航、右坞按需 Tab、朋友圈样张、记忆颜色；本轮仍停留在 Playground P0，未回流正式页面。

### 2026-08-18 · Playground 页面基线精修候选

- Sidebar 候选底栏真正贴底，隐藏“开发 / 产品”标签，主侧栏候选只保留人物世界 / 设置；已删除被否决的“二级页收起”和工具 Secondary Nav。
- Right Dock 加入只读项目文件树 / 代码预览样张，人物世界加入只读 Moments / Catch-up 样张，均显式跳过真实 IPC。
- Toast 四态关闭按钮统一右边界；记忆分类图标、名称与数量在窄宽下保持同行。
- 本轮仍处于 Playground P0，等待人工确认后才决定是否回流正式页面。

### 2026-08-17 · 记忆后台任务生命周期收口

- 修复 GitHub Asset registry CI 在 `memory-tools` teardown 阶段出现 `EnvironmentTeardownError` 的时序竞态。
- 记忆向量异步写入继续保持非阻塞，但通过 `drainMemoryBackgroundTasks` 提供测试 / 退出前的生命周期边界。
- 相关单测在关闭数据库或测试环境前 drain，避免动态加载辅助模型配置跨越 Vitest 生命周期。

### 2026-08-17 · Chat 页面组合基线与设置自动保存

- Primary Sidebar 默认宽度收敛为 248px（216–320px），Debug / Playground 固定在会话列表上方，底栏只保留产品入口。
- Chat 顶栏只显示会话标题和特殊上下文；Debug / Playground 等全页视图不再继承 52px 空白顶栏。
- 欢迎区按可用高度居中，主角联动说明改为轻量引用样式，输入卡与 Playground 页面组合故事保持同源。
- 设置页移除重复的“设置 / 保存”顶部栏，字段修改后 800ms 防抖自动保存，未修改 API Key 不覆盖安全存储。
- Renderer E2E 覆盖开发入口顺序、Playground 顶部起点和设置无手动保存栏。

### 2026-08-17 · GitHub Actions 与跨平台删除安全收口

- 清理 `.tmp/` 临时审计报告、过期文档重构草稿和未引用 Prompt 注册表草稿，并将 `.tmp/` 纳入本地忽略。
- 修复 Linux 工作区位于 `/tmp` 时普通文件被永久删除白名单误命中的问题；白名单现在只检查工作区内部相对路径段。
- Unit CI 使用 Electron external 占位路径，不再下载桌面二进制；官方 Checkout / Setup Node / Upload Artifact Actions 升级到 v7。
- GitHub 失败日志中的大量 EnvironmentTeardownError 已确认为下载超时后的连锁噪声，根因测试已补回归并在本地 CI 等价环境通过。

### 2026-08-17 · 全量资产治理与自动登记施工

- 新增 `src/shared/design-asset-registry.ts`，统一 Settings、Playground、MarkdownRenderer 的主题与字体比例来源。
- 新增 `electron/main/agent/subagent-asset-registry.ts`，登记 researcher / coder / analyst 的稳定角色资产，并接入 Debug 聚合与真实运行证据。
- 新增 `scripts/asset-governance.mjs` 与 `npm run assets:check`，维护 12 个资产家族、18 个 ModelContextAssetType 的治理覆盖，生成 `var/asset-audit/` 机器快照并对 staged 漏登 fail-closed。
- Git hooks 与 GitHub Actions 已接入资产门禁；全量盘点快照见 `_archive/audits/asset-registry-audit-2026-08.md`。

### 2026-08-17 · UI 组件资产注册与方法论

- 在统一资产注册方法论中补入 UI 组件 / 图标的身份、采用生命周期、Playground 验收和无障碍契约，不另造第二套管理哲学。
- 新增 `src/shared/ui-component-registry.ts`，区分 candidate / playground / adopted / deprecated / archived，并明确 Radix 候选不等于已安装依赖。
- Playground「组件 → 组件目录」支持按分类、采用状态和中英文 / key / 来源搜索，已采用项指向真实组件源码。
- 增加 UI 组件注册表 Unit 与 Renderer E2E，图标分类导航恢复中文单语，英文只保留在具体常用组件 / 图标名中。
- 已采用组件的无障碍验证状态与采用状态分离；当前专项复核登记为 WISH-022，不用“已采用”冒充“已验证”。

### 2026-08-16 · Playground Lucide 语义图标目录

- 保持 `lucide-react` 为生产唯一图标源，不把 Alice 的 Tabler 图标库混入产品依赖。
- 新增 `src/shared/icon-registry.ts`：按导航、对话、开发、伙伴、资产、状态登记稳定语义 key、中文主名、灰色英文名和 P0/P1 优先级。
- Playground「组件 → 图标」增加可搜索、按分类筛选的图标资产目录，作为后续正式 UI 采用前的统一验收面。
- 增加注册表单测和 Playground UI 验收，避免图标 key 漂移或目录与实际组件脱节。

### 2026-08-16 · 文档自进化复盘闭环

- 新增 `npm run docs:self-review`：只读扫描最近提交、变更影响、重复长句候选、活跃文档体量、施工合同、Wishlist、规则反馈和 docs:check 结果。
- 新增 `npm run docs:self-review:prompt`：生成给 AI 的结构化语义复盘提示词，明确不自动修改 canonical 文档。
- 复盘产物写入 ignored 的 `var/docs-self-review/`，不触碰用户已有 `.tmp/`、`.env`、用户数据或运行报告。
- GitHub Actions 每周生成复盘 artifact；CI 不调用模型、不提交修复。
- AI 复盘结论按现有账本路由到 rules-feedback / wishlist / decisions / 模块卡，不新增第二套问题系统。

### 2026-08-16 · 文档变更影响与收工闭环

- Wishlist 未完成项统一为 `WISH-001`～`WISH-021`，保留来源，ID 不复用。
- 四张模块卡新增相关 DEC 薄索引；不复制决策正文。
- 新增 `docs-impact-check`，按 staged 代码路径提醒或要求复核模块卡、Architecture、Quality、Progress 和 Changelog。
- 新增 `docs:validate` 统一入口；`npm prepare` 启用 `.githooks/`，commit / push 自动触发文档门禁。
- 新增 GitHub Actions 文档门禁，Pull Request 和 push 自动运行 `npm run docs:check`。
- 施工合同增加收工门禁：稳定事实回流、Wishlist ID、账本更新、文档验证和冻结生命周期缺一不可。

### 2026-08-16 · 文档真相源与生命周期收口

- 建立当前事实矩阵：代码 / 模块卡 / Architecture / Quality / Decisions / Wishlist / Progress / Changelog 各自只负责一种事实。
- 完整归档旧 Progress、Changelog、Wishlist、Rules Feedback 和 dated audit；活跃文件只保留当前内容。
- 施工合同区分进行中与已完成施工快照；完工合同不再承担当前能力真相。
- 统一当前规则入口到 `AGENTS.md`，并增加决策发现与归档搜索规则。
- 新增 `npm run docs:check`，阻止链接、状态、DEC 引用和易漂移数量再次失真。

### 2026-08-16 · 安全审计 v5 与威胁模型收口

- Renderer 不再接收 API Key 或 MCP env 原文；主进程负责已保存凭据恢复和高风险设置确认。
- MCP 配置校验、资源上限、secret hydrate 与启动恢复统一进入主进程安全边界。
- DEC-037 明确当前不建设 OS 级 Shell 强隔离或 Python 嵌入沙箱。
- 完整审计报告已冻结在 [`../_archive/audits/security-audit-2026-08.md`](../_archive/audits/security-audit-2026-08.md)。

### 2026-08-14～15 · Agent 生产资产与使用证据链

- Prompt、Role Pack、Memory Strategy、Permission / Sandbox、Tool、Skill、Eval、Provider 与 MCP 进入统一生产资产目录。
- 真实 LLM / Tool / Memory / Permission 运行通过稳定 key 记录脱敏使用证据，支持反向查询、导出和 Debug 跳转。

## 当前状态

### 产品

- 伙伴世界 W0–W6、三槽、召唤、自动反思 MUTABLE 已落地。
- 人物行为人格已进入 Playground 与 Persona Eval；人物故事、职业、经历、住所和完整世界观仍待产品确认。
- Debug 回答“生产系统实际是什么”；Playground 只做隔离实验，不复制生产真相。

### 工程

- Agent Loop、上下文压缩、任务队列、多 Provider、MCP、Skill、权限责任链和工作区路径防线已落地。
- 当前能力清单以 [`modules/README.md`](./modules/README.md) 及各模块卡“已落地能力”为准。
- 当前门禁以 [`quality.md`](./quality.md) 和实际命令输出为准，不在 Progress 固定测试数量。

## 最近进展

- Playground 产品体验补齐隔离主角连续性：角色架可从 Chat 伙伴身份进入，切换后 Chat、朋友圈、物什和名册共享同一 fixture 主角，不触发生产角色切换。

- Playground 补齐“人物世界 → 记忆 → 设置 → Chat”的候选闭环，入口均保持隔离和只读。
- Playground 人物世界候选增加“看记忆”入口，补齐生活面到长期关系信息的连续路径。
- Playground Chat 任务候选补齐“处理任务 → 回到对话”的收尾动作，工作区不再只能通过切换 Tab 消失。
- Playground 产品体验补齐 Chat 欢迎区到人物世界的真实候选导航；“看看朋友圈”不再是无响应的静态按钮。
- Playground 人物世界朋友圈候选补齐微信式左对齐赞 / 评论互动行；评论仍是隔离样张状态，不进入正式数据链路。

## 下一步

1. 完成 Playground 常用 UI 控件的中文主名与灰色英文辅助名。
2. 在 Playground 做伙伴语气、活人感和审美人工验收。
3. 根据人工验收结果决定是否进入主角人物故事设计。
4. 从 Wishlist 选择下一项前，先确认是否需要新的施工合同。

## 阻塞与暂缓

- 原生语音输入：等待明确采用系统 STT 或云端 Whisper，见 [`deferred/native-voice-input.md`](./deferred/native-voice-input.md)。
- 人物故事：不是工程阻塞，需要产品设定确认。
- 真实 Persona Eval：会产生远程模型费用，只有明确需要时运行。

## 历史索引

- [完整 Progress 快照（截至 2026-08-16）](../_archive/ledgers/progress-through-2026-08-16.md)
- [完整 Changelog 快照（截至 2026-08-16）](../_archive/ledgers/changelog-through-2026-08-16.md)
- [2026-08 当前实现逐章审计](../_archive/audits/current-implementation-audit-2026-08.md)
- [2026-07 方法论缺口审计](../_archive/audits/gap-audit-2026-07.md)

- 2026-09-11：Skills 详情补充“技能描述：”标签，与“触发条件：”左对齐；仅为 Playground 文案层级调整。

- 2026-09-11：记忆候选移除管理方式卡片，搜索收为身份信息区右侧放大镜并改为点击展开。

- 2026-09-11：删除记忆页重复的长期信息边界提示，页面直接进入分类、搜索、添加和列表。

- 2026-09-11：记忆新增改为列表尾部新增行，默认不占空间，点击后展开输入与分类选择。

- 2026-09-11：新增记忆改为当前分类列表下方的内联行，隔离说明置于新增行下方，移除重复分类选择。

- 2026-09-13：正式终端面板补齐运行实例隔离：仅接收当前 runId 的输出，退出、终止和卸载都会清理运行状态并结束所属进程；`terminal:ready` 握手会缓存并按序冲刷早到输出，完整 PTY 仍是后续缺口。

- 2026-09-13：Markdown 代码块背景统一改由共享语义 token 提供，正式与 Playground 均覆盖高亮库内部背景；ReviewPanel 原始 diff 展示仍待收敛到共享渲染器。

- 2026-09-13：正式 ReviewPanel 的真实 diff 内容改为复用 MarkdownRenderer，统一代码块主题、滚动和安全渲染边界；数据读取与错误恢复保持 session IPC。

- 2026-09-13：正式 ChatRightDock 回流五功能入口：审阅、浏览器、文件、终端、侧边聊天。浏览器与侧边聊天仅提供真实产品空态，不带 Playground srcDoc、模拟消息或场景切换器，后端契约仍列为缺口。

- 2026-09-13：浏览器与侧边聊天正式空态壳已登记为 Experience 资产，明确不代表真实后端能力；后端契约仍按工作区合同单独施工。

- 2026-09-14：正式设置完成第一批 Playground 回流：共享设置导航与伙伴设置内容，正式入口统一为外观与界面、伙伴与相处、模型、记忆、数据与隐私、权限与自动化、Skills、MCP、关于 My Agent；旧参数、工具、开发者入口移除，后端服务保留。

- 2026-09-14：按用户确认收敛正式 Skills：旧管理器展示不再暴露新建、版本历史、隔离试跑，正式页只保留列表、详情、用户 Skill 编辑校验保存与删除；底层服务和历史数据未删除。

- 2026-09-15：正式入口补齐开发者模式门控：默认隐藏 Debug / Playground，设置中的“关于 My Agent”提供真实持久化开关，关闭不删除数据或后台服务。

- 2026-09-14：UI E2E 壳显式启用开发者模式以覆盖 Playground / Debug；Electron 正式运行仍以持久化设置为准，避免测试夹具改变产品默认。

- 2026-09-14：回归门禁补齐开发者模式测试契约：UI E2E 显式保留开发入口，正式 Electron 默认仍关闭。

- 2026-09-14：人物世界文化角接入真实 `culture` 资产链路，正式页面展示读书 / 音乐 / 电影 / 摄影记录；家居与足迹仍待独立数据契约。

- 2026-09-15：正式模型设置完成一次展示层收敛：旧单连接表单不再与新路由面板并存，生产 UI 仅复用已验收的 Playground 模型连接/用途安排组合；兼容字段继续服务旧数据和运行时回退。

- 2026-09-15：模型设置的 image 用途路由已接入 Runtime，配置面与实际图片请求不再脱节；无有效 image 路由时保留主模型回退。

- 2026-09-15：模型连接卡编辑已修正密钥保留边界；正式界面不显示旧 Provider / API Key / Base URL 表单，旧字段仅作为兼容数据源参与迁移与运行时回退。

- 2026-09-15：R12 家居 / 足迹已接入 `companion_assets` 的 `home` / `footprint` 类型与幂等 starter；正式面板按主角读取住所和常去地点，未设定数据不生成占位事实。
- 2026-09-16：正式设置外观页按 Playground 验收结果收敛为语言、主题、字号三段式结构；真实主题切换与字号设置链路保持不变。
- 2026-09-16：人物世界物什删除操作复用 Foundation 确认面板，避免浏览器原生确认框造成主题和交互不一致。
- 2026-09-16：通讯录强制召唤和敏感记忆写入复用 Foundation 确认面板，真实召唤与记忆 IPC 契约保持不变。
- 2026-09-16：纠正此前 Skills 完成记录：`2055429` 只有文档，旧页仍为双栏并使用 `window.confirm`，不能算回流。本批实际替换为正式 / 候选共享列表→详情，删除未使用的旧页面状态；补齐真实启停、错误恢复、资源加载与 Foundation 确认故事。全产品目标保持进行中，其他页面不因本项验证通过而变为完成。
- 2026-09-16：用户明确开发期不考虑旧界面、旧接口或旧开发数据兼容；本次未批量清空开发数据库。后续回流按新结构直接实现，必要时只重建相关开发数据，遵循 DEC-042。
- 2026-09-16：R09 本批验证完成：Unit 155 文件 / 914 项、UI 160 项、Electron 12 项通过（4 项外部模型跳过），Eval 23 + 1 项、根 tsc / build / 资产检查通过；真实重启后 Skill 停用仍生效。主进程独立类型检查仍有 70 条存量诊断，本批对照无新增；npm audit 因 TLS 失败未得到新结果。
