# 内容完整性管线施工合同 v1

> 状态：已完成施工快照（冻结）
> 生命周期：已完成施工快照（冻结）。稳定事实已回流模块卡、Architecture、Quality、Progress 和 Changelog。

## 1. 需求背景

人物世界的事件、朋友圈、日记、信物、生活资产和长期记忆已经分别具备来源字段、事件关联、幂等键或 grounding，但这些约束分散在不同模块。模型生成内容、生活引擎事实和用户输入缺少统一的内容证据协议，Debug 也不能用同一套规则判断内容是否有来源、是否跨角色或是否可以进入长期记忆。

## 2. 目标

- 每条可持久化内容都能追溯到人物、来源类型、来源 ID、发生时间、事件或调用链。
- 模型输出先成为候选内容，经过 Domain / Application 校验后才能写入事实表、事件、Memory 或 Outbox。
- 跨角色、无来源、时间无效、重复事件和不符合 Domain 规则的内容被拒绝。
- Prompt 只消费经过筛选的结构化事实，并能在 Debug 中查看来源证据。
- 内容连续性和来源完整性进入 Unit、Eval、Electron 和 Debug 质量门禁。

## 3. 内容事实分层

- Persona / Role Pack 保存稳定身份、价值观、表达基线和已确认人物资料。
- Companion Runtime 保存当前心情、精力、关系、地点、活动和生活事件。
- Memory 保存用户画像、长期偏好和被确认的共同经历。
- Companion Domain 保存朋友圈、日记、信物、衣柜、文化、家居和足迹。
- Prompt 和 UI 只读取经过来源标记和长度限制的 Read Model，不反向创造事实。

## 4. 来源协议

共享 `ContentProvenance` 至少包含 `origin`、`sourceType`、`sourceId`、`eventId`、`traceId`、`occurredAt` 和可选 `confidence`。`origin` 只能是 `user`、`agent`、`system`、`role-pack` 或 `derived`。

领域事件必须具备人物归属、事件类型、来源类型、关联 ID、幂等键、发生时间和 schema version。日记、朋友圈和生活资产继续保留各自现有字段，统一事件来源和事件证据，不复制一套平行数据库。

## 5. 写入边界

模型生成器只返回候选内容。Application Service 负责结构化解析、人物归属、来源、时间、长度、重复和 Domain 不变量校验。通过后才进入 Domain Fact、Domain Event、Execution Ledger 和 Outbox。

用户输入和人物自主生成使用不同 `origin`。人物自主生成不能伪装成用户确认，用户未确认的模型推断不能直接写入稳定 Persona 或长期 Memory。

## 6. 连续性不变量

- 内容只能写入当前 Agent / role 作用域。
- 事件和内容的幂等键重复时复用原结果，不能创建第二份事实。
- 已删除或取消的事实不能重新投影成新的公开内容。
- 日记、朋友圈和关系变化必须能回到来源事件或明确触发原因。
- Memory 不能覆盖 Persona 稳定身份，Runtime 状态不能伪装成长期事实。
- 时间、地点、参与者和关系变化不满足 Domain 组合规则时拒绝整笔写入。

## 7. Prompt 与 Debug

Prompt 组装顺序固定为稳定人格、当前状态、相关长期记忆、当前事件、用户输入和输出协议。每层动态内容都必须有来源、作用域和长度上限。

Debug 展示最终内容时，同时展示来源类型、来源 ID、关联事件、生成者、发生时间、校验状态和投递状态。缺少历史实发证据时，不得把静态资料或 Prompt 候选写成已发生事实。

## 8. 实施步骤

### P0 来源和事实校验

1. 新增共享 Content Provenance 与内容事件校验器。
2. 接入 Companion Domain Event、事件通知、日记和生活资产来源链。
3. 增加来源缺失、跨角色、重复、时间无效和非法载荷测试。

### P1 连续性与 Prompt 证据

1. 盘点朋友圈、日记、信物、关系、生活资产和 Memory 的来源字段。
2. 统一 Prompt 动态内容来源和作用域证据。
3. Debug 展示内容来源和事实关联，区分候选、已提交和已投递。

### P2 内容 Eval

1. 增加人物身份稳定、事件连续、关系有依据、未知事实拒绝和跨角色隔离场景。
2. 将来源完整性和连续性加入 Companion Unit、Eval 和 Electron 验收。
3. 记录失败原因和证据，不用静态样本文案代替真实事实。

## 9. 非目标

- 不把所有自然语言内容改成僵硬模板。
- 不让模型直接写数据库或绕过 Application / Domain 校验。
- 不把用户运行数据、Prompt 候选或工具原始输出登记为静态生产资产。
- 不在本合同中重做 Memory 检索算法或迁移 SQLite 存储引擎。

## 10. 验收门禁

- Content Provenance 和领域事件校验单测通过。
- 日记、朋友圈、生活资产和 Outbox 内容均能追溯来源。
- 跨角色、重复调用、无来源内容和非法时间被拒绝。
- Prompt 动态上下文保持来源和作用域边界。
- Debug 能区分候选、已提交和已投递证据。
- 全量 Unit、Eval、类型检查、构建、Electron E2E、资产和文档门禁通过。

## 11. 完工记录

共享 `ContentProvenance`、领域事件完整性校验、事件通知来源证据、日记来源持久化和 Debug provenance 展示已落地。既有 Companion Domain 校验继续负责旅行、穿搭、文化、关系和资产组合不变量。来源缺失、跨角色、重复、非法时间和非法载荷测试通过，内容来源证据进入正式 Debug Read Model。模型质量和真实供应商效果仍由现有 Persona / Companion Eval 与用户允许的真实模型评估负责，不用静态样本文案冒充真实模型质量。
