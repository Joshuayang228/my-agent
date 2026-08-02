# M25 资产层代码走读

> 对应 `m25-assets-wardrobe.md`。

---

## 一、模块地图

```
life/assets.ts     # list/get/add/ensureStarter/pickWardrobeAssetId
life/engine.ts     # materialize 时 moment 槽挂 assetId
life/moments.ts    # 投影时解析 outfit name
ipc/companion.ts   # get-assets → active role
AssetsPanel.tsx
```

表：`companion_assets (id, role_id, kind, name, payload_json, acquired_at, source_event_id)`。

---

## 二、Starter 种子

```
ensureStarterWardrobe(roleId)
  若已有 kind=wardrobe → return
  插入 tee-white / hoodie-gray / sneakers
  id = `wardrobe:${roleId}:${key}`  // 稳定、可幂等跳过
```

另有 `maybeGrantFromEvent`（payload.grantAsset → addAsset），管线尚未挂到 publish 主路径（M25-G2）。

---

## 三、挂到事件

```
materializePlannedEvents
  slot.type === 'moment' → assetId = await pickWardrobeAssetId(roleId, scheduledAt)
  insertEvent(..., payload: { ..., assetId? })
```

`pickWardrobeAssetId`：确保 starter → 在衣柜列表中按时间/哈希挑一件（确定性，便于测）。

---

## 四、IPC 可见性

与 moments 相同：只读当前 `activeRoleId` 的资产列表；可按 `kind` 过滤。

---

## 五、约束速查

| 约束 | 落点 |
|------|------|
| 按 role 隔离 | 表字段 + list 查询 |
| 事件只引用 id | payload.assetId |
| 空柜可演示 | ensureStarterWardrobe |
| 不进 agent 层 | assets 不 import agent |

---

## 六、已知简化

- 无编辑/删除 IPC（M25-G1）  
- 无「购买事件 → 自动 addAsset」管线（M25-G2）  
- 仅 wardrobe 种子（M25-G3）
