# 伙伴与生活世界 — 技术框架

> 状态：已确认方向（2026-08-01）· 工程按 W 批次推进 · 方法论 Part VI 已按此重排  
> 产品前提：**先 1 个主角色**做深；终局对齐 Alice 型关系 Agent（人设、成长、每日生活、朋友圈、衣柜、交际圈）。

## Why

仅有 Prompt 人格只能做出「会说话的工具」。目标是：**不在对话框里时也在活**，且动态 / 着装 / 圈子 / 对话是同一份世界状态的不同截面。

## 四层架构（契约）

| 层 | 职责 | 禁止 |
|----|------|------|
| **A Identity** | Character Bible、PROTECTED、主角色身份核 | 自进化改 PROTECTED |
| **B Growth** | MUTABLE 覆盖、反思演化、与记忆分工 | 每轮狂改；无版本无回滚 |
| **C World** | 时空/日程、资产、事件、交际圈、生成器 | 朋友圈/衣柜另起真相源 |
| **D Assemble + Surfaces** | prompt-builder 注入；聊天/朋友圈/衣柜/触达 UI | UI 私自造状态 |

```text
Identity + Growth + World ──组装──► System Prompt / 工具上下文
                │
                └──派生──► 朋友圈 · 衣柜 UI · 主动触达（截面，只读投影）
```

硬原则（来自 Alice Ch.18，自有表述）：

1. **展示层是业务层的派生**，朋友圈不得有独立「内容真相」。  
2. **事件层可滑动过期；资产层永久**（动态可沉，衣服还在）。  
3. **生活不挡干活**（第一期）：World 戏份不降低工具/Agent 工作质量。  
4. **文案是数据，组装是代码**：人设不进 `prompt-builder.ts` 长字符串堆。

## 工程批次 W（唯一施工队列）

| 批次 | 交付 | 主要模块 | 对应方法论 |
|------|------|----------|------------|
| **W0** | 人设资产化 + 主角色 Bible 骨架；组装只读资产 | `personas/`、prompt-builder | M21 补、M22 预备 |
| **W1** | MUTABLE 用户态 + 门控反思（可回滚）+ 记忆联动 | persona-store / reflection | M22、M28 |
| **W2** | World v1：居所/时区/日程 + 每日生活生成 | `world/` | M23 |
| **W3** | 朋友圈 v1（事件窗口，读 World） | moments 截面 | M24、M31 苗头 |
| **W4** | 衣柜/资产 v1（持久；可被动态引用） | assets | M25 |
| **W5** | 交际圈 / 具名子 Agent 卡司 | cast | M26 |
| **W6** | 主动在场 + 体验横切收齐 | surfaces / UX | M27–M31 |

验收终局一句话：**她不在聊天时也有一天；动态、衣服、圈子与对话里的她是同一个人。**

## 目录落点（目标形态，随 W 生长）

```text
electron/main/agent/
  prompt-builder.ts          # 只组装
  personas/                  # W0：主角色 Bible + 默认 MUTABLE
  persona-store.ts           # W1
  persona-reflection.ts      # W1
electron/main/world/         # W2+
  state.ts                   # 时空/日程/心情等
  generator.ts               # 每日生活生成
  moments.ts                 # 事件层
  assets.ts                  # 衣柜等
  cast.ts                    # 交际圈
```

存储：Identity 资产可进仓库；Growth/World 用户态进 SQLite（或 settings + 版本表），生成物可回滚。

## 与方法论关系

- **施工**只认本文 W0–W6。  
- **沉淀**认 `methodology/README.md` Part VI（M21–M31）；章号按问题域，不按施工顺序。  
- wishlist 只挂缺口，不维护第二套路线图。

## 边界（已拍板）

- [x] 先 1 个主角色（深度 Bible），多模板切换不做第一期并行主线  
- [x] 朋友圈 / 衣柜 / 交际圈为正式模块，不是「可选装饰」  
- [x] MUTABLE 与 World 生成均需版本/可回滚  
- [x] 第一期：生活系统不阻断工具执行  

## 下一步

1. 落地 W0（人设目录化 + 主角色骨架）  
2. 各 W 完成后按映射写/补对应 M 章（深啃五步）  
