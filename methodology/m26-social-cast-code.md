# M26 交际圈与卡司代码走读

> 对应 `m26-social-cast.md`。

---

## 一、模块地图

```
cast/roster.ts         # buildRosterLines / formatRosterForPrompt / loadCastBrief
cast/availability.ts   # checkCastAvailability / describeCastPresence / BUSY_PROFILES
identity/loader.ts     # loadRelations / loadRolePack / manifest.protagonistIds
universes/default/relations.json
orchestrator.ts        # startSummon / assemble 带 rosterLines
runtime.ts             # summon 时 describeCastPresence；不 schedule 对方反思
CastPanel.tsx
```

---

## 二、名册注入

```
buildRosterLines(activeRoleId)
  遍历 relations.edges 含 active 的边
  other = loadRolePack(otherId)
  text = `你与${name}（${typeLabel}）：${note || summary || description}`
  // 绝不读 other.protected

formatRosterForPrompt → prompt-builder L3「Cast roster」
```

---

## 三、召唤

```
startSummon(roleId, force?)
  可选 checkCastAvailability；!force && !available → 返回婉拒+改约
  创建 session(session_kind=summon, role_id=对方)
  不写 activeRoleId；不 pause/catchup 对方
```

组装：`assertSessionRole` 用会话 `role_id` 装完整 Pack；`sessionKind=summon` 跳过 catchup/反思调度。

---

## 四、忙闲（availability.ts）

- 静态 `BUSY_PROFILES`（hour/day/declineRate）  
- 若有当日 day_script 事件，优先用槽位生成 presence / 忙点  
- 纯查询；单测可注入 `now` / `random`

---

## 五、约束速查

| 约束 | 落点 |
|------|------|
| 无他人 protected 进主对话 | roster 只用 summary/note |
| 召唤不改 active | startSummon |
| 召唤不推进生活 | 无 tick/catchup 对方 |
| NPC 可非主角 | protagonistIds 可不含 chen/ayu |

---

## 六、已知简化

- Moments 无卡司互动（M26-G1）  
- 未接 M19 任务协作（M26-G2）  
- 无多场景 prompt map（M26-G3）
