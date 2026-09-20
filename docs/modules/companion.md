# 伙伴世界（Companion）

## 一句话

同宇宙多主角架构下，**唯一活跃主角**接管聊天、生活世界、朋友圈与衣柜；文案资产化，组装器只拼装。

## 边界

**做**：Role Pack / 单活跃门控 / MUTABLE 版本与自动反思 / LifeEngine（暂停·剧本·tick）/ Catch-up≤7×24h / Moments·Assets 截面 / 名册浅注入 / 冷启动在场 / 召唤子会话与忙闲婉拒。  
**不做**：会话中途换角；非活跃后台养成；多宇宙并行；生图朋友圈（非本阶段）。

## 短 Why

只有 Prompt 换皮是工具；有暂停的生活世界与派生截面，才是「同一个人」的伙伴感。

## 主入口

| 类型 | 位置 |
|------|------|
| UI · 生活面 | 侧栏「人物世界」（`WorldHub`：朋友圈 / 衣柜 / 文化角 / 家居 / 通讯录 / 足迹）；角色架归设置 |
| UI · 工具面 | 设置「伙伴与相处」：回答方式、相处补充说明、生活提醒、主动问候、角色架；旧 MUTABLE / 反思表单不再保留为设置入口，后端服务仍保留 |
| IPC | `companion:*`（list / switch / moments / toggle-moment-like / add-moment-comment / assets / roster / catchup-status(+presence) / start-summon / reflection…） |
| Prompt | `prompt-builder` + `orchestrator.loadRoleAssembleInput`（管线见下方「Prompt 组装」） |
| 资产 | `electron/main/companion/universes/default/` |
| 契约 | `docs/requirements/companion-*.md`；前端方案 [frontend-companion-surfaces.md](../requirements/frontend-companion-surfaces.md) |

### 前端 View 映射

| View | 组件 | 说明 |
|------|------|------|
| `chat` | App + CompanionSceneBackdrop | 对话；弱场景随地点 |
| `world` | WorldHub | 人物世界口袋（内页 tab） |
| `moments` | MomentsPanel（经 WorldHub） | 朋友圈卡片时间线 |
| `assets` | AssetsPanel | 衣柜（P1 加厚主视觉） |
| `cast` | CastPanel | 通讯录 / 召唤（≠换活跃） |
| `shelf` | CharacterShelfPanel | 角色架换角 |
| `settings` | SettingsPanel + CompanionSettingsContent | 相处偏好 / 提醒 / 角色架；与 Playground 共用业务组合，数据隔离 |

## 依赖

- **依赖**：settings-store、SQLite、streaming-gate、LLM（反思 / 日后剧本生成）、task-queue  
- **被依赖**：runtime 聊天组装、Eval C01 / B01–B07、设置页、CastPanel

## 不变量

- 同时仅一个 `activeRoleId`  
- 流式进行中 `requestSwitch` → `SESSION_ACTIVE`  
- 非活跃不 tick、不生成剧本/事件  
- 名册只注入 summary/关系短句，不注入他人全文 protected  
- 召唤不改 active、不推进对方生活世界  
- 朋友圈/衣柜为事件与资产的派生截面，非第二真相库  

## 必读文件

- `electron/main/companion/orchestrator.ts`
- `electron/main/companion/life/engine.ts`
- `electron/main/companion/cast/roster.ts`
- `electron/main/companion/growth/reflection-service.ts`
- `electron/main/agent/prompt-builder.ts`
- `electron/main/agent/runtime.ts`（组装 + 召回 + 反思调度）
- `docs/requirements/companion-tech-spec.md`

## 必测点

- 换角门控、Catch-up 7 日边界、名册无他人 protected、资产按 role 隔离  
- 住所 / 常去地点初始化并发幂等、事务失败回滚、已有资产优先、删空后重载不复活；正式列表刷新失败保留旧内容，跨主角响应不混合
- 召唤不改 active；反思门闸 / 召唤跳过  
- Eval：`evals/scenarios/c01-companion.ts`；语气基线 `b01-persona-tone.ts`；主角行为 `b02-protagonist-behavior.ts`（真实模型判断需 key）

## 已落地能力

- 文化角、家居、足迹共用的 WorldDetailsPanel 订阅正式角色变化，立即清除旧主角的展示与未提交草稿，再读取新角色；旧请求不覆盖新内容，预览不订阅生产事件。真实 Electron 从四个资产页面（含衣柜）验收 requestSwitch / 广播 / 当前角色存储链，切换来回与重载后各角色资产保持隔离；此证据不代替跨角色在途写入竞争验证。

