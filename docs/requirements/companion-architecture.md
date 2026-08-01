# 伙伴与生活世界 — 模块架构详设

> 状态：设计已确认（2026-08-01）· **开工前合同** · 落地后要点吸入 `architecture.md` / modules 卡  
> 产品契约与 W 批次：[`companion-world-framework.md`](./companion-world-framework.md)  
> 与底层关系：挂在现有 Electron 主进程分层之下，**不推翻** Agent Loop / tools / memory / ipc；新增 `companion/`（或等价）域，由 Orchestrator 门控，Assemble 注入 Loop。

## 1. 与现有底层是否一致

| 现有层 | 关系 |
|--------|------|
| `agent/loop` + `runtime` | 不变；每轮仍 yield 事件。组装前向 Companion 取 active Role + 近况摘要 |
| `prompt-builder` | 退化为 **Assemble**：只拼装，不养文案 |
| `memory/` | 用户画像仍跨角色；MUTABLE/生活按 role 分桶，不混进记忆事实库抢职责 |
| `storage/` SQLite | 新增 companion 相关表（或命名空间），沿用现有 DB 纪律 |
| `ipc/` | 增设 companion/persona 门控通道；**四处同步**纪律不变 |
| `tools/` / sandbox | 生活不挡干活；权限模型不因朋友圈绕过 |

依赖方向仍遵守：`ipc → agent/companion → storage/llm`；禁止 companion UI 直写 DB。

## 2. 六域模块

```text
Orchestrator ──门控──► activeRoleId / 完整切换 / Catch-up 触发
     │
     ├─ Identity      Role Pack（仓库资产）
     ├─ Growth        MUTABLE（user×role）
     ├─ Universe      团、relations、名册
     ├─ LifeEngine    暂停 · 剧本 · tick · 事件 · 资产 · Catch-up
     ├─ Assemble      prompt-builder
     └─ Surfaces      聊天/圈/衣柜/设置（只读投影）
```

| 域 | 职责 | 不负责 |
|----|------|--------|
| **Orchestrator** | `activeRoleId`；`requestSwitch`；拒会话中换角；切换事务 | 写人设、生成剧本正文 |
| **Identity** | `universes/*/roles/*` Role Pack；PROTECTED | 用户态演化 |
| **Growth** | MUTABLE 读写/版本；仅 active 可反思 | 生活事件 |
| **Universe** | roster、relations、canBeProtagonist | 推进日子 |
| **LifeEngine** | 见 §3 | 主对话 Loop |
| **Assemble** | L1–L4 拼装 | 长文案硬编码 |
| **Surfaces** | UI 随 active 重绑 | 自建生活真相 |

## 3. LifeEngine 子模块

| 子模块 | 职责 | Alice 对照 |
|--------|------|------------|
| Clock/Pause | `pausedAt`；非活跃不 tick | （我们加强） |
| Script Planner | 按日剧本；缺则生成 | `generateDayScript` / `ensureDayScriptsForDateRange` |
| World Tick | **仅 active** 物化到期事件 | `worldTick` |
| Event Store | 结构化事件 | Ch.18 结构化数据 |
| Moments Projector | 事件→朋友圈截面 | Moments |
| Assets | 衣柜等持久 | wardrobe |
| **Catch-up** | 切换时：细补 **pausedAt→now 中最近 7 天**；更早→状态摘要 | 范围 ensure + 上限 |

Catch-up 规则：

1. 触发：完整切换成功且新角色存在 `pausedAt`（或首次启用的等价空洞）。  
2. 细粒度剧本/事件：**最多 7 个日历日**（含边界策略在实现时写死并单测）。  
3. 超过 7 天的空洞：一条「期间概况」摘要写入角色状态，供 Prompt/UI，不逐日生成。  
4. 物化时间戳落在过去合理点；禁止「打开瞬间假装正在发生」。  
5. Job 可异步；Surfaces 可先显示「正在追赶最近生活…」。

## 4. 数据分桶

```text
per universe（资产）: roles/, relations
per roleId（用户态）: mutable, pause, day_scripts, events, moments, assets
per user: 记忆画像, activeRoleId, universeId
per session: 绑定创建时的 roleId（中途不可改）
```

## 5. 完整切换时序

```text
requestSwitch(B)
  → 若存在未结束且绑定 A 的会话 → 拒绝
  → A.pause() 记录 pausedAt
  → activeRoleId = B
  → enqueue CatchUp(B, from=pausedAt, to=now)  // ≤7 日细补
  → Surfaces.rebind(B)
  → 仅允许以 B 创建新会话
```

## 6. 目录意向（实现时再落，本文不强制文件名）

```text
electron/main/companion/     # 或 agent/companion/
  orchestrator.ts
  identity/   growth/   universe/
  life/       assemble 桥接 prompt-builder
ipc: companion.* / 扩展 persona.*
```

旧 `BUILTIN_PERSONAS`：W0 删除，改为 Universe 内新主角包。

## 7. Eval / 可插拔

- 场景带 `universeId` + `protagonistId`（= activeRoleId）。  
- 必测：拒会话中换角；切换后 Surfaces 全换；Catch-up ≤7 日。  
- 新主角 = 新 Role Pack + relations 边 + 挂上 `protagonistIds`。

## 8. 非目标（本阶段）

- 会话中途换角；多角色并行刷朋友圈  
- 非活跃后台养成；完整复刻 Alice 朋友圈驱动力回复（可后置）  
- 多宇宙并行（先 1 个宇宙）  

## 9. 落地后文档收敛

- 稳定连接图 → 收进 `docs/architecture.md` 一小节（已预留）  
- 产品边界稳定 → `docs/modules/` 开/改薄卡  
- 深 Why → 对应 `methodology/m2x-*.md`  
