# M24 朋友圈与事件层代码走读

> 对应 `m24-moments-event-layer.md`。

---

## 一、模块地图

```
life/moments.ts     # format / project / publishAndProject*
life/store.ts       # events + moments CRUD
life/engine.ts      # tick → publishAndProjectDue
life/catchup.ts     # → publishAndProjectRange
ipc/companion.ts    # get-moments → active role only
src/components/MomentsPanel.tsx
```

---

## 二、投影路径

```
projectMomentFromEvent(event)
  require status === 'published'
  optional: getAsset(payload.assetId) → outfitName
  text = formatMomentText(activity, mood, location, outfit)
  store.insertMoment({ roleId, eventId, publishedAt: scheduledAt, text, meta })
```

`publishAndProjectRange(roleId, from, to)`：扫 `planned` 且 `scheduledAt ∈ [from,to]` → mark published → project。  
`publishAndProjectDue(roleId, now)` ≡ `Range(0, now)`。

幂等：同一 event 重复 project 由 store 约束（eventId 唯一/忽略重复）。

---

## 三、可见性

- 存储：`listMomentsForRole(roleId)`  
- IPC：解析当前 `activeRoleId`，只返回该角色分页列表  
- UI：随 `companion:role-changed` 刷新

---

## 四、与剧本槽位

`script-generator` 槽 `type: 'moment' | 'activity'`：  
moment 槽在 `materializePlannedEvents` 时挂 `assetId`；activity 可不挂。  
两者都可以 published→投影；文案都走同一 `formatMomentText`。

---

## 五、约束速查

| 约束 | 落点 |
|------|------|
| 无独立朋友圈真相 | 只从 event 投影 |
| 仅 active 展示 | IPC 门控 |
| Catch-up 细窗发布 | `publishAndProjectRange(fineStart, now)` |
| 失败不挡 Loop | tick/catchup 上层已吞错 |

---

## 六、已知简化

- 文案规则拼接，无 LLM（M24-G2）  
- 无聊圈一致性裁判（M24-G1）  
- 无图片字段（M24-G3）
