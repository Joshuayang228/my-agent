# M22 成长核代码走读

> 对应 `m22-growth-mutable.md`。只记关键路径与约束，不重复理念。

---

## 一、模块地图

```
electron/main/companion/growth/
  mutable-store.ts       # get/set/rollback；SQLite 用户态
  reflection-gate.ts     # 72h / 24h / ≥5 msgs
  reflection-log.ts      # 每 role 的 lastRun / 摘要
  reflection-service.ts  # schedule / run / LLM / setMutable

调度：agent/runtime.ts → enqueuePostTasks → scheduleReflectionAfterChat
UI：SettingsPanel（MUTABLE 编辑、版本回滚、立即/强制反思）
IPC：companion:get/set/rollback-mutable · reflection-status · run-reflection
```

依赖方向：`runtime` → `companion/growth`；**禁止** `companion` import `agent/`。

---

## 二、数据流

```
主会话 chat 结束
  → ensureGrowthStartedAt(roleId)    # 首次打点该角色成长时钟（按 role 分桶）
  → shouldReflectNow(roleId)         # 门闸；fail → 不入队
  → taskQueue.enqueue(persona-reflection)
  → runReflectionCore
       load Pack + getMutable
       近 7 日用户消息 + feedback memories
       chatComplete(caller: persona-reflection)
       parse JSON → null? 只 recordReflectionRun
                 → 有正文且不同于当前 → setMutable(+version)
```

召唤：`sessionKind === 'summon'` → `scheduleReflectionAfterChat` 直接 `{ queued: false }`。

---

## 三、门闸（reflection-gate.ts）

常量：`COLD_START_MS=72h` · `COOLDOWN_MS=24h` · `LOOKBACK_MS=7d` · `MIN_USER_MESSAGES=5`。

- `force: true`（设置页强制）→ 跳过三门，仍走 Runner  
- 消息计数：`countUserMessagesForRoleSince(roleId, since)`（按会话 `role_id`）  
- 冷却看 `getReflectionState(roleId).lastRunAt`

**M22-G1 已落地**：settings 键 `companionGrowthStartedAtByRole`（JSON `Record<roleId, ms>`）；旧 `companionGrowthStartedAt` 仅作迁移源（落到当时 `activeRoleId`）。

---

## 四、Runner 约束（reflection-service.ts）

- Prompt 硬性：不碰 PROTECTED；事实不进 MUTABLE；可返回 null  
- `MAX_MUTABLE_CHARS = 800`  
- `pendingRoles` Set：同 role 去重入队  
- LLM 失败 / 解析失败：记 log，**不** `setMutable`  
- 与当前正文相同：视为 no-change，占冷却不升版本  

反馈信号：`listMemories('feedback').slice(0, 12)`——**未按 role 过滤**（M22-G2）。

---

## 五、mutable-store.ts

- 表：`companion_mutable`（当前）+ `companion_mutable_versions`（历史）  
- `getMutable`：无覆盖 → Pack `mutable.default`  
- `setMutable(roleId, body, summary)` → version+1 + persist  
- `rollbackMutable(roleId, toVersion)` → 回写当前并留痕  

永不写磁盘上的 Role Pack 文件。

---

## 六、必测点（已有单测覆盖方向）

- 门闸：冷启动 / 冷却 / 消息不足  
- Runner：null → 不写版本；有正文 → version+1  
- 召唤路径不入队（集成/行为上由 `sessionKind` 短接）

手工：设置页看上次反思时间；强制反思一轮；回滚一版。

---

## 七、和 Prompt 组装的接缝

`runtime` 组装时：`loadRoleAssembleInput` → `mutableBody` → `buildSystemPrompt` L1。  
反思写入后，**下一轮**对话才会带上新 MUTABLE；不在当轮热更新已发出的 system prompt。
