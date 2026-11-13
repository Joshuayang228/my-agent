# Agent Host 架构收口施工合同 v2

> 状态：已完成施工快照（冻结）
> 生命周期：已完成施工快照（冻结）。稳定事实已回流模块卡、Architecture、Quality、Progress 和 Changelog。

## 1. 需求背景

Agent Host v1 已完成 Manifest、Domain Registry、Capability Registry、Application Orchestrator、Context Provider、Scoped Tool Catalog 和首批 Domain 接入，但仍有几处迁移态边界没有完全收口。全局 ToolRegistry 仍保存模型可见实现，Skill Registry 只把元数据同步给 Host，部分 Companion 后台入口仍直接调用生活服务，跨入口恢复和多 Agent 隔离的证据也需要补齐。

本合同负责把这些迁移态边界收成稳定的会话执行架构。SQLite 从全量导出实现迁移到原生事务存储属于独立评估，不在本合同中虚构完成。

## 2. 目标

- 每个会话只向 Agent Loop 提供当前 Manifest、Permission、Skill 和 Session 作用域共同计算出的 Scoped Tool Catalog。
- Skill Registry 与 Capability Registry 共享稳定元数据关系，不复制业务实现或 Capability 定义。
- Companion 的 UI、Scheduler、Headless 和 LLM 入口共享 Application / Domain / Event / Outbox 事实链。
- 跨入口重复调用、角色切换、后台恢复和权限拒绝具有可验证的幂等与隔离行为。
- Debug 能展示目录来源、Skill 关系、实际激活和恢复结果。

## 3. 边界定义

### 3.1 Tool Catalog

全局 ToolRegistry 只保存实现索引，不再直接作为模型请求目录。Runtime 为每个 Session 创建不可变 Scoped Tool Catalog，目录输入包括 Agent Manifest、Permission Engine、启用 Skill、Session kind 和当前工具来源。LLM、Headless 和 Skill Eval 都通过 Catalog 获取可见工具。

### 3.2 Skill

Skill 继续拥有操作指南、激活工具和 `allowed_tools` 规则。Capability Registry 只登记 Skill 的 key、版本、来源、启用状态和允许的 Capability / Tool 关系。Skill 不复制 Capability schema，不直接执行 Domain 逻辑。

### 3.3 Companion Application

固定入口由 Application Orchestrator 或 Companion Application Service 编排。Domain Service 负责事实和规则，Command Gateway 负责角色校验、幂等、执行账本和事务，Event / Projection / Outbox 负责跨进程传播。任何入口都不能绕过这一链路直接写业务事实。

### 3.4 Storage

本合同保留 sql.js 的当前存储实现和原子快照边界。数据库性能基准、WAL、原生 SQLite 替换和断电耐久性另立施工合同。

## 4. 技术方案

### 4.1 Session Catalog

新增统一 `createSessionToolCatalog` 入口，所有 Agent Loop、Headless 和 Skill Eval 通过它计算工具目录。目录以 capability key 和 tool source 建立来源索引，拒绝未授权、停用 Skill、跨 Agent 和不满足 Permission 的能力。旧的 Runtime 字符串筛选只保留在 Catalog 内部，不再由调用方维护。

### 4.2 Skill Capability Metadata

Host 保存 Skill Metadata Snapshot，包含 skill key、version、fingerprint、enabled、allowedTools 和 capabilityKeys。Skill Registry 是正文和生命周期事实源，Host 只接受一次同步快照。重复 key、版本漂移和停用状态必须被测试覆盖。

### 4.3 Companion 入口收口

盘点并迁移仍直接调用 Companion Domain Service 的 UI、Scheduler、Headless 和后台入口。迁移后的入口只提交 Application Command 或调用已授权 Workflow。固定入口与自然语言 Tool 必须共享同一个执行实现和幂等键策略。

### 4.4 恢复与隔离

补齐过期任务、Outbox、Workflow 和 Tool 执行的恢复测试。每个恢复动作必须带稳定 trace、execution id 或 idempotency key，重复恢复只能复用已有结果或安全跳过。角色切换和并发调用必须拒绝迟到写入。

## 5. 实施步骤

### P0 目录唯一化

1. 审计所有 Agent Loop、Headless、Skill Eval 和 Debug 的 Tool Catalog 来源。
2. 实现统一 Session Catalog 工厂并迁移调用方。
3. 增加未授权、停用 Skill、跨 Agent 和 Permission 拒绝测试。

### P1 Skill 元数据收口

1. 建立 Host Skill Metadata Snapshot 类型和同步入口。
2. 将 allowed tools 与 Capability key 关系写入 Debug 证据。
3. 增加重复 key、版本指纹和停用状态测试。

### P2 Companion 入口收口

1. 盘点直接写入或直接调用 Companion 服务的入口。
2. 迁移 UI、Scheduler、Headless 和后台入口到 Application / Workflow。
3. 增加固定入口与 LLM Tool 共用事实链的行为测试。

### P3 恢复验收与收工

1. 验证重复调用、角色切换、后台恢复、权限拒绝和 Outbox 重投。
2. 更新模块卡、Architecture、Quality、Progress、Changelog 和 Decisions。
3. 运行自审、全量测试、类型检查、构建、Electron E2E、资产与文档门禁。
4. 通过全部门禁后冻结本合同。

## 6. 非目标

- 不在本合同中迁移 sql.js 到原生 SQLite 或引入 WAL。
- 不拆分微服务，不引入远程插件执行。
- 不复制 Skill 正文、Prompt 正文或 Domain 业务规则。
- 不为了目录统一改变已有 Tool key、IPC 载荷或用户可见产品语义。

## 7. 验收门禁

- 全量 Unit、类型检查和生产构建通过。
- `luffy-chat-tools` 及相关 Companion Electron E2E 通过。
- Session Catalog 来源唯一，所有模型请求均经过 Catalog。
- Skill Metadata Snapshot、停用和版本漂移测试通过。
- UI、Scheduler、Headless、LLM Tool 共用 Application / Domain / Event / Outbox 事实链。
- 重复调用、角色切换、后台恢复、权限拒绝和 Outbox 重投测试通过。
- `npm run assets:check` 和 `npm run docs:validate` 通过。

## 8. 风险与权衡

- 目录唯一化会暴露历史入口遗漏，迁移期间先保留实现索引，再禁止调用方自行筛选。
- Skill 与 Capability 关系可能出现版本漂移，使用 fingerprint 和同步快照拒绝静默覆盖。
- 后台入口迁移可能改变触发时序，保留原有冷却、幂等键和失败回退语义。
- SQLite 性能和断电耐久性仍是独立风险，必须另立合同和基准，不在本批次宣称解决。

## 9. 完工记录

Session Catalog 已成为 Agent Loop 的统一会话工具目录入口，Skill 元数据快照已接入启停、版本、指纹和 Capability 关系，Companion 写入口已完成 Command Gateway 盘点，LifeTicker、Chat 完成结算和 Host Workflow 共用 Application / Domain / Event / Outbox 链路。重复调用、角色隔离、后台恢复和 Outbox 重投沿既有可靠性门禁与本批次回归通过。SQLite 原生迁移仍由可靠性合同中的性能基准边界管理，不属于本合同交付范围。
