# Debug 能力与历史证据补齐 v1

生命周期：已完成施工快照（冻结）
日期：2026-10-26

## 背景与目标

Debug 七组 26 页的展示回流已经完成，但展示真实来源不等于具有完整的行动历史。此次以现有生产链路为基础，补主动问候证据、行动记录及可关联的历史追踪；不重新设计全部页面，不把 Alice 的专属产品模块搬入本项目。

用户已同意“先盘点 → 复用记录关联 → 主动消息 → 行动历史 → 真实流程验收”的方向，并在合同落盘后明确“可以，继续干吧”，批准新增历史存储与回执机制。新 UI 状态仍按 Playground 确认后回流。上一份已冻结的 `debug-production-parity-v4.md` 不重开。

当前能力事实仍归对应模块卡；下表是本次施工的源码核对底稿，不作为另一份长期能力总目录。

## 开工时源码核对：26 页与补齐归属

导航事实源：`src/shared/debug-navigation.ts`。领域读取集中在 `electron/main/debug/companion-evidence.ts`；其余专用接口位于 `electron/main/ipc/debug.ts`。

| 页面 | 已有真实来源 / 执行边界 | 本次处理 |
|---|---|---|
| 提示词管理器 | `debug:model-context-assets` 聚合生产定义及来源 | 保持只读，不复制目录或补历史正文 |
| 今日日程 | `companion_day_scripts`；生活引擎生成计划 | 接受计划不等于执行，仅关联实际产生的行动 |
| 最近事项 | `companion_events` | 保留生活事件视角，不改成运行日志 |
| 行为日志 | 与最近事项同读 `companion_events` | **补运行行动来源**，保留生活事件来源 |
| 此刻 | `companion_role_state` 与生产 world codec | 保留当前快照，不伪造历史 |
| 人物档案 | Role Pack profile / 身份定义 | 不创建平行人物资料库 |
| 当前位置 | 当前世界的位置字段 | 不当作旅行历史 |
| 家居 | `companion_assets` 的 home / furniture | 既有资产与事件关联，不重做资产能力 |
| 足迹 | `companion_assets` 的 footprint | 不把地点 / 计划当作已出发；旅行扩展仍属原合同 |
| 成长与反思 | mutable、版本和 reflection 记录 | 已有结果保留，仅关联明确的运行标识 |
| 朋友圈 | moments 与用户互动表 | 发布事实不作问候送达证明 |
| 通讯录 | Universe relations 与明确共同事件 | 不推算无来源关系分数 |
| 主动消息证据 | query 明确返回 unsupported；生产已有 ticker → greeting → IPC → toast | **补决定、发出、呈现回执和失败记录** |
| 衣柜 | wardrobe 资产与当前穿着 | 不新增衣物或改换装规则 |
| 文化角 | culture / bookshelf 与笔记 | 不新增文化内容引擎 |
| 生活事件关联 | `companion_event_links` | 复用明确 ID，不按时间猜关联 |
| 上下文 | `llmLogsQuery / llmLogGet` 的保存结构 | 继续标明未保存正文，不能还原旧请求 |
| 用户画像 | 有界记忆来源摘要；非反馈资料沿既有全局范围 | 不把阅读摘要改成新画像写入器 |
| 用户记忆 | 所选人物与显式共享桶 | 存储不作召回证明；不改召回策略 |
| LLM 调用 | `llm-debug-store` 持久化元数据 | 复用现有 Span ID，不再造第二条模型调用记录 |
| 调用链 | tracer 内存最多 500 Span，IPC 返回最近 100 | **补按显式 ID 查询的有界持久历史** |
| 实时事件 | App 内最多 501 条摘要，无保存的会话 / Span 关联 | **补生产侧关联及关键事件历史**；不持久化文字流 |
| 技能与工具 | ToolRegistry、Skills、MCP 当前快照 | 定义 / 可用 / 实际使用继续区分，运行关联来自行动证据 |
| 系统状态 | 真实运行环境与配置聚合 | 保留快照边界，不新增配置写入口 |
| Skill 验收 | 已有报告与运行状态，只读阅读 | 不重复建设 Eval 执行器 |
| 人格验收 | 受控 Eval runner、报告与独立人工审阅 | 保留费用确认、取消和真实保存，不宣称真实模型质量已达标 |

