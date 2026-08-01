# 伙伴与生活世界 — 完整技术方案（施工合同）

> 状态：**讨论稿 / 待你确认后开工**（2026-08-01）  
> 上位文档：[产品契约](./companion-world-framework.md) · [模块架构](./companion-architecture.md) · [DEC-034](../decisions.md)  
> 本文补齐：数据模型 · Role Pack 格式 · 关键接口 · 影响范围 · W0–W6 可验证步骤 · 风险权衡  
> **确认前不改 `electron/` 业务代码。**

---

## 1. 需求背景（Why）

见 `companion-world-framework.md`。一句话：从「Prompt 换皮」升级为 **同团多主角 + 单活跃生活世界**，且与现有 Agent Loop / Memory / IPC 分层兼容，避免后期推倒重来。

## 2. 功能目标（What）

| # | 目标 | 验收意象 |
|---|------|----------|
| G1 | 同宇宙 3 个可选主角（人设新建，废旧模板） | 设置里三选一；无 warm-partner 等旧 id |
| G2 | 同时仅一个 `activeRoleId` 接管聊天+生活 UI | 切角色 = 整面切换 |
| G3 | 会话绑定角色，禁止中途换角 | 进行中会话调用 switch → 明确错误码 |
| G4 | 非活跃完全暂停；切换 Catch-up 细补 ≤7 日 | 单测覆盖天数上限与摘要路径 |
| G5 | 文案资产化；组装器无长文案 | Role Pack 目录；`prompt-builder` 只拼装 |
| G6 | 朋友圈/衣柜为派生截面（随 W3/W4） | 无独立「朋友圈真相库」 |

非目标见 architecture §8（多宇宙、会话中换角、非活跃后台养成等）。

---

## 3. 技术方案（How）

### 3.1 逻辑架构与数据流

```text
设置「切换主角」
  → IPC companion.requestSwitch(roleId)
  → Orchestrator 门控（会话？）
  → pause 旧角色 / 写 settings.activeRoleId
  → Catch-up Job（≤7 日）
  → 渲染进程 rebind Surfaces

聊天发送
  → session 带 role_id（创建时写入，不可改）
  → runtime 读 active Role Pack + mutable + 近况摘要
  → Assemble → Loop → LLM
```

依赖方向：`ipc → companion/* → storage/llm`；`agent/runtime` 只依赖 companion 的只读查询 API。

### 3.2 Role Pack 文件格式（仓库资产）

```text
electron/main/companion/universes/default/
  manifest.json
  relations.json
  roles/
    <roleId>/
      manifest.json          # 元数据
      protected.md           # PROTECTED 正文（纯文本/Markdown）
      mutable.default.md     # 默认 MUTABLE（可被用户态覆盖）
      voice.md               # 可选：语气补充（拼进 L1 或 L2）
      summary.txt            # 一行/短摘要，供名册浅层注入
```

**`universes/default/manifest.json`**

```json
{
  "id": "default",
  "title": "默认主角团",
  "version": 1,
  "protagonistIds": ["role-a", "role-b", "role-c"],
  "defaultProtagonistId": "role-a"
}
```

**`roles/<id>/manifest.json`**

```json
{
  "id": "role-a",
  "name": "（待定中文名）",
  "description": "一句话简介（设置页）",
  "canBeProtagonist": true,
  "asideStyle": "可选 aside 风格说明"
}
```

**`relations.json`**

```json
{
  "edges": [
    { "from": "role-a", "to": "role-b", "type": "colleague", "note": "短关系说明" }
  ]
}
```

组装名册时：以 `activeRoleId` 为视角，把 `from/to` 转成「你与 X 的关系」短句；**禁止**在三份 `protected.md` 里各写一套互相矛盾的人物小传。

**W0 人设正文**：可用占位文案（标明 TODO），但 **id/目录/加载链路必须一次做对**；正式三主角文案可并行另开 `docs/requirements/companion-cast-content.md`（纯内容，不挡引擎）。

**废弃**：`BUILTIN_PERSONAS` / `warm-partner` / `rigorous-advisor` / `tech-geek`。迁移策略见 §5。

### 3.3 设置与会话字段

