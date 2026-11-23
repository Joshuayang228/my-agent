# My Agent 通用 Agent Harness 修复施工合同 v1

> 状态：进行中
> 范围：通用 Agent Loop、LLM、Tool、Context、Session、Retry、Trace 和恢复链路。不包含人物世界业务和前端界面。

## 1. 需求背景

2026-11-23 的 Harness 审计确认，当前模块方向正确，但长任务和流式失败仍有四类系统性风险：工具异常可能破坏整批 tool result，流式重试可能重复展示半截输出，上下文预算没有覆盖完整请求，主对话没有 durable turn checkpoint。模型能力目录、会话级权限状态、并发 QueryContext、持久重试和工具结果修剪也需要统一收口。

## 2. 功能目标

- 每个已接受的工具调用都产生且只产生一个可恢复的结构化结果。
- 流式重试、failover 和取消不会重复发布或伪装提交半截模型输出。
- Context budget 统一覆盖 system、messages、tool schema、附件、Provider overhead 和 output reserve。
- 主对话具备 turn / step / attempt / tool / retry 的 durable lifecycle，可在重启后区分可恢复和需核实状态。
- 模型能力、输出预算和 Provider 完成状态统一表达。
- 权限降级、Query source、取消和 retry 状态按 session / run 作用域隔离。

## 3. 技术方案

```text
Conversation Run
  → Durable Turn
     → Step / Attempt
        → Model Request / Response Segment
        → Tool Call / Permission / Tool Result
        → Commit Boundary
  → Final Assistant Message / Terminal Reason
```

### 3.1 Tool Runtime

ToolRegistry 将单工具异常、超时、取消统一转换为 ToolResult。批次执行保持调用顺序和 callId 配对。Loop、Runtime、Session Store 和 Context Manager 只消费结构化结果，不通过异常推断工具状态。

### 3.2 Stream 与 Retry

每次 Provider attempt 拥有独立 response segment。只有完整终态的 segment 才能提交为 assistant 或 tool call。已发布的过程事件与最终消息分离。异常 EOF、abort、length、refusal、tool incomplete 和 Provider error 统一进入完成状态分类。

### 3.3 Request Token Meter 与 Model Capability

新增统一请求计量器，输入包括 system、消息、工具 schema、Skill、附件、Provider overhead 和输出预留。模型能力由 Provider model descriptor 提供，显式请求预算覆盖 descriptor，未知能力不伪造厂商规格。

### 3.4 Durable Turn

新增 Turn Ledger / Session 事件，记录 runId、turnId、step、attempt、request hash、model、状态、tool call、retry、取消原因和终态。外部模型调用不进入 SQLite 本地事务，但调用前后必须记录可恢复状态。外部写操作在结果不确定时进入核实态。

### 3.5 Scope Isolation

execution mode、query source、retry state、cancellation 和 active tool catalog 绑定 session / run。全局 Settings 只提供默认值，不接收单会话运行期降级结果。

### 3.6 History Pressure

在压缩前增加独立 tool-result-pruner，按当前预算和历史年龄处理大型工具结果。tool call pairing validator 按局部消息序列验证，不使用跨历史全局 ID 集合替代顺序关系。

## 4. 实施步骤

### P0

1. ToolRegistry 单工具异常隔离和 exactly-once tool result。
2. Provider stream completion state 与 attempt segment。
3. Request Token Meter 接入 Loop 和 Provider 请求构造。
4. Durable Turn Ledger 最小状态机和重启恢复边界。

### P1

1. Model capability descriptor 和 provider model catalog。
2. Session-scoped execution mode 与 AsyncLocalStorage QueryContext。
3. Durable retry lifecycle 和 failover process event。
4. Tool-result-pruner 与局部 pairing validator。
5. 主会话、子 Agent、后台任务统一 run ownership。

### P2

1. Provider failure taxonomy、Trace single-terminal-state 门禁和 response item 统一协议。
2. Compaction checkpoint replay 与跨 Provider conformance suite。

## 5. 关键不变量

- 已接受的 tool call 恰好对应一个 tool result。
- 未完成的模型输出不得伪装成最终 assistant 消息。
- 重试不得重复发布已提交的用户可见输出。
- 请求预算必须覆盖完整模型输入结构。
- 单会话权限、取消、retry 和 query source 不得污染其他会话。
- 外部副作用结果不确定时不得自动重放写操作。
- 所有 durable 状态都有明确终态或可恢复状态。

## 6. 验收

- 工具异常、超时、取消、并发批次和迟到结果测试。
- Provider 断流位置覆盖正文、thinking、tool delta、EOF 和 retry-after。
- 上下文计量覆盖工具 schema、附件、压缩、413 和大工具结果。
- 重启恢复覆盖 turn、retry、权限等待、工具执行中断和外部写入核实态。
- 多会话并发覆盖 execution mode、query source、取消和子 Agent 隔离。
- 按顺序通过单元测试、类型检查、生产构建、架构门禁、资产门禁、文档门禁和 Electron 回归。

## 7. 非目标

- 不拆分微服务，不引入分布式消息队列。
- 不修改人物世界领域模型，不新增人物世界产品功能。
- 不在本合同内更换 SQLite 实现，除非新的基准合同单独批准。
- 不通过增加默认输出数字掩盖模型能力目录缺失。
