# 伙伴世界（Companion）

## 一句话

同宇宙多主角架构下，**唯一活跃主角**接管聊天、生活世界、朋友圈与衣柜；文案资产化，组装器只拼装。

## 边界

**做**：Role Pack / 单活跃门控 / MUTABLE 版本 / LifeEngine（暂停·剧本·tick）/ Catch-up≤7×24h / Moments·Assets 截面 / 名册浅注入 / 冷启动在场文案。  
**不做**：会话中途换角；非活跃后台养成；多宇宙并行；生图朋友圈（非本阶段）。

## 短 Why

只有 Prompt 换皮是工具；有暂停的生活世界与派生截面，才是「同一个人」的伙伴感。

## 主入口

| 类型 | 位置 |
|------|------|
| UI | 设置「活跃主角」；侧栏朋友圈 / 衣柜；空会话冷启动欢迎屏 |
| IPC | `companion:*`（list / switch / moments / assets / roster / summon-brief…） |
| Prompt | `prompt-builder` + `orchestrator.loadRoleAssembleInput` |
| 资产 | `electron/main/companion/universes/default/` |
| 契约 | `docs/requirements/companion-*.md` |

## 依赖

- **依赖**：settings-store、SQLite、streaming-gate、（可选）LLM 日后换剧本生成器  
- **被依赖**：runtime 聊天组装、Eval C01 / B01、设置页

## 不变量

- 同时仅一个 `activeRoleId`  
- 流式进行中 `requestSwitch` → `SESSION_ACTIVE`  
- 非活跃不 tick、不生成剧本/事件  
- 名册只注入 summary/关系短句，不注入他人全文 protected  
- 朋友圈/衣柜为事件与资产的派生截面，非第二真相库  

## 必读文件

- `electron/main/companion/orchestrator.ts`
- `electron/main/companion/life/engine.ts`
- `electron/main/companion/cast/roster.ts`
- `electron/main/agent/prompt-builder.ts`
- `docs/requirements/companion-tech-spec.md`

## 必测点

- 换角门控、Catch-up 7 日边界、名册无他人 protected、资产按 role 隔离  
- Eval：`evals/scenarios/c01-companion.ts`；语气基线 `b01-persona-tone.ts`（有 key）

## 现状 / 缺口

**现状**：W0–W5 已落地；W6 补冷启动在场与模块卡 / Eval C01。  
**缺口**：召唤子会话完整 Pack 装载；自动反思写 MUTABLE；方法论 M21–M31 审核式深啃。三主角薄 Pack（小林/小周/小夏）已挂满。