| 键 / 列 | 位置 | 说明 |
|---------|------|------|
| `universeId` | settings | 默认 `"default"` |
| `activeRoleId` | settings | 取代业务语义上的 `personaId`（见迁移） |
| `personaId` | settings | **兼容读**：W0 期间若存在旧值则映射/忽略并写入 `activeRoleId`；稳定后可删 |
| `sessions.role_id` | SQLite | 创建会话时写入当时 `activeRoleId`；**不可 UPDATE** |
| `sessions` 进行中判定 | 现有流式/任务状态 | Orchestrator：若该 session 未结束且 `role_id ≠ 目标` → 拒绝 switch |

### 3.4 SQLite 表（用户态，schema migration 递增）

> 表名可微调，语义冻结。均带 `role_id`（除全局 settings）。

**`companion_role_state`** — 每角色一行运行态

| 列 | 类型 | 说明 |
|----|------|------|
| role_id | TEXT PK | |
| paused_at | INTEGER NULL | 非 null = 暂停中；active 时为 null |
| last_tick_at | INTEGER | |
| catchup_summary | TEXT | >7 日空洞的概况摘要 |
| updated_at | INTEGER | |

**`companion_mutable`** — MUTABLE 覆盖（W1）

| 列 | 类型 | 说明 |
|----|------|------|
| role_id | TEXT PK | |
| body | TEXT | 当前 MUTABLE |
| version | INTEGER | 单调增 |
| updated_at | INTEGER | |

**`companion_mutable_versions`** — 回滚（W1）

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | |
| role_id | TEXT | |
| version | INTEGER | |
| body | TEXT | |
| created_at | INTEGER | |
| summary | TEXT | 变更说明 |

**`companion_day_scripts`** — 日剧本（W2）

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | |
| role_id | TEXT | |
| date | TEXT | `YYYY-MM-DD` |
| payload_json | TEXT | 结构化剧本 |
| created_at | INTEGER | |
| UNIQUE(role_id, date) | | |

**`companion_events`** — 结构化事件（W2/W3）

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | |
| role_id | TEXT | |
| scheduled_at | INTEGER | 预定发生/发布时间 |
| status | TEXT | `planned` / `published` / `cancelled` |
| type | TEXT | 如 `moment` / `activity` |
| payload_json | TEXT | 地点、心情、活动、着装引用等 |
| day_script_id | TEXT NULL | |

**`companion_moments`** — 朋友圈截面缓存（W3，可由 events 派生物化）

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | |
| role_id | TEXT | |
| event_id | TEXT | |
| published_at | INTEGER | |
| text | TEXT | |
| meta_json | TEXT | 图片占位等 |

**`companion_assets`** — 衣柜等（W4）

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | |
| role_id | TEXT | |
| kind | TEXT | `wardrobe` / … |
| name | TEXT | |
| payload_json | TEXT | |
| acquired_at | INTEGER | |
| source_event_id | TEXT NULL | |

索引：`(role_id, date)`、`(role_id, scheduled_at)`、`(role_id, published_at DESC)`。

### 3.5 关键接口（TypeScript 契约意向）

实现时可放 `electron/main/companion/types.ts` + 各模块；以下为**语义冻结**。

```ts
// Orchestrator
requestSwitch(roleId: string): Promise<
  | { ok: true; catchupQueued: boolean }
  | { ok: false; code: 'SESSION_ACTIVE' | 'UNKNOWN_ROLE' | 'ALREADY_ACTIVE'; }
>
getActiveRoleId(): Promise<string>
assertSessionRole(sessionId: string, roleId: string): void  // 聊天前校验

// Identity
listProtagonists(universeId: string): RoleSummary[]
loadRolePack(roleId: string): RolePack  // 含 protected / mutableDefault / summary

// Growth (W1)
getMutable(roleId: string): Promise<string>  // 覆盖或 default
setMutable(roleId: string, body: string, summary: string): Promise<void>

// Life (W2+)
pauseRole(roleId: string, at: number): Promise<void>
resumeRole(roleId: string): Promise<void>
ensureDayScripts(roleId: string, fromDate: string, toDate: string): Promise<void>
// Catch-up: 仅细补 min(空洞, 7 个日历日)；更早写 catchup_summary
runCatchup(roleId: string, pausedAt: number, now: number): Promise<{ fineDays: number; summaryUpdated: boolean }>
tickActiveRole(now: number): Promise<void>  // 仅 active

// Assemble（改造 prompt-builder）
buildSystemPrompt({
  rolePack, mutableBody, rosterLines, catchupSummary?, ...existing
}): string
```

