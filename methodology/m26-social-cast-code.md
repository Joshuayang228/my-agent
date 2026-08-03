# M26 交际圈与卡司代码走读

> 对应 `m26-social-cast.md`（加厚修订版）。

---

## §三 对照：名册浅注入

```text
buildRosterLines(activeRoleId)
  边含 active → other Pack
  text = 你与{name}（{type}）：{note||summary||description}
  // 不读 other.protected

formatRosterForPrompt → prompt-builder L3 Cast roster
```

Eval C01 盯「无他人 protected」。

**方法论对照**：→ §三

---

## §五–§六 对照：召唤

```text
startSummon(roleId, force?)
  可选 checkCastAvailability；!force && !available → 婉拒+改约
  createSession(session_kind=summon, role_id=对方)
  不写 activeRoleId；不 pause/catchup 对方

runtime：assertSessionRole(会话 role) 装完整 Pack
  summon → 跳过 catchup 注入；scheduleReflection 短接
```

**方法论对照**：→ §五 §六

---

## §七 对照：忙闲

`availability.ts`：`BUSY_PROFILES` + 可选 day_script 槽位 → presence / decline。  
纯查询；单测可注入 `now` / `random`。

**方法论对照**：→ §七

---

## 资产

`universes/default/relations.json` + 各 role Pack；NPC（chen/ayu）可非主角。

**方法论对照**：→ §二 §四

---

## §十 / M26-G1 对照：Moments 互动

```text
projectMomentFromEvent
  deriveCastInteractions(event)  // roster 浅层 + seed；仅 moment
  → meta.interactions: coframe | comment
  // 不 insert 对方 moment；不 tick 对方

MomentsPanel：同框角标 + 评论行
```

**方法论对照**：→ §十 · M26-G1

---

## §九 / M26-G2 对照：召唤 × 委派

```text
runtime toolContext.sessionKind = summon|main
summonNote += summonParentDelegationHint()
delegate_task → canDelegateInSession
runSubAgent systemPrompt += summonWorkerSystemAddon(summon)
  // 任务工 ≠ 卡司；不推生活 / 不换 active
```

**方法论对照**：→ §九 · M26-G2

---

## 已知简化

无多场景 prompt map；互动未进 Assemble 主对话；无「请 TA 帮忙」独立 UI。
