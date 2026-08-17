# 2026-08 全量资产注册审计快照

> 日期：2026-08-17
> 类型：dated snapshot，仅用于盘点、复盘和开发者导航；不替代代码注册表、loader、ToolRegistry、模块卡或 Architecture。
> 生成入口：`npm run assets:check`（实时报告位于被忽略的 `var/asset-audit/`）。

## 盘点结论

项目已识别 12 个生产 / 设计资产家族，并为 18 个 `ModelContextAssetType` 建立治理来源。后续新增资产采用“动态自动发现 + 静态显式语义注册 + fail-closed 门禁”，不会再只靠人工记忆登记。

## 家族清单

| 家族 | 当前登记 / 发现方式 | Debug / Playground | 运行证据 | 当前盘点 |
|---|---|---|---|---:|
| Prompt | `electron/main/prompts/registry.ts` 显式注册 | Debug / 提示词管理器 | `llm-input` | 52（含 Eval Judge） |
| 伙伴资产 | Role Pack manifest / loader + `companion/asset-registry.ts` | Debug / 伙伴世界 | LLM / Memory | 59 |
| Memory Strategy | `memory/strategy-registry.ts` | Debug | Memory | 6 |
| Permission / Sandbox | `sandbox/asset-registry.ts` | Debug | Permission | 6 |
| Eval | `evals/scenario-registry.ts` + `evals/asset-registry.ts` | Debug / Eval | LLM | 187 |
| Provider | `provider-asset-registry.ts` + shared presets | Debug / Provider | Route / Policy | 17 |
| SubAgent Role | `agent/subagent-asset-registry.ts` | Debug / 资产目录 | `subagent-role` | 3 |
| Lucide 图标 | `src/shared/icon-registry.ts` | Playground / 设计 / 图标 | 不记录 | 129 |
| UI 组件 | `src/shared/ui-component-registry.ts` | Playground / 设计 / 组件目录 | 不记录 | 32 |
| Theme / Design | `src/shared/design-asset-registry.ts` | Settings / Playground / 正式页面 | 不记录 | 7 主题 + 3 字体比例 |
| 内置 Tool | `ToolRegistry` 自动聚合 | Debug / 工具 | Tool | 23（运行时） |
| Skill / MCP | loader / MCP bridge 自动聚合 | Debug / Skill / MCP | Activation / Tool | 动态 |

## 明确不纳入静态资产

- 用户记忆正文、当前世界态、运行日志、Eval 报告、审批记录、Provider 能力缓存；
- API Key、密码、Cookie、MCP secret、工具参数、命令、路径、隐藏 reasoning；
- Playground 临时故事格和实验草稿（除非未来显式载入为实验副本）。

## 当前缺口与下一阶段

本轮治理基础设施已收口，下一阶段不再继续扩张注册表，而是转向 Playground 设计基线验收、正式 UI 回流和人格 / Persona Eval 的体验调优。剩余的 Prompt Lab 加厚、组件无障碍专项复核、伙伴结构化资产实验草稿等仍保留在 `docs/wishlist.md`，不在本轮伪装成已完成。
