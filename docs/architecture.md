# 系统架构

## Agent Host 契约骨架（2026-11-13）

新增 `src/shared/agent-host.ts` 定义 Agent Manifest、Domain、Capability、Context Provider 和执行作用域。主进程 `electron/main/agent-host/` 提供 Domain Registry、Capability Registry 与 Application Orchestrator，当前注册 Persona、Memory、Companion、Workspace 四个首批 Domain，Companion 提供 Runtime Read Model Context。Tool、Skill、Workflow 的边界由施工合同 `agent-host-architecture-v1.md` 固定，现有 Agent Loop、Tool Registry、Skill Registry 和 Permission Engine 继续作为执行基础。

主角主会话通过 `getAgentHostContext` 获取已授权 Context Provider，召唤和 Workspace 会话不注入主角动态上下文。Provider 失败保持原 Prompt 装配并记录结构化告警。

首批查询 Capability 通过 `registerAgentHostTools` 注册为 `capability_*` Tool，执行上下文从当前 ToolContext 取得 roleId。后续按 Agent Manifest 收窄 Tool 可见性，不复制第二套工具执行链。

当前会话在 Runtime 的 `filterTools` 阶段根据 role 对应 Manifest 再筛选 `capability_*`，Skill 的 `allowed_tools` 继续在同一过滤器内叠加，未授权能力不会进入模型请求。

该筛选已提取为 `AgentHostScopedToolCatalog`，全局 ToolRegistry 只保存实现，Scoped Catalog 负责生成当前会话可见目录。

固定业务流程通过 Application Orchestrator 的 `runWorkflow` 进入 `kind: 'workflow'` Capability，LLM 只通过 Tool Adapter 选择已授权的 query / command Capability。

朋友圈发布 Workflow 复用既有 `companion_post_moment` Tool 的执行实现，继续沿角色校验、命令网关、领域事件和 Moment 投影链路写入。Host Capability 只提供统一编排入口，不复制朋友圈业务规则。

日记生成 Workflow 复用 `triggerInnerThought` 生活引擎入口，固定生活推进和 LLM Tool 都进入同一日记事实链路。

生活推进增加 `companion.life.tick` Workflow Capability，固定 Scheduler 通过 `runCompanionLifeTickWorkflow` 进入 Host Application，再复用 `tickActiveRole` 生活引擎实现；生命周期能力不进入 LLM Tool Catalog。

`companion.life.tick` 标记为 `exposeToTool: false`，只允许固定生命周期入口调用，不把生活时钟控制权交给 LLM。

Debug Model Context 目录现在聚合 Agent Manifest 与 Capability 状态证据，状态来自 Host Registry 和实际激活记录，分别标记 Registered、Available、Activated。

Workspace 的项目路径、最近主对话和当前焦点内容现在由 `workspace.context` Provider 统一注入，Runtime 不再同时拼接第二份 Workspace Prompt。Provider 以 `scope + source` 去重并按优先级选择事实来源。

## 2026-11-13 可靠性收口

人物世界核心写入现在通过 `withCompanionUnitOfWork` 复用数据库事务协调器，建表在事务外完成，领域事件、业务事实与 Outbox 写入在同一事务内提交。Outbox 采用 `claimed_at` / `lease_until` 租约，过期 processing 会被下一轮恢复，失败使用 `next_attempt_at` 退避重试，投递语义为至少一次，消费端必须幂等。

对话完成后的伙伴生活结算由 `conversation-application-service.ts` 负责，Agent Runtime 只保留会话生命周期和 Loop 编排。Chat、Session 与 Companion 的特权 IPC 入口统一经过主框架来源校验，图片读取入口继续保留异步期间的导航复核。sql.js 当前通过 `npm run bench:database` 建立插入与全量导出基线。

## 人物世界核心层（2026-11-12）

人物世界采用模块化单体内的领域核心。IPC、Chat Tool、LifeTicker 和 Debug 逐步转为 Command Adapter，核心层维护 `companion_runtime_state`、`companion_domain_events`、`companion_execution_runs` 和 `companion_outbox`。`core/commands/gateway.ts` 统一 active role 校验、命令执行账本和 retryable 失败记录，人物世界主要写入 IPC 已经经过该网关。朋友圈、日记、信物、关系和 Prompt 读取面作为投影迁移，旧生活表在迁移期只作为镜像读模型。

当前首批核心落点：

- `electron/main/companion/core/state/runtime-state.ts` 统一人物当前运行态快照，并镜像到既有 `companion_role_state.world_json`。
- 运行态 delta 支持 `expectedVersion` 乐观并发校验，过期写入直接拒绝，不覆盖更新后的状态。
- `electron/main/companion/core/events/domain-events.ts` 提供领域事件幂等写入与因果字段。
- `electron/main/companion/core/execution/ledger.ts` 提供动作执行状态和失败信息记录。
- 执行账本支持 `idempotency_key` 与 `result_json`，重复命令复用第一次结果，运行中的同键命令拒绝并发执行。
- `electron/main/companion/core/projections/receipts.ts` 提供 `projection_name + event_id` 的幂等投影回执，迁移期用于约束旧生活读模型重试。
- `electron/main/companion/core/read-models/runtime-read-model.ts` 是 Prompt、Debug、人物入口和自动配图共享的运行态只读边界。
- `electron/main/companion/core/outbox/outbox.ts` 提供去重通知出站记录。
- `electron/main/companion/adapters/window-outbox-dispatcher.ts` 是 Electron 窗口投递适配器，负责领取 pending/failed 消息、成功标记 delivered、失败保留 failed 并等待下一轮重试。
- `electron/main/companion/adapters/session-outbox-dispatcher.ts` 消费 `main-session-message`，按消息 ID 幂等写入主会话；窗口通知和主会话留痕使用独立消费器。
- 窗口不可用时投递器不会把消息误标为 delivered，Outbox 保留失败状态等待下一轮窗口恢复后重试。
- `chat-resonance.ts` 的文化体验完成链路已写入核心事件、执行账本和 Outbox。
- 文化体验完成已把旧文化读模型的消费写入投影回执，重复重试不会重复登记同一领域事件。
- 日程 / 朋友圈投影已先登记 `life_event_published` / `moment_published` 核心事件，再写旧 Moment、关系、情绪和事件关联读模型，并以投影回执防重复消费。
- 赠礼与信物馈赠已写入核心领域事件并通过 Outbox 投递；`ticker.ts` 每轮生活推进后统一消费窗口通知。
- 主动搭话、脆弱心境、日记、深夜反思、换装、旅行、日内重排、朋友圈评论回复、宿主关怀和朋友圈轻提示已改为由核心事件记录器生成事件并进入 Outbox，生活服务不再直接向窗口广播这些领域通知。
- Chat Tool 的发朋友圈、朋友圈评论、阅读笔记和生活资产写入已通过命令网关，Chat 与 IPC 共享 active role 校验和执行账本。
- LifeTicker 每个生活动作也通过命令网关记录独立执行账本，失败不会与同轮其他动作混淆。

深夜反思与高光回忆重温架构（2026-11-09）：
- 深夜反思与心灵领悟流：`nightly-reflection.ts` 在深夜时段（22:00～04:00）结合今日生活事件与近期用户对话线索，经 20 小时冷却（每日上限 1 次）由受控配方 `compileNightlyReflectionRequest` 生成第一人称深夜反思；
- 数据模型与记忆闭环：随笔写入 SQLite `companion_inner_thoughts`（`thought_type: 'nightly_reflection'`），提炼出的心灵感悟（`epiphany`）同步调用 `addMemory('feedback', ...)` 存入长期记忆的“我们之间”分桶；广播 `companion:nightly-reflection-created`；
- 高光回忆重温引擎：`nostalgia.ts` 在主会话提示词装配前夕（`orchestrator.ts`）检索沉淀记忆（feedback 深度默契、专属信物、深夜领悟），经 4 小时冷却保护挑选一条高光切片，注入 `formatConversationImpulseForPrompt` 作为【高光回忆羁绊】生活切片话头，引导角色在闲聊时像真人老友一样自然带出过去共同经历；
- 前端呈现与双向连通：`WorldJournalPanel` 使用日记封面与信件式详情展示正文，日期、地点和心情收在日记本内容中，保留删除与「与TA聊聊」入口；Playground 只覆盖清单、详情、长文、空态和读取失败等通用状态。

人物世界能力边界（2026-11-11）：日记的公开 IPC 只提供读取、删除和引导聊天，手动创建与收藏切换不再暴露给 Renderer；内部生活引擎仍可生成日记，历史收藏字段只作为内部连续性数据保留。

人物写入角色隔离（2026-11-11）：手动生活写入统一由 `companion.ts#requireActiveWriteRole` 在主进程核对当前 activeRole，Renderer 的旧 roleId 不能跨切换写入赠礼、信物、旅行、关怀、重排或反思事实。

生活服务提交边界（2026-11-11）：手动与 ticker 生活服务在模型等待后再次核对 activeRole，确保生成阶段发生切角时不提交旧人物的信物、安慰、关怀、重排和旅行事实。

生活结果失败恢复（2026-11-11）：赠礼、信物和脆弱安慰将主会话留痕作为 `main-session-message` Outbox 消费，消息写入失败时保留失败状态，不发送成功广播。

主动搭话失败恢复（2026-11-11）：主动消息先进入主会话 Outbox 与主动行为历史，任一投递失败都不标记为成功通知，消息 ID 保证重试幂等。

工作区持久化与跨会话协同架构（2026-11-09）：
- 工作区会话持久模型：`sessions` 表扩充 `parent_session_id` 列（schema 25），`getOrCreateWorkspaceSession` 将工作区侧聊与宿主主会话一对一绑定并建立索引；组件折叠、隐藏或视图切换时不销毁会话，保留工程讨论全过程；
- 会话生命周期与隔离：切换主会话时，工作区右坞根据新的 `activeSessionId` 自动无缝切换对应侧聊上下文与变更审阅；主会话列表（`listSessions`）过滤排除 `session_kind = 'workspace'` 避免侧聊混淆；
- 工作区到伙伴直通连通：`ChatRightDock` 接入统一 `onTakeToChat` 动作链并下发至 `ReviewPanel`（审阅代码变更一键与伙伴聊聊改动）与 `TerminalPanel`（构建成功一键与伙伴分享好消息），打通工程任务与伙伴人设陪伴。

足迹与航海旅行自主演化架构（2026-11-09）：
- 航程自主推进机制：`travel-progression.ts` 结合角色航行时间积累（24小时冷却）与主会话共鸣沉淀的 `travel_wish`，自动调度演化千里阳光号航线新经停站点；
- 数据模型与持久化：站点写入 SQLite `companion_travel_progressions` 表，并向当前 active trip 资产（`sunny-current-route`）原子追加包含站点名、日期与第一人称见闻故事的 `TripStopRecord`；
- 心愿与提示词感知联动：若存在对应的 `travel_wish` 心愿，自动更新为 `completed`；`formatLifeAssetsSliceForPrompt` 实时抓取最新到访站点注入主会话；
- 广播与通知体系：`companion:travel-progressed` 全局广播，前端支持 Toast 提示航程拓进。

同伴求助与生活共同决策架构（2026-11-09）：
- 共同决策数据模型：`co-decision.ts` 管理 `companion_co_decisions` 表，每个角色同一时刻最多 1 个待决项（pending）；
- 即时第一人称回响：用户决断后，由 `coDecisionReaction` 模型配方生成生动第一人称回应（或高质量预设保底），作为 assistant 消息直接存入主会话并触发 `companion:co-decision-resolved` 广播；
- 次日剧本因果闭环：`getRecentResolvedCoDecision` 与 `markCoDecisionAbsorbed` 联动 `script-generator.ts`，将用户抉择深度注入次日剧本上下文，真实左右角色次日探险与生活轨迹；
- UI 边界：共同决策不再作为人物世界、Playground 或 Renderer IPC 的独立能力展示，`co-decision.ts` 只作为生活因果链内部能力，由既有主会话与次日日剧本链路吸收。

