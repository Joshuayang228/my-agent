# My Agent 目标架构深度源码二审报告（2026-11-19）

## 1. 结论与审计基线

- **审计日期**：2026-11-19
- **源码基线**：`48fadcc1`（在 `WISH-050` 首轮 `A01`–`A18` 收口之后执行零信任二审）
- **总体结论**：首轮 `A01`–`A18` 的 18 项局部一致性缺口已闭合，但对照 5 份目标架构合同（`agent-host-architecture-v1.md`、`companion-world-engine-core-v1.md`、`architecture-reliability-hardening-v1.md`、`top-level-architecture-closeout-v1.md`、`architecture-migration-final-v1.md`）对 `electron/main` 全量源码进行零信任穿透审查后，确认存在 **12 项未迁移完的架构断点与真实缺陷（B01–B12）**，其中 **1 项 P0（数据导出崩溃与新核心表备份缺失）**、**7 项 P1**、**4 项 P2**。
- **活跃追踪与施工入口**：心愿池由 `WISH-051` 统一跟踪，施工范围与批次由 `docs/requirements/architecture-deep-audit-remediation-v2.md` 管理。

---

## 2. 二审问题总表（B01–B12）

| ID | 优先级 | 问题摘要 | 关键位置 | 证据级别 |
|---|---|---|---|---|
| **B01** | **P0** | 朋友圈一旦出现角色 / NPC 自动回复，全应用数据导出（`data:export`）必挂；且新迁移的 Companion Core / 生活表与自动配图媒体完全未纳入备份恢复 | `electron/main/storage/moment-backup.ts:57-68, 126-142, 240-241`、`electron/main/ipc/data-export.ts:684-716` | 源码确认 |
| **B02** | **P1** | Agent Host 仅注册 7 个样板 Capability，其余 7 个伙伴工具与 3 个记忆工具留在 `tools/builtins/`，绕过 `AgentHostManifest` 的 `grantedPermissions` 与 `capabilityPolicy` 门禁 | `electron/main/agent-host/builtin-domains.ts:12-168`、`electron/main/agent-host/scoped-catalog.ts:26-28`、`electron/main/tools/builtins/companion-life.ts`、`memory-manage.ts` | 源码确认 |
| **B03** | **P1** | 主对话 System Prompt 重复注入人物运行态（`loadConversationAssemblyInput.worldSlice` 与 `companion.runtime-context` 双重拼接同一位置 / 活动 / 状态） | `electron/main/agent/runtime.ts:243-257, 350-354`、`electron/main/agent-host/builtin-domains.ts:80-93` | 源码确认 |
| **B04** | **P1** | 5 处手写裸 `db.run('BEGIN')` 绕过 `withDatabaseTransaction` 队列；定时器或嵌套调用触发时会导致 `cannot start a transaction within a transaction` 甚至在 `catch` 中误回滚外层事务 | `electron/main/storage/diagnostic-history-store.ts:95`、`electron/main/companion/life/assets.ts:889, 1167`、`electron/main/storage/proactive-evidence-store.ts:57`、`electron/main/ipc/data-export.ts:525, 594` | 源码确认 |
| **B05** | **P1** | 可变人格 `setMutable` / `rollbackMutable` 绕过 `requireActiveWriteRole`、`executeCompanionCommand` 与 `withDatabaseTransaction`，且 IPC 未传 `universeId` 导致自定义世界观写人设必败 | `electron/main/ipc/companion.ts:135-167`、`electron/main/companion/growth/mutable-store.ts:101-161, 192-215` | 源码确认 |
| **B06** | **P1** | 只读查询与 Prompt 组装夹带写副作用：`ensureVulnerabilityTable` 每次读取无条件 `persist()` 全量写盘；`get-today-timeline` 读取时调 LLM 写库；`collectDayScriptLifeContext` 在 LLM 成功前提前落盘 `markResonancesAbsorbed`；建表硬编码播种 `'luffy'` | `electron/main/companion/life/vulnerability.ts:156`、`timeline.ts:17-31`、`script-generator.ts:281-291`、`relationship-keepsake.ts:130-161`、`inner-thoughts.ts:166-203` | 源码确认 |
| **B07** | **P1** | 跨世界观切换（`switchUniverse`）无条件调用 `resumeRole` 抹除目标主角 `pausedAt`，导致切回原世界观时永久丢失 Catch-up 补叙；`broadcastRoleChanged` 漏检 `!win.isDestroyed()` | `electron/main/companion/orchestrator.ts:479-488`、`electron/main/companion/adapters/window-outbox-dispatcher.ts:37-39` | 源码确认 |
| **B08** | **P1** | 命令与角色边界残留漏洞：`deleteInnerThought` 未校验 `role_id` 可跨角色删日记；`completeCultureResonance` 在 `withCompanionUnitOfWork` 内部反向嵌套 `executeCompanionCommand`；`sendGiftToCompanion` 与 `comfortVulnerability` 里程碑未走统一事件 / 广播闭环 | `electron/main/companion/life/inner-thoughts.ts:247-253`、`chat-resonance.ts:488-530`、`gifting.ts:364-372`、`vulnerability.ts:390-395` | 源码确认 |
| **B09** | **P2** | 两套关系阶段系统分裂：`growth/relationship-stage.ts`（驱动 `behavior.relationshipStage`）与 `companion_relationship_state`（驱动 `situation.relationshipSummary` 与朋友圈可见窗口）互不通信 | `electron/main/companion/growth/relationship-stage.ts:62-166`、`electron/main/companion/core/persistence/life-repository.ts:80-126`、`electron/main/agent/runtime.ts:431, 449` | 源码确认 |
| **B10** | **P2** | 数据库 Schema 四处分裂与高频重复 DDL：`core/schema.ts`、`life-schema.ts` 与 10 余个 `ensure*Table()` 未绑数据库实例缓存，每次读写重复执行数十条 `CREATE TABLE` 与 `try { ALTER TABLE } catch {}` | `electron/main/companion/core/schema.ts:10-130`、`core/persistence/life-schema.ts:3-162`、`life/*.ts`、`growth/*.ts` | 源码确认 |
| **B11** | **P2** | 僵尸代码与双轨配置残留：`co-decision.ts` 写入口无任何生产调用却仍在日剧本生成时建表并播种死数据；`companionProactiveGreetingLastDay` 等废弃设置键仍残留在 store 与备份白名单 | `electron/main/companion/life/co-decision.ts`、`script-generator.ts:287-291`、`proactive-greeting.ts:31`、`settings-store.ts:169` | 源码确认 |
| **B12** | **P2** | 10 张高频追加表缺少 TTL / 行数上限裁剪，在 `sql.js` 全量内存 + 全量 `db.export()` 架构下会导致内存与写盘耗时随使用时间线性膨胀 | `companion_execution_runs`、`companion_outbox`、`companion_domain_events`、`companion_projection_receipts`、`companion_proactive_budget`、`background_tasks`、`scheduled_task_runs` 等 | 源码确认 |

