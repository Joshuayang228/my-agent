# M32 Debug 与 Playground — 代码走读

> 理念章：[`m32-experience-debug-playground.md`](./m32-experience-debug-playground.md)
> 最近核对：2026-08-16

## 一、Debug 是生产真相

`ipc/debug.ts` 聚合真实 Prompt、资产、工具、系统配置、Trace、LLM 摘要、Eval 报告和世界快照。`DevPanel.tsx` 只读展示来源、版本、fingerprint、调用链和脱敏运行证据。

## 二、生产资产目录

`debug/model-context-assets.ts` 聚合 Prompt、Skill、Tool、Role Pack、Memory Strategy、Permission/Sandbox、Eval、Provider 与 MCP 注册表。目录不复制用户记忆、当前世界正文、API Key 或工具参数。

## 三、Playground 是隔离实验

`src/components/playground/` 提供设计系统故事格、组件/页面基线、Prompt 草稿、模型烟测和工具手测。草稿不写真实会话或设置；真实工具手测必须走 Registry、动态 metadata、权限与显式 confirmRisk。

## 四、Eval

Debug Eval Runner 只允许 mock/skill/persona-real 白名单；真实 Persona 需二次确认和 Key。报告只读，人工审阅单独存储。

## 五、边界

Debug 回答“系统实际是什么”；Playground 回答“如果这样会怎样”。Playground 不复制生产 Prompt 正文作为目录真相，也不把实验结果自动回流正式 IA。

## 六、测试证据

`debug-*.test.ts`、`playground*.test.ts`、`model-context-assets.test.ts`、`debug-tool-run.test.ts`、UI E2E。

## 七、当前缺口

更完整的视觉故事格和真实对话 E2E 仍可扩展，但不能破坏 Debug/Playground 边界。
