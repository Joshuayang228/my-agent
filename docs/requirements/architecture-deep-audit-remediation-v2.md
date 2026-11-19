# 架构深度二审残余断点与全链路收口施工合同 v2

> 状态：已完成施工快照（冻结）
> 生命周期：已完成施工快照（冻结）
> 授权来源：2026-11-19 用户要求重新零信任审计当前架构断点与未迁移完路径，先落成文档再分批施工并启用目标模式全面收口。
> 冻结说明：2026-11-19 已完成 Batch 1 ～ Batch 4（`B01`—`B12`）全部修复、单测反例转正、双进程类型检查与构建、离线 Eval / Skill Eval / 资产审计与正式 Electron E2E 验证；稳定事实已吸入 `docs/architecture.md`、`docs/architecture-boundary-audit.md`、`docs/modules/companion.md`、`docs/modules/agent-runtime.md` 与 `docs/quality.md`，`WISH-051` 已从心愿池关闭。

## Why

在 `WISH-050`（`A01`–`A18`）完成首轮局部一致性修复后，2026-11-19 对 `electron/main` 全量源码进行了对照 5 份目标架构合同的零信任穿透二审（完整证据见 [`_archive/audits/2026-11-19-architecture-deep-source-audit.md`](../../_archive/audits/2026-11-19-architecture-deep-source-audit.md)），发现 **12 项未迁移完的架构断点与真实缺陷（`B01`–`B12`，由 `WISH-051` 跟踪）**：

1. **备份恢复断层（`B01`，P0）**：朋友圈一旦有主角或卡司回复评论，`moment-backup.ts` 因硬编码校验 `actorId === 'user'` 直接导致全应用 `data:export` 抛错失败，且丢弃了 `actor_type / actor_name / parent_interaction_id / reply_to_actor_name` 四列；同时新迁移的 Companion Core 与生活表（`companion_mutable`、运行态、日记、信物、礼物、脆弱心境、心愿共鸣、关系状态、自动配图媒体等）完全未纳入备份导出与导入。
2. **Agent Host 权限门禁半途而废与重复上下文（`B02`、`B03`，P1）**：`builtin-domains.ts` 仅注册了 7 个样板 Capability，其余 7 个 `companion_*` 工具与 3 个 `remember / recall / forget` 记忆工具游离在 Manifest `grantedPermissions` 与 `capabilityPolicy` 门禁之外；主对话同时通过 `worldSlice` 和 `companion.runtime-context` 重复注入同一份人物运行态。
3. **裸 SQL 事务撞车与写入旁路（`B04`、`B05`、`B06`、`B07`、`B08`，P1）**：5 处代码手写裸 `db.run('BEGIN')` 绕过 `withDatabaseTransaction`（定时器或嵌套调用会抛错甚至误回滚外层事务）；`setMutable` / `rollbackMutable` 缺少命令边界、事务和 `universeId`（导致自定义世界观写人设必败）；`vulnerability.ts` 每次只读查询都无条件 `persist()` 全量写盘；`get-today-timeline` 在读接口调 LLM 写库；`script-generator.ts` 在 LLM 成功前提前落盘消费心愿；`switchUniverse` 无条件抹掉 `pausedAt` 导致跨世界观切回永久丢失 Catch-up 补叙；`broadcastRoleChanged` 漏检 `!win.isDestroyed()`；`deleteInnerThought` 缺 `role_id` 校验；`completeCultureResonance` 事务与命令嵌套反转。
4. **双关系系统分裂、Schema 重复 DDL、僵尸代码与高频表无界膨胀（`B09`、`B10`、`B11`、`B12`，P2）**：`relationship-stage.ts` 与 `companion_relationship_state` 互不通信；`ensure*Schema` / `ensure*Table` 每次读写重复跑数十条 DDL；`co-decision.ts` 与废弃设置键残留；10 张高频追加表缺少有界裁剪策略。

## What

完整关闭 `WISH-051` 的 `B01`–`B12`，分 4 个独立可验证、可回滚的施工批次（Batch 1 ～ Batch 4）推进，并在全部完成后再次执行独立源码终审。

## How（分批施工范围与技术方案）

### Batch 1 · 备份恢复闭环与朋友圈互动导出急救（关闭 `B01`）

