# 心愿池

> 只保存**尚未完成**的缺口、暂缓项和灵感，不承诺执行。完整旧心愿池（含 107 个已完成项）见 [`../_archive/ledgers/wishlist-through-2026-08-16.md`](../_archive/ledgers/wishlist-through-2026-08-16.md)。
> 决定开工 → 写施工合同或进入对应方法论队列；完成或明确取消 → 从本文件移出，并在 Progress 留痕。
> 每个未完成项必须有唯一 `WISH-xxx` ID；ID 不复用，来源和重启条件尽量写在同一行。

## 待办缺口

- WISH-045 MCP 回流补充：服务卡片与添加向导已接入，生产 Streamable HTTP / Bearer、测试后选择工具、取消 / 超时清理和保存后接管已落地。仍需独立 Electron 数据目录验收真实 IPC / safeStorage / 重启恢复、OAuth 登录生命周期和异常断开恢复；不能将 Renderer 替身或协议单测当作完整 R10 完成。配置保存与连接停止仍是两个 IPC，保存后的停止通道异常只报告状态未确认并要求重启检查，后续须补主进程统一变更与状态恢复，不宣称原子操作。

- WISH-045 设置内容复核：九区共享导航、伙伴偏好及四主题同源已接入，旧七主题描述已过时；模型、记忆、Skills、MCP 的完整候选形态仍按各编号验收，不能只把旧面板嵌入新导航后关闭缺口。
- WISH-045 生活面 / 备份补充：文化角、家居和足迹已共用展示组件与资产链；生活资产编辑和想去写入流程仍归 R12。文化 starter 中的“留下 3 条笔记”“看过两次”等默认描述没有关联数量 / 事件证据，仍需复核角色内容来源，不能以写入数据库代替人物设定授权；本批只回流展示，不静默删除用户记录。`ipc/data-export.ts` 当前只导入导出会话、记忆和设置，未覆盖 `companion_assets` / `companion_asset_seeds`；需按 R07 补齐完整归属、恢复与失败回滚，不能将此缺口移出原目标或把数据库重载测试算成产品备份验证。
- WISH-045 跨入口保存核验：[待确认] App 全局快捷键直接切换视图，尚未统一走设置返回按钮的异步保存门控；需复现失败时的草稿保留与恢复，不将返回按钮专项证据外推到所有导航路径。
- WISH-042 验收稳定性：UI 与 Electron 同期运行时有一次记忆候选点击中 DOM 被卸载 / 返回主界面，单独 trace 复核及串行完整 UI 均通过；根因未确定，保留现场，不放宽断言或当作已修复。
- WISH-042 2026-09-15 MCP 复现：仅运行 UI 的全量回归中，瓷青 600px 候选点击“连接失败”前返回聊天首页，111 项通过 / 1 项超时；现场 Vite 日志没有对应 HMR，说明同期 Electron 运行不是该现象的必要条件。原断言不变，使用独立 trace 复核；根因仍未确定，不能把重跑通过当作稳定性修复。
- WISH-042 已定位子因：后续全量 trace 把 HTML 写进 `var/verification`，真实 Vite 日志出现连续 page reload；已通过 watcher 排除产物目录修复，真实 watcher Unit 修复前失败、修复后通过。该证据只关闭 trace 产物引发重载这一子因，不关闭前述无对应 HMR 的退出问题。
- WISH-042 符号检查成本已收敛：Foundation 复用测试只解析显式的 7 个真实文件和负例夹具，保留 TypeChecker / 别名 / 遮蔽断言且不增加 5 秒超时；默认并发全量 Unit 已通过 844 项。此前该测试加载外部类型图引起的超时子项已有对应修复，其他 UI 稳定性问题不随之关闭。

- [ ] **WISH-045 · 全产品体验正式回流遗漏（已开工）** — 来源：2026-09-14 用户核验发现正式设置、人物世界、记忆等仍停留旧实现；右坞完成不能代表全部回流。用户已授权原目标和必要后端补齐，施工入口：`docs/requirements/product-experience-production-rollout-v1.md`。该合同统一管理页面映射及后端验收，WISH-027 / WISH-040 / WISH-042 / WISH-043 保留各自细节，不将缺失能力静默移出目标。

