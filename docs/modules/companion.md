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
| UI · 生活面 | 侧栏「人物世界」口袋（`WorldHub`：朋友圈/物什/名册/角色架）；欢迎屏快捷 |
| UI · 工具面 | 设置「伙伴」：MUTABLE/反思 + 活跃主角（次要）；记忆与 Skills 均从 Settings 进入 |
| IPC | `companion:*`（list / switch / moments / assets / roster / catchup-status(+presence) / start-summon / reflection…） |
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
| `cast` | CastPanel | 名册 / 召唤（≠换活跃） |
| `shelf` | CharacterShelfPanel | 角色架换角 |
| `settings` | SettingsPanel | 伴侣开关 / MUTABLE / 反思 |

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
- 召唤不改 active；反思门闸 / 召唤跳过  
- Eval：`evals/scenarios/c01-companion.ts`；语气基线 `b01-persona-tone.ts`；主角行为 `b02-protagonist-behavior.ts`（真实模型判断需 key）

## 已落地能力

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 用户入口 | 落点 |
|------|------|----------|------|
| Universe + Role Pack（三槽：lin / zhou / xia） | 已落地 | 角色架 / 设置 | `universes/default/` · 文案见 [companion-cast-content](../requirements/companion-cast-content.md) |
| 主角候选结构化档案（Role Profile） | 已落地 | Debug「世界态」/ Prompt L1 | 当前仅小航 `profile.json`；行为边界与五维表达基线已定，人物故事字段待定 |
| 伙伴生产资产目录 | 已落地 | Debug「提示词管理器 → 伙伴世界」 | `companion/asset-registry.ts`；manifest / profile / 默认世界 / 场景 / 衣柜书架 starter 使用稳定 key、版本、指纹、来源和依赖 |
| 生活分味（剧本 / starter 衣柜） | 已落地 | 朋友圈 / 衣柜随主角 | `script-generator` · `ensureStarterWardrobe` |
| 日剧本 LLM（当日）+ 哈希回退 | 已落地 | （隐式）Life ticker | `resolveDayScript` · aux-config |
| 世界状态薄片（居所/时区/情境/心情/精力/当前位置与活动） | 已落地 | （隐式）Assemble L3 | schema v1 `world_json` · `## World slice` |
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
| Moments（朋友圈） | 已落地 | 人物世界 / 欢迎屏 → 朋友圈 | `get-moments` · MomentsPanel · 卡司互动 meta；Playground 可用只读 Moments / Catch-up 样张且跳过 IPC |
| 正式人物世界朋友圈流默认态 | 已落地 | `WorldHub` 默认 `social-feed` 并隐藏重复标题；保留真实动态、时间 / 地点、互动和近期窗口说明 |
| Assets（物什） | 已落地 | 欢迎屏 → 物什 | wardrobe/bookshelf · `get/update/delete-asset` · AssetsPanel |
| 名册浅注入 | 已落地 | （Prompt） | `cast/roster` |
| CastPanel（名册 / 召唤） | 已落地 | 人物世界 / 欢迎屏 → 名册 | CastPanel · `start-summon` · 场景 prompt |
| 召唤子会话 | 已落地 | 名册「开聊」 | 不改 active / 不 tick；可 delegate（任务工） |
| 召唤忙闲婉拒 + force | 已落地 | 名册开聊前 | `check-cast-availability` |
| 冷启动在场文案 | 已落地 | Chat 空态欢迎屏 | `companion-presence.ts` |
| 角色架 UI | 已落地 | 人物世界 / 欢迎「换主角」 | CharacterShelfPanel · `shelf` |
| 物什主视觉（衣柜穿着中 + 书架分栏） | 已落地 | 人物世界 / 欢迎屏 → 物什 | AssetsPanel · Moment.assetId/outfit |
| 名册关系卡 + 最近召唤互动 | 已落地 | 人物世界 / 欢迎屏 → 名册 | CastPanel · sessions(summon) |
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