这 26 页按施工处理归为：22 页沿用现有事实源，4 页需要新增或增强证据来源（行为日志、主动消息、调用链、实时事件）。这不是“22 个业务能力已全部完成”的结论。

## 关键发现及确定性边界

1. `companion/life/proactive-greeting.ts` 在 `maybeProactiveGreeting` 中先写 `companionProactiveGreetingLastDay`，后通过所有窗口广播 `companion:proactive-greeting`。`App.tsx` 订阅后只调用 toast，无回执。因此 `greeted: true` 只能证明函数走到广播返回，不能证明任何窗口已呈现。无窗口 / 广播失败时的实际行为还需复现，不直接宣称已经发生故障。
2. `activity` 与 `recent` 共用生活事件表，不能代表模型、工具、取消、权限等待等运行历史。
3. 系统并非没有落盘日志：`utils/logger.ts` 已有按日期写入与最近 7 个日志文件清理；tracer 结束也会写 debug 日志。但日志级别会影响输出，且现有 Debug 没有按稳定 ID 查询这类历史的接口。不能把扫描文本日志当作完整行动数据库。
4. tracer 已有 parentId、links、caller、等待 / 执行分离与 AsyncLocalStorage 上下文；LLM 也已有持久化 sink。复用这些身份与执行节点，不从 Renderer 摘要反推业务事实。
5. 新历史只能从启用后积累；旧空范围与未采样 / 未记录范围必须明示。正文持久化、记忆召回解释与新的人物行为引擎不是此次默认扩展项。

## 参考与方案选择

- Claude Code 参考：`_reference/framework-harness/repos/claude-code-sourcemap-main/claude-code-sourcemap-main/restored-src/src/utils/telemetry/sessionTracing.ts`，保留 interaction / operation 层级与等待时间分离。它依赖其自身 OTel 与 feature 配置，不直接移植整个遥测 SDK。
- Alice 参考：`_reference/framework-harness/repos/alice-methodology/chapters/13-observability.md`，采用结构化原因、caller、显式关联与默认不记录正文。此处是方法论参考，不能称为已核对 Alice 完整生产实现。
- 项目已有 tracer、trace-context、observer、LLM store 和领域事件表足以承载接入；新增本地只读历史投影，不引入云服务、额外依赖或每页一套数据库。

## 技术方案（已确认）

### 共同证据与存储

- 新增纯共享类型和主进程存储服务，记录稳定 `id`、`kind`、`occurredAt`、`status`、`reasonCode`、`processRunId` 及实际存在的 `roleId / sessionId / spanId / parentId / links / sourceEventId / momentId`。缺失身份留空，不从当前活跃人物、时间邻近或 UI 选择回填。
- tracer 生命周期和生活服务只发布结构化事实，由启动装配的 sink 写入；遵守 utils 不反向依赖 storage、agent 不 import ipc。是否成功与是否记录成功独立，写入失败可观测，不改主任务结果。
- 使用既有 SQLite 生命周期，正式初始化负责建表；Debug 读取不建表、不播种、不修复业务设置。参数化查询，角色 / 会话 / 日期 / 类型筛选，稳定 `(occurredAt, id)` 游标，默认 50、上限 100；指定 ID 不回退相邻记录。
- 建议初始上限：最近 7 天且总数不超过 20,000 条；单条序列化元数据最多 4 KiB，批处理和队列均有界。超限保留裁剪 / 丢弃计数与来源范围，不无声截断身份字段；不是保留无限历史的承诺。
- 只保存白名单元数据与原因码；不保存 Prompt、回复、隐藏推理、工具参数 / 原始结果、凭据或任意 attributes 对象。现有模型正文保存边界不变。
- 退出前尽力排空有界写队列；重启后未结束的记录标记为中断 / 结果未知，不伪装成功或实际取消。清理可重复，历史不加入人物设定或记忆。

