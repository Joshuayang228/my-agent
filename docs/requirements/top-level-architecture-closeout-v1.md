# 顶层架构收口施工合同 v1

> 状态：进行中
> 生命周期：进行中，指导 Agent Loop 到 Domain 的顶层边界收口。

## 1. 审计结论

当前模块化单体和 Agent Host 方向合理，但顶层架构仍有三类迁移态边界。

- Agent Runtime 仍直接依赖部分 Companion 业务组装器，通用执行器和产品应用编排没有完全分离。
- Agent Host Capability 已声明 `requiredPermissions`，Application Orchestrator 和固定 Workflow 尚未使用同一权限判定契约。
- Companion Core 与旧生活表并行存在，部分读模型和投影仍直接读取旧表，核心事实源尚未完全唯一化。

## 2. 目标

- Agent Loop 只负责 Think / Act / Observe、取消、压缩、工具执行和流式事件。
- Agent Runtime 只负责会话生命周期和通用上下文编排，产品语义由 Application Service / Domain 提供。
- Capability 的固定入口和 Tool 入口共享 Manifest、Permission、Execution Context 和失败语义。
- Companion Core 成为生活事实的唯一写入与事件来源，旧表只作为明确登记的投影或历史读取面。
- Prompt Context、Memory、Companion 和 Workspace 通过统一 Application Context 进入模型请求。

## 3. P0 实施范围

1. 为 Agent Host 增加 Capability Permission Gate，固定 Workflow、Tool Adapter 和 Headless 入口统一执行。
2. 把 Runtime 中剩余的 Companion 关系、生活上下文和生命周期调用收进 Conversation Application Service / Host Context Provider。
3. 盘点 Companion 旧表直接读取和写入，禁止新增旁路写入，优先将主会话、Debug 和 Prompt 读取切到 Core Read Model。

P0-1 已完成：Manifest 现在声明 `grantedPermissions`，Application Orchestrator 和 Capability → Tool Adapter 都会在执行前校验 Capability 的 `requiredPermissions`。Tool Runtime 的沙箱和用户确认继续作为更下层的安全门禁。

P0-2 进入迁移态收口：Runtime 组装器和 Debug 世界快照的旧生活表读取已经集中到 `core/read-models/legacy-companion-read-model.ts`。该适配层只读、不建事实、不写旧表，后续 Core Read Model 替换不再扩散到上层调用方。

P0-3 已完成：Runtime 的角色组装输入通过 `ConversationApplicationService.loadConversationAssemblyInput` 进入 Application 边界，Runtime 保留会话生命周期和 Loop 编排，不再直接 import 伙伴组装器。

P0-2 继续收口：Core Runtime State 现在承载 `pausedAt`、`catchupSummary` 和 `lastTickAt` 三个生命周期字段；pause、resume、catch-up 和生活 tick 会同步更新核心快照，Debug 与主会话组装优先读取核心状态。旧 `role_state` 仅保留迁移期镜像，尚未删除。

P0-2 只读路径继续收口：通讯录、卡司可用性、生活信号、穿搭、旅行推进、日程时间线、反思、事件切片、生活时钟和世界体征刷新等读取者统一通过 `legacy-companion-read-model` 进入旧表；写入路径仍由 Life Domain 自己持有，避免把迁移读适配器误当成事实写入口。

P0-1 事务边界继续收口：用户赠礼的业务事实、主会话 Outbox、Core Domain Event、体征更新和通知 Outbox 现在在同一 `withCompanionUnitOfWork` 本地事务中提交；窗口和会话投递都延迟到提交后，避免外部副作用进入事务。

## 4. P1 实施范围

1. 建立统一 Application Context，包含 Agent、Session、Permission、Prompt Context Evidence 和 Domain Read Model。
2. 统一固定 Workflow、Scheduler、IPC、LLM Tool 和 Headless 的 trace、幂等和失败恢复字段。
3. 建立 Core Event 到旧读模型的投影清单，完成可删除旁路的识别和测试。
4. 收口剩余混合写入路径：朋友圈自动互动的用户首条评论、文化心愿完成、朋友圈投影、重编排和互动反馈等流程仍需把旧表事实、Core Event、Runtime State、Execution Ledger 与 Outbox 按动作拆成完整本地事务；外部模型调用必须留在事务外。专属信物和自动回复落库已完成这一收口。

## 5. 非目标

- 不重写 Agent Loop 算法。
- 不拆微服务，不引入远程 Domain 插件。
- 不在本合同中迁移 sql.js 到原生 SQLite。
- 不改变现有产品 UI 语义和 Tool key。

## 6. 验收

- Capability Permission Gate 覆盖固定 Workflow、Tool Adapter、Headless 和 Scheduler。
- Runtime 不再直接承担新增 Companion 业务策略。
- Companion Core 旁路写入为零，旧读路径有登记、有投影依据、有隔离测试。
- Agent Loop、Runtime、Application、Host、Domain 和 Infrastructure 依赖方向通过静态审计。
- 全量 Unit、类型检查、构建、Electron E2E、资产和文档门禁通过。