衣柜与穿搭自主演化架构（2026-11-09）：
- 生活时钟自主调度：`LifeTicker` 在定时推进生活时唤起 `checkAndPerformContextualDressing`（`autonomous-dressing.ts`），结合日剧本主题/活动槽位、清晨起床 routine 与衣柜资产匹配目标穿搭；
- 原子换装与数据一致性：严格调用既有 `changeWardrobe` 事务，保证槽位校验、版本原子递增与配图同步沿用；
- 门控与优先权保障：每日上限 2 次、冷却 4 小时、近 2 小时用户手动换装绝对保护；换装写入 `companion_autonomous_dressings`；
- 事实感知与多端广播：通过 `companion:timeline-updated` 与 `companion:wardrobe-changed` 广播驱动前端衣柜画廊静默刷新，`formatLifeAssetsSliceForPrompt` 保证主会话实时感知当前穿着。

会话到生活因果反哺架构（Chat to Life Resonance，2026-11-08）：
- 主对话结束钩子：`AgentRuntime` 在主会话（`sessionKind === 'main'`）结束后异步调用 `settleChatResonance`，分析近期对话中的具体文化推荐、美食或生活向往；
- 意向抽取与自动播种：由 `compileChatResonanceRequest` 签名签发并由辅助模型分析提取，文化类意向自动调用 `createAsset` 在文化角创建 `planned`/`queued` 状态的待体验物什，意向全量存入 SQLite `companion_life_resonances`；
- 日剧本因果闭环：`script-generator.ts#collectDayScriptLifeContext` 读取活跃心愿作为次日剧本输入，并更新状态为 `absorbed_in_script`，让聊天中提到的话题真正出现在角色次日日程中；
- 文化心愿体验闭环与主动反馈：`ticker.ts` 动态生活推进或定时轮询时调用 `checkAndProgressAbsorbedResonances`，通过 `compileCultureReviewRequest` 生成第一人称评语与下次对话引子（`chatOpener`），文化资产推进至 `finished` 并将感悟追加至 `readingNotes`；待反馈引子注入 `formatConversationImpulseForPrompt`（插槽 31），主对话送达后调用 `markResonanceFeedbackDelivered` 标记投递，并广播 `companion:resonance-completed` 通知；
- 突发生活意图与主动找聊（Spontaneous Impulse）：`ticker.ts` 结合体征（`socialNeed >= 70` 或 `energy >= 80`）与活动，经 `decideSpontaneousImpulse` 规则门控（每日最多 2 次、冷却 3 小时、避开勿扰时段），通过 `compileSpontaneousImpulseRequest` 生成即兴搭话消息；主动消息经 `main-session-message` Outbox 写入角色主会话（`sessionKind === 'main'`），并经窗口 Outbox 广播 `companion:spontaneous-impulse` 通知，前端支持 Toast 一键直达会话与即时无感渲染；
- 私密内心独白与日记（Inner Thoughts & Private Journal Stream）：构建角色私密内心记录流（SQLite `companion_inner_thoughts` 表）；`ticker.ts` 结合夜间/清晨时段与生活状态，经 `decideInnerThought`（每日 2 次、冷却 6 小时）通过 `compileInnerThoughtRequest`（或保底）生成第一人称私密随笔；出厂自动为路飞播种 3 篇具情感羁绊的 starter 日记；`WorldHub` 新增 `journal` 分区（`WorldJournalPanel`），使用封面与详情两层阅读，支持实时广播更新、删除和一键将日记契机回引至主对话（「与TA聊聊这篇日记」）；
- 羁绊深度跃迁与专属信物馈赠（Relationship Progression & Keepsake Gifts）：构建实体信物承载流（SQLite `companion_keepsakes` 表）；跨越关键里程碑或完成共同心愿（`completeCultureResonance`）时由 `relationship-keepsake.ts` 驱动赠送专属信物，通过 `compileKeepsakeGiftRequest` 生成真情实感第一人称赠礼寄语直写主会话，记录 `keepsake_gifted` 关系里程碑并广播 `companion:keepsake-gifted`；出厂为路飞播种首件信物「生命卡的一角」，`WorldHub` 新增 `keepsakes` 分区（`WorldKeepsakesPanel`）支持高光展示与触摸信物直达会话；
- 实时通知与跳转：心愿入库后通过 `companion:life-resonance-created` 广播给渲染进程，前端 Toast 提供一键跳转文化角查看。

朋友圈回复互动与人物/NPC 自主回复决策架构（2026-11-08）：
- 评论回复数据链：`companion_moment_user_interactions` 扩展 `reply_to_actor_name` 列与 `actor_type=cast` 支持；用户可直接评论动态，亦可回复在场 NPC（如索隆）或现有回复；`mergeMomentComments` 支持递归解析回复目标人物；
- NPC 自主回复决策：`moments.ts#addMomentCommentForRole` 在保存用户评论后，结合动态上下文、在场卡司名册（`buildRosterLines`）与已有评论历史，调用 `moment-reply` 提示词让在场人物自主决策是否回复（`shouldReply`）、由哪位在场角色回复（`responderId`/`actorType`）以及回复延迟时长（`delaySeconds: 5..60`，不写死）；
- 异步延迟调度与事件广播：当 NPC 决策延迟回复时，通过异步定时器挂载任务，在延迟到达后持久化回复，并通过 `companion:moment-updated` 事件广播通知前端，`MomentsPanel` 监听事件无感增量刷新；`App.tsx` 在非活跃时记录 `unreadMomentsCount`，在 `PrimarySidebar` 的底栏「人物世界」入口与 `WorldHub`「朋友圈」Tab 呈现未读徽标与提示，支持 Toast 点击直达朋友圈，进入朋友圈后自动清零。

今日生活轨迹与生活面会话连通架构（2026-11-08）：
- 今日生活轨迹聚合：`companion/life/timeline.ts` 提供 `getTodayTimelineForRole`，结合当前时间推算今日各时间槽状态（past / current / upcoming）、当前进行中节点与已发布朋友圈动态，通过 IPC `companion:get-today-timeline` 提供给前端 `WorldTodayTimeline` 组件展示；
- 生活面直通主会话：`WorldHub` 朋友圈（`MomentsPanel`）、文化角（`WorldCultureGallery`）与旅行足迹（`WorldTravelGallery`）支持一键「聊聊 / 和TA聊聊」，自动切入 Chat 并在输入框填入结构化引用话题；
- 消息流自主生活卡片：`ToolCallbackList` 捕获 `companion_post_moment` 与 `companion_create_asset` 工具完成态，内联渲染生活动态卡片与直达链接，打通模型自主生活与前端视觉呈现；
- 时钟事件动态对齐与轨迹实时流转：`ticker.ts` 结合接下来 planned 事件 scheduledAt 动态推算唤醒延迟（`getNextPlannedEventDelay`），在事件落地与推进后通过 `companion:timeline-updated` 广播通知；`WorldTodayTimeline` 结合事件广播与每分钟心跳定时器动态驱动节点状态更新。

日剧本因果流与主动问候入会话架构（2026-11-08）：
- 跨天因果日剧本：`script-generator.ts` 聚合前日已发布事件、当前旅行足迹、生命体征与近 24 小时主会话用户诉求，注入辅助模型日剧本规划提示词，确保日程编排具备真实因果连续性；
- 主对话交谈冲动：`orchestrator.ts` 根据角色生活见闻与社交体征萃取 `conversationImpulse` 并经 `AgentRuntime` 注入主对话模板（插槽 31），实现闲聊场景下角色自然引出自身生活叙事；
- 主动问候入会话：`proactive-greeting.ts` 在投递通知时调用 `session-store.ts` 的 `ensureMainSessionForRole`，将问候文案持久化为角色专属主会话的 `assistant` 消息；事件载荷携带 `sessionId`，前端 Toast 触发一键导航直达会话。

生活体征与切片装配架构（2026-11-08）：主对话装配管线由 `AgentRuntime` 读取 `companion_life_assets`（穿着、在读在看在听文化活动）及核心运行态中的进行中旅程，通过 `formatLifeAssetsSliceForPrompt` 有界切片注入 `situation.lifeAssetsSlice`；对话流式响应完成并在主进程安全落地后，调用 `settleVitalsAfterChat` 结算角色体力消耗与社交满足度，写入 `companion_runtime_state`，迁移期同步镜像到 `companion_role_state`，与朋友角色的召唤会话不产生主角体征结算。

出厂静态视觉备份边界（2026-11-07）：`ipc/data-export.ts` 通过 `companion/life/assets.ts` 的 `isStarterVisualImage` 识别与 Role Pack `visualPath` 摘要一致的出厂静态图片，导出 JSON 时仅保留 `visualPath` 而不打包进 `generatedImageMedia`；导入时通过 `restoreStarterVisualPayload` 从本地 Role Pack 重新物化受控图片引用，用户重新生成的资产配图仍走完整 base64 媒体备份与恢复链路。

类型检查边界（2026-11-07）：Renderer 与主进程分别由根 `tsconfig.json` 和 `tsconfig.node.json` 检查；`typecheck` / `build` 强制执行两套检查，主进程、Eval 与共享源码不再依赖隐式 include。

材料观察与阅读写回（2026-11-07）：图片材料沿 `companion_observe_material` → 注册多模态 Prompt → 候选 observation / inference / uncertainties → `companion_add_reading_note` 明确写回进入人物 `bookshelf` 资产；观察工具不持久化图片事实，尝试状态写入独立有界证据表，写回沿当前 role、来源、confirmation 和 `world-records` schema 校验，Debug / 反思只读同一结构。

阅读笔记来源边界（2026-11-07）：书架 `readingNotes` 属于人物生活资产，写入沿 `companion_add_reading_note` 的当前 role 校验和 world-records schema；记录者与来源范围随资产保存，不进入用户长期记忆。

自动配图状态一致性（2026-11-07）：生活层从 `companion_runtime_state` 读取图片描述所需的当前地点、活动和叙事心情，与 Prompt / Moment 使用同一事实源；图片服务不写回新的世界事实。人物入口和 Debug 世界态也读取该核心快照，旧 `world_json` 只由核心写入镜像。

状态量化边界（2026-11-07）：运行态保留有界数值供 Debug / 计算使用；人物世界头部以本地 UI 状态切换“描述 / 数字”，数值不进入设置写入、权限决策或用户长期记忆。

情绪事件幂等（2026-11-07）：生活投影在 `companion_emotion_events` 写入前按 role / source event 去重，保留无来源手动事件，不新增跨层依赖。

关系事件历史（2026-11-07）：`companion_relationship_events` 保存生活事件到关系变化的可追溯边，`companion_relationship_state` 仍是当前快照；两者按 role 隔离，Debug 只读投影。

自主配图幂等（2026-11-07）：生活层在生图请求前查询 `companion_moment_media_attempts` 的人物 / 事件键，成功复用或终态跳过；媒体表、事件事实与动态投影边界不变。

伙伴策略正式设置（2026-11-07）：正式 Settings 仅暴露已存在的 companion 设置字段，Renderer 通过既有设置保存桥接写入；没有新增 IPC、存储表或跨层依赖。

朋友圈可见窗口（2026-11-06）：Renderer 仍通过设置入口保存用户边界；主进程 `companion:get-moments` 读取当前角色关系阶段后调用 `moment-visibility.ts` 过滤动态，Debug 世界态沿同一函数展示实际窗口。未新增跨层依赖或第二份生活事实源。

## 用户人物草稿边界