---

## 3. 逐项详细证据与根因分析

### B01（P0）：备份导出因朋友圈角色回复永久崩溃，且 Companion 核心与生活表大量漏备

1. **朋友圈角色 / NPC 回复直接导致 `data:export` 失败**：
   - `electron/main/companion/life/moments.ts:520-530` 在主角或卡司回复用户评论时，向 `companion_moment_user_interactions` 写入 `actor_id = input.responderId`（如 `'luffy'`、`'zoro'`）、`actor_type = 'protagonist' | 'cast'`、`actor_name`、`parent_interaction_id`、`reply_to_actor_name`。
   - `electron/main/storage/moment-backup.ts:126-129` 的 `collectMomentBackup` 查询全表 `SELECT * FROM companion_moment_user_interactions`，只提取了 `id, momentId, roleId, kind, actorId, text, createdAt`，随后在第 142 行调用 `isValidMomentBackup(result)`。
   - `moment-backup.ts:57-60` 强制断言 `row.actorId !== MOMENT_USER_ACTOR_ID`（即必须为 `'user'`）则立即返回 `false`，导致 `collectMomentBackup` 抛出 `Error('朋友圈历史关联不完整，无法导出')`。
   - 同时，`moment-backup.ts` 在导出和导入（第 240-241 行）时完全丢弃了 `actor_type`、`actor_name`、`parent_interaction_id`、`reply_to_actor_name` 四列。
