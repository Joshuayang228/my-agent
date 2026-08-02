# 伙伴与生活世界 — 完整技术方案（施工合同）

> 状态：**W0–W6 主线已落地**（2026-08-02）· 后续为内容 Pack / 方法论深啃  
> 上位文档：[产品契约](./companion-world-framework.md) · [模块架构](./companion-architecture.md) · [DEC-034](../decisions.md)  
> 本文补齐：数据模型 · Role Pack 格式 · 关键接口 · 影响范围 · W0–W6 可验证步骤 · 风险权衡  

### 已拍板补充（原 §8）

| 项 | 决定 |
|----|------|
| 主角数量 | **架构按 3 个主角位设计**（`protagonistIds` 可挂满 3）；**内容先做 1 个**，其余按需一个一个加 Pack |
| 旧会话 | 开发阶段**可清空** sessions/messages；不保留无 `role_id` 的兼容路径 |
| 设置字段 | **直接使用 `activeRoleId`**，删除 `personaId`；不做读写兼容/映射 |

---

## 1. 需求背景（Why）

见 `companion-world-framework.md`。一句话：从「Prompt 换皮」升级为 **同团多主角 + 单活跃生活世界**，且与现有 Agent Loop / Memory / IPC 分层兼容，避免后期推倒重来。

## 2. 功能目标（What）