- 工作区回流审计补充（WISH-041 / WISH-042）：共享 Markdown 的就近主题／Mermaid、DiffViewer/模式控件、IconButton 和 WorkspaceToolMenu 已接入真实调用，空稿/缺稿回退、四主题、长文件和完整 UI/Electron 回归通过。仍需输入及其它基础控件全量复用核验。侧聊流中关闭已有真实 Electron 证据；终端 Windows 停止/关闭后的真实父子进程退出已验证，Unix 仍需实机验证，不把 Renderer 替身当作跨平台完成。

- [ ] **WISH-043 · 主进程类型检查门禁** — 来源：正式侧聊 Electron 回归发现 runtime 的 undefined.trim 和 span 越域未被默认 tsc 检出；根配置只 include src，主进程 `tsc -p tsconfig.node.json --noEmit` 仍报告跨项目 include/composite、ImportMeta.glob 与多个存量类型错误。重启条件：当前回流质量门禁收口；明确前端/主进程检查入口，先清理真实诊断，再纳入 build/commit，不用宽泛 any 或排除文件消音。

- [ ] **WISH-042 · Foundation 真实复用与源码门禁** — 来源：2026-09-13 用户对白底、孤立控件和基础复用原则的反馈及代码审计；施工合同：`foundation-reuse-enforcement-v1.md`，范围待确认。收口四个 Playground 产品体验的 Markdown / Diff / 局部主题和通用控件，验证真实 import 与渲染使用，补违规负例和四主题视觉回归；当前注册表 key / 来源存在检查不能保证实际复用，不得只补调用参数或包装标签后宣称完成。
  门禁稳定性补充：Foundation 符号解析测试在默认/2-worker 全量运行中出现 5 秒超时；单独测量加载 427 个源文件（401 个来自依赖），程序构建与类型解析合计约 1 秒。单 worker、禁用文件并行后完整 803 项通过，原超时与断言未放宽；仍需稳定默认执行成本，不能把串行通过写成并发问题已修复。

- [ ] **WISH-041 · 工作区五功能正式回流（进行中）** — 2026-09-13 用户已授权目标模式回流；来源：`playground-workspace-five-tools-v1.md`。正式 ChatRightDock 已接入共享标签、代码块、Markdown/Mermaid、DiffViewer、IconButton、WorkspaceToolMenu、TextField，以及文件左树右多预览、审阅真实旧稿、受限只读浏览器和 workspace 侧聊；文件浏览器、浏览器、终端和侧聊的通用操作槽已统一到 Foundation。新增 `workspace-backend-contract.test.ts` 锁定五功能真实 project/session/terminal/browser/chat IPC，禁止正式面板依赖 Playground fixture。侧聊关闭及切换主会话后的连接终止、删除与新侧聊发送已有真实 Electron 证据，创建失败重试、旧草稿/确认/迟到错误隔离有 Renderer 回归，主进程初始化取消/运行收尾/待确认工具取消有 Unit。Windows 终端已用真实 Electron 验证大块输出和停止/关闭后的父子进程退出。当前剩余：正式工作区 Foundation 复用已由审计门禁覆盖（本轮补充统一扫描）；剩余后端能力、Unix 终端实机验证；完整 PTY 已按 2026-09-14 产品决策暂缓，浏览器脚本/登录交互明确不在本合同。Debug 页点新对话仍停留 Debug 的入口行为也需核验，当前 Electron 用正式返回入口回 Chat。Debug 与 Playground 一级入口、返回聊天及新对话后的工作区入口已由 UI/Electron 回归覆盖；Playground 与 Renderer IO 替身不能替代后端证据。
- [ ] **WISH-040 · MCP 场景正式接入** — 来源：`playground-mcp-scenarios-v1.md` 与 2026-09-10 协议/竞品复核；已获准回流。当前已有 stdio / SSE / Streamable HTTP、Bearer 凭据管线、逐工具持久化及执行侧校验；仍缺完整添加向导、可取消测试与保存 / 激活恢复、OAuth 登录生命周期及真实 Electron 端到端验收。候选中的连接、确认与重试仍是隔离状态，协议单测不得冒充完整用户流程。
- [ ] **WISH-027 · 编程套餐后端接入与兼容性验证** — 来源：用户批准先做前端、Alice `providers-C3aFiGCn.js` / DEC-039；重启条件：模型设置 P0 获准正式回流，并取得套餐测试授权。逐套餐核实官方使用限制、认证、协议适配器、模型发现与手动添加、流式 / 工具调用、额度和失败分类；尤其验证 MiniMax Token Plan 的 Anthropic 路径与工具差异。沿用统一配置工厂和模型调用入口，不伪装客户端身份绕过套餐限制；当前六个入口仅是 Playground 预设，未承诺通用聊天、生图或后台任务可用。
- [ ] **WISH-028 · Vite 开发依赖扫描范围** — 来源：2026-09-06 启动日志，依赖预扫描进入 `_reference/framework-harness/repos/cc-switch`，报告缺少 Tauri 等参考仓库依赖；本项目页面与 UI E2E 仍可运行。重启条件：下一次开发启动配置维护；将扫描入口限定为应用入口并验证普通 dev / ui-e2e 冷启动，不为消除警告安装参考项目依赖。