**IPC（四处同步：types / preload / ipc / 调用方）**

| Channel | 方向 | 说明 |
|---------|------|------|
| `companion:list-protagonists` | inv | 设置页列表 |
| `companion:get-active` | inv | `{ roleId, name, description }` |
| `companion:request-switch` | inv | 入参 roleId；出参同 `requestSwitch` |
| `companion:get-moments` | inv | W3；仅 active role，分页 |
| `companion:get-assets` | inv | W4 |
| `companion:catchup-status` | inv/事件 | 可选：进度给 UI |

旧 `persona:list` / `persona:get-current`：W0 改为薄封装转调 companion，或标记 deprecated 一版后删除。

### 3.6 Catch-up 算法（冻结）

```text
输入: roleId, pausedAt, now
fineStart = max(pausedAt, now - 7*86400000)   // 毫秒，按日对齐实现时写清
1) 若 pausedAt < fineStart:
     生成/更新 companion_role_state.catchup_summary（LLM 或规则模板，W2 可先规则）
2) ensureDayScripts(roleId, date(fineStart)..date(now))
3) 将 scheduled_at ∈ [fineStart, now] 且 status=planned 的事件标为 published 并投影 moments
4) paused_at = null；成为 active
```

边界：时区用本地日历日；单测固定 `now` 注入。

### 3.7 目录落点（实现约定）

```text
electron/main/companion/
  orchestrator.ts
  types.ts
  identity/          # load packs from universes/
  universes/default/ # 资产
  growth/
  life/              # pause, scripts, tick, catchup, moments, assets
  assemble.ts        # 或改造 agent/prompt-builder 并 re-export
electron/main/ipc/companion.ts
storage: database.ts migration + companion-*-store.ts
```

---

## 4. 影响范围评估

| 区域 | 影响 | 破坏性 |
|------|------|--------|
| `prompt-builder.ts` / 单测 | 改加载源；断言改 role id | 中：测例改写 |
| `ipc/persona.ts`、preload、vite-env、SettingsPanel | 列表/切换走 companion | 中：UI 文案「主角」 |
| `settings-store` | 增 `activeRoleId`/`universeId`；默认角色 id 变更 | 中：旧设置需迁移 |
| `sessions` | 增 `role_id` | 中：旧会话 `role_id` 可填当时默认或 null 只读 |
| Eval `b01-persona-tone` 等 | 改 `protagonistId` / system 夹具 | 低～中 |
| Memory | 用户画像仍全局；不按角色劈开（第一期） | 低 |
| 方法论 | 不挡施工；W 后沉淀 | 无 |

**迁移旧模板**

1. W0：打包内仅新三角色；设置若读到旧 `personaId` → 强制映射到 `defaultProtagonistId` 并写回 `activeRoleId`。  
2. 不保留「温暖伙伴」等旧文案兼容渲染。  
3. changelog 写明「人格模板重置」。

---

## 5. 实施步骤（W0–W6，每步可验证）

### W0 — Identity + Assemble（最小可运行）

**做：**

1. 建 `universes/default` + 3 个 Role Pack 目录（占位文案可）  
2. `loadRolePack` / `listProtagonists`  
3. `prompt-builder` 改为从 pack 读 L1；删 `BUILTIN_PERSONAS`  
4. settings：`activeRoleId` + 旧 id 迁移  
5. IPC `companion:list-protagonists` / `get-active`；设置页改绑（切换可先「直接改 settings」，完整门控放 W1）  
6. sessions 加 `role_id`（新会话写入）  

**验收：**

- [ ] `tsc` + 相关单测绿（prompt-builder 新断言）  
- [ ] 设置可见 3 主角；对话 L1 含对应 protected 片段  
- [ ] 无 warm-partner 字符串残留（grep）  

