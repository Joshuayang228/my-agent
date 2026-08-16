# M30 叙事连贯与能力边界 — 代码走读

> 理念章：[`m30-narrative-capability.md`](./m30-narrative-capability.md)
> 最近核对：2026-08-16

## 一、专家度

`agent/expertise-level.ts` 结合设置和启发式信号生成解释粒度 hint；它只调讲解密度，不改变工具权限，也不把“专家/新手”当面标签用户。

## 二、关系最小集

`relationship-minset.ts` 在压缩时保护称呼偏好、共同约定和情感锚点；规则抽取有数量/长度上限，不调 LLM、不编造。

## 三、生活上下文

`moment-format.ts`、Orchestrator 和 Prompt Builder 只注入当前事实薄片。Role Pack 默认世界不能覆盖运行状态，Moment 文案不能创造资产。

## 四、能力诚实

System Prompt 明示工具和破坏性确认；模型不知道或工具不可用时应坦诚，不把世界叙事包装成真实外部经历。

## 五、测试证据

`expertise-level.test.ts`、`relationship-minset.test.ts`、`moment-consistency.test.ts`、Prompt 测试。

## 六、当前缺口

更长时间跨度的叙事一致性仍需要跨会话 Persona Eval。