2. **新迁移的 Companion Core 与生活表未纳入备份恢复**：
   - `electron/main/ipc/data-export.ts:684-716` 目前只导出 `sessions`、`memories`、`settings`、`companion_assets`、`companion_asset_seeds`、`momentHistory` 和聊天 / 资产配图。
   - 以下用户与伙伴长期相处的持久数据在备份恢复中 **100% 丢失**：
     - 人格成长：`companion_mutable`、`companion_mutable_versions`、`companion_reflection_state`、`companion_first_contact`；
     - 核心运行态与关系：`companion_runtime_state`、`companion_relationship_state`、`companion_relationship_events`、`companion_emotion_events`；
     - 生活面核心记录：`companion_inner_thoughts`（日记与深夜反思）、`companion_keepsakes`（专属信物）、`companion_received_gifts`（收到礼物）、`companion_vulnerability_moments`（脆弱心境与抚慰记录）、`companion_life_resonances`（对话生活心愿）、`companion_travel_progressions`（航程推进）、`companion_autonomous_dressings`（自主穿搭记录）；
     - 朋友圈自动配图：`companion_moment_media` 及其对应的受控图片文件未被 `collectBackupImageMedia` 采集，恢复后 `companion_event_links` 指向不存在的 `imageId`。

### B02（P1）：Agent Host Capability 覆盖不完整导致 Manifest 权限旁路

- `electron/main/agent-host/builtin-domains.ts` 仅注册了 7 个 Capability（`companion.runtime.read`、`companion.moment.publish`、`companion.diary.generate`、`companion.life.tick`、`persona.read`、`memory.profile.read`、`workspace.root.read`）。
- 其余 7 个伙伴工具（`companion_read_world`、`companion_create_asset`、`companion_add_reading_note`、`companion_observe_material`、`companion_comment_moment`、`companion_character_draft`、`companion_switch_universe`）和 3 个记忆工具（`remember`、`recall`、`forget`）仍作为传统内置工具直接挂在全局 `ToolRegistry`。
- `electron/main/agent-host/scoped-catalog.ts:26-28` 仅对 `registered.has(tool.name) || tool.name.startsWith('capability_')` 校验 `AgentHostManifest` 的 `domainKeys`、`capabilityPolicy.allow / deny` 和 `grantedPermissions`。
- 结果：当会话 Manifest 撤销 `companion.write`、`memory.write` 或禁用 `companion` / `memory` domain 时，上述 10 个工具仍对模型可见且可执行（仅受 `unattended-readonly` 的 `isReadOnly` 粗粒度过滤限制，不受 Manifest 细粒度权限控制）。

### B03（P1）：主对话 System Prompt 重复注入同一份人物运行态

- `electron/main/agent/runtime.ts:243-257` 通过 `loadConversationAssemblyInput` 从 `companion_runtime_state` 构建 `worldSlice`（含当前地点、当前活动、状态描述）并注入主对话 Prompt。
- `electron/main/agent/runtime.ts:350-354` 又对主会话调用 `getAgentHostContext(agentManifest, ...)`，触发 `companion.runtime-context`（`builtin-domains.ts:80-93`），将 `当前位置：...；当前活动：...；状态：...` 再次拼入 `sessionInfo`，违反 `agent-host-architecture-v1.md` §8「同一事实只能由一个 Provider 进入同一 scope」的契约。

### B04（P1）：5 处手写 `db.run('BEGIN')` 绕过 `withDatabaseTransaction`

- `electron/main/storage/database.ts:64-104` 通过 `withDatabaseTransaction` 维护 `transactionTail` 串行队列和 `transactionDepth` 标记。
- 但以下 5 处直接调用 `db.run('BEGIN')` 或 `db.run('BEGIN TRANSACTION')`：
  1. `electron/main/storage/diagnostic-history-store.ts:95`（50ms 定时器异步触发，直接持有 `this.db`，在外部异步事务 awaiting 期间触发会撞上 `cannot start a transaction within a transaction` 并丢弃诊断批次）；
  2. `electron/main/companion/life/assets.ts:889`（`ensureWorldDetailStarter`）与 `assets.ts:1167`（`ensureStarterMoments`）：内部手写 `BEGIN TRANSACTION`，且 `catch` 块无条件执行 `db.run('ROLLBACK')`，一旦在外层事务内被调用会直接回滚外层事务；
  3. `electron/main/storage/proactive-evidence-store.ts:57`（`ProactiveEvidenceStore.reserve`）；
  4. `electron/main/ipc/data-export.ts:525, 594`（`importSessionsIntoDatabase` 与 `importBackupPayload`）。