### 主动问候闭环

- 每次允许提醒产生独立 attempt ID，绑定 role、moment、当地日期及 processRunId；同一 attempt 的状态单向推进，主进程处理状态竞争。
- 状态区分决定允许、已发出、界面呈现、无接收窗口、发出失败及未确认；`presented` 只表示应用内提示组件实际呈现，不代表用户看见 / 已读。
- 回执经白名单 IPC 到达主进程，校验发出记录、接收窗口归属和一次性 attempt，拒绝伪造、重复改变结果和其他窗口代报。保持四处类型同步。
- 按人物与当地日期做限次与并发保护，勿扰 / 静音 / 关闭 / 无新动态均保留原因；未提醒原因按人物、日期与原因变化聚合，不每 5 分钟无限追加相同记录。
- 每日消费语义：无有效接收窗口时记录未发出，不占用当天发送名额；有窗口时先原子登记该人物当日 attempt 与发送保留，再广播。已保留后即使发送失败、回执缺失或进程崩溃，当天也不自动重发；呈现回执不释放名额。每天最多一个发送 attempt，跨人物独立；UTC 存时间戳，当地日期沿现有 `toLocalDateString` 语义，不在此顺手更换时区策略。
- 不因为缺回执就自动重发；本次不新增重试按钮或系统通知。无窗口、发送失败、崩溃恢复和并发 tick 必须测试上述语义，不把确认呈现直接等同允许重复打扰。
- 不改变默认关闭、静音和勿扰策略，不调用新模型，不写用户会话。

### 行动历史与关联

- 行为日志提供运行行动和生活事件的明确来源区分；运行行动复用 interaction、工具、压缩、后台生活推进等实际节点，并能进入同 ID Span / LLM 调用 / 生活事件。
- 实时事件保留现场阅读，新增关键生命周期的生产侧身份；文本 / thinking 流不按 token 落盘。运行历史和实时窗口是两个有明确范围的视角，不把历史伪装为实时。
- 调用链保留已有内存快照，同时读取存储历史；父级已过期、未采样、孤立 links、运行中断均保留未知，不按时间或展示顺序补树。
- 所有 UI 新状态先落 Playground 隔离故事格。只改必要页面，沿用已经批准的字体、页头、短目录和渐进展开；新布局确认后再回流。

## 影响范围与不做项

拟涉及：`electron/main/utils/{tracer,observer,trace-context}.ts` 的必要发布接口、启动装配、`storage/` 新历史服务、`companion/life/{ticker,proactive-greeting,engine}.ts` 的实际证据节点、`ipc/debug.ts` 与必要的 companion 回执入口、preload、共享类型、`vite-env.d.ts`、App 的接收关联，以及四页正式容器 / Playground 与对应测试。

最终路径以完整调用链确认后为准；改动前读取最新文件。工作区已有终端、记忆索引、沙箱、模型 thinking 等未提交改动，本合同不认领、不覆盖、不混入提交；共享文件有冲突先核对实际差异。

不做：重做全部 UI、迁移旧正文、主动聊天生成器、系统通知 / 外部渠道、无人值守重试、完整事务审计、记忆策略改造、旅行 / 家居 / 文化角新引擎、引入 OTel 后端。主动问候此次仍是已有应用内提示，不包装成自动写入聊天的消息。

## 实施顺序与独立验收

