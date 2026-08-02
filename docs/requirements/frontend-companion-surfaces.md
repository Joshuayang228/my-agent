# 前端伴侣界面：Alice 走查 + 改造方案

> 状态：**P0 已落地**（2026-08-02）；P1/P2 待做  
> 前置：Part VI 方法论已加厚收齐。

---

## 0. 已锁定决策

| 项 | 决定 |
|----|------|
| 路线 | 按 G1–G9、阶段 A→E 推进 |
| 本轮范围 | **A 文档 + B Token + C P0 UI**（状态条 / Moments 卡片 / 角色架 / IA） |
| G6 场景背景 | **P2**，本轮不做 |
| 视觉 | **薄雾 glass + 暖金点缀**（Alice 语义；token 前缀 `--companion-*`，不抄品牌资产） |
| P1 | 衣柜主视觉、名册关系感（下轮） |

### 方案判断（为何这样定）

1. **先让「她在过生活」可见**：状态条 + 朋友圈卡片 + 换角一等入口，比先改全站主题更划算。  
2. **生活/工具分层**：侧栏继续放工具；生活入口走 Chat 顶栏快捷 + 专用 View，避免首屏仪表盘。  
3. **场景背景后置**：没有插画资产时硬上背景容易假；先用 presence 文案占位。  
4. **不重写全部主题**：在现有深/浅/mist 上叠加 companion token，生活面组件优先用暖金/glass。

---

## 1. 我方现状（摘要）

`activeView`：`chat | skills | memory | moments | assets | cast | settings`（本轮新增 `shelf`）。  
缺口：无状态条、Moments 偏列表、换角埋设置、无 companion token、文档缺用户入口。

---

## 2. Alice 可借 / 不抄

**借**：生活面 vs 工具面；glass + 克制暖金；朋友圈/衣柜当叙事表面；换角一等操作。  
**不抄**：IDE 审美主导、主题全家桶、仪表盘顶栏、Alice 插画资产。

---

## 3. Gap 与本轮交付

| # | 项 | 本轮 |
|---|-----|------|
| G1 | Chat 状态条 | ✅ |
| G2 | Moments 卡片化 | ✅ |
| G5 | Character Shelf | ✅ |
| G7 | companion CSS token | ✅ |
| G8 | IA：换主角→shelf；快捷入口 | ✅ |
| G9 | skill + catalog/companion 文档 | ✅ |
| G3/G4/G6 | 衣柜/名册/场景 | 下轮 / P2 |

---

## 4. 目标 IA

```text
Sidebar: 会话 + 工具（Skills/记忆/设置）
Main: chat（含状态条）| moments | assets | cast | shelf | …
换主角主入口 = shelf；设置页可保留次要切换
```

---

## 5. 验收（本轮）

- [x] frontend skill 能区分生活面/工具面  
- [x] catalog/companion 写清用户入口  
- [x] Chat 可见「主角 · 此刻状态」；可进朋友圈/角色架  
- [x] Moments 为卡片时间线；Catch-up 用暖色条  
- [x] Shelf：3 槽、活跃徽标、流式中拒绝切换文案  
- [x] 测试 / tsc 通过（338 tests；`tsc --noEmit`）