运行时人物制作 Skill 通过 `tools/builtins/companion-character-draft.ts` → `companion/authoring/draft-store.ts` 保存用户数据目录中的草稿；草稿与仓库内置 Universe / Role Pack 分离，模型不能绕过工具确认直接覆盖内置资产。发布和世界观切换必须经过主进程校验与明确确认，不能由普通草稿更新直接改变 `activeRoleId` 或 `universeId`。

审阅发布后，`draft-store` 以同一 Universe loader 形状写入用户 `universes/`，并为角色生成带 Universe 前缀的内部 ID，规避当前运行表按 `role_id` 分桶的碰撞。`companion_switch_universe` 经 Companion orchestrator 校验、暂停 / 恢复与设置回滚后切换；正式 UI 和完整历史隔离门禁仍未完成。

人物工具使用 `resolveMetadata` 按 action 动态解析权限：整理草稿 / 查询世界观保持非破坏性，发布和切换显式进入确认路径，避免把整个 Skill 的普通资料采集误判为写入操作。

角色架通过 preload → `companion:switch-universe` → orchestrator 读取与切换世界观；Renderer 只消费清单和结果，不直接修改设置或拼装人物事实。

## Chat 生活互动工具数据流

Chat 的 `companion_comment_moment` 与发布、资产工具一起由 `tools/builtins/index.ts` 注册；工具从 `ToolContext.roleId` 取得当前人物，不接受调用方指定人物。评论请求进入 `companion/life/moments.ts` 的正式服务，先校验动态角色并保存用户互动，再按已注册的 `moment-reply` 配方尝试主角回复；失败只保留用户评论。WorldHub、Debug 和 Chat 读取同一生活存储，不产生第二份动态或互动事实。

## 主动问候证据与生活追踪

数据库 v20 新增 companion_greeting_days 名额与 companion_greeting_evidence 元数据索引，启动恢复旧进程未确认投递；只读查询不创建或修复表。主动问候经策略判断 → 同步事务预留并落盘 → 登记窗口定向 IPC → Toast 可见 DOM → 主 frame / nonce 校验 → 呈现证据。缺回执不释放名额，无窗口不消费。原始提醒、nonce 与任意内容不持久化。

生活 tick 在解析真实主角且未暂停后创建 Span，发布节点沿明确父 ID 保存事件与动态身份；后台关联不借 UI 活跃人物补齐。工具 / 模型仍沿已有 tracer 发布，utils 不反向依赖 storage。will-quit 在首个 await 前停止投递回执并尽力排空有界历史，未确认结束的任务下次标中断。

## Debug 的只读数据边界

调用链沿 `tracer → debug:traces → preload → TracesEvidenceContent → TraceReading` 读取有界内存快照；`src/shared/debug-traces.ts` 统一已有 Span / links 和统计传输形状，handler、preload 与渲染声明共用该契约。树只依显式 parentId，links 是独立因果关联，统计不按当前可见树重算；持久化请求仍按 llm_request 的同 Span ID 进入现有 LLM 日志接口，请求正文边界保持独立，保存历史沿下述元数据链路读取。

系统状态通过共享摘要 / 分区阅读显示 `systemInfo`，技能工具由 `tools` 与 `systemInfo` 的 Skill / MCP 投影分别组成能力记录。读取失败按来源反馈，不因系统聚合失败而清空工具注册表；调用链概览的错误只进入折叠概览，不覆盖其他系统来源。

上下文由正式 `ContextInspectorPanel` 负责 `llmLogsQuery / llmLogGet` 的只读状态、选中归属和恢复，`SavedContextContent` 只呈现保存投影并供候选复用。Playground 数据和状态控制仍在候选容器，正式组件不导入 fixture。

Debug 与 Settings / Playground 同为独立一级工作区；`App` 保留隐藏的 Chat 工作区实例，仅在独立壳挂载一个 `DevPanel`。Debug 继续消费 App 的事件快照，返回不销毁 Chat 工作区。调用清单与详情使用独立响应序号，当前范围 / 选中项之外的迟到结果不能提交；资产关联失败与调用详情失败分别反馈。

正式 DevPanel → preload → debug IPC → companion-evidence 纯查询投影 → 已初始化数据库 / Role Pack。诊断不通过会初始化表、播种或修复配置的业务 getter；未初始化时显示不可用。视图、人物、日期、页大小、游标和显式目标在主进程校验，所有值参数化，表与列来自内部白名单。生产资产继续通过统一聚合器读取，正文不复制进 UI。

设置诊断使用 `getAllSettingsReadOnly` 解码而不迁移；主模型信息仍从 `loadMainLLMConfig` 的只读选项装配，普通生产调用路径不变。导航与样式由生产模块维护，Playground 只提供隔离数据与控制器。当前 / 存储 / 定义 / 实发输入分别标源，旧世界数据以生产 codec 的解码值展示，并保留原存储差异。

## 模型请求的注册编译边界

图片独立出口使用 `compileImageGenerationRequest` 签发对象，`llm/image-generation.ts` 在网络前校验私有身份；与聊天请求的证明表分开，复制或反序列化不能继承证明。Renderer 生图草稿由 shared 生产构造器提供，注册表引用同一符号；用户编辑后是运行时数据。Embedding 保持原文本 / 批量数据协议。NPC 评论在动态投影中沿既有 preferLlm 与辅助配置调用专用注册配方，选择、解析、回退与持久化仍归领域服务。

领域服务 → `prompts/registered-request.ts` 固定配方 → 不透明编译对象 → `llm/index.ts` 校验来源与身份 → Provider。签发器不公开，正文、key 和实验作用域保存为冻结快照；模型入口先拒绝旧字段、伪造身份、错误调用行为和未知资产，再创建 Trace 与发送请求。主 System 与压缩恢复系统消息必须有编译身份，运行时数据不伪装成生产资产。SubAgent 角色纯定义移至 `prompts/subagent-roles.ts`，执行器与资产目录共用它，LLM 不反向依赖 Agent。

Playground / Eval 使用明确实验配方与来源，生产模块禁止导入 Eval 签发入口。目录只读与页面编辑实验是不同职责；Debug 即时装配和当次实发快照也各自标明边界。

## Prompt 生产定义与注册边界

目录用途采用生产注册项的稳定 `domain` 标识，身份 / 行为 / 场景文件由 Role Pack 来源契约声明用途；中文名称和正文不参与用途推断。注册元数据不改变请求编译或权限。配方消费者门禁沿真实文件 import、别名及 namespace 调用反查，防止仅登记未接入函数；实验请求通过实验 System 和 Agent 配方消费同一签发机制，不保留无人调用的额外消息签发入口。

显式人物生图的数据流为 `RolePack.profile.appearance` → `formatRoleAppearanceForImagePrompt`，绑定人物穿搭时再由 `companion_assets` 的同角色槽位补充衣物名称 → `compileImageGenerationRequest` → 图片协议；只投影确认的外观与穿搭字段，保持用户图片描述为运行时资料，不建立第二份人物视觉真相，也不让视觉锚点改变权限或图片落盘边界。Role Pack loader 只将 json / md / txt 文本资产打入主进程，PNG 等视觉参考留在项目文件中，避免二进制被 raw glob 膨胀进 Electron bundle。

角色专属视觉与空间氛围架构（2026-11-10）：角色包（Role Pack）在 `manifest.json` 中声明 `avatarVisualPath`、`bannerVisualPath` 与 `themeColor`；`electron/main/companion/identity/loader.ts` 通过 `resolveRoleAssetFilePath` 安全寻址二进制图片，并经 `getRoleVisuals` / `getRoleVisualDataUrl` 转化为带内存缓存的 base64 dataUrl，经 IPC `companion:get-role-visuals` 供前端消费。出厂为路飞及草帽海贼团卡司成员（索隆、娜美、山治、乌索普）配置 1:1 高清立绘头像资产（`avatar-v1.png`）及阳光号甲板/内舱/瞭望台等横幅壁纸。前端由统一封装的 `CompanionAvatar` 取代旧有的 `<Bot />` 机器人图标与单字方块，在 Chat 欢迎屏、消息流气泡、人物世界顶栏与主侧栏全线贯通；`WorldProfileHeader` 升级为宽幅生活场景封面 Banner，Chat 消息背景 `CompanionSceneBackdrop` 接入弱场景氛围壁纸（保留 9% 透光度与轻度高斯模糊），实现沉浸氛围感与文本高可读性的统一。

日内因果状态机与宿主现实作息感知架构（2026-11-10）：
- 日内因果重编排引擎（Intra-day Causality & Dynamic Re-planning）：`replan.ts` 在角色出现体征耗竭（`energy <= 25` 或 `mood <= 20`）、突发脆弱（vulnerability）或重大共同决断时触发；提取今日尚未执行的 `planned` 事件，通过受控配方 `compileReplanSlotsRequest`（或规则保底）将后续日程重编排为休养、平复或静息活动；`updateEventPayload` 向事件 payload 原子注入 `causedBy` 因果追溯元数据，广播 `companion:slots-replanned` 与 `companion:timeline-updated`；
- 宿主现实作息感知与双向关怀锚点（Host Presence Perception & Real-world Care Anchor）：`host-presence.ts` 通过 `powerMonitor.getSystemIdleTime()` 结合主会话交互时序无感追踪宿主专注时长与空闲状态；当连续专注工作 >= 120 分钟（疲劳关怀，3小时冷却）或深夜 23:30~05:00 仍持续活跃（深夜休息关怀，6小时冷却）时，通过受控配方 `compileHostCareRequest` 生成伙伴关怀私语，作为 `assistant` 角色消息直接持久化写入角色主会话（`sessionKind: 'main'`），并广播 `companion:host-care-triggered`；
- 虚实双向因果闭环（Reality-to-Script Resonance）：宿主深夜加班被关怀的记录被标记为 `yesterdayNightWorkRecorded`，次日清晨 `script-generator.ts#collectDayScriptLifeContext` 自动吸收此现实线索，使伙伴在次日日程与朋友圈中自然流露“昨晚看到你熬夜工作，今天早上给你准备了特制肉汤”的真实活人感，实现生活引擎对现实世界的双向锚定。

`prompts/` 保存纯正文构造器、语义编译器、typed key 与注册索引；领域服务提供事实并拥有解析、回退与副作用。注册表的 `definitions` 指向真实代码符号，动态模板调用同一生产构造器生成；禁止在索引或 Debug 复制正文。四类伙伴行为的领域协议在输出模块最后编译，人物增量和运行时事实不能隐式覆盖稳定身份。

Agent Host 收口后，`AgentHostScopedToolCatalog` 是 Agent Loop 的会话级唯一工具目录入口。全局 ToolRegistry 只保存实现索引，Manifest、Permission、启用 Skill 和 Session 作用域共同决定本轮可见工具；Skill 元数据快照只记录版本、指纹、启停和允许能力，不复制正文或 Domain 实现。

内容完整性由 `src/shared/content-integrity.ts` 提供共享来源协议和事实校验。领域事件拒绝缺少人物、来源、关联、幂等或有效时间的内容；事件通知会附加 `contentProvenance`，日记持久化来源类型、来源 ID 和 trace，Prompt 与 Debug 只消费可追溯的事实切片。

主对话动态上下文的来源证据随 `RegisteredSystemPrompt` / `RegisteredModelRequest` 冻结保存，包含上下文 key、来源、作用域和长度上限。来源证据作为模型请求元数据传递，不混入人物自然语言正文。

Agent Host Manifest 现在同时声明 `grantedPermissions`。Application Orchestrator 和 Capability Tool Adapter 在执行前校验 `requiredPermissions`，再交给 Tool Runtime 的沙箱、确认和命令安全门禁，固定 Workflow 不再绕过 Host 层权限声明。