### W1 — Orchestrator + Growth 门控

**做：** `requestSwitch` 完整门控；`SESSION_ACTIVE`；mutable 表 + 版本；Assemble 用覆盖 MUTABLE。  

**验收：**

- [ ] 流式中 switch → `SESSION_ACTIVE`  
- [ ] 无进行中会话时 switch 成功且 UI 主角名变  
- [ ] mutable 版本可回滚（单测）  

### W2 — LifeEngine 暂停 / 剧本 / tick

**做：** `companion_role_state` / `day_scripts` / `events`；pause；ensureDayScripts；仅 active tick。  

**验收：**

- [ ] 非活跃不新增 script/event  
- [ ] ensure 某 3 日缺页则补齐（可 mock LLM）  

### W3 — Moments + Catch-up

**做：** moments 投影；`runCatchup` ≤7 日；IPC 列表；简单 UI 时间线。  

**验收：**

- [ ] 暂停 10 日后切回：细补 7 日 + summary 有值（单测冻时间）  
- [ ] 朋友圈仅显示 active role  

### W4 — Assets 衣柜

**做：** `companion_assets`；事件可引用资产 id；设置或面板只读列表。  

**验收：**

- [ ] 资产按 role 隔离；切换后列表变  

### W5 — Cast 名册 / 召唤

**做：** relations → roster 浅注入；可选子会话装载非 active pack（不启用其生活）。  

**验收：**

- [ ] 主对话 Prompt 含名册短句；不出现其他主角全文 protected  

### W6 — 主动在场与体验收齐

**做：** 触达入口、冷启动文案、Eval 场景补齐；modules 卡更新。  

**验收：**

- [ ] 产品清单 G1–G6 可演示  
- [ ] Eval：禁中途换角 + 基线主角语气（有 key 或 skip）  

每完成一批：更新 progress/changelog；**再**补对应 methodology 章（审核式沉淀）。

---

## 6. 风险与权衡

| 风险 | 缓解 |
|------|------|
| Catch-up LLM 贵/慢/失败 | Job 异步；失败保留 pause 点可重试；W2 可先规则摘要 |
| 7 日边界时区扯皮 | 本地日历日；单测注入 clock |
| 旧会话无 role_id | 只读打开不切换；新会话强制写入 |
| 设置页误用「换角色」当会话中操作 | 文案写清；W1 硬拒 |
| Role Pack 与代码双真相 | 文案只在目录；CI/单测读文件哈希或快照可选 |
| 范围膨胀（生图朋友圈） | W3 先纯文本；生图非本阶段 |
| WPS 再盖文件 | 本仓不纳入 WPS 同步（已建议） |

权衡记录：单活跃 + 完整切换（清晰）优于共享时间线滤镜（灵活但易跳戏）— 见 DEC-034。

---

## 7. 测试策略（摘要）

| 层 | 覆盖 |
|----|------|
| Unit | loadRolePack、迁移旧 personaId、switch 门控、catchup 7 日边界、Assemble 含 protected |
| Eval | `protagonistId` 夹具；禁中途换角场景（可 E2E/集成） |
| 手工 | 设置切换 → 新会话人设 →（W3）朋友圈列表隔离 |

---

## 8. 待讨论项（确认前请拍板）

请你在本条回复或下轮明确：

1. **W0 三角色**：是否接受「引擎用占位名 role-a/b/c + 占位 protected」先打通，正式人设另轨并行？还是 W0 必须同期给出三份完整 Bible？  
2. **旧会话**：打开无 `role_id` 的历史会话时，是只读用当前 active 展示，还是冻结为「未知角色、禁止继续聊」？  
3. **`personaId` 字段**：兼容一个版本后删除，还是直接改名 `activeRoleId`（破坏性一次做完）？  

---

## 9. 文档关系（施工时认谁）

| 优先级 | 文档 |
|--------|------|
| 1 施工 | **本文** + framework 约束 |
| 2 模块图 | companion-architecture.md |
| 3 全局指针 | architecture.md §5.1 |
| 4 沉淀 | methodology M21–M31（代码后写） |

确认本文 §8 三点并说「可以按此施工」后，从 **W0** 开始写代码。  
