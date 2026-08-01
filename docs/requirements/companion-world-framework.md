# 伙伴与生活世界 — 产品契约与批次

> 状态：已确认（2026-08-01）  
> **本文职责**：Why / 硬约束 / W0–W6 施工队列（产品契约）  
> **模块详设**：[`companion-architecture.md`](./companion-architecture.md)  
> **完整技术方案（施工合同）**：[`companion-tech-spec.md`](./companion-tech-spec.md) ← 接口/表结构/W 验收/风险  
> **全局技术图**：[`../architecture.md`](../architecture.md) 仅留指针  
> **深 Why**：`methodology/` Part VI（M21–M31），随 W 沉淀，不当施工图  

## Why

仅有 Prompt 人格只能做出「会说话的工具」。终局对齐 Alice 型关系 Agent：**有人设、有成长、有每日生活、有朋友圈/衣柜/交际圈**；动态 / 着装 / 对话是同一活跃角色世界状态的不同截面。

## 已拍板约束

| 项 | 决策 |
|----|------|
| 可选主角 | 架构预留 **3 个主角位**；**内容先做 1 个**，再逐个加；人设推倒重来，废旧模板；设置键用 `activeRoleId`（无 `personaId` 兼容） |
| 旧数据 | 开发期允许清空会话；不做旧会话/旧 persona 兼容 |
| 同时启用 | **唯一** `activeRoleId`（聊天 + 朋友圈 + 衣柜 + 日程全跟他） |
| 会话中换角 | **禁止** |
| 更换方式 | **完整切换**（门控通过后整面重绑） |
| 非活跃角色 | 生活世界**完全暂停**（不 tick、不生成） |
| 切换 Catch-up | 后台为新启用角色补暂停期间生活；**细补最近 ≤7 天**，更早仅摘要 |
| 生活 vs 干活 | 第一期：生活不阻断工具执行 |
| 展示层 | 朋友圈/衣柜 = 派生截面，禁止独立内容真相 |

## 逻辑四层（契约视角）

| 层 | 职责 | 禁止 |
|----|------|------|
| **A Identity** | Role Pack / Bible / PROTECTED | 自进化改 PROTECTED |
| **B Growth** | MUTABLE（按 user×role 分桶） | 无版本狂改 |
| **C World / Life** | 剧本、事件、资产、Catch-up（按 role 分桶） | 非活跃仍推进；朋友圈另起真相 |
| **D Assemble + Surfaces** | prompt 组装；UI 投影 | UI 私自造状态 |

模块拆分与时序见 **architecture 详设**，不在本文重复。

## 工程批次 W（唯一施工队列）

| 批次 | 交付 | 主模块（详设） | 对应方法论 |
|------|------|----------------|------------|
| **W0** | Universe + Role Pack 资产；组装只读；废旧模板 | Identity / Assemble | M21 |
| **W1** | 单活跃门控 + MUTABLE 分桶 + 冷启动门控 | Orchestrator / Growth / M28 | M22、M28 |
| **W2** | LifeEngine：暂停/剧本/tick | LifeEngine.Script/Tick | M23 |
| **W3** | 朋友圈截面 + Catch-up 物化 | Moments / Catch-up | M24 |
| **W4** | 衣柜等资产 | Assets | M25 |
| **W5** | 团员名册 / 卡司召唤 | Universe Cast | M26 |
| **W6** | 主动在场与体验横切 | Surfaces / UX | M27–M31 |

验收终局：**同一时刻只活一个角色；切换完整且可补近 7 日生活；动态与对话是同一个人。**

## 文档分工（符合四维规范）

| 文件 | 写什么 |
|------|--------|
| **本文** | 产品契约、约束、W 批次 |
| `companion-architecture.md` | 六域模块、分桶、时序 |
| `companion-tech-spec.md` | **施工合同**：表/接口/迁移/逐步验收/风险 |
| `docs/architecture.md` | Electron 总图 + 本节指针 |
| `docs/modules/*` | 有代码边界后再开/改产品卡 |
| `methodology/` M21–M31 | 深 Why；随 W 沉淀 |
| `docs/decisions.md` | 硬决策摘要 |

## 下一步

1. ✅ W0 / W1 / W2 已落地  
2. 下一刀按 tech-spec 做 **W3**（Moments + Catch-up≤7 日）  