Companion 旧生活表读取已集中到 `core/read-models/legacy-companion-read-model.ts` 迁移适配层。Runtime 组装器和 Debug 世界快照不再直接 import `life/store`，适配层只读旧事实，不允许新增旁路写入。

Runtime 的角色组装输入通过 `ConversationApplicationService.loadConversationAssemblyInput` 进入 Application 层，Runtime 保留会话绑定、取消、Loop 和流式生命周期。

人物 JSON 来源由纯 `companion/identity/source-assets.ts` 工厂投影，Prompt 追踪和伙伴目录共享 canonical key；高层 Debug 聚合去重。LLM 依赖 Prompt 目录时不反向导入 Agent 或生活存储，Role Pack 文本仍从实际 loader 读取。主对话 / Eval 使用 `prompts/compiler.ts`；旧生产组装适配层已移除。

人物世界六面共用纯展示画廊，正式加载 / 写入由各面板和 companion IPC 管理；Playground 通过隔离 props 注入样张，不改变生产默认数据。world-records 负责结构校验，资产服务负责同角色引用与同步换装版本校验；通讯录从已发布事件与 event_links 派生关系经历，足迹仅消费已出发旅行。schema 18 保存事件关联；关联替换与事件投影删除使用 SAVEPOINT 整组回滚。用户资料不是内置生产资产，Debug 静态目录仍只登记 Role Pack 与 starter 定义。

生活资产创建 IPC 使用共享 CompanionAssetCreateInput：Renderer 从已校验的资产快照发送 roleId，主进程进行运行时类型 / 长度与活跃角色一致性校验，再将固定 roleId 交给资产服务；角色变化不能把请求重定向给另一伙伴。无角色旧调用直接拒绝，不作兼容回退；preload / vite-env 共用输入类型。编辑删除的资产 ID 与 expectedRoleId 校验不变，不新增数据库锁或迁移。

模型草稿离页判定由 ModelRoutingSettings 统一提供给内部 beforeLeave 和桌面 beforeunload。主窗口 will-prevent-unload 恢复 isQuitting=false 并显示原窗口，不强行放行卸载；memoryIndexSync.stop 位于最终 will-quit，不能在可取消的 before-quit 停止后台索引。无新增 IPC 或持久化路径。

Agent Loop 的模型流读取异常边界先核验当次 AbortSignal：已取消时结束观察 span 并复用 terminateLoop(aborted)，未取消才进入重试 / 压缩 / model_error。Runtime 继续保留 Loop 已发布终态，不补发或改写取消；不通过异常名字推断用户取消。

敏感设置持久化经 `storage/encryption-persistence.ts` 前置保护：Windows 在保存快照之前只读检查 userData/Local State 的 os_crypt.encrypted_key（DPAPI 包络）；缺失时合并异步等待，15 秒上限失败且不提交。`settings-store` 双键 / 单键入口等待后同步复核，备份在业务快照与 beginCommit 前准备，并复核请求归属。只读系统状态，不改写 Chromium 文件、不另存密钥、不明文降级；当前格式绑定 Electron 42 Windows，升级须跑首次保存强退回归。保护针对进程异常退出，不承诺磁盘损坏、系统账户变化或断电恢复。

模型配置提交事件由 storage/settings-store 发布无载荷通知，memory/index-sync 订阅后重读统一配置工厂。双键 / 单键保存及备份实际写入模型键均须完整持久化成功后发布；失败补偿且不通知。恢复 worker 合并请求、取消过期尝试并以修订号阻止旧结果发布，停止时解除订阅。存储层不反向依赖 memory 或 llm。

模型诊断 IPC 使用 `model-diagnostic-operation.ts` 持有单次主框架请求的 AbortController 与事件监听；它不持有设置写入锁，也不下沉到 LLM 层。settings handler 在每个准备阶段 await 后复核归属，向 `chatComplete` / `fetchRemoteModels` 传信号并在 finally 释放监听。模型发现组合 owner 与超时信号；配置仍由 aux-config 唯一工厂装配，未改变 IPC 载荷或凭据存储。

`storage/moment-backup.ts` 从既有生活表收集已发布事件、动态快照和独立用户赞评，校验角色 / 事件 / 动态关联及规模；`ipc/data-export.ts` 在整份导入的同一 SQLite 事务和失败补偿中恢复。历史事件不关联日剧本，不创建 planned 事件，不调用世界推进、奖励或 LLM。稳定身份冲突拒绝整份导入，相同归属的现有内容不覆盖。

`CheckboxField` 是 Foundation 的原生复选框封装，只集中主题强调色、焦点及固定尺寸，不持有业务许可状态。MCP 服务卡、添加向导和基础故事共同消费；工具选择与存储仍分别归受控调用方和主进程，不通过基础组件访问 IPC。

类型检查按进程独立运行：Renderer 根配置不再引用主进程 composite 工程，避免共享源码被当成尚未生成的声明产物而报 TS6305；主进程配置和独立诊断检查保留。这不改变运行时依赖方向，也不解决主进程存量类型债。

`ModelAdvancedSettings` 组合 Foundation ActionButton / TextField，只管理展开和测试展示生命周期，参数值、保存重试及测试实现均由调用方注入。正式通过既有 settings:set 保存，通过既有 settings:test-connection 测试已保存主用途首选；Playground 只改内存与返回隔离结果。`src/shared/model-routing.ts` 是用途顺序 / 启用 / 模型清单筛选的纯函数事实源，Renderer 传脱敏快照，主进程传解密快照，不把凭据处理下沉前端。`src/shared/model-parameters.ts` 统一界面、IPC 与 Temperature 装配的数字边界；同端点换 Key 后的测试失效由成功保存版本号保证，不比较密钥原文。新增共享文件显式列入主进程 composite 清单。

ModelConnectionCard 是正式模型页与候选共用的纯受控 Experience，组合 Foundation ActionButton / IconButton / TextField。调用方持有请求令牌、草稿与保存状态，只传脱敏展示属性和动作回调；组件不读取 IPC、密钥或存储。正式注入删除与真实请求，候选注入隔离适配器；共享展示不改变后端保存或请求生命周期。

连接认证与协议自动检测共用 `src/shared/llm-connection-test.ts`，主进程 Provider Router 引用并重导出规则，不复制第二份。只有 HTTP(S) 回环 OpenAI 兼容端点可无 Key；Runtime、测试 / 发现和已有辅助调用按同一规则预检。主进程 `settings:get` 经唯一配置工厂派生就绪状态和实际主模型 / 地址，Renderer 不再用全局 Key 推断主用途配置；原密钥配置标志仍只表达密钥存在，不被改写为连接可用性。

正式模型设置通过专用 `settings:save-model-configuration` 一次提交连接与用途路由。主进程限制 JSON 长度、数组数量及字段枚举，串行合并同身份密钥后调用 settings-store 双键保存；密文准备完成后在无 await 的同步段更新并一次落盘，失败恢复已写键的原始值。通用 settings:set 的模型键与专用入口共用写队列，但仍是单键接口，不对外承诺整组语义。未实现多窗口旧快照版本冲突检测。

SQLite 快照通过同目录临时文件写入后 rename 替换；替换失败禁止退回 copy 覆盖旧库，失败保留原文件并向调用方抛出友好错误。这只是单进程文件替换保障，不代表多字段业务事务或断电耐久性；sql.js 的 export 不得发生在尚未提交的业务事务内。

MCP 启动恢复在主进程阶段读取已启用配置并建立真实连接，恢复失败记录受控错误且不阻塞主窗口；OAuth 配置重启后进入需登录状态，不自动打开浏览器。工具许可仍由配置、活动连接、Registry 注册和执行前调用共同约束。

MCP 首次 OAuth 链路由共享设置表单经 preload / 主框架 IPC 发起，`mcp/oauth.ts` 在主进程持有窗口绑定的临时授权、回环监听与内存凭据，SDK 处理发现、注册、PKCE 和授权码交换；`oauth-network.ts` 校验端点并固定 DNS 解析地址，拒绝越界私网与重定向。成功后聚焦发起窗口，测试连接沿既有保存 / 接管 / 工具许可链路进入 Manager 与 Registry。取消、窗口失效及超时撤销归属；令牌不进入 Renderer、settings 或备份，不自动刷新。已保存服务重新登录前确认并复核配置，登录失效撤销工具注册；后续登录保持见 DEC-043 与 WISH-045。

MCP 运行状态由 Manager 生成不含凭据的共享快照，经 IPC 同步 Registry 后广播 `mcp:status-changed`；preload 提供可取消订阅，Settings 对状态与工具读取做代际隔离。意外断开保留 error / reconnecting 行，手动停止撤销连接归属；旧 close / connect 回调不得覆盖新连接。生产与 Playground 共用服务卡片，后者仍只注入隔离状态，不订阅生产。
> 只维护稳定分层、依赖方向和主数据流。工具数、IPC 数、测试数、预设数等动态清单以代码注册表或命令输出为准。

## 项目愿景

**构建一个人格化桌面 AI Agent。**

正式设置的 UI 只承载已验收的 Playground 体验；生产数据、IPC 与安全边界仍由正式调用链负责，Playground 不成为第二事实源。

模型连接配置由设置存储加密保存，配置工厂在主进程按用途路由解析为 LLMConfig；Renderer 只读取脱敏结构，数据备份只保留连接元数据，不携带密钥。正式模型发现只走主进程 `settings:fetch-models`，不允许 Renderer 直连供应商。

ModelConnectionForm 为纯受控业务 UI，由正式设置和候选共用；来源分类与预设默认值从共享 Provider 注册表派生。source / presetId 是连接元数据，不授予权限；provider 是实际协议选择，测试与生产装配共用 LLMProvider。主进程保存 / 读取旧密钥时除连接 id 外还核对端点与协议，身份变化必须使用新输入的 Key；候选只模拟凭据状态，不能读取真实存储。

ModelUsageArrangements 同样属于纯受控 Experience，组合 Foundation SelectField / ActionButton / IconButton。正式 ModelRoutingSettings 注入真实路由及整组保存回调，候选只操作内存；共享组件没有 IPC。image 用途统一为生图，由独立配置工厂装配；用户附图理解使用主对话模型，不再切换到 image 路由。

主对话与辅助用途由唯一配置工厂按同用途顺序装配首选及 fallbackModels，过滤停用项和缺失引用、去重相同连接模型；每项端点、密钥、模型和 provider 整体绑定，空 Key 不借用其他连接凭据。独立辅助用途不继承主用途备用池，无有效辅助用途时整体沿用主配置。生图必须显式配置，只取首个有效目标，不回退主模型、不自动重试或跨供应商重发。主用途不存在时身份为空，不读取旧全局字段或 LLM_* 环境变量。一次性身份覆盖不继承已保存备用链。统一调用入口逐目标认证，远程缺 Key 不发请求；Debug 从主配置工厂读取脱敏身份。

用户主动生图沿 image_generate → loadImageGenerationConfig → Images / Gemini 适配器 → sharp 完整解码并归一化 PNG → 项目 images 目录独占提交执行。主进程注入 workspaceRoot，收费请求前及提交前复核权限与真实路径；restricted-fetch 同时服务生成下载及 OAuth 网络封装，限制目标、DNS、重定向和响应规模。结构化图片引用经 Registry / Loop 写入 schema 17 工具消息或当前角色的 companion_assets.payload.image 后才发布结果；模型仅接收文字摘要，主聊天、侧边聊天和人物世界共用 GeneratedImageResult。读取与文件定位 IPC 仅接受会话 / 资产身份和图片身份，主进程校验归属、文件摘要及路径，不接受 Renderer 任意路径。

