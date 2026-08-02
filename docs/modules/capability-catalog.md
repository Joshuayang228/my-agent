# 能力目录（Capability Catalog）

> **「有什么能力」的快速真相表**。  
> 模块卡管边界与入口；本表管**已落地能力清单**（防 `features.md` 归档后失忆）。  
> 细节以代码为准；卡/架构只导航。更新节奏：能力增删或行为变了 → 同轮改对应行。

入口：[`product-module-map.md`](./product-module-map.md) · 技术总图：[`../architecture.md`](../architecture.md)

---

## 怎么用

| 你想… | 去哪 |
|--------|------|
| 任务落在哪个产品横切？ | 模块卡 |
| 这个横切**已经做了哪些能力**？ | **本表** |
| 分层怎么连？ | `architecture.md` |
| 施工合同 / 批次缺口？ | [`../requirements/README.md`](../requirements/README.md) |

状态约定：`已落地` · `部分` · `缺口`（缺口勿写成已落地）。

---

## 1. 伙伴世界（Companion）

模块卡：[companion.md](./companion.md)

| 能力 | 状态 | 用户入口 | 落点 |
|------|------|----------|------|
| Universe + Role Pack（三槽：lin / zhou / xia） | 已落地 | 角色架 / 设置 | `universes/default/` · 文案见 [companion-cast-content](../requirements/companion-cast-content.md) |
| 生活分味（剧本 / starter 衣柜） | 已落地 | 朋友圈 / 衣柜随主角 | `script-generator` · `ensureStarterWardrobe` |
| 单活跃 + 流式换角门控 | 已落地 | **角色架（主）** / 设置（次） | `orchestrator` · `streaming-gate` · `requestSwitch` |
| 会话绑定 `role_id` | 已落地 | （隐式）Chat 顶栏徽标 | `runtime` · `assertSessionRole` |
| MUTABLE 分桶版本 + 回滚 | 已落地 | 设置 | `mutable-store` · Settings |
| 自动反思写 MUTABLE | 已落地 | 设置「立即/强制反思」 | `reflection-*` · task-queue |
| LifeEngine（暂停 · 剧本 · tick） | 已落地 | （隐式）状态条 presence | `life/engine.ts` |
| Catch-up ≤7×24h | 已落地 | 朋友圈暖色条 / Prompt | `life/catchup` · `catchup-status` |
| 此刻 presence | 已落地 | Chat `CompanionStatusBar` | `describeCastPresence` · `catchup-status.presence` |
| Moments（朋友圈） | 已落地 | 状态条 / 欢迎屏 → Moments | `get-moments` · MomentsPanel |
| Assets（衣柜） | 已落地 | 欢迎屏 → 衣柜 | `get-assets` · AssetsPanel |
| 名册浅注入 | 已落地 | （Prompt） | `cast/roster` |
| CastPanel（名册 / 召唤） | 已落地 | 状态条 / 欢迎屏 → 名册 | CastPanel · `start-summon` |
| 召唤子会话 | 已落地 | 名册「开聊」 | 不改 active / 不 tick 对方 |
| 召唤忙闲婉拒 + force | 已落地 | 名册开聊前 | `check-cast-availability` |
| 冷启动在场文案 | 已落地 | Chat 空态欢迎屏 | `companion-presence.ts` |
| 角色架 UI | 已落地 | 状态条 / 欢迎「换主角」 | CharacterShelfPanel · `shelf` |
| 衣柜主视觉（穿着中 + 场合标签） | 已落地 | 状态条 / 欢迎屏 → 衣柜 | AssetsPanel · Moment.assetId/outfit |
| 名册关系卡 + 最近召唤互动 | 已落地 | 状态条 / 欢迎屏 → 名册 | CastPanel · sessions(summon) |
| 场景弱背景（Chat 氛围） | 已落地 | Chat 消息区底层 | `CompanionSceneBackdrop` · `companion-scene.ts` |
| 生图朋友圈 / 多宇宙并行 | 缺口 | — | wishlist / 非本阶段 |
| 非活跃后台养成 | 缺口 | — | 产品明确不做 |

