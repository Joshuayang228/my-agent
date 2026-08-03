# M25 资产层代码走读

> 对应 `m25-assets-wardrobe.md`（加厚修订版）。

---

## §五 对照：Starter 与入库

```text
ensureStarterForKind(roleId, kind)  // wardrobe | bookshelf
  若该 kind 已有 → return
  id = `{kind}:{roleId}:{key}`  // 稳定幂等；主角分味
ensureStarterAssets = wardrobe + bookshelf

addAsset({ roleId, kind, name, payload, sourceEventId?, id? })
maybeGrantFromEvent({ roleId, eventId, eventPayload })  // id=grant:{eventId} 幂等
normalizeGrantAsset → grant-asset.ts（纯函数）
```

**方法论对照**：→ §五 · M25-G2 · M25-G3

---

## §六 对照：挂到事件与投影

```text
materializePlannedEvents
  slot.type === 'moment' → assetId = pickWardrobeAssetId(...)
  slot.grantAsset? → event.payload.grantAsset

publishAndProjectRange
  mark published → maybeGrantFromEvent → projectMoment

projectMomentFromEvent → getAsset → outfitName 进 text/meta
```

**方法论对照**：→ §六 §七

---

## §八 对照：可见性

`companion:get-assets` → active role；可按 kind 过滤。  
`companion:update-asset` / `companion:delete-asset` → 仅 active（`expectedRoleId`）。  
`AssetsPanel`：衣柜 / 书架分栏；编辑字段随 kind；删除确认后降级引用。

**方法论对照**：→ §四 §八 · M25-G1 · M25-G3

---

## Schema

`companion_assets(id, role_id, kind, name, payload_json, acquired_at, source_event_id)`

**方法论对照**：→ §二

---

## 已知简化

哈希日剧本不自动 grant；书架尚未进 Assemble / Moment 引用（可后续）。