媒体备份保存工具调用配对、人物资产图片引用、图片摘要和受限 PNG 字节，不保存恢复用绝对路径。导入经完整校验后写 userData 带管理标记的独立目录，并把新路径回填到新增 companion_assets 的 payload；会话、生活资产、记忆和设置在同一同步事务中写入，失败整笔回滚并清理本批媒体，不更换数据库实例。成功落盘后才通知 `memory/index-sync` 核对派生索引并移除媒体标记。启动先读取持久数据库并核对待恢复目录，未引用才清理，已引用则保留；解析失败 / 链接目录不清理。SQLite 是结构化记忆事实源，Vectra 镜像由启动、成功提交和失败退避 worker 按稳定 id 重建 / 清理；不承诺断电耐久性、外部 Embedding 可用性或未保存凭据的强退恢复。

不只是一个工具，而是一个有性格、有记忆、能成长的数字伙伴：
- **人格化交互** — 有一致的性格特征和交流风格，不是冰冷的 Q&A 机器
- **持久记忆** — 记住用户的偏好、项目上下文、历史对话，越用越懂你
- **主动协作** — 不仅被动回答，还能主动提醒、建议、推进任务
- **本地优先** — 数据存储在用户本地，隐私可控
- **可扩展** — 通过 MCP 协议连接外部能力，用户可自由添加工具

## 技术栈

| 层级 | 技术选择 |
|------|---------|
| 外壳 | Electron（主进程 Node.js + 渲染进程 Chromium） |
| 语言 | TypeScript 全栈，主进程与渲染进程共享类型定义 |
| 前端 | React + TailwindCSS + Lucide Icons |
| 存储 | SQLite（结构化，sql.js WASM）+ Vectra（向量检索）|
| LLM | 多 Provider（OpenAI 兼容 / Anthropic / Gemini，自动检测路由） |
| 扩展 | MCP 协议（Model Context Protocol） |
| 测试 | vitest（单元）+ Playwright（E2E） |
| 打包 | electron-builder（NSIS / DMG） |

## 整体架构

- MCP 配置类型统一在 shared，主进程 `mcp/transport.ts` 复用 SDK 创建 stdio / SSE / Streamable HTTP。Bearer 沿既有 settings 加密与脱敏管线装配，不在 Renderer 或 Playground 创建传输；HTTP 凭据绑定原端点，禁止自动重定向。连接确认、工具注册和权限决策不属于传输工厂，仍由既有 IPC / Manager / Bridge 分层负责。
- MCP 添加向导的测试连接由 `mcp/connection-tests.ts` 独立持有，按 Renderer 窗口与 requestId 绑定；只有保存成功后才由 `McpClientManager.adoptTestedConnection` 接入生产 Registry。取消、超时和窗口销毁不会写配置或开放未保存工具。

- MCP 工具许可数据流：正式 Settings 读取脱敏后的服务配置与真实 `mcp:list-tools`，通过 `mcp:set-tool-allowed` 写回服务配置；主进程更新活动连接、重建 MCP Bridge 的 ToolRegistry 注册，并在 `callTool` 前再次校验。未配置 `allowedTools` 的历史配置保持全部允许，MCP 许可不替代权限引擎的审批决策。


- 伙伴设置只通过 `SettingsPanel → settings:get/set → settings-store` 管理回答方式、生活提醒和主动问候；共享 `CompanionSettingsContent` 只接 props，Playground 使用隔离状态。相处补充说明已从设置、备份和 Runtime Prompt 数据流移除，记忆库仍由独立 memory-store 负责。

- chat:send 建立会话到发起 Renderer 的短生命周期归属，chat:abort 只能控制该归属；IPC 缺省会话 ID 直接返回，避免把 Renderer 输入映射为 Runtime 全局中断。

