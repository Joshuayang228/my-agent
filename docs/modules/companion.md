# 伙伴世界（Companion）

## 一句话

同宇宙多主角架构下，**唯一活跃主角**接管聊天、生活世界、朋友圈与衣柜；文案资产化，组装器只拼装。

## 边界

**做**：Role Pack / 单活跃门控 / MUTABLE 版本与自动反思 / LifeEngine（暂停·剧本·tick）/ Catch-up≤7×24h / Moments·Assets 截面 / 名册浅注入 / 冷启动在场 / 召唤子会话与忙闲婉拒。  
**不做**：会话中途换角；非活跃后台养成；多宇宙并行；生图朋友圈（非本阶段）。

## 短 Why

只有 Prompt 换皮是工具；有暂停的生活世界与派生截面，才是「同一个人」的伙伴感。

## 主入口

| 类型 | 位置 |
|------|------|
| UI | 设置「活跃主角」+ MUTABLE/反思；侧栏朋友圈/衣柜/名册；欢迎屏冷启动；CastPanel「开聊」 |
| IPC | `companion:*`（list / switch / moments / assets / roster / start-summon / reflection…） |
| Prompt | `prompt-builder` + `orchestrator.loadRoleAssembleInput`（管线见能力目录 §1.1） |
| 资产 | `electron/main/companion/universes/default/` |
| 契约 | `docs/requirements/companion-*.md`（索引见 [requirements/README](../requirements/README.md)） |
| 能力表 | [capability-catalog.md](./capability-catalog.md) §伙伴世界 |

## 依赖

- **依赖**：settings-store、SQLite、streaming-gate、LLM（反思 / 日后剧本生成）、task-queue  
- **被依赖**：runtime 聊天组装、Eval C01 / B01、设置页、CastPanel

## 不变量

- 同时仅一个 `activeRoleId`  
- 流式进行中 `requestSwitch` → `SESSION_ACTIVE`  
- 非活跃不 tick、不生成剧本/事件  
- 名册只注入 summary/关系短句，不注入他人全文 protected  
- 召唤不改 active、不推进对方生活世界  
- 朋友圈/衣柜为事件与资产的派生截面，非第二真相库  

## 必读文件

- `electron/main/companion/orchestrator.ts`
- `electron/main/companion/life/engine.ts`
- `electron/main/companion/cast/roster.ts`
- `electron/main/companion/growth/reflection-service.ts`
- `electron/main/agent/prompt-builder.ts`
- `electron/main/agent/runtime.ts`（组装 + 召回 + 反思调度）
- `docs/requirements/companion-tech-spec.md`

## 必测点

- 换角门控、Catch-up 7 日边界、名册无他人 protected、资产按 role 隔离  
- 召唤不改 active；反思门闸 / 召唤跳过  
- Eval：`evals/scenarios/c01-companion.ts`；语气基线 `b01-persona-tone.ts`（有 key）

## 现状 / 缺口

**现状**：W0–W6 主线已落地；深 Why：`m22` 成长 · `m23` 生活 · `m24` 朋友圈/事件。  
**缺口**：主角 Pack 内容打磨；methodology M25–M31；生图朋友圈等见 wishlist。