1. **盘点与合同**：核对 26 个导航、真实来源及上述关键执行点；合同确认后才新增生产能力。
2. **共同历史机制**：生产节点 → sink → SQLite → 重启查询；覆盖分页、相同时间、按 ID、作用域、资源上限、敏感数据拒绝、写失败与中断恢复。完成后可独立查询实际历史，不以空函数或假数据交付。
3. **主动问候**：端到端跑通允许 / 发出 / 呈现及未发送原因。真实 Electron 验证无窗口、重复 tick、多窗口、回执伪造、失败和重启后的限次语义；不运行付费模型。
4. **四页证据接入**：Playground 默认、边缘和失败态确认后，正式页与故事格同轮更新；从历史行动到显式 Span / 调用 / 生活来源可往返，缺来源不替代。
5. **收工**：自审后依次 Unit、标准类型 / 构建、相关 UI / 真实 Electron、资产和文档门禁；模块卡吸收稳定事实，合同冻结，分独立可回滚批次 commit + push。

## 风险与权衡

- 诊断写失败不应中断 Agent，但不能因此标记“已完整记录”；读取要说明历史缺口。
- 观察回执不能证明用户阅读；每日限次与投递状态不能混成一个布尔值。
- 全量 Span 原 attributes 可能含文本，必须白名单投影，禁止直接序列化迁入历史表。
- 这是有范围、有资源上限的关键行动历史，不声称覆盖每个内部函数或完成全产品能力。

## 盘点交付记录

源码静态核对已完成；本轮不新增生产接口、数据库表、调度行为或视觉状态。新增持久化、回执和四页接入仍未实施，也没有以此前 UI / Electron 测试替代本合同的新能力验收。

文档交付自审：逐项核对导航、只读查询、主动问候发送 / 接收、tracer 与日志保存边界，无生产代码改动。标准类型检查通过；全量 Unit 首次因正在运行的开发服务占用 5173 导致两项 watch 测试失败，停止该开发服务后 232 文件 / 1485 项通过（`var/verification/debug-capability-inventory-unit-recheck.log`）；`npm run build` 通过（`debug-capability-inventory-build.log`），`npm run docs:validate` 与暂存差异格式检查通过。本轮没有新 UI，不以这些检查宣称新能力验收通过。

## 共同历史机制批次

范围：正式 schema v19、Tracer 白名单投影与启动 sink、有界队列 / SQL 存储、`debug:history-query` 四处契约和对应测试。运行角色只来自实际装配的 character，并通过 TraceContext 传播；没有从当前 UI 选角回填。保留原 Span / LLM sink 与最近快照，不替换已存在的诊断行为。

可独立查询的历史仅包含 Span 投影和 start / end 事件，最多 7 天 / 20000 条 / 单条 4 KiB / 队列 512；分页默认 50，上限 100。无生产界面变化，四页仍读原来源；主动问候独立证据、回执、生活推进关联与新状态候选继续施工，不以此批次宣称整个合同完成。

批次验证：233 文件 / 1499 项 Unit、标准类型 / 生产构建通过；真实 Electron 在隔离 profile 沿本地 SSE → 生产 Span → SQLite → preload 查询核对同 ID 元数据，完整重启后按记录 ID 回读一致（`var/verification/diagnostic-history-{unit,build,electron}.log`）。测试不访问付费模型，不证明新 UI 或提醒送达。

独立 Node 配置仍有既有诊断，不宣称全绿；编译器 overlay 对照本批改前 / 改后均 69 项、无新增（`var/verification/diagnostic-history-node-comparison.json`），`tsconfig.node.json` 已纳入新增共享历史类型。自审覆盖查询参数化 / 游标范围、列与 JSON 作用域一致性、白名单与凭据拒绝、资源上限、事务归属与重启中断；既有原始 Trace、LLM sink 与页面读取不删除。


## 四页回流许可证与施工记录

用户在 Playground 截图复核后明确回复「可以，按这版回流」，批准行为日志、主动消息、调用链和实时事件采用简洁时间线、单条详情、来源折叠；问候区分未发出、发出、呈现与未确认，不作已读证明。来源为既有 Debug story 的显式「能力补齐样张」，稳定导航身份仍为 activity / proactive / traces / events。