### 安全与韧性

- [ ] **WISH-044 · 当前锁定依赖安全更新** — 来源：本轮工作区收口执行 npm audit，全部依赖报告 7 项（3 high / 4 moderate），omit=dev 报告 4 项（2 high / 2 moderate）；涉及 fast-uri、hono、js-yaml、qs，以及开发依赖 @vitest/mocker/vitest、@xmldom/xmldom。未找到现有 DEC 接受这些风险。重启条件：发布前单独完成依赖升级与实际使用路径核验，运行 Unit/Eval/Electron/打包回归；本轮没有修改 package/lock，也未声称漏洞清零。

- [ ] **WISH-001 · URL Fetch DNS rebinding 深度防护** — 当前已有 DNS 预解析、私网黑名单、重定向阻断和响应上限；若威胁模型需要对抗主动竞态攻击，再引入固定地址连接器或进程级网络策略。历史证据见 [`../_archive/audits/security-audit-2026-08.md`](../_archive/audits/security-audit-2026-08.md)。；来源：安全审计
- [ ] **WISH-002 · Tool Result Injection 结构化分类器** — 当前已有中英文启发式探针和不受信任内容边界；后续可用离线分类器 / Eval 扩展。；来源：安全审计 / Gap Audit
- [ ] **WISH-003 · 长任务韧性复核** — 复核分层超时、心跳保活和可重试 / 不可重试错误码白名单，来源：2026-07 Gap Audit。
- [ ] **WISH-004 · 可逆性 / Undo 设计** — 为高风险工具和用户可见修改建立可逆操作模型，来源：2026-07 Gap Audit。

### 存储、上下文与启动

- [ ] **WISH-005 · 迁 better-sqlite3 / 增量快照** — 等 sql.js 全量 export 出现明确体感问题再评估。；来源：M16 方法论
- [ ] **WISH-006 · Context Engineering 专项** — 复核 just-in-time 检索、结构化工作笔记、context reset 与压缩边界，来源：2026-07 Gap Audit。
- [ ] **WISH-007 · 启动性能专项** — 评估等待窗口内并行 I/O、阶段计时和“超时不缓存 null”，来源：2026-07 Gap Audit。
- [ ] **WISH-008 · 配置源与本地热更新复核** — 判断是否需要统一配置源抽象，而不是继续由各模块独立监听，来源：2026-07 Gap Audit。

### 多 Agent 与自进化

- [ ] **WISH-009 · M19 多 Agent：Swarm / Handoff** — 复核动态 Agent 列表、Mailbox 权限冒泡和控制流 / 数据流侧信道。；来源：M19 方法论
- [ ] **WISH-010 · M20 自进化** — 自动改进、代码级自进化和主动提案；版本备份与回滚已落地。；来源：M20 方法论
- [ ] **WISH-011 · Generator–Evaluator 架构** — 评估独立 evaluator，避免生成器自评过宽，来源：2026-07 Gap Audit。

### Playground、Skill 与国际化