| # | 目标 | 验收意象 |
|---|------|----------|
| G1 | 同宇宙架构支持 3 主角位；**首发 1 个完整 Role Pack**（废旧模板） | 设置可见已启用主角（先 1 个）；manifest 预留另 2 个 id 槽或空位说明；无 warm-partner 等旧 id |
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
  "protagonistIds": ["role-a"],
  "plannedProtagonistSlots": 3,
  "defaultProtagonistId": "role-a"
}
```

> W0：`protagonistIds` 仅含已交付的 1 个；`plannedProtagonistSlots: 3` 标明架构容量。加第二/第三个主角 = 新增 `roles/<id>/` + 把 id 追加进 `protagonistIds` + 补 `relations`，**不改引擎模型**。

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

**W0 人设正文**：先交付 **1 个**主角的可用 protected/mutable（可仍标迭代中）；另 2 个位不建半残 Pack。后续主角文案可另开 `docs/requirements/companion-cast-content.md`。

**废弃（直接删除，无兼容）**：`BUILTIN_PERSONAS` / `warm-partner` / `rigorous-advisor` / `tech-geek` / settings.`personaId`。

### 3.3 设置与会话字段

| 键 / 列 | 位置 | 说明 |
|---------|------|------|
| `universeId` | settings | 默认 `"default"` |
| `activeRoleId` | settings | **唯一**当前主角；**无** `personaId` 字段 |
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

旧 `persona:*` IPC：**直接删除**，由 `companion:*` 取代（四处同步一并改完）。

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
| `prompt-builder.ts` / 单测 | 改加载源；断言改新 role id | 中：测例改写 |
| `ipc/persona.ts` → `companion.ts`、preload、vite-env、SettingsPanel | 删 persona API，改 companion | 中：破坏性一次做完 |
| `settings-store` | 删 `personaId`，加 `activeRoleId`/`universeId` | 高：本地设置重置相关键 |
| `sessions` | 加 `role_id`；**允许清空**旧会话表（开发期） | 高：历史对话可丢 |
| Eval | 夹具改新 protagonistId | 低～中 |
| Memory | 用户画像仍全局 | 低 |

**破坏性重置（开发期允许）**

1. 删除旧三模板与一切 `personaId` 引用。  
2. W0 可提供「清空会话」或 migration 直接 `DELETE` sessions/messages（无客户数据顾虑）。  
3. changelog 写明「人格与会话存储破坏性变更」。

---

## 5. 实施步骤（W0–W6，每步可验证）

### W0 — Identity + Assemble（最小可运行）

**做：**

1. 建 `universes/default`：`plannedProtagonistSlots: 3`，**仅 1 个** `roles/<id>/` 完整 Pack  
2. `loadRolePack` / `listProtagonists`（列表 = 已在 `protagonistIds` 中的包）  
3. `prompt-builder` 从 pack 读 L1；删 `BUILTIN_PERSONAS`  
4. settings：删 `personaId`，加 `activeRoleId` + `universeId`（默认指向该唯一主角）  
5. IPC：删 `persona:*`，加 `companion:list-protagonists` / `get-active`（及设置写 active）；设置页改绑  
6. sessions 加 `role_id`；开发期清空或 migration 丢弃旧会话  

**验收：**

- [x] `tsc` + 相关单测绿  
- [x] 设置可见 **1** 个主角（小林 / `lin`）；对话 L1 从 Pack 读 protected  
- [x] 业务代码无 `personaId` / `warm-partner` / `BUILTIN_PERSONAS`（仅迁移删除与注释残留）  
- [x] 再加一个角色目录并写入 `protagonistIds` 后，**无需改 Orchestrator/Assemble 模型**即可列出（已验：`zhou` / 小周，`xia` / 小夏；3 槽满）  

### W1 — Orchestrator + Growth 门控

**做：** `requestSwitch` 完整门控；`SESSION_ACTIVE`；mutable 表 + 版本；Assemble 用覆盖 MUTABLE。  

**验收：**

- [x] 流式中 switch → `SESSION_ACTIVE`（单测 + 设置页 toast）  
- [x] 无进行中会话时 switch 成功写 `activeRoleId`  
- [x] mutable 版本可回滚（单测）  

### W2 — LifeEngine 暂停 / 剧本 / tick

**做：** `companion_role_state` / `day_scripts` / `events`；pause；ensureDayScripts；仅 active tick。  

**验收：**

- [x] 非活跃不新增 script/event  
- [x] ensure 某 3 日缺页则补齐（可 mock LLM）  

### W3 — Moments + Catch-up

**做：** moments 投影；`runCatchup` ≤7 日；IPC 列表；简单 UI 时间线。  

**验收：**

- [x] 暂停 10 日后切回：细补 7 日 + summary 有值（单测冻时间）  
- [x] 朋友圈仅显示 active role  

### W4 — Assets 衣柜

**做：** `companion_assets`；事件可引用资产 id；设置或面板只读列表。  

**验收：**

- [x] 资产按 role 隔离；切换后列表变  

### W5 — Cast 名册 / 召唤

**做：** relations → roster 浅注入；可选子会话装载非 active pack（不启用其生活）。  

**验收：**

- [x] 主对话 Prompt 含名册短句；不出现其他主角全文 protected  
- [x] 召唤子会话：`startSummon` 装载非 active Pack（含 protected），`session_kind=summon`，不改 active、不注入 catchup  

### W6 — 主动在场与体验收齐

**做：** 触达入口、冷启动文案、Eval 场景补齐；modules 卡更新。  

**验收：**

- [x] 产品清单 G1–G6 可演示（设置主角 / 禁流式换角 / Catch-up / 名册 / 朋友圈 / 衣柜 / 冷启动欢迎）  
- [x] Eval：C01 名册浅注入契约；禁中途换角由单测覆盖；B01 语气基线（有 key，无 key skip）  

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

## 8. 待讨论项 — 已关闭

见文首「已拍板补充」。无开放项。

---

## 9. 文档关系（施工时认谁）

| 优先级 | 文档 |
|--------|------|
| 1 施工 | **本文** + framework 约束 |
| 2 模块图 | companion-architecture.md |
| 3 全局指针 | architecture.md §5.1 |
| 4 沉淀 | methodology M21–M31（代码后写） |

**W0–W6 主线已完成**。后续：第二主角内容 Pack、子会话召唤 UI、methodology M21–M31 审核式沉淀。  