生产落点：DevPanel → SavedEvidencePanel → HistoryEvidenceReading / ProactiveDeliveryReading；真实读取分别来自 debug:history-query 和 companion:proactive-evidence-query。生活事件、当前内存调用链与实时窗口仍保留；样张、场景控制器、虚构 ID 和首次失败开关留在 Playground，不进入正式页。

本批替换正式主动消息的旧 unsupported 阅读入口和对应测试断言，原因是已有独立投递索引；通用旧领域接口仍明确指向专用接口，不再声称系统没有索引。行为日志的生活来源提示同步改为双来源说明，原生活查询 / 搜索 / 详情不删除；测试覆盖新时间线与真实查询，不再验证过时的「无独立源」界面。本合同收工结果见下节，稳定事实已吸入模块卡与架构文档。

运行与投递阅读登记为 experience 组件 developer.saved-evidence，复用已有 Foundation；没有新增基础控件或 Foundation story。旧 developer.proactive-evidence 转为 deprecated，保留显式历史对照；正式体验来源与证据路径同步登记，资产审计与生产运行链分别核对。


## 完工验收与边界（2026-10-26）

四页按已批准样张回流，原生活事件、当前内存调用链和现场缓存保留；新增保存历史、主动问候索引、真实生活发布关联及来源往返均进入生产链路。未知 / 缺失 / 首次失败不补零、不替代目标，刷新旧快照保留，呈现不作已读证明。默认关闭、静音 / 勿扰、无窗口不消费、预留后不自动重发的边界未扩大；没有新增模型请求、系统通知或用户会话写入。

回流映射：既有 Debug story / activity、proactive、traces、events → DevPanel / SavedEvidencePanel → 既有共享 Foundation 组合与新纯阅读层 → 两个只读 IPC。虚构记录、状态开关与旧版对照留在 Playground。新阅读组件 developer.saved-evidence 进入 adopted，旧边界组件 deprecated；生产投递常量直接注册为 companion:policy:proactive-delivery。

最终自审核对 IPC 四处契约、SQL 参数化与游标归属、资源上限、落盘前预留、nonce / frame / 窗口归属、导航撤销、隐藏与卸载不报告、单向终态和重启恢复。另修复队列 flush 前重复结束可覆盖首个终态的问题，超限损坏行在 JSON 解析前拦下；负例测试通过。无新增依赖，无 Prompt 正文或凭据持久化。

验证证据：235 文件 / 1515 项 Unit 通过；离线 Mock Eval 23 项和 Skill Eval 1 项通过；标准类型与生产 build 通过。Debug 最终专项 UI 40 项通过，覆盖四页能力样张、正式分页 / 失败 / 人物隔离、旧快照阅读及综合导航（debug-evidence-ui-final.log）；其他 Debug 页的扩大回归保留原日志。真实 Electron 全导航与审阅 2 项、问候闭环 1 项、本地请求到历史且完整重启回读 1 项通过（debug-evidence-electron-final.log 中前两项、debug-proactive-electron-probe.log、debug-history-electron-recheck.log）。问候测试验证实际隐藏窗口、额外未登记窗口、真实 Toast 回执、来源动态往返、并发 tick 和重启后的同条记录 / 名额，不依赖付费模型。

额外 Node Compiler 对照改前 / 改后 69 项既有诊断且无新增，保留 WISH-043；根类型通过不等于该存量债已清零。扩大全仓 UI 时复现范围外的旧标题 / 状态切换 / 刷新按钮用例失败，经 HEAD 前端源码覆盖构建逐类复现后停止重复主题排列，保留 WISH-042，未宣称 682 项全绿。依赖审计全量 23 / 生产 15 项风险归 WISH-044，不在本合同顺手升级依赖或改范围外 UI。

稳定能力、边界与必测点已吸入 companion / agent-runtime / memory 模块卡、architecture、quality；文档和资产门禁按最终暂存内容验证。该快照只保留本次 Why / What / How 和验收，今后能力变更回到模块卡维护。