### 1.1 Prompt / 召回组装管线（聊天一轮）

主路径：`AgentRuntime` → `loadRoleAssembleInput` → `buildSystemPrompt` → Loop。

```text
用户发消息
  → assertSessionRole(session.role_id)          # 禁止偷换人设
  → loadRoleAssembleInput(roleId)               # Pack + MUTABLE + catchup + roster
  → memory.buildUserProfile()                   # 结构化画像
  → safeVectorSearch(lastUser)                  # 向量语义召回 → L3 memories
  → buildSystemPrompt({
        L1: PROTECTED + MUTABLE
        L2: 工具/aside/skill 摘要
        L3: 画像 + memories + catchup + roster
        L4: 动态（时间等）
     })
  → Agent Loop（流式）
  → 后台：profile-extract / smart-title / vector-index-user
  → scheduleReflectionAfterChat（召唤会话跳过）
```

召唤差异：装载对方完整 Pack；**不**改 `activeRoleId`；**不** tick / catchup 对方生活；Prompt 可带忙闲情境（`describeCastPresence`）。

---

## 2. 记忆（Memory）

模块卡：[memory.md](./memory.md)

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| 结构化记忆（画像 / 偏好 / 事实） | 已落地 | `memory-store` · MemoryPanel · `memory:*` IPC |
| remember / recall / forget 工具 | 已落地 | `tools/builtins/memory-manage.ts` |
| 向量语义召回注入 L3 | 已落地 | `vector-store` · `runtime.safeVectorSearch` |
| 对话后索引用户消息 | 已落地 | `vector-index-user`（不索引 assistant 原文） |
| 后台画像提取 | 已落地 | `profile-extractor` · task `profile-extract` |
| 语义去重（记忆写入） | 已落地 | M08 G6 |
| 项目文档 RAG | 不做（本模块） | 见 `rag/` |

---

## 3. 权限（Permission）

模块卡：[permission.md](./permission.md)

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| PermissionEngine 责任链 | 已落地 | `sandbox/permission-engine.ts` |
| 执行模式 confirm-all / auto / full-access | 已落地 | 输入区 · settings |
| 命令分级 + 路径守卫 | 已落地 | `command-guard` · `shell_exec` |
| 用户确认 IPC + 超时拒绝 | 已落地 | tool confirm · 监听清理 |
| `permissionRules` 热更新 | 已落地 | settings JSON |
| 权限规则可视化编辑器 | 缺口 | wishlist |

---

## 4. Agent 运行时（横切骨架）

暂无独立模块卡；边界见 `architecture.md` §Agent Loop / Prompt / 压缩。

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| Agent Loop（流式事件 · 工具超时 · 重试） | 已落地 | `agent/loop.ts` |
| 会话 Runtime 中心化（chat:send 只传本轮） | 已落地 | `agent/runtime.ts` · `ipc/chat` |
| System Prompt 四层组装 | 已落地 | `prompt-builder.ts` |
| 上下文压缩 L1–L4 | 已落地 | `context-manager` |
| 任务队列（后处理 / 反思等） | 已落地 | `services/task-queue` 等 |
| 子 Agent | 部分 | `subagent`；Swarm 见 wishlist M19 |
| MCP Client（stdio + SSE） | 已落地 | `mcp/` · 设置页 |
| 多 Provider LLM + Failover | 已落地 | `llm/` |
| Headless 运行（定时/后台） | 已落地 | `runtime.runHeadless` |
| Observer / DevPanel 可观测 | 已落地 | Batch3 |

---

## 维护

- 新能力落地 → 在对应节加一行，并视需要改模块卡「现状」  
- 能力废弃 → 删行或标缺口，勿留幽灵  
- 禁止把本表写成第二份 architecture；禁止把 wishlist 愿望写进「已落地」