- 此外，`mutable-store.ts:142-158`、`session-store.ts:217-224, 252-268, 299-345`、`llm-debug-store.ts:417-430` 存在多条关联写 SQL 不在事务内直接 `persist()` 的问题。

### B05（P1）：可变人格 `setMutable` / `rollbackMutable` 缺少命令边界、事务与 `universeId`

- `electron/main/ipc/companion.ts:135-149`（`companion:set-mutable`）与 `156-167`（`companion:rollback-mutable`）未校验 `requireActiveWriteRole(roleId)`，未经过 `executeCompanionCommand`。
- 两个 IPC 均未读取当前 `universeId` 传给 `setMutable` / `rollbackMutable`，导致 `mutable-store.ts:108` 永远回退到 `universeId = 'default'`，在用户自定义世界观下调用 `loadRolePack(roleId, 'default')` 必然抛错。
- `mutable-store.ts:142-158` 写 `companion_mutable` 与 `companion_mutable_versions` 两张表未使用 `withCompanionUnitOfWork` / `withDatabaseTransaction`。

### B06（P1）：读接口与 Prompt 组装夹带写盘、LLM 调用、提前消费心愿及跨角色硬编码播种

1. `electron/main/companion/life/vulnerability.ts:156`：`ensureVulnerabilityTable()` 在 `CREATE TABLE IF NOT EXISTS` 后无条件调用 `persist()`，导致每次只读查询 `getActiveVulnerability` / `listVulnerabilities` 都触发全库导出写盘。
2. `electron/main/companion/life/timeline.ts:17-31`：只读 IPC `companion:get-today-timeline` 在当日无剧本时直接调用 `ensureDayScripts(roleId, date, date, { preferLlm: true })` 发起 LLM 请求并写库，且不校验 `roleId` 是否为当前活跃主角。
3. `electron/main/companion/life/script-generator.ts:281-291`：`collectDayScriptLifeContext` 在组装日剧本 Prompt 时（LLM 调用前）直接执行 `markResonancesAbsorbed` 将心愿标为 `absorbed_in_script`。若后续 LLM 失败或被取消而回退到哈希剧本，心愿未被写进剧本却已被永久消费。
4. `electron/main/companion/growth/relationship-keepsake.ts:130-161` 与 `electron/main/companion/life/inner-thoughts.ts:166-203`：在 `ensure*Table()` 中无条件为 `'luffy'` 硬编码插入初始信物（并写 `settings` 里程碑）和随机 UUID 的初始日记，即使当前查询的是其他角色或自定义世界观主角。

### B07（P1）：跨世界观切换丢失 Catch-up 补叙 & 窗口广播缺销毁检查

1. `electron/main/companion/orchestrator.ts:479-488`：`switchUniverse` 在切换世界观事务中无条件对新世界默认主角执行 `await resumeRole(manifest.defaultProtagonistId)`，将 `pausedAt` 清为 `null` 并广播 `catchupQueued: false`。当用户从世界 A 切到世界 B 再切回世界 A 时，原本记录的 `pausedAt` 被直接抹除，不会像 `switchProtagonist`（第 537-553 行）那样保留 `pausedAt` 并触发 `recoverActiveCatchup()`。
2. `electron/main/companion/adapters/window-outbox-dispatcher.ts:37-39`：`broadcastRoleChanged` 遍历 `BrowserWindow.getAllWindows()` 时未检查 `if (!win.isDestroyed())`（对比同文件第 21 行有检查），存在已销毁窗口时会抛出未捕获异常。

### B08（P1）：命令嵌套反转、跨角色删日记与里程碑通知不一致