- 衣柜读取按请求序号发布最新结果，并校验 active、assets、moments 的角色身份；切角立即清除旧列表、穿着和草稿，迟到响应不能覆盖新主角。普通刷新失败保留已加载内容并提示重试；角色不一致清空混合结果。重试复用原刷新按钮尺寸，深浅宽窄与受控迟到响应回归已覆盖；不改变资产写入和存储契约。

- 生产初始化不再生成服务内置的衣物、书籍、歌单、电影与摄影记录；当前角色未定义这些初始资产时展示真实空态。Role Pack 世界默认、用户创建和已发布事件资产不受影响；Playground 样张仍隔离。此次不批量删除旧数据库中的历史记录，不把已有记录当成角色设定已确认的证据。

- 伙伴设置的回答方式、相处补充说明和提醒数字输入均组合 Foundation ActionButton / TextField；正式与 Playground 使用同一 CompanionSettingsContent，不再在业务组合中复制原生按钮 / 数字输入。候选的勿扰时段、次数及补充说明可在隔离内存中编辑，不再使用空回调；正式保存链路不变。绑定门禁检查真实 JSX 符号而非 import 声明，正式入口覆盖四主题宽窄、键盘选中、hover 尺寸与保存失败恢复。

- 生活剧本、朋友圈润色、Catch-up 摘要与显式反思入口用共享连接认证判断，允许已配置的本机兼容无 Key 辅助模型；仍保留原有 preferLlm、数据校验和失败回退，不更改主动调用时机、反思门闸或角色隔离。协议可连接不代表任意本地型号能正确生成结构化生活内容。

