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

## 已知简化

无 Moments 卡司互动；无 M19 接线；无多场景 prompt map。
