# M25 资产层代码走读

> 对应 `m25-assets-wardrobe.md`（加厚修订版）。

---

## §五 对照：Starter 与入库

```text
ensureStarterWardrobe(roleId)
  若已有 kind=wardrobe → return
  插入 tee-white / hoodie-gray / sneakers
  id = wardrobe:{roleId}:{key}  // 稳定幂等

addAsset({ roleId, kind, name, payload, sourceEventId?, id? })
maybeGrantFromEvent(...)  // 未挂 publish 主路径（M25-G2）
```

**方法论对照**：→ §五

---

## §六 对照：挂到事件与投影

```text
materializePlannedEvents
  slot.type === 'moment' → assetId = pickWardrobeAssetId(roleId, scheduledAt)
  pick：ensureStarter → list wardrobe → seed % length

projectMomentFromEvent → getAsset → outfitName 进 text/meta
```

**方法论对照**：→ §六 §七

---

## §八 对照：可见性

`companion:get-assets` → active role；可按 kind 过滤。  
`companion:update-asset` / `companion:delete-asset` → 仅 active（`expectedRoleId`）。  
`AssetsPanel`：编辑名称/色/风格/场合；删除确认后降级引用。

**方法论对照**：→ §四 §八 · M25-G1

---

## Schema

`companion_assets(id, role_id, kind, name, payload_json, acquired_at, source_event_id)`

**方法论对照**：→ §二

---

## 已知简化

grant 未接线（M25-G2）；仅 wardrobe 种子（M25-G3）。