- 朋友圈正式页与 Playground 共用卡片样式，hover 只改变颜色，不再通过 translateY 移动整张卡片；评论槽在展开前后保持相同尺寸与位置。衣柜删除失败保留确认、原条目与重试入口，测试按真实无障碍按钮名称及脱敏错误提示验收。
- 人物世界正式入口提供六个生活面：朋友圈、衣柜、文化角、家居、通讯录、足迹。朋友圈、衣柜和通讯录读取现有 companion IPC；正式通讯录列表会先读取既有 `check-cast-availability` 展示方便 / 忙碌，开聊仍走 `startSummon` 二次判定。文化角、家居和足迹复用按主角隔离的 `companion_assets`，其中家居与常去地点仅在 Role Pack 提供真实 `world.default` 时幂等播种；小林当前没有该资产，正式家居 / 常去保持空态。没有 `world.default.json` 时，运行态 `world_json`、Catch-up 和 Prompt 切片的居所 / 当前位置回退为「未设定」，不再写入城西小公寓、日常住处或家。生活动态地点作为足迹的近期补充，不把 Playground fixture 当作生产数据源。衣柜、书架和文化角不再从服务硬编码默认值生成作品、穿着或阅读经历；无 Role Pack 定义时为空。
- 家居与足迹的正式页、Playground 使用同一 `WorldLivingContent` 纯展示组件；家居保留住所结构和生活物件，足迹分开常去、显式想去记录与实际动态，不用资产初始化时间伪造访问日期，同地点不同动态保留各自正文和日期。正式刷新失败保留内容并可重试，响应主角不一致则清空并提示重试。
- 新住所 / 地点的初始化标记与资产在同一 SQLite 事务内写入 `companion_asset_seeds`；仅真实 Role Pack 提供默认数据时初始化，不覆盖已有记录，删除后重载不补种。文化角 / 衣柜 / 书架沿用既有初始化语义，不外推该删除保证。
- 文化角通过 `WorldCultureContent` 同源展示四类文化卡片、书架阅读内容和关联读书笔记；`detail` 与 `note` 同时存在时均保留，重名作品按资产 ID 区分，未知类型保留为文化记录，空数据不生成作品。正式页沿既有资产 IPC 读取，并通过 `companion:create-asset` 与既有 update / delete 编辑衣柜、文化、家居物件和足迹地点；Playground 只传隔离 props 并改内存预览。
- 文化 / 书架资产更新中的 `note`、`detail`、`description` 支持最多 4000 UTF-16 代码单元，保留换行，超限或错误类型在写入前拒绝整次修改，不再按衣柜标签截为 24 字。书架进入 Prompt 仍只取 24 字笔记摘要；其余资产短标签规则不变，历史已截断正文无法自动恢复。
- 正式设置「数据与隐私」的导出 / 导入覆盖 `companion_assets` 与 `companion_asset_seeds`；按稳定 id / 播种键合并，不覆盖现有记录。会话与生活资产同一事务，失败整笔回滚。旧备份缺这两项仍可导入。记忆继续走 `memoryStore.addMemory`。不导出朋友圈互动、MCP、权限、API Key 和本机项目路径。

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 用户入口 | 落点 |
|------|------|----------|------|
| 用户相处补充说明 | 已落地 | 设置 → 伙伴与相处 | 独立 `companionResponseNote`，默认空、最多 4000 UTF-16 代码单元；仅保存实际修改，失败保留草稿并提供固定操作槽重试。作为 L3 偏好用于下一轮主对话 / 召唤，workspace 排除；不迁移或覆盖旧 `systemPrompt`，不改变角色身份和工具权限。备份白名单包含该字段，导入前同样限长 |
| 生活资产与朋友圈备份往返 | 已落地 | 设置 → 数据与隐私 | `data:export` / `data:import` 覆盖生活资产、播种标记、已发布事件、动态快照及用户赞评；按稳定身份合并，同一事务失败回滚。旧备份缺字段仍可导入。不包含未来事件、日剧本、当前世界态、MCP、权限、凭据和项目路径；恢复历史不重放奖励 |
| Universe + Role Pack（三槽：lin / zhou / xia） | 已落地 | 角色架 / 设置 | `universes/default/` · 文案见 [companion-cast-content](../requirements/companion-cast-content.md) |
| 主角候选结构化档案（Role Profile） | 已落地 | Debug「世界态」/ Prompt L1 | 当前仅小航 `profile.json`；行为边界与五维表达基线已定，人物故事字段待定 |
| 伙伴生产资产目录 | 已落地 | Debug「提示词管理器 → 伙伴世界」 | `companion/asset-registry.ts`；manifest / profile / 默认世界 / 场景 / 衣柜书架 starter 使用稳定 key、版本、指纹、来源和依赖 |
| 生活资产来源边界 | 已落地 | 衣柜 / 文化角 / 家居 / 足迹 | 衣柜、书架、文化默认样张不再播种；住所 / 地点 / 物件沿用真实 world.default，用户 CRUD 与已发布事件授予保留。已有数据库不批量清空 |
| 日剧本 LLM（当日）+ 哈希回退 | 已落地 | （隐式）Life ticker | `resolveDayScript` · aux-config |
| 世界状态薄片（居所/时区/情境/心情/精力/当前位置与活动） | 已落地 | （隐式）Assemble L3 | schema v1 `world_json` · `## World slice`；无 Role Pack 世界默认时 home / currentLocation 为「未设定」 |
| 主角候选默认世界结构 | 已落地 | Debug「世界态」/ 世界初始化 | 当前仅小航 `world.default.json`；城市、住所、地点、物品与作息均待定 |
| 主角候选行为人格验收 | 已落地 | Playground「人格验收」/ `npm run eval:persona` | 七个中性故事格 + B02–B07 DeepSeek `pass^3`；自动门禁已过，人工语气审美待本地验收 |
| 伙伴 Prompt 自有框架文案统一中文 | 已落地 | 人物档案 / 世界 / 关系阶段 / 里程碑 / 召唤任务工动态注入；Role Pack 原文继续作为单一事实源 |
| Catch-up 概况 LLM + 模板回退 | 已落地 | （隐式）换角追赶 | `resolveCatchupSummary` · catchup.ts |
| 聊圈薄一致性（近 Moment 锚点） | 已落地 | （隐式）Assemble L3 | `moment-consistency` · `## Recent moments` |
| Moment LLM 润色（绑 event） | 已落地 | （隐式）tick 发布 | `moment-polish` · 规则回退 |
| 单活跃 + 流式换角门控 | 已落地 | **角色架（主）** / 设置（次） | `orchestrator` · `streaming-gate` · `requestSwitch` |
| 会话绑定 `role_id` | 已落地 | （隐式）Chat 顶栏徽标 | `runtime` · `assertSessionRole` |
| MUTABLE 分桶版本 + 回滚 | 已落地 | 设置 | `mutable-store` · Settings |
| 自动反思写 MUTABLE | 已落地 | 设置「立即/强制反思」 | `reflection-*` · task-queue |
| 成长时钟按 role 分桶（72h） | 已落地 | （隐式）反思门闸 | `companionGrowthStartedAtByRole` |
| feedback 记忆按 role 分桶 | 已落地 | （隐式）反思 / L3 画像 | `memories.role_id` · `listFeedbackForRole` |
| MUTABLE 结构性防退化（G3） | 已落地 | 设置保存 / 自动反思 | `mutable-validate` · setMutable 门闸 |
| 反思吃生活薄信号（G4） | 已落地 | （隐式）自动/手动反思 | `life-signals` · Moments + Catch-up |
| LifeEngine（暂停 · 剧本 · tick） | 已落地 | （隐式）presence / Prompt | `life/engine.ts` |
| Debug 计划 / 发布状态时间线 | 已落地 | Debug「世界态」只读视图 | `debug-world-snapshot` 有界读取 planned / published 事件；不提供生活世界写操作 |
| Catch-up ≤7×24h | 已落地 | 朋友圈暖色条 / Prompt | `life/catchup` · `catchup-status` |
| 此刻 presence | 已落地 | Catch-up / Prompt | `describeCastPresence` · `catchup-status.presence` |
| Moments（朋友圈） | 已落地 | 人物世界 / 欢迎屏 → 朋友圈 | `get-moments` · `toggle-moment-like` · `add-moment-comment` · MomentsPanel · 卡司互动 meta；正式页真实赞 / 评论落独立用户表，不改 moment.text；Playground 可用只读 Moments / Catch-up 样张、可选本地图片内容位且跳过 IPC |
| 正式人物世界朋友圈流默认态 | 已落地 | `WorldHub` 默认 `alice-feed` 并隐藏重复标题；保留真实动态、时间 / 地点、真实赞评和近期窗口说明 |
| Assets（物什） | 已落地 | 人物世界衣柜 / 文化角 / 家居 / 足迹 | wardrobe/bookshelf/culture/home/footprint/furniture · `get/create/update/delete-asset` · AssetsPanel / WorldDetailsPanel / WorldAssetEditor |
| 名册浅注入 | 已落地 | （Prompt） | `cast/roster` |
| CastPanel（通讯录 / 召唤） | 已落地 | 人物世界 → 通讯录 | CastPanel · `start-summon` · 场景 prompt |
| 召唤子会话 | 已落地 | 通讯录「开聊」 | 不改 active / 不 tick；可 delegate（任务工） |
| 召唤忙闲婉拒 + force | 已落地 | 通讯录列表预检 / 开聊前 | `check-cast-availability` · CastPanel 卡片展示 |
| 衣柜删除与强制开聊确认恢复 | 已落地 | 人物世界衣柜 / 通讯录 | 复用 `ConfirmPanel`；删除物什或强制召唤在成功前不关闭确认，失败可重试，处理中禁止取消和重复提交 |
| 冷启动在场文案 | 已落地 | Chat 空态欢迎屏 | `companion-presence.ts` |
| 角色架 UI | 已落地 | 设置「角色架」 | CharacterShelfPanel · `shelf` |
| 物什主视觉（衣柜穿着中 + 书架分栏） | 已落地 | 人物世界 / 欢迎屏 → 物什 | AssetsPanel · Moment.assetId/outfit |
| 名册关系卡 + 最近召唤互动 | 已落地 | 人物世界 → 通讯录 | CastPanel · sessions(summon) |
| 场景弱背景（Chat 氛围） | 已落地 | Chat 消息区底层 | `CompanionSceneBackdrop` · `companion-scene.ts` |
| 前端视觉语言（token / 设置 IA / Chat 气质） | 已落地 | 主题·设置·侧栏身份·空态 | `frontend-visual-language` Phase1–3 |
| Alice 壳 Phase A（大气侧栏） | 已落地 | Primary/底栏宫格只保留人物世界与设置；记忆与 Skills 从 Settings 进入 | `PrimarySidebar` · `frontend-alice-shell` |
| Chat 侧栏会话搜索与收起动效 | 已落地 | Primary Sidebar 顶部搜索 / Ctrl+B | `PrimarySidebar` · `App` · `sidebar-transition` |
| Chat 消息区大气化（Phase B 留白） | 已落地 | 消息流 `space-y-8`；工具卡见 agent-runtime | `frontend-alice-shell` Phase B |
| 人物世界口袋（对齐 Alice `/moments`） | 已落地 | 侧栏一入口 + 内页 tab | `WorldHub` |
| 伴侣状态条（展厅故事格） | 已落地 | Playground UI · 状态条 | `CompanionStatusBar` · Chat 顶栏已撤 |
| 生图朋友圈 / 多宇宙并行 | 缺口 | — | wishlist / 非本阶段 |
| 非活跃后台养成 | 缺口 | — | 产品明确不做 |

