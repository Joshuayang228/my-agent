# M28 冷启动与关系阶段代码走读

> 对应 `m28-cold-start-relationship.md`（加厚修订版）。

---

## §二 对照：欢迎冷启动

```text
src/shared/companion-presence.ts → buildColdStartCopy
electron/main/companion/presence.ts → re-export
欢迎屏：读 active 元数据 → 同一函数
```

与 `reflection-gate` **无直接调用关系**——刻意解耦。

**方法论对照**：→ §二

---

## §四 / §六 对照：成长门闸

### 我们的实现（`reflection-gate.ts`）

| 常量 | 值 |
|------|-----|
| COLD_START_MS | 72h |
| COOLDOWN_MS | 24h |
| LOOKBACK_MS | 7d |
| MIN_USER_MESSAGES | 5 |

```text
shouldReflectNow(roleId)
  force → ok
  !growthStartedAt or <72h → cold-start-72h
  lastRunAt <24h → cooldown
  countUserMessagesForRoleSince <5 → insufficient-messages
```

`ensureGrowthStartedAt`：settings 键 `companionGrowthStartedAt`，首次打点，已存在不改。  
**已 per-role**（M22-G1，`companionGrowthStartedAtByRole`）。

单测：`companion-reflection.test.ts` 覆盖冷启动拒绝等。

**方法论对照**：→ §四 §六

---

## §七–§八 对照：换角与绑角

| 行为 | 代码 |
|------|------|
| 流式禁换 | streaming-gate + orchestrator `SESSION_ACTIVE` |
| 切换事务 | pause → activeRoleId → runCatchup |
| 会话绑角 | createSession 写 role_id；`assertSessionRole` |
| 不重置成长时钟 | switch 路径无 clearGrowthStartedAt |

**方法论对照**：→ §七 §八

---

## §六 对照：召唤不成长

`scheduleReflectionAfterChat`：`sessionKind === 'summon'` → 不入队。

**方法论对照**：→ §六

---

## §三 / M28-G1 对照：关系阶段

```text
resolveRelationshipStage({ growthStartedAt, lastRunAt, recentUserMessages, sessionKind, mix })
  summon → stranger（客人）
  !growth or <72h or msgs<5 → stranger
  lastRunAt>0 → rapport
  else → familiar
  mix.lean=task-leaning ∧ rapport → 压回 familiar（M28-G2）
→ format + familiarity-mix → Assemble ## Relationship stage
```

模块：`companion/growth/relationship-stage.ts`；Runtime 装载。

**方法论对照**：→ §三 · M28-G1

---

## §六 / M28-G2 对照：交心 vs 干活

```text
listRecentUserMessagesForRole → resolveFamiliarityMix
  bond/task/neutral 计数 → lean: bond|task|mixed|sparse
```

模块：`companion/growth/familiarity-mix.ts`（不改反思硬门闸数字）。

**方法论对照**：→ §六 · M28-G2

---

## 已知简化

| Gap | 代码 |
|-----|------|
| M28-G1 | ✅ 派生枚举注入 Prompt（未另持久化情感分字段） |
| M28-G2 | ✅ lean 启发式；非可靠情感特征 |
| M28-G3 | ✅ `buildReacquaintCopy` → SwitchResult.reacquaint / role-changed |

---

## §七 / M28-G3 对照：再认识文案

```text
requestSwitch
  …pause / active / catchup…
  buildReacquaintCopy({ fromName, toName, catchupQueued })
  broadcast + return { reacquaint }
  // 路径内无 clearGrowthStartedAt
```

**方法论对照**：→ §七 · M28-G3

## 2026-08 当前实现校准

关系阶段与冷启动入口是 `relationship-stage.ts`、`reflection-gate.ts`、`orchestrator.ts` 和 `ipc/companion.ts`；阶段变化按 role 计算，切换主角不会把另一角色的成长状态混入当前 Prompt。对应测试是 `relationship-stage.test.ts` 与 `companion-session-role.test.ts`。
