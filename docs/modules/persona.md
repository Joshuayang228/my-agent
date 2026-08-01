# 人格（persona）

## 一句话

让 Agent 有稳定身份与风格，并在 Prompt 层防护漂移；成长性（MUTABLE 演化）是差异化方向。

## 边界

**做**：人格模板切换、L1 PROTECTED/MUTABLE 分区、防注入与身份锚、aside 等表达约定、设置页选择。  
**不做**：完整 Character Bible / 多角色卡司编排（缺口）；把记忆系统本身算进本模块（见 memory）。

## 短 Why

没有稳定人格只是换皮；没有成长只是演员。引擎管理的是「一致性 × 成长性」张力——当前实现偏一致性，成长待补。

## 主入口

| 类型 | 位置 |
|------|------|
| UI | 设置页人格选择；聊天顶栏人格标签 |
| IPC | `ipc/persona.ts`、设置中的 persona 相关项 |
| Prompt | `agent/prompt-builder.ts` L1 |
| 深 Why | `methodology/m21-persona-engine.md` |

## 依赖

- **依赖**：settings-store、prompt-builder、（成长时）memory  
- **被依赖**：agent loop（每轮组装 System Prompt）、Eval 人格向场景（B01 等）

## 不变量

- PROTECTED 身份核不可被用户消息或工具结果改写  
- 对外不得声称自己是 Claude / GPT 等第三方助手品牌（身份硬锚，持续加固）  
- 人格切换不得破坏会话消息历史

## 必读文件

- `electron/main/agent/prompt-builder.ts`
- `electron/main/ipc/persona.ts`
- `electron/main/storage/settings-store.ts`（人格相关字段）
- `src/components/SettingsPanel.tsx`（人格 UI）
- `methodology/m21-persona-engine.md`

## 必测点

- Prompt 含当前人格 L1，且 PROTECTED 区存在  
- 切换人格后新会话/新轮次 Prompt 反映新模板  
- 相关单测：`prompt-builder`；Eval：`evals/scenarios/b01-persona-tone.ts` 等

## 现状 / 缺口

**现状**：W0 已换 Role Pack（`electron/main/companion/universes/default/roles/lin`）；设置键 `activeRoleId`；旧三模板与 `persona:*` 已删。
**缺口 / 路线**：下一刀 **W1**（会话中禁换角 + MUTABLE 版本）；契约 / 详设 / tech-spec 见 `docs/requirements/companion-*.md`。