### Prompt / 召回组装管线（聊天一轮）

主路径：`AgentRuntime` → `loadRoleAssembleInput` → `buildSystemPrompt` → Loop。

```text
用户发消息
  → assertSessionRole(session.role_id)          # 禁止偷换人设
  → loadRoleAssembleInput(roleId)               # Pack + MUTABLE + catchup + worldSlice + recentMoments + roster
  → detectReplyStance(lastUser)                 # M27-G1 问/做/安慰/推回 hint
  → resolveToneControl(stance, mode, text)      # M27-G3 紧/软/中性 + aside 策略
  → resolveRelationshipStageForRole(...)        # M28-G1/G2 阶段 + 交心/干活 lean
  → memory.buildUserProfile()                   # 结构化画像
  → safeVectorSearch(lastUser)                  # 向量语义召回 → L3 memories
  → yield memory_citations                      # M29-G1 UI 芯片
  → buildSystemPrompt({
        L1: PROTECTED + MUTABLE
        L2: 工具/aside/stance/tone/relationship/skill 摘要
        L3: 画像 + memories + catchup + worldSlice + recentMoments + roster
        L4: 动态（时间等）
     })
  → Agent Loop（流式）
  → 后台：profile-extract / smart-title / vector-index-user
  → scheduleReflectionAfterChat（召唤会话跳过）
```