- [ ] **WISH-012 · Playground Prompt Lab 加厚** — 从 Debug 选择资产、模拟上下文、A/B 对比和模型 / 参数切换；用户已明确暂缓。；来源：用户讨论 / M32
- [ ] **WISH-013 · 伙伴结构化资产 Playground 草稿** — 支持从 Debug 显式载入 profile / 默认世界为隔离草稿、Diff 和人工回流；不得直接写生产 Role Pack。；来源：资产注册管理方法论
- [ ] **WISH-014 · Skill Diff 审阅与导入导出** — 补版本 diff、导入导出和迁移策略。；来源：Skill 管理施工合同
- [ ] **WISH-015 · 中文 Prompt → 英文 Prompt 多语言版本** — 当前生产只维护简体中文；未来在同一资产 key 下维护 `zh` / `en` 独立版本，运行时按 locale 单选，不做中英韩并发注入。；来源：Prompt 中文统一施工合同 / Alice 参考
- [ ] **WISH-022 · 已采用 UI 组件无障碍专项复核** — 按组件注册表的 `needs-review` 清单复核焦点管理、键盘操作、读屏语义、颜色之外的状态表达和窄屏溢出；优先检查 ResizeHandle、Toast、Tabs 与后续 Dialog / Menu Primitive。；来源：UI 组件资产注册方法论

### 伙伴人格与视觉资产

- [ ] **WISH-023 · 主角人物事实模型与激活决策** — 在 Playground / Debug 收尾、伙伴行为人格人工验收通过后，明确是否保留并激活小航；建立姓名、性别 / 性别表达、年龄段、称谓、外观边界、家乡、家庭、教育、职业和关键经历等结构化事实，并标注可主动表达、仅在询问时表达和禁止编造的边界。未经人工确认不得写入生产 Role Pack。；来源：伙伴模块现状 / 用户讨论
- [ ] **WISH-024 · 主角生活世界与关系设定** — 在人物事实模型确认后，补充城市、住所、房间、常去地点、路线、作息、食物、音乐、书籍、颜色、固定物品和其他角色关系等生活世界；与 `world.default.json`、生活世界组装器和 `WISH-013` 的隔离草稿、Diff、人工回流流程对齐。；来源：`playground-world-living-dimensions-v1.md` / 伙伴模块现状
- [ ] **WISH-025 · 人物聊天人格 Prompt 与一致性 Eval** — 将确认后的人物事实和生活世界接入 Role Pack 的稳定身份与动态上下文分层；补充人物事实一致性、反编造、长期稳定性、用户追问和边界拒答 Eval。不得把未经确认的人物设定直接写入聊天 Prompt，也不得在 Playground 复制生产 Prompt。；来源：Prompt 中文统一施工合同 / Persona Eval
- [ ] **WISH-026 · 人物视觉资产与生图 Prompt** — 单独建立人物视觉资产的来源、版本、用途、风格边界、参考图和生图 Prompt 管理流程；与聊天人格 Prompt 分离，并通过 Playground 隔离草稿、人工确认、Diff 和生产回流门禁接入 Role Pack。该项不等同于 `WISH-017` 的生图朋友圈能力。；来源：用户讨论 / 资产注册管理方法论
- [ ] **WISH-031 · 首个可插拔人格化 Agent 与扩展契约施工合同** — 先以一个真实人格化 Agent 作为平台样本，再从实际实现中提炼 Role Pack、Prompt、生活世界、视觉资产、Skill、Tool 和 Persona Eval 的可插拔边界；合同需明确 Runtime 由平台维护、扩展不得绕过权限和安全校验、Debug 可验证资产加载，且不得提前建设完整插件市场或通用 SDK。；来源：用户讨论 / 平台定位

### 开源平台长期规划

以下项目是平台定位下的长期路线入口，不属于当前 Playground / Debug 收尾任务；只有在首个可插拔人格化 Agent 样本成立、开发者最小闭环得到验证后，才按优先级分别立项。