```
┌──────────────────────────────────────────────────────────┐
│                      Electron App                        │
│                                                          │
│  ┌──────────────┐        IPC         ┌────────────────┐  │
│  │   渲染进程    │◄─────────────────►│    主进程       │  │
│  │   (React)     │   AgentStreamEvent │   (Node.js)    │  │
│  │               │                    │                │  │
│  │ - App.tsx     │                    │ ┌────────────┐ │  │
│  │ - Settings    │                    │ │ IPC 路由层  │ │  │
│  │ - Markdown    │                    │ │ (12 模块)  │ │  │
│  │ - FileBrowser │                    │ └──────┬─────┘ │  │
│  └──────────────┘                    │        │       │  │
│                                      │ ┌──────▼─────┐ │  │
│                                      │ │ Agent Loop  │ │  │
│                                      │ │ (核心循环)  │ │  │
│                                      │ └──────┬─────┘ │  │
│                                      │        │       │  │
│                     ┌────────────────┼────────┼───────┤  │
│                     │                │        │       │  │
│              ┌──────▼──────┐  ┌──────▼─────┐  │       │  │
│              │ Tool System │  │ LLM Adapter│  │       │  │
│              │ (Registry)  │  │ (流式API)  │  │       │  │
│              └──────┬──────┘  └────────────┘  │       │  │
│                     │                         │       │  │
│              ┌──────▼──────┐           ┌──────▼─────┐ │  │
│              │ MCP Bridge  │           │ Memory     │ │  │
│              │ (动态工具)  │           │ System     │ │  │
│              └──────┬──────┘           │ - SQLite   │ │  │
│                     │                  │ - Vectra   │ │  │
│              ┌──────▼──────┐           │ - Profile  │ │  │
│              │ MCP Client  │           └────────────┘ │  │
│              │ (stdio)     │                          │  │
│              └─────────────┘                          │  │
└──────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. Agent Loop（核心循环）

```
think → act → observe → think → ...
```

- 事件流使用 AsyncGenerator 模式
- 输出纯数据事件（AgentStreamEvent），不含 UI 逻辑
- 支持 AbortSignal 取消（用户停止按钮）
- 最大迭代次数保护（默认 25 轮）
- 每轮迭代前自动检查上下文压缩（四层分级）
- **消息管道**：sanitizeToolCallPairs 修复孤儿消息，防止 LLM API 400
- **Runtime 编排**：AgentRuntime 单例管理生命周期，后台任务队列串行执行
- **LLM 调用重试**：网络错误/429/5xx 自动重试，最多 2 次，指数退避
- **工具并发执行**：按 LLM 原始顺序分批 — concurrencySafe 连续工具并行，遇到非安全工具刷新批次串行，保持 LLM 指定的执行语义
- **ToolContext 依赖注入**：工具通过 `ctx: ToolContext` 获取 workdir / sessionId / AbortSignal，不再依赖全局 import
- **运行证据会话归属**：Agent Loop 的权限决策与工具执行资产记录统一从 `ToolContext.sessionId` 取会话 ID，与 workspace/runtime 的工具上下文保持同源；不新增 IPC 字段，也不改变权限或工具执行契约。

### 2. IPC 模块化

主进程 IPC 按产品领域拆分在 `electron/main/ipc/`，实际 handler 清单以该目录和 `ipc/index.ts` 注册结果为准，不在本文维护数量。

IPC 契约必须四处同步：

1. `src/shared/types.ts`：共享载荷类型；
2. `electron/preload/index.ts`：Renderer 白名单桥接；
3. `electron/main/ipc/*.ts`：主进程 handler；
4. `src/vite-env.d.ts`：`window.electronAPI` 类型。

Renderer 只能通过 preload 白名单访问主进程。敏感配置、文件边界、外部进程和高风险确认必须由主进程重新校验，不能信任 Renderer 传入的“已批准”状态。

备份 IPC 的交互生命周期由 `ipc/backup-operation.ts` 管理：`data:export` 与 `data:import` 共用进程内互斥租约，绑定请求主框架及其 BrowserWindow，不依赖当前聚焦窗口。准备阶段监听窗口销毁、Renderer 退出与主文档导航，失效后迟到结果不得开始写入；进入 commit 后保持锁直至 handler finally 收尾。该锁只互斥备份请求；核心会话 / 生活资产 / 记忆 / 设置由同步 SQLite 事务和一次快照替换提交，派生向量不属于同一事务。

备份正文的业务约束不在 IPC 复制：`isValidExportData` 在整份预检阶段调用 `memoryStore.assertMemoryContentAllowed`，与实际记忆写入共用长度与凭据拒绝规则。任何一条不合法都在首次业务写入前拒绝；预检不能替代后续合法数据写入的事务与失败恢复。

### 3. 工具系统

- 声明式注册（ToolDefinition + ToolMetadata）
- **buildTool() 工厂**：统一 fail-closed 默认值（isReadOnly/isDestructive/isConcurrencySafe 默认 false，maxResultSizeChars 默认 50,000），工具只声明偏离默认的字段
- 并发安全分流：`isConcurrencySafe` → Promise.all，否则串行
- 动态注册/注销：支持 MCP 工具运行时加入和移除
- 破坏性操作前用户确认（IPC 双向通信弹窗）
- 终端运行实例由发起 webContents 归属；终止合并并发请求，必须等到 child `close` 才成功，失败或超时保留记录供重试，`error` 不代替退出。Windows 使用隐藏的 taskkill 回收进程树；Unix 使用独立进程组并在 SIGTERM 后必要时升级 SIGKILL（本机未作 Unix 实机验证）。未握手 stdout/stderr 有界缓存，Renderer 通过 `terminal:ready` 冲刷；10 秒未握手、窗口销毁/崩溃或命令超时触发清理。输出按 8000 字符分包而不是截断，累计上限仍为 2MB 字符；Renderer 拼接未完成行，不以包边界换行。
- **超时保护**：每个工具 30s 超时，超时自动返回错误
- **子 Agent 系统**：delegate_task 工具，独立上下文 + 受限工具集 + 权限只降不升 + 工具黑名单（禁止 delegate_task 递归 / remember / forget / task_plan）
- **中间件管道**：ToolMiddlewarePipeline 洋葱模型（error-formatting → logging → verify → result-persistence）
- **大结果落盘**：工具结果超过 maxResultSizeChars（默认 50,000）时写临时文件返回路径，防止上下文爆炸；file_read 设 Infinity 避免循环
- **Token 预算**：会话级 + 日级限额，超限自动终止
- **沙箱系统**：参考 Codex 四层纵深防御，三级沙箱模式（read-only / workspace-write / full-access）
- **命令安全分级**：ExecPolicy 白名单/黑名单 + CommandGuard 路径边界检查 + ApprovalStore 审批记录
- **权限规则引擎**：不可绕过硬边界（危险命令、Shell 控制符、越界路径 / cwd）先执行，再进入五层业务责任链（自定义规则 → 审批记录 → ask 规则 → 命令分级 / 沙箱 → 默认）；已接入 Agent Loop 主流程
- **文件自定义规则**：Loop / Debug 与 Registry 共用 file-tool-permission，先验证真实路径沙箱，再按 deny > ask > allow 匹配逻辑路径、真实路径和删除目录子项。ask 的内部对象凭据绑定 callId、参数、会话、规则快照和目标，一次性消费；Registry 在实际执行前复核，不能从 IPC/JSON 伪造。此链覆盖原生文件读写、编辑、删除和补丁，不扩展到 Shell 或 MCP。
- **工作区管理**：workspaceRoot 维护；文件工具与子 Agent 优先使用 `ToolContext.workdir`，写入前解析 realpath 防 symlink 越界；`file_delete` 的永久删除白名单只匹配工作区内部相对路径段，系统 `/tmp` 等祖先目录不能扩大永久删除范围
- **工具 vs 服务边界**：工具（ToolDefinition）仅暴露给 LLM 的薄壳，内部逻辑下沉为独立服务（如 task-plan-service.ts），运行时/中间件/其他工具可直接调用服务而不经 LLM

### 4. 记忆系统

两层记忆架构：

| 层级 | 存储 | 用途 |
|------|------|------|
| 结构化记忆 | SQLite memory 表 | 用户画像（identity/workflow/voice）、偏好、事实 |
| 向量记忆 | Vectra LocalIndex | 历史对话语义检索，按相关性召回 |

- 自动提取用户画像（异步 LLM 分析，每 5 分钟 + 3 条消息触发）
- 对话后只索引用户消息；assistant 原文不写入向量库，避免自我强化循环
- 语义检索注入 Prompt 情境上下文模块（top-5，score > 0.6）

### 5. Prompt 语义编译

Prompt 不再以 L1–L4 作为领域模型。主对话和伙伴后台行为由 `electron/main/prompts/compiler.ts` 按行为选择六类语义模块：平台规则、人物定义、人物成长、行为定义、情境上下文和输出契约。Role Pack 提供稳定人物与可选 `behaviors/<behavior>.md` 增量；行为服务提供事实、校验、回退和副作用。上下文压缩仍可使用 L1–L4 作为算法名称，但不得把它们重新当作人物 Prompt 层。

| 语义模块 | 内容 | 主要来源 |
|------|------|------|
| 平台规则 | 工具、权限、不受信任数据和注入防护 | 主进程生产规则 |
| 人物定义 | 身份、价值观、档案、世界默认值、表达基线 | Role Pack |
| 人物成长 | 可持久化的长期表达变化 | MUTABLE store / 反思校验 |
| 行为定义 | 任务目的、边界、行为增量与 Skill 摘要 | 行为入口 / Role Pack |
| 情境上下文 | 用户、记忆、世界、关系和事件切片 | 运行时数据源 |
| 输出契约 | 格式、校验、回退和副作用边界 | 真实行为服务 |

Prompt 资产仍由 `electron/main/prompts/registry.ts` 统一登记；每次模型调用必须声明非空资产 key。Debug 只读取生产资产和真实调用证据，Playground 只接收显式实验副本。

未来扩展英文时，在同一资产 key 下维护独立语言版本，由运行时按 locale 单选；当前不实现英文或韩文版本。

Skill 资产由 `electron/main/skills/loader.ts` 读取和保存；Frontmatter 只允许标准 YAML，使用 `js-yaml` `JSON_SCHEMA`，禁止 JavaScript / 可执行语言引擎。内置目录由主入口 `APP_ROOT/electron/skills-builtin` 定位并纳入打包清单，不依赖 ESM 中不存在的 `__dirname`。`registry.ts` 负责激活工具、当前激活状态和不含正文的指纹。正式 `SkillsPanel` 与 Playground 共用 `settings/SkillViews.tsx`，只管理列表、详情、启停及用户正文编辑 / 删除；创建、版本和试跑不作为正式页入口。保存前由主进程校验 Frontmatter、正文和工具引用，底层版本备份仍保存在用户目录 `.versions/`。

Skill 启停是用户运行态，不修改内置文件或资产指纹。`skills:set-enabled` 通过 registry 串行队列，调用 `storage/skill-state-store.ts` 在 settings 表独立键 `skillDisabledNames` 保存停用名称；普通 settings 写入不开放此键。写盘成功后才替换注册状态，失败恢复数据库旧值；重载、保存和删除使用同一队列。新 Prompt 摘要过滤停用项，已捕获的生产工具执行前检查当前启用状态和定义身份，避免重载 / 删除后的旧闭包继续激活。`disable_model_invocation` 与启停独立；已写入历史消息的正文不追溯撤回。Debug 目录展示定义，真实 LLM 调用继续通过 `requestExtra.skillActivations` 记录来源和指纹；Eval 的显式隔离 Skill 不读取用户启停状态。

### 5.1 伙伴与生活世界（Companion）

人格化伙伴的**产品终局**（多主角同团、单活跃、生活世界、朋友圈/衣柜）挂在现有 Loop / Memory / IPC 之上，**不另起进程模型**。

| 要点 | 说明 |
|------|------|
| 运行时 | 唯一 `activeRoleId`；会话中禁止换角；完整切换 + 非活跃暂停 |
| Catch-up | 切换时细补最近 ≤7 日生活剧本/事件 |
| 契约索引 | [`requirements/README.md`](./requirements/README.md) |
| 产品模块 | [`modules/companion.md`](./modules/companion.md) |
| 能力表 | [`modules/companion.md`](./modules/companion.md)「已落地能力」；运行时见 [`modules/agent-runtime.md`](./modules/agent-runtime.md) |

目录落点：`electron/main/companion/`（identity / growth / life / cast / orchestrator）；`prompts/compiler.ts` 为 Prompt 编译器。
已落地：**W0–W6** + 三槽 + 召唤子会话/忙闲 + 自动反思 MUTABLE。后续：Pack 内容打磨、methodology M21–M31 深啃。

生活面数据沿 `Role Pack world.default → life/assets → companion_assets → companion IPC → WorldDetailsPanel / AssetsPanel → WorldLivingContent / WorldAssetEditor` 流转。正式通讯录沿 `get-roster` + 既有 `check-cast-availability` 进入 `CastPanel` 列表预检，开聊仍走 `start-summon` 二次判定；Playground 通讯录保持静态夹具。住所和常去地点分别为 `home` / `footprint`，不另建第二份世界内容库；运行后以角色隔离的资产为准。没有 `world.default.json` 时，`world_json` 的 home / currentLocation 与 Catch-up 居所回退为「未设定」，不得按角色写入公寓、合租或日常住处。用户新增走 `companion:create-asset`，由 `createAsset` 校验白名单 kind 后写入活跃主角；更新 / 删除沿既有 IPC。`companion_asset_seeds(role_id, kind)` 与新资产同事务写入，事务内无异步等待或落盘；默认世界未设定不生成，已有记录优先，删空后不重新初始化。动态足迹继续来自 Moments，不把资产创建日期当成访问日期。正式朋友圈沿 `companion:get-moments` 读取动态；用户赞 / 评论写入独立表 `companion_moment_user_interactions`，不改 `moment.text` 或卡司 `meta.interactions`。Playground 朋友圈仍用本地夹具。

`WorldLivingContent` 将正式文化角 / 家居 / 足迹投影到共享画廊；真实 IPC 和加载 / 错误处理属于正式面板，隔离样张属于 Playground。用户导入导出覆盖 `companion_assets`、`companion_asset_seeds` 与已发布朋友圈事件 / 动态 / 用户互动 / 关联，按稳定身份合并，失败与会话同一事务回滚；旧备份缺字段仍可导入。媒体只保存受限字节与摘要，恢复目录由主进程重建，不导出恢复用本机绝对路径。

生活切片详情沿 `companion:get-life-slice` 读取：主进程以 `companion_events` 为事实源，按当前 `role_id` 聚合对应 `companion_moments`、`companion_assets.source_event_id` 和 `companion_event_links`；Renderer 不自行拼接跨表关系，找不到事件或角色不匹配时返回空。关联表必须以 `role_id + event_id` 隔离，唯一关系由 `(event_id, target_type, target_id, relation)` 约束，避免事件详情只依赖不可查询的长文本。朋友圈历史备份同步保存这些关联，导入失败时与事件、Moment 和用户互动一并回滚。

### 6. MCP 协议

- MCP Client Manager：管理多个 MCP Server 的生命周期
- **双传输层**：StdioClientTransport（本地子进程）+ SSEClientTransport（远程 HTTP/SSE）
- Bridge 层：自动将 MCP 工具转换为 ToolDefinition 并注册
- 命名空间隔离：`mcp:{serverId}:{toolName}` 避免冲突
- 配置持久化：MCP 服务器列表存入 settings
- 启动时自动恢复已启用的连接

### 7. LLM 路由

- **多 Provider 路由**：显式 Provider 优先；否则按共享 Base URL 规则检测 OpenAI / Anthropic / Gemini，未知端点回退 OpenAI Compatible
- OpenAI Compatible 请求由 `request-builders.ts` 纯构造器生成，真实调用与 Provider 资产目录共用同一请求事实（覆盖 DeepSeek / Groq / OpenRouter / Together 等）
- Anthropic Messages API 适配（SSE 流解析 + content_block_delta + tool_use 映射）
- Gemini API 请求构建器（systemInstruction + functionDeclarations）
- 流式 SSE 解析（text / reasoning / tool_calls delta）
- **Streaming Tool Calls**：工具参数边流式边 yield `tool_call_delta` 事件
- **Model Failover**：未输出时按 `fallbackModels` 顺序尝试；备用配置继承采样参数、可显式覆盖或清空 thinking / 运行资产证据，并清除递归 fallback。取消或向消费者交付模型事件后停止切换，所有目标失败仍返回失败。切换提示不算模型事件；`chatComplete` 丢弃流式事件，只消费最终返回值。
- **Vision 降级**：OpenAI Compatible 图片先乐观尝试，识别能力错误后进程内记忆拒绝并去图重试一次
- **Prompt Cache**：Anthropic `cache_control` 标记 System Prompt + Tools
- **Structured Output**：OpenAI Compatible `ResponseFormat` 支持 json_object / json_schema
- 内置 Provider 入口统一来自 `src/shared/provider-presets.ts`：按海外直连、国内服务商、编程套餐、聚合与代理、本地 / 自定义分组；当前 Settings 展示 24 个入口，Chat 快切展示其中 2 个 Provider。模型 ID 不进入 Provider 预设，来自用户账户实际可用列表。ListenHub / CLIProxy 不作为普通聊天入口。
- RAG 文档查询通过 rag_search → searchDocuments → Vectra queryItems(vector, query, topK)，配置仍由 loadMainLLMConfig 装配；入口校验端点和模型，不将 Key 非空作为本地连接必要条件。不改变分层、索引格式或 IPC。
- Embedding 当前仍复用主用途端点与默认嵌入模型。index-sync 与 RAG IPC 从唯一配置工厂装配，入口不以 Key 非空替代配置就绪；适配器仅在 Key 非空时发送认证头，不持有进程级永久失败缓存。结构化索引恢复的退避 / 取消仍归既有 worker，不新增调度层。embeddings 统一生成请求空间指纹、返回模型和维度元数据，记忆 / RAG 在计算相似度前过滤；结构化源在核对时按请求空间重建。独立嵌入配置、配置保存后的唤醒及文档 / 对话重建仍是 S2 缺口。

### 8. 上下文压缩

四层分级压缩策略（Alice 方法论 Ch.5）：

| 层级 | 触发阈值 | 策略 | 成本 |
|------|----------|------|------|
| L1 Snip | 60% | 删除最早的工具调用轮次 | 零 |
| L2 MicroCompact | 75% | 去重相同工具调用 | 零 |
| L3 Collapse | 90% | LLM 生成摘要（降级：规则占位符） | LLM 调用 |
| L4 AutoCompact | 95% | 全量重写（仅主循环触发） | LLM 调用 |

- querySource 互斥守卫：compact/memory/title 来源自动跳过 LLM 摘要，防递归

### 9. Eval 与 Debug 证据链

- 关键历史链路为 `Tracer → utils/diagnostic-history` 的白名单元数据发布 → 启动装配 sink → `storage/diagnostic-history-store` → `debug:history-query`。schema 由正式数据库 v19 迁移建立，Debug 查询不初始化数据库；utils 不 import storage。角色身份来自实际装配角色并经 TraceContext 传播，保留原 Span ID、parentId 与 links；不存 Span 名称 / 错误正文或任意 attributes。历史与内存快照分别解释，重启未结束 Span 只标中断；四页通过 SavedEvidencePanel 复用纯阅读层；日期 / 人物 / 目标归属和多页刷新由容器持有，迟到响应不可提交到新范围。

- Eval CLI 是判定与报告的事实源；Debug 只通过受控 IPC 读取报告、启动固定白名单脚本，不在渲染层重新评分。
- Debug 只有一个产品入口：`activeView === 'debug'` 渲染 `DevPanel` 全页工作区；Chat 不再维护 `conversationDebugMode`，也不在 `ChatRightDock` 中叠加调试半屏。LLM 调用、调用链和实时事件分别作为 Debug「系统」分组的同级视角；七组 26 个入口以 `debug-navigation.ts` 为唯一导航事实源。候选与正式页共用无夹具阅读组件，正式容器仍负责真实读取、分页 / 刷新、异步归属与稳定 ID 跳转；生产不导入 Playground。
- 产品 Primary Sidebar 只保留人物世界与设置两个产品目的地；MemoryPanel 与 SkillsPanel 仍是独立页面能力，但入口统一由 Settings 的「记忆」与「工具」分区承载，SecondaryNav 不再挂载。
- Chat 壳层的 PrimarySidebar 与 ResizeHandle 由 `sidebar-transition` 轨道常驻承载：收起时通过宽度 / 透明度 / 位移和延迟隐藏完成滑动，搜索在顶部工具行内展开，不再增加独立搜索行。
- Skill Eval 为每个 Case 创建独立临时目录和 ToolRegistry，复用生产 Skill 激活工具、Skill 摘要与 Agent Loop；Mock / Real 共用触发、指南注入、工具边界和回复约束 Grader。
- 报告写入 `eval-reports/` 的 JSON / Markdown，只保存输入快照、Skill 元数据与指纹、激活 Trace、工具调用和 Agent 可见回复，不保存 API Key、隐藏 reasoning 或 Skill 正文。
- `debug:skill-eval-reports` / `debug:skill-eval-report-get` 对文件名与最小结构做校验，拒绝目录穿越和损坏报告；`DebugEvalRunner` 仅映射 `eval:run`、`eval:skill`、`eval:persona`。

### 10. Agent 生产资产目录

- Prompt 注册表仍负责模型可见 Prompt 的稳定 key、locale、模板和运行时追踪；伙伴注册表不复制 Prompt 正文。
- `companion/asset-registry.ts` 读取真实 Role Pack loader、场景 loader 和生活 starter 工厂，生成 manifest、人物档案、默认世界、伙伴场景与生活内容资产。
- Debug 高层聚合 Prompt、伙伴资产、记忆策略、权限与沙箱策略、Tool schema、Skill、Eval Case / Grader、Eval Judge、模型 Provider 与 MCP，统一展示来源、所有权、版本、指纹、状态、派生关系和依赖。
- 用户记忆、当前世界状态和运行后 `companion_assets` 属于运行时数据，不进入静态生产资产目录；分别由记忆 / 世界态 / 请求记录查看。
- `memory/strategy-registry.ts` 只登记记忆提取、去重、反馈分桶、向量召回、向量生命周期和引用纠错策略；策略参数由原生产模块导出，注册表不反向驱动算法。
- `sandbox/asset-registry.ts` 从沙箱档位、命令分级、权限责任链、路径守卫、审批生命周期和有效沙箱映射生成只读资产；不读取用户规则、审批记录或当前执行模式。
- 正式设置权限页与 Playground 候选共用 `PermissionSettingsContent` / `PermissionRulesEditor`；Renderer 只提交规则草稿，主进程在 `settings:set` 写盘前严格校验并再热加载，执行引擎仍是权限事实源。
- `evals/scenario-registry.ts` 是普通 Eval Scenario 唯一列表，CLI、Vitest 与 `evals/asset-registry.ts` 共同消费；Case / Grader 资产来自真实场景和结构化判据，不读取运行报告、环境凭据或 Judge 隐藏推理。
- `llm/provider-asset-registry.ts` 从真实请求构造器、路由规则、Thinking / Context / Vision / Failover 生产事实和共享预设生成协议能力、跨 Provider 策略与内置预设资产；只保存脱敏结构，不读取用户配置或能力缓存。
- `agent/subagent-asset-registry.ts` 登记 `researcher`、`coder`、`analyst` 三个 SubAgent 角色的 Prompt addon、默认工具集与只读边界；执行器和 Debug 聚合消费同一角色定义，自由字符串角色不伪造为内置资产。
- Renderer 设计资产由 `src/shared/design-asset-registry.ts` 单一登记主题与字体比例；Settings、Playground、MarkdownRenderer 不再各自维护主题集合，设计资产不进入 ModelContext 或运行证据。
- Playground 不直接写生产资产；只有文本类资产可显式载入为实验副本，伙伴、记忆、权限与沙箱、Eval Case / Grader、Provider 等结构化资产保持只读。
- 已确认的候选回流正式 UI 时采用选择性同步：生产只接收视觉 token、真实产品交互和真实组件组合，不接收来源路径、采用标记、目录、调试控制或隔离 fixture。正式 Right Dock 的文件工具由 `WorkspaceFilesPanel` 管理左树右多预览及每路径读取状态；审阅 / 终端仍沿真实 `session` / `terminal` IPC 路径。
- 正式 Right Dock 的浏览器入口走 `browser:load` 主进程边界：Renderer 不直接 `fetch` 或 `loadURL`，主进程复用 URL/DNS 校验、手动拒绝重定向、超时和响应上限后返回文档；Renderer 仅用无脚本 `sandbox` 与 CSP 展示，不继承 Electron bridge。该能力是受限只读查看器，不等同于完整浏览器。每次加载由 Renderer 生成 requestId，主进程按 senderId + requestId 维护 AbortController；标签关闭或组件卸载通过 `browser:cancel` 终止未完成抓取，避免无主网络请求继续等待超时。
- 正式 Right Dock 的侧边聊天不复用主会话：`session:createWorkspace` 创建 `session_kind=workspace` 的临时 Runtime 会话，`listSessions` 排除它；卸载调用既有 `session:delete`，由主进程阻止新发送、取消运行与工具确认，等待 chat:send 完整消费生成器并退出后才删记录。`done` 事件和 abort 回执均不是收尾完成凭证。Runtime 在首次配置 await 前登记控制器，只在生成器 finally 释放；重复发送不能覆盖运行锁，删除失败释放删除门禁以便重试。`chat:event` 按 sessionId 过滤，停止只控制当前会话；异窗不能中断或删除活跃会话，确认响应也校验发起 webContents，窗口销毁取消确认。
- 工作区按项目归属：App 的产品子树在设置／Playground 全屏导航时仅隐藏；其它非 Chat 页面也隐藏右坞和拖拽柄，不挤压全页。ChatRightDock 以项目路径为 key，切换项目重建，取消项目或关闭最后标签卸载。后台标签保留面板与订阅，ReviewPanel 额外以 sessionId 重建。TerminalPanel 的运行记录独立于选中态，pending 取消／卸载保留取消意图，迟到成功响应补发 kill；仅当前未卸载的运行可更新 UI。终止失败可重试，关闭后的清理失败仅记录固定告警，主进程已实现进程树回收与就绪握手；仍不将 IPC 应答视为进程树退出证明。
- `session:getFileChangeDiff` 的真实返回同时包含受长度上限保护的 `before` 与 `after`；Renderer 的 ReviewPanel 只在两者都存在时开放并排视图，并以请求序号隔离快速切换产生的过期响应。
- `scripts/asset-governance.mjs` 声明资产家族的来源、注册表、发现方式、key 规则、展示面和证据边界；`npm run assets:check` 生成机器审计快照并对静态资产执行 fail-closed staged 漏登检查。`src/assets/playground/` 中的隔离媒体夹具归入产品体验家族，并必须由对应 `experience.*` 的 `fixtureAssetPaths` 显式认领，不能借 Playground 名义绕过资产登记。

### 10.1 生产资产运行证据层

- `utils/asset-usage.ts` 是业务层唯一证据分发入口：调用方只上报稳定 key、关系、状态和扁平 allowlist 元数据，不依赖 Storage 或 Debug IPC。
- 主进程用 `createModelContextAssetResolver` 校验 key，并把运行时 version / fingerprint 快照写入 `agent_asset_usage`；未知 key、解析失败和写盘失败只告警，不阻断 Agent 主链路。
- `agent_asset_usage` 只是关联索引：LLM 正文仍在 `llm_debug_logs`，Trace 仍由 tracer 管理，资产正文仍在各生产注册表；索引按 20,000 行与约 32 MB 双上限裁剪。
- LLM 记录 Prompt、Provider 路由 / 策略、Tool availability 与 Skill；Agent / Tool 记录执行、审批、命令责任链、有效沙箱和真实路径守卫；Memory 记录召回、画像、去重、反馈分桶、向量生命周期与引用纠错。
- Tool Registry 为每个 call 注入实际 tool span，使 `shell_exec` 和文件工具内部守卫证据精确挂到执行节点；不记录 command、路径、reason、args 或结果正文。
- Debug 通过单一 `debug:asset-usage-query` 按 span / asset / session 查询；LLM JSON 与 JSONL 导出都附带证据，清空 LLM Debug 时同步清理对应会话关联。

## Playground 设计层与体验组合

共享 UI 实现落在 src/components/foundation/，不依赖 Playground、fixture 或业务 IPC。TabStrip 是当前工作区回流的首个通用标签实现：UiControlsPanel、WorkspaceExperienceCandidate 与正式 ChatRightDock 直接 import；ui-component-registry 的 behavior.tabs 指向它。组件管理固定操作槽和键盘焦点，业务层保留实例状态、关闭选择及资源释放责任。IconButton 提供 24/28/32px 固定图标操作槽与统一 label/tooltip/aria-label；工作区添加、审阅工具和候选工作区入口同源，hover/disabled 不改变几何。WorkspaceToolMenu 统一正式与候选添加菜单的键盘循环、Escape、失焦和焦点恢复，但不拥有业务工具列表或实例资源。DiffViewer / DiffViewControls 提供统一/并排内容、缺稿回退与固定尺寸模式按钮；基础故事、候选和 ReviewPanel 同源，数据仍由 session IPC 提供，不在基础层计算差异或读取文件。MarkdownRenderer/CodeBlock 通过 Foundation useSurfaceTheme 读取容器的语义变量与 color-scheme；Mermaid 的 initialize+render 由同一串行适配器管理，取消不发布结果、失败不堵队列、finally 清理测量节点，保持 strict 和资源上限。局部候选主题不进入生产主题注册表。现有其它基础故事尚不等于已提取的共享组件。

Playground 的导航工作域不等于产品架构层。产品设计只保留两层：

```text
基础 Foundation → 产品体验 Experience
```

- **Foundation** 只登记可脱离业务复用的设计语言、图标、通用组件、状态和通用交互能力。
- **Experience** 登记 Chat、人物世界、设置和工作区的业务语义、页面组合与流程。记忆归入设置的“记忆与相处”分区；伙伴状态条、生活事件卡、角色卡、记忆引用芯片和完整右侧工作坞等业务结构属于 Experience。空态、确认、错误等业务状态回到各自真实上下文验收，不作为独立体验入口。
- **Agent 实验** 是 Playground 的独立工作域，不是第三层产品架构；它只承载隔离试验。
- Experience 只能通过 `src/shared/product-experience-registry.ts` 的 `usesFoundation` 引用 Foundation；发现基础能力缺失时，先在 Foundation 建故事并登记真实来源，再回到 Experience 组合。
- Playground 的一级 Tab 事实表与当前验收边界见 [`docs/requirements/playground-navigation-world-polish-v1.md`](requirements/playground-navigation-world-polish-v1.md)；代码注册表是 key、来源、状态和依赖的事实源，文档只记录边界与原则。
- Foundation 组件资产与 Foundation 故事是两种不同资产：`src/shared/ui-component-registry.ts` 只回答“组件是什么、来源和生命周期是什么”；`src/shared/foundation-story-registry.ts` 只回答“Playground 展示哪些故事、属于哪个组件、如何分组、由哪类 renderer 渲染”。二者通过 `assetKey` 关联，不把 React 实现导入 shared 注册表。
- `src/components/playground/catalog.ts` 的 Foundation Tab、`FoundationComponentsPanel.tsx` 的分组和 `layout.foundation-workbench` 的故事摘要都从 Foundation 故事注册表派生；新增故事不能只改 catalog 或工作台文案。
- `UiControlsPanel.tsx` 与 `FoundationAdvancedStories.tsx` 是 renderer 实现面：registry 的 `renderer` 决定路由，单元测试同时校验 assetKey、viewId、renderer 分支和实际源码标记；新增候选故事必须补注册、renderer、E2E 和文档。
- 当前 Foundation 故事筛选由注册表派生为 13 个任务入口：按钮、输入与表单、标签与选择、弹层、菜单与提示、徽标与标签、状态反馈、加载与进度、工具卡、Markdown 与资产、文件与差异、布局与滚动、卡片。入口合并只改变导航密度，不减少 story 预览。参考 Alice 后补入的 IconButton、Card、Badge、Tag、Divider 保持 `playground` 生命周期；ToggleRow、NavItem、ThemePicker、划词工具条和 Kbd 暂不登记为本项目 Foundation。

## 目录结构

```
my-agent/
├── electron/
│   ├── main/
│   │   ├── index.ts          # App 生命周期 + 窗口管理 + Tray + Auto Update
│   │   ├── ipc/              # IPC 处理器（按领域拆分，清单以代码为准）
│   │   ├── agent/            # Agent Loop + Runtime + Prompt + Context + Pipeline + Subagent
│   │   ├── tools/            # ToolRegistry + 内置 / Skill / MCP 工具 + Middleware
│   │   ├── services/         # 内部服务（task-plan-service 等，工具调用的底层逻辑）
│   │   ├── sandbox/          # 沙箱系统 + 权限引擎
│   │   ├── mcp/              # MCP Client（stdio + SSE）+ Bridge
│   │   ├── memory/           # 向量存储 + Embedding 适配器
│   │   ├── llm/              # LLM 流式适配器 + Provider 路由 + Failover + Cache
│   │   ├── rag/              # RAG 文档管道（导入 + 分块 + 向量化 + 检索）
│   │   ├── scheduler/        # 定时任务调度器（interval + cron + SQLite 持久化）
│   │   ├── storage/          # SQLite + Session/Settings/Memory Store
│   │   └── utils/            # Logger + 错误脱敏 + Tracer
│   └── preload/              # contextBridge 暴露 API
├── src/
│   ├── App.tsx               # 主 UI
│   ├── components/           # SettingsPanel / MarkdownRenderer / DevPanel / MemoryPanel / SkillsPanel / FileBrowser / Toast
│   └── shared/types.ts       # 共享类型定义
├── __tests__/               # vitest Unit + Playwright E2E
├── methodology/              # 设计哲学沉淀
└── docs/                     # 项目文档
```

## 核心数据流

### 用户输入 → AI 响应（主链路）

```
用户输入 → 渲染进程(React) → IPC chat:send
    → 主进程 AgentRuntime.chat()
        ├─ 记忆检索（向量 + SQLite）
        ├─ 上下文组装（System Prompt 语义模块 + 消息管道清洗）
        ├─ Token 预算检查
        └─ Agent Loop（AsyncGenerator）
            ├─ streamChat → LLM API（Provider Router 自动选择协议）
            ├─ yield text/thinking/tool_calls 事件
            ├─ 工具调用 → Middleware Pipeline → 权限检查 → 执行
            └─ yield done → 后台任务（画像/向量索引/标题）
    → IPC chat:event → 渲染进程按 sessionId 过滤后流式显示

工具确认请求沿同一 IPC 边界携带 sessionId，由对应会话的确认队列承接；主 Chat 与 workspace 侧边聊天不得跨会话消费确认。

`session_kind=workspace` 仍复用人格与工具 Runtime，但跳过长期画像、向量召回、画像提取、标题、向量索引和反思任务；临时工作区对话不得改变主伙伴记忆。

正式侧聊实例以所属主会话 ID 为 React 生命周期边界：同主会话隐藏/切换标签保留，主会话变化重建并沿 session:delete 清理旧运行。创建失败重试走 createWorkspace，不能向空 session 发送；旧发送 Promise 的错误仅能更新仍归属该 session 的实例，正文、草稿和工具确认不跨主会话延续。

侧边聊天可通过 `WorkspaceChatContext` 传入父会话 ID、项目路径和当前文件／审阅焦点；
侧边聊天错误态重试复用失败消息的稳定内容重新进入同一 workspace session；侧边聊天可通过 `WorkspaceChatContext` 传入父会话 ID、项目路径和当前文件／审阅焦点；主进程限制路径与正文长度，Runtime 只读取父会话最近有限消息及焦点内容作为本轮上下文，不复制到 workspace 历史，也不把 Renderer 提供的路径当作工具工作目录或权限依据。
```

### 工具调用链路

```
LLM 返回 tool_calls（可能多个）
    → Agent Loop 按 LLM 原始顺序分批
        ├─ 连续 concurrencySafe 工具 → 并行批次（Promise.all）
        └─ 非安全工具 → 刷新批次，串行执行
    → 每个工具：
        → PermissionEngine 权限检查（五层责任链）
            ├─ allow → 继续
            ├─ needs_approval → IPC tool:confirm-request → 用户确认/拒绝
            └─ deny → 返回拒绝结果
        → ToolRegistry.executeSingle(toolCall, toolContext)
            → MiddlewarePipeline（error-formatting → logging → truncation）
                → toolDef.execute(args, ctx)  ← ToolContext 注入 workdir/sessionId/signal
    → yield tool_end → 继续 loop
```

### 数据持久化流

```
对话完成
    ├─ SQLite：保存消息（含 toolCalls + tool results）+ 累加 token 用量
    ├─ 向量数据库：异步嵌入并索引用户消息
    └─ 日 Token 计数器：recordDailyUsage
```

- 开发者模式沿 `SettingsPanel → settings:set/get → settings-store → App → PrimarySidebar` 单一路径控制 Debug / Playground 可见性；默认关闭，关闭仅收回入口，不影响诊断服务、资产或历史数据。

- 模型配置的产品入口统一由 `ModelRoutingSettings` 组合真实设置存储、路由配置工厂与主进程模型发现；空清单不合成连接或用途，不恢复旧单连接身份。Chat 仅展示实际主模型，配置在正式模型页管理；Playground 获取仍是隔离 fixture。

- LLM 配置工厂提供主对话、辅助任务和独立生图配置；Runtime 的图片输入仍使用主对话配置，image_generate 才调用生图配置。

- 2026-10-30：Chat 人物生活写入沿现有分层落地：`tools/builtins/companion-life.ts` 只做工具薄包装，朋友圈写入 `companion_events` 后由 `life/moments.ts` 投影，家居等资料经 `life/assets.ts` 白名单入库；生图动态绑定经 `life/moment-images.ts` 写 `companion_event_links`。不新增 Renderer 直写路径或第二份生活真相。
- 2026-10-30：关系资料继续沿 Role Pack / Universe relations 单一来源：`cast/relation-summary.ts` 负责跨名册、通讯录、Debug 的短摘要投影，关系弧线不进入用户记忆或 MUTABLE。
- 2026-10-30：关系事件由 Chat 工具写入 `companion_events.payload.relationship / participantIds`，`life/moments.ts` 投影为 `companion_event_links(targetType=cast, relation=coframe)`；参与者和阶段不创建第二份关系真相。
- 2026-10-31：人物设计新增的首次冷启与既有经历资料仍属于 Role Pack / Debug 资产层：loader 读取人物清单和场景文件，Prompt 注册表负责防漏登记，运行时按当前功能选择性注入；用户草稿先写入独立 userData，发布时才转换为 Universe / Role Pack，不新增 Renderer 直写生产资产路径。
- 2026-10-31：首次冷启门闸落在 companion life store 与 IPC，按人物保存一次性领取记录；UI 只消费结果，避免把展示状态写进人物 Prompt 或用户记忆。
- 2026-10-31：世界观 canon 篇章 / 事件与人物视角由 companion loader / asset registry 读取；`web_search` / `url_fetch` 只提供外部候选证据，用户确认后才通过人物草稿发布链进入 Role Pack。

- 2026-11-02：Chat 世界读取沿 builtinTools → companion_read_world → companion life store/assets 单向调用，当前会话 roleId 是唯一查询归属；不新增 Renderer 直写接口。

- 2026-11-02：世界观切换沿 Settings / CharacterShelfPanel → companion:switch-universe → orchestrator 运行；Chat ToolRegistry 不持有该能力。
## 人物关系与情绪事实

生活事件发布时，关系载荷写入 `companion_relationship_state`，情绪载荷写入 `companion_emotion_events`；运行时只读取摘要注入人物表达，Debug 世界态展示结构化证据。朋友圈节奏与可见范围来自设置存储，用户读取入口执行策略，Debug 保留完整事实。关系与情绪不得改变工具权限、审批或任务执行。

- 2026-11-03：运行时先读 companion life 的持久化关系 / 情绪事实，再注入主 Prompt；Debug 世界态沿同一事实源只读展示，情绪不进入权限或任务执行链。

- 2026-11-03：朋友圈自动分享从 LifeEngine / Catch-up 进入策略门控，读取 settings-store 的节奏、上限、冷却、勿扰和配图偏好；手动路径不复用自动门控。

- 2026-11-04：朋友圈策略从发帖节奏扩展到自动卡司互动，settings-store 是唯一策略来源，Debug 展示同一值。

- 2026-11-05：Debug 世界态读取记忆时使用共享 / 当前人物范围过滤，仍只读，不改变 memory-store 的存储与召回策略。

- 2026-11-05：新增 `companion_event_executions` 诊断表，记录自动生活事件的分享决策；事件事实与朋友圈投影保持分离。
<!-- 2026-11-06：生活自动配图读取设置预算并写入 companion media，数据流不穿过 memory 层。 -->
<!-- 2026-11-06：阅读笔记确认工具沿 ipc/agent/tools → companion/life/assets 写入，不绕过角色归属校验。 -->
### 2026-11-10 伙伴生活 IPC 数据流

Renderer 通过 preload 调用宿主作息和计划重排通道，主进程 IPC 层完成输入校验后调用 companion life 服务，状态与会话写入仍由主进程内部完成。
主对话 `chat:send` 在消息校验后把活动时间交给宿主作息服务，保持现实锚点从主进程入口统一记录。

赠礼请求由 preload 进入 companion IPC，经主进程和生活服务双层校验后才写入 SQLite 与主会话。

生活互动文本在 companion IPC 层完成边界校验后才进入 Prompt、SQLite 和主会话链路。

旅行推进的用户文本在主进程校验后才进入生活资产持久化。

思绪与信物输入经主进程校验后才进入生活服务。

深夜反思和怀旧回忆的强制模式由显式参数控制，普通 Renderer 调用走冷却路径。

宿主作息数据流以主进程接收时刻为时间源。

生活历史查询在 IPC 层先应用结果数量上限。
## 2026-11-13 IPC 可信发送方收口

通用 IPC handler 通过 `registerSecureIpcHandler` 统一检查 sender 生命周期和主框架来源。MCP、Settings、Terminal、Browser 与生成图片读取保留各自的 OAuth、请求租约、导航、销毁窗口和凭据隔离复核，并调用同一 `assertTrustedIpcSender`。这层校验只负责入口可信性，人物、会话和工具权限仍由应用层与 Permission Engine 决定。

Skill Registry 初始化完成后同步 Skill key 与激活工具元数据到 Host，Skill 正文和实际激活继续由既有 Skill Registry 管理，Host 不复制 Skill 正文或业务实现。