1. **修复朋友圈互动备份契约（`electron/main/storage/moment-backup.ts`）**：
   - 支持 `actorType: 'user' | 'protagonist' | 'cast'` 及对应 `actorId`、`actorName`、`parentInteractionId`、`replyToActorName` 的导出、严格结构校验（`isValidMomentBackup`）与幂等导入（`importMomentBackup`），消除主角 / NPC 回复后 `data:export` 崩溃的 P0 缺陷。
2. **补齐 Companion 核心与生活状态备份（`electron/main/ipc/data-export.ts`）**：
   - 在保持对旧 v1 备份文件向前兼容（可选字段缺失时安全默认为空）的前提下，扩展备份载荷以涵盖：
     - 人格成长与首次冷启：`companion_mutable`、`companion_mutable_versions`、`companion_reflection_state`、`companion_first_contact`；
     - 核心运行态与关系：`companion_runtime_state`、`companion_relationship_state`、`companion_relationship_events`、`companion_emotion_events`；
     - 生活面持久数据：`companion_inner_thoughts`、`companion_keepsakes`、`companion_received_gifts`、`companion_vulnerability_moments`、`companion_life_resonances`、`companion_travel_progressions`、`companion_autonomous_dressings`；
     - 朋友圈自动配图媒体：`companion_moment_media` 及其受控图片文件纳入媒体收集与恢复重映射，保证恢复后朋友圈配图不裂。
   - 导入全过程必须在单一事务与失败内存补偿内完成。

### Batch 2 · 事务收敛、读写分离、命令边界与切世补叙修复（关闭 `B04`、`B05`、`B06`、`B07`、`B08`）

1. **消灭裸 `db.run('BEGIN')`（`B04`）**：
   - 将 `diagnostic-history-store.ts`、`proactive-evidence-store.ts`、`assets.ts`（`ensureWorldDetailStarter`、`ensureStarterMoments`）和 `data-export.ts` 的裸 `BEGIN` 统一收敛到 `withDatabaseTransaction` 或 `SAVEPOINT`（已在事务内时使用 `SAVEPOINT`，事务外排队进入 `withDatabaseTransaction`），严禁内部 `catch` 误回滚外层事务。
   - 将 `session-store.ts`（`saveMessage`、`deleteSession`、`forkSession`）与 `llm-debug-store.ts`（`clear`）的多语句写操作纳入事务保护。
2. **可变人格 `mutable-store` 收口（`B05`）**：
   - `companion:set-mutable` 与 `companion:rollback-mutable` 接入 `requireActiveWriteRole`、`executeCompanionCommand({ local: true })` 并传入当前 `universeId`；`setMutable` 内部双表写入包入本地事务。
3. **读写分离与日剧本心愿消费原子化（`B06`）**：
   - 删除 `vulnerability.ts#ensureVulnerabilityTable` 中无条件执行的 `persist()`；
   - `ensureKeepsakeTable` 与 `ensureInnerThoughtTable` 的路飞 starter 播种仅在目标 `roleId === 'luffy'` 且处于显式初始化 / 对应角色访问时按幂等确定性 ID 执行，不在查询其他角色时跨角色污染；
   - `getTodayTimelineForRole` 保持只读查询语义（缺日剧本时使用确定性 fallback 视图或仅对当前活跃主角通过受控命令初始化，绝不允许任意 `roleId` 在读接口裸跑 LLM 写库）；
   - `script-generator.ts` 将 `markResonancesAbsorbed` 移至日剧本成功生成并落库的 `withCompanionUnitOfWork` 事务内，LLM 失败或取消时不提前吞没心愿。
4. **跨世界观切换 Catch-up 恢复与窗口销毁防护（`B07`）**：
   - `switchUniverse` 对齐 `switchProtagonist` 的暂停恢复契约：若目标世界默认主角存在 `pausedAt != null`，保留 `pausedAt` 并在切换提交后触发 `recoverActiveCatchup()`，广播真实的 `catchupQueued` 状态；
   - `window-outbox-dispatcher.ts#broadcastRoleChanged` 补齐 `if (!win.isDestroyed())` 检查。
5. **命令层级与日记删除角色隔离（`B08`）**：
   - `deleteInnerThought(roleId, id)` 强制校验 `WHERE id = ? AND role_id = ?`；
   - `completeCultureResonance` 调整为外层 `executeCompanionCommand`、内层 `withCompanionUnitOfWork`，消除事务内反向嵌套命令；
   - `sendGiftToCompanion` 与 `comfortVulnerability` 的关系里程碑统一接入 Outbox followup 或事件通知闭环。

