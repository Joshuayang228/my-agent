# M24 朋友圈与事件层代码走读

> 对应 `m24-moments-event-layer.md`（加厚修订版）。

---

## §二 / §五 对照：投影与状态机

### 我们的实现（`life/moments.ts`）

```text
projectMomentFromEvent(event)
  require status === 'published'
  optional outfit from payload.assetId → getAsset
  text = formatMomentText(activity, mood, location, outfit)
  store.insertMoment({ roleId, eventId, publishedAt: scheduledAt, text, meta })

publishAndProjectRange(roleId, from, to)
  planned ∧ scheduledAt∈[from,to] → mark published → project

publishAndProjectDue(roleId, now) ≡ Range(0, now)
```

| 理念约束 | 代码体现 |
|----------|----------|
| 无独立编造 | 无「只写 moment」的公共 API 给 UI |
| 幂等投影 | eventId 关联；重复 project 由 store 约束 |
| 朴素文案 | `formatMomentText` 规则拼接 |

**方法论对照**：→ §二 §四 §五

---

## §六 对照：仅 active 可见

```text
ipc get-moments → 解析 activeRoleId → listMomentsForRole(roleId)
```

store 可按任意 role 查；**门控在 IPC**，防止渲染误传别人 id 刷混。

**方法论对照**：→ §六

---

## §七 对照：Catch-up

`catchup.runCatchup` → `ensureDayScripts` + `publishAndProjectRange(fineStart, now)`。  
只对该 `roleId`；细窗公式见 M23。

**方法论对照**：→ §七

---

## §九 对照：资产引用

`engine.materializePlannedEvents`：moment 槽 `pickWardrobeAssetId` → payload.assetId。  
投影时读名；资产缺失则无着装后缀。

**方法论对照**：→ §九

---

## 触发链

| 触发 | 调用 |
|------|------|
| ticker | `tickActiveRole` → `publishAndProjectDue` |
| 换角 | `runCatchup` → `publishAndProjectRange` |

**方法论对照**：→ §五、实战记录

---

## 已知简化

M24-G1/G2/G3 均无对应模块；生图字段未进 schema。