召唤差异：装载对方完整 Pack；**不**改 `activeRoleId`；**不** tick / catchup 对方生活；Prompt 可带忙闲情境（`describeCastPresence`）。

## 相关决策

- `DEC-034`：同团多 Role Pack、单活跃角色、会话中禁止换角。
- `DEC-035`：主角交付节奏、破坏性重置和 `activeRoleId`。
- `DEC-036`：角色档案、默认世界与表达状态分层。

## 现状 / 缺口

**现状**：W0–W6 主线已落地；深 Why：`methodology/m22`–`m31`（Part VI 收齐）；前端 P0–P2 已落地；小航 B02–B07 真实 DeepSeek `pass^3` 已通过，仍待本地人工语气审美验收；人物故事尚未确定且未激活；其他角色本轮不扩写。
**缺口**：见上表「缺口」行 + wishlist；生图场景等非本阶段。

- 2026-09-14：文化角正式使用 `companion_assets(kind=culture)`，按主角隔离并复用既有资产 CRUD / starter 播种；资产 payload 的 `type` 区分 reading、music、film、photography。
- 2026-09-15：家居与足迹接入同一 `companion_assets` 事实链，分别使用 `kind=home` 与 `kind=footprint`；家居读取住所结构，足迹读取角色常去地点，近期动态仅作为补充。
- 2026-09-16：衣柜删除与通讯录强制开聊改为成功后才关闭确认；失败保留同一确认，处理中禁止取消和重复提交。不改 IPC、存储或召唤忙闲判定。该补验不关闭生活面编辑、备份或六面完整验收。
- 2026-09-17：衣柜、文化角、家居和足迹正式页接入用户创建白名单与真实增改删；Playground 只做内存预览。Electron 覆盖文化 / 家居物件 / 想去地点的 create、重载保留、超限拒绝和删除清理。正式通讯录列表读取既有忙闲判定，忙碌仍可开聊并进入强制确认；Playground 通讯录保持静态夹具。正式朋友圈赞 / 评论落独立用户表，重载后保留，不改动态正文或卡司投影。人物 starter 来源复核仍未完成。
- 2026-09-17：正式备份覆盖生活资产与播种标记；按 id 合并、失败回滚，旧备份缺字段仍可导入。Electron 覆盖独立目录真实导出导入往返与二次导入不覆盖。朋友圈互动仍不进入备份。人物 starter 来源复核仍未完成。
- 2026-09-17：正式人物世界六面可从侧栏入口点开并读取真实 companion 数据；Electron 覆盖朋友圈、衣柜 starter、文化四类、家居空态、通讯录关系卡 / 忙闲和足迹动态地点。文化 starter 去掉无证据数量文案，不新编人物故事。人物 starter 来源复核仍未完成，数据库有记录不等于已获确认的人物事实。
- 2026-09-17：人物 starter 来源复核收口无 `world.default.json` 的运行态泄漏：lin / zhou / xia 的默认居所和当前位置改为「未设定」，Catch-up 空居所不再写「日常住处」。衣柜 / 文化分味播种仍不是已确认人物事实。