1. `electron/main/companion/life/inner-thoughts.ts:247-253`：`deleteInnerThought(id)` 执行 `DELETE FROM companion_inner_thoughts WHERE id = ?`，未接收也未校验 `roleId`，存在跨角色删除隐患。
2. `electron/main/companion/life/chat-resonance.ts:488-530`：`completeCultureResonance` 先开启 `withCompanionUnitOfWork`，在事务内部又调用 `executeCompanionCommand`（而在 `companion-life-ticker.ts:127` 中外层已经包了一层 `executeCompanionCommand`），导致事务与命令账本层级倒置。
3. `electron/main/companion/life/gifting.ts:364-372` 与 `vulnerability.ts:390-395`：分别在事务外或 `commitLifeAction` 内直接调 `tryRecordMilestone` 写 `settings`，未像 `relationship-keepsake.ts` 那样通过 `companion_outbox` followup 或 `recordAndBroadcastMilestone` 统一产出领域事件与里程碑通知。

### B09（P2）：两套关系阶段系统互不通信

- `electron/main/companion/growth/relationship-stage.ts:62-166` 基于认识时长、反思记录和用户消息数计算 `stranger | familiar | rapport`，注入 Prompt 的 `behavior.relationshipStage`。
- `electron/main/companion/core/persistence/life-repository.ts:80-126` 维护 `companion_relationship_state`（`phase` 与 `signal`），仅在生活事件带 `relationship` 载荷投影时更新，注入 Prompt 的 `situation.relationshipSummary` 并控制 `companion:get-moments` 的可见窗口（`ipc/companion.ts:177-178`）。
- 赠礼、信物馈赠、安慰脆弱心境、深夜反思与人格反思均未联动更新 `companion_relationship_state`，导致同一会话内两处关系阶段与朋友圈可见窗口互相脱节。

### B10（P2）：Schema 初始化四处分裂与高频重复 DDL

- `core/schema.ts`（`ensureCompanionCoreSchema`）、`core/persistence/life-schema.ts`（`ensureLifeSchema`）以及 `life/*.ts`、`growth/*.ts` 中的 10 余个 `ensure*Table()` 均未按 `SqlJsDatabase` 实例缓存初始化状态。
- 每次读写调用都会重复执行数十条 `CREATE TABLE IF NOT EXISTS`、`CREATE INDEX IF NOT EXISTS` 以及依靠异常捕获的 `try { db.run('ALTER TABLE ...') } catch {}`，增加无意义的 SQL 解析开销与调试噪声。

### B11（P2）：僵尸代码 `co-decision.ts` 与废弃配置键残留

- `docs/modules/companion.md` 记录共同决策已退出 UI 改为内部因果能力，但生产代码中 `createCoDecision` 与 `resolveCoDecision` 没有任何调用方；`script-generator.ts:287-291` 仍在每次生成日剧本时调用 `getRecentResolvedCoDecision` -> `ensureCoDecisionTable()`，建表并播种一条永远无法变为 `resolved` 的 `luffy-starter-decision-1` 记录。
- `proactive-greeting.ts:31`、`settings-store.ts:169` 和 `data-export.ts:72` 仍保留从未被读写过的 `companionProactiveGreetingLastDay` 废弃设置键；`moment-tips.ts` 同时在 `settings`（`companionMomentTipsLastAt` / `companionMomentTipsDayStats`）和 `companion_proactive_budget` 表维护两套重复冷却计数。

### B12（P2）：`sql.js` 高频追加表缺少有界裁剪（Pruning）

- 在 `sql.js` 全量内存驻留 + 每次 `persist()` 全量 `db.export()` 写盘的机制下，以下追加表无任何过期清理或行数上限：
  - `companion_execution_runs`、`companion_outbox`（已 `delivered` / 终态 `failed`）、`companion_domain_events`、`companion_projection_receipts`；
  - `companion_events`、`companion_day_scripts`、`companion_event_executions`；
  - `companion_proactive_budget`（历史日期行）、`background_tasks`（已确认终态）、`scheduled_task_runs`。
- 需在不破坏幂等回执有效窗口和用户可见历史的前提下，建立启动与周期性有界裁剪策略。