- [ ] **WISH-032 · Extension API 与兼容性契约** — 将 Role Pack、Prompt、Skill、Tool、Memory Provider、Model Provider、UI 扩展和 Eval 的可扩展边界整理为稳定契约；补充版本号、能力声明、生命周期、迁移策略和兼容性测试，避免开发者只能通过修改 Runtime 源码完成二次开发。；来源：平台定位 / 架构讨论
- [ ] **WISH-033 · 开发者 SDK、脚手架与 30 分钟上手路径** — 提供一键启动、环境变量示例、扩展模板、示例 Agent、常见错误排查和从 Fork 到发布的完整教程；验收标准是外部开发者无需先读懂 Agent Loop 或 Electron IPC，即可创建并运行自己的 Role Pack、Skill 和 Tool。；来源：平台定位 / 开发者体验讨论
- [ ] **WISH-034 · 扩展分发、社区协作与安全治理** — 建立贡献指南、Issue / Discussion 模板、Code of Conduct、版本发布流程、扩展提交规范和安全漏洞报告流程；长期评估扩展目录、签名 / 来源声明、安装前审阅、禁用和回滚机制，不默认建设无审查的插件市场。；来源：开源平台定位 / 社区治理讨论
- [ ] **WISH-035 · 扩展数据访问与隐私隔离** — 明确第三方扩展可访问的会话、记忆、文件、凭据状态和运行证据范围；建立权限声明、数据最小化、导入导出、敏感数据清理、多 Agent / 多扩展隔离和撤销机制，扩展不能绕过主进程安全边界。；来源：安全边界 / 平台定位
- [ ] **WISH-036 · 扩展可观测性、Eval 与性能成本反馈** — 让开发者能够在 Debug 中看到扩展加载、Prompt / Skill / Tool 实际使用、权限决策、Trace 关联和失败原因；提供自定义 Eval、回归测试模板、性能指标与模型成本观测，证明扩展行为而不是只展示静态配置。；来源：Debug / 资产证据链 / 平台定位
- [ ] **WISH-037 · 无界面与多运行形态的 Runtime 边界** — 保持 Agent Runtime 与 Electron UI 解耦，长期评估 headless、服务端 API、Web 控制台、团队部署和多端客户端；先定义哪些能力属于桌面产品、哪些属于 Runtime / SDK，不在没有真实需求前同时建设多套运行形态。；来源：平台架构讨论
- [ ] **WISH-038 · GitHub / 官网 English-first 语言策略** — 对外 README、Quick Start、架构说明、Extension API、贡献指南、安全策略和发布说明以英文为默认入口，并提供简体中文入口；产品 UI、内部研发文档和当前人格 Prompt 不强制全部英文化，避免把公开开发者资料、产品 locale 和 Prompt 资产混成同一件事。；来源：用户讨论 / 开源平台定位
- [ ] **WISH-039 · 开源协议、品牌与项目治理** — 明确 Runtime、SDK、示例 Agent、Role Pack、Skill、文档和媒体资产的许可证边界；补充贡献者协议 / 贡献指南、商标与品牌使用规则、版本发布责任、安全漏洞披露和社区决策机制，确保其他开发者可以放心基于平台二次开发和分发。；来源：开源平台定位 / 社区治理讨论

### 产品体验

- [ ] **WISH-016 · 人格化错误承接** — 评估错误码到伙伴语气模板的映射，避免技术错误提示破坏关系体验；来源：2026-07 Gap Audit。
- [ ] **WISH-017 · M24-G3 生图朋友圈** — 非本阶段。；来源：M24 方法论
- [ ] **WISH-018 · 原生语音输入** — 暂缓；待选择系统 STT 或云端 Whisper，见 [`deferred/native-voice-input.md`](./deferred/native-voice-input.md)。；来源：docs/deferred/native-voice-input.md
- [ ] **WISH-019 · 真终端（node-pty / xterm）** — 当前右坞是命令控制台，不支持 vim 等交互程序。；来源：Chat Right Dock 施工合同

## 灵感

- [ ] **WISH-020 · 设置：账号 / 隐私云同步 / 用量统计大盘 / 自动化工作流** — Alice 有，我方无后端；不得先做假入口。；来源：Alice 产品参考
- [ ] **WISH-021 · 侧栏 Wiki / 待办 / 定时应用模块** — Alice 应用区参考，需先确认是否符合我方产品 IA。；来源：Alice 产品参考
- [ ] **WISH-029 · 开源平台对外展示与开发者上手材料** — 建立官网或展示页，并完善 GitHub README、快速开始、架构图、截图、演示视频和示例 Agent，清楚说明平台定位、Runtime 与扩展层边界，让其他开发者可以低成本判断项目是否适合二次开发。；来源：用户讨论 / 开源平台定位
- [ ] **WISH-030 · 产品与开发者平台多语言支持** — 为官网、GitHub 文档、安装引导、扩展开发文档和必要的产品界面建立可维护的 locale 方案；语言范围、翻译事实源和运行时选择机制需单独设计，不与 `WISH-015` 的 Prompt 多语言版本混为一项，也不在未定义术语体系前散落翻译字符串。；来源：用户讨论 / 开源平台定位

## 明确不做

以下不是待办，不得重新登记为工程欠债：

- OS 级 Shell 强隔离；
- Python 嵌入沙箱。

只有 DEC-037 的威胁模型触发条件变化时，才重新立项独立受限 Runner。