### Batch 3 · Agent Host 权限门禁全覆盖与双关系系统统一（关闭 `B02`、`B03`、`B09`）

1. **Agent Host 领域工具全量纳管（`B02`）**：
   - 将 `companion_read_world`、`companion_create_asset`、`companion_add_reading_note`、`companion_observe_material`、`companion_comment_moment`、`companion_character_draft`、`companion_switch_universe` 以及 `remember`、`recall`、`forget`、`rag_search` 纳入 `AgentHost` 的 Domain / Capability 权限映射（或在 `AgentHostScopedToolCatalog` 与 `ToolRegistry` 执行门禁中建立完整的 Tool → Domain Permission 强制映射表），确保 Manifest 撤销 `companion.write`、`memory.write` 或禁用对应 Domain 时，所有同领域工具在目录筛选和实际执行两处均被严格拦截。
2. **消除主对话重复运行态上下文（`B03`）**：
   - 收敛 `runtime.ts` 中 `loadConversationAssemblyInput.worldSlice` 与 `companion.runtime-context` Context Provider 的职责边界，保证人物当前位置、活动和状态在同一次 Prompt 编译中只注入一次。
3. **统一双关系阶段系统（`B09`）**：
   - 打通 `growth/relationship-stage.ts` 与 `companion_relationship_state`：让赠礼、信物馈赠、脆弱抚慰、深夜反思与互动密度共同驱动单一关系状态事实源，使 `behavior.relationshipStage`、`situation.relationshipSummary` 与朋友圈可见窗口（`resolveMomentVisibilityDays`）始终一致。

### Batch 4 · Schema 初始化去重、僵尸代码清理与高频表有界裁剪（关闭 `B10`、`B11`、`B12`）

1. **Schema 初始化按 DB 实例缓存去重（`B10`）**：
   - 为 `ensureCompanionCoreSchema`、`ensureLifeSchema` 及各生活模块的 `ensure*Table` 绑定基于当前 `SqlJsDatabase` 实例（`WeakSet<Database>`）的一次性初始化守卫，消除每次读写重复执行数十条 `CREATE TABLE` / `ALTER TABLE` 的开销，并在 `_resetDatabaseForTests()` 时自动随实例释放。
2. **清理僵尸代码与重复配置（`B11`）**：
   - 清理 `script-generator.ts` 对无生产写入口的 `co-decision.ts` 的无效建表与死数据播种调用，以及 `companionProactiveGreetingLastDay` 等废弃死键；收敛 `moment-tips.ts` 重复的冷却状态到 `companion_proactive_budget`。
3. **高频追加表有界裁剪（`B12`）**：
   - 为 `companion_execution_runs`（已完成记录）、`companion_outbox`（已投递 / 终态失败记录）、`companion_domain_events`、`companion_projection_receipts`、`companion_proactive_budget`（过期日期）、`background_tasks`（已确认终态）和 `scheduled_task_runs` 建立有界保留与启动 / 周期裁剪机制（Pruning），保留近期幂等窗口与活跃记录，防止 `sql.js` 内存与导出体积无限增长。

## 影响范围与删除授权

- **允许修改**：`electron/main/` 下 `storage`、`companion`、`agent`、`agent-host`、`tools`、`ipc`、`services`、`scheduler`、`rag`，以及 `src/shared/`、`__tests__/` 和相关文档。
- **删除授权**：授权删除 `vulnerability.ts` 读路径中的冗余 `persist()`、5 处裸 `db.run('BEGIN')`、重复的 `companion.runtime-context` 注入、无生产写入口的 `co-decision` 日剧本播种钩子及 `companionProactiveGreetingLastDay` 等废弃死键。

## 验收门禁

每一批次交付及最终收口均须通过：
1. 针对 `B01`–`B12` 的反例复现与转正回归测试（`npm run test`）；
2. 双进程类型检查与生产构建（`npm run build`）；
3. 离线 Eval、Skill Eval 与生产资产审计（`npm run eval:run`、`npm run eval:skill`、`npm run assets:check`）；
4. 真实 Electron E2E 回归（含备份导出导入、朋友圈评论回复、切角与换世界补叙、聊天工具调用）；
5. 文档校验与变更影响门禁（`npm run docs:validate`）。
