# My Agent 架构可靠性加固施工合同 v1

> 状态：已完成施工快照
> 生命周期：已完成施工快照（冻结），稳定事实已回流 Architecture、模块卡、Quality、Decisions 和边界审计。

## 1. 需求背景

人物世界核心引擎已经完成统一运行态、命令、事件、投影、执行账本和 Outbox 的基础收口。下一阶段需要把平台从“核心链路可用”推进到“中断、重试、重启和边界校验可恢复”。

当前需要加固的风险集中在五处：

- 业务事实、执行账本和 Outbox 可能由不同异步调用分别持久化，缺少明确本地事务边界。
- Outbox 进入 `processing` 后进程崩溃时，缺少租约和启动恢复语义。
- Agent Runtime 继续直接编排 Companion 业务，生命周期与领域能力逐渐耦合。
- 特权 IPC 的 sender / frame 校验分散在少数 handler，缺少统一可信发送方门禁。
- `sql.js` 全量导出式 `persist` 的耗时和数据库增长尚未形成基线。

## 2. 功能目标

- 建立 Companion 本地 Unit of Work，保证领域事实、Runtime State、Execution Ledger 和 Outbox 在一次本地提交中一致。
- 把模型请求、网络调用、窗口通知和主会话投递排除在本地事务之外。
- 为 Outbox 增加 `claimed_at`、`lease_until`、恢复、退避和至少一次投递语义。
- 建立统一 IPC sender 校验器，覆盖主框架、窗口生命周期和请求来源。
- 抽取 `ConversationApplicationService`，让 Agent Runtime 只负责会话生命周期和执行编排。
- 建立 SQLite / `persist` 性能基准、日志指标和可接受阈值，不提前替换存储引擎。
- 完成 Context、Memory、Persona、Permission、Runtime 五条边界审计，并把稳定事实回流模块卡与架构文档。

## 3. 非目标

- 不拆分微服务，不引入分布式消息队列。
- 不把 Companion 改造成可插拔插件。
- 不在本合同中实现完整 Event Sourcing。
- 不提前迁移到原生 SQLite 或 WAL，除非基准结果证明当前实现已经越过阈值。
- 不新增生活模块或扩展 Persona 功能。

## 4. 技术方案

### 4.1 Companion 本地事务

新增 `CompanionUnitOfWork`，只包围本地数据库操作：

```text
Command
  → activeRole / schema / idempotency
  → BEGIN
     ├─ Domain Fact
     ├─ Domain Event
     ├─ Runtime State
     ├─ Execution Ledger
     └─ Outbox
  → COMMIT
  → Projection / Dispatcher
```

模型调用、文件操作、网络请求和 Electron 发送必须在事务之外。投影失败不能回滚已提交事实，只能进入可重试状态。

### 4.2 Outbox 租约与恢复

`companion_outbox` 增加：

- `claimed_at`
- `lease_until`
- `next_attempt_at`
- `max_attempts`

领取使用租约，超过 `lease_until` 的 `processing` 在启动和每轮调度前恢复为 `failed`。投递采用至少一次语义，窗口和主会话消费者必须按稳定消息 ID 幂等。

### 4.3 IPC 可信发送方

新增主进程统一校验器，至少检查：

- sender 未销毁。
- sender frame 存在且等于 mainFrame。
- sender 对应当前应用窗口。
- 需要当前会话 / 当前人物时，载荷归属经过主进程再次确认。

所有特权写入 IPC 通过包装器进入 handler，禁止每个模块复制一套校验。

### 4.4 Conversation Application Service

新增应用层编排边界：

```text
Agent Runtime
  → ConversationApplicationService
     ├─ 主角会话：Persona / Memory / Companion
     ├─ 召唤会话：Cast / Summon Context
     ├─ Workspace：工程上下文
     └─ Headless：后台任务上下文
```

Agent Runtime 保留 Agent Loop、Context、Tool、Permission、取消和流式生命周期。对话完成后的 Companion 结算通过应用服务或生命周期 Hook 进入，不继续向 Runtime 增加产品判断。

### 4.5 存储基准

新增只读基准脚本和结构化日志，覆盖：

- 数据库文件大小。
- `persist` 耗时。
- 单次写入耗时。
- 高频 LifeTicker 下的写入阻塞。
- 启动加载耗时。
- Outbox 批处理耗时。

首批阈值只记录和报警，不自动切换存储实现。

## 5. 实施步骤

### P0 · 一致性与恢复

1. 建立本地事务协调器和测试数据库事务夹具。
2. 把核心命令的事实、运行态、账本和 Outbox 写入迁移到协调器。
3. 增加 Outbox 租约、恢复和退避字段。
4. 增加启动恢复、定时恢复和消费者幂等测试。

### P0 · IPC 安全

1. 新增 sender / frame 校验器。
2. 迁移 Companion、Debug、MCP、Browser、Backup 等特权 handler。
3. 增加跨窗口、子 frame、销毁窗口和角色不一致测试。

### P1 · Runtime 边界

1. 盘点 `agent/runtime.ts` 对 Companion、Memory、Reflection 的直接调用。
2. 新增 ConversationApplicationService。
3. 将对话完成后的业务结算迁移到应用层 Hook。
4. 保留 Agent Runtime 的通用执行能力和现有行为。

### P1 · 存储基准

1. 建立可重复的 sql.js 基准夹具。
2. 记录不同数据量和高频写入下的耗时。
3. 将阈值和观测方式写入质量门禁。

### P2 · 五边界审计

1. Context：上下文装配、压缩和动态生活切片。
2. Memory：长期记忆、画像、伙伴事实和关系事实边界。
3. Persona：稳定身份、Role Pack 和热更新覆盖。
4. Permission：工具权限、确认和沙箱边界。
5. Runtime：生命周期、取消、任务和应用层编排边界。

### P3 · 验收与冻结

1. 通过正常、重复、失败、崩溃恢复、并发、重启和跨角色测试。
2. 通过 Chat、LifeTicker、IPC、MCP、Debug 的 sender 安全测试。
3. 通过全量 Unit、Electron 旅程、类型检查、构建、资产审计和文档门禁。
4. 将稳定事实回流 Architecture、模块卡、Quality 和 Decisions。
5. 将本合同冻结为已完成施工快照。

## 6. 关键不变量

- 本地核心事实要么全部提交，要么全部不提交。
- 外部副作用不进入本地事务。
- Outbox 的 `processing` 不能因为进程崩溃永久停留。
- 所有消费者允许重复调用且不产生重复业务副作用。
- Agent Runtime 不直接拥有 Companion 业务策略。
- 特权 IPC 只接受可信主框架发送方。
- 性能基准先观测，不以未经证据的存储替换解决问题。

## 7. 验收证据

- `npm run test -- --maxWorkers=1`
- `npm run build`
- `npm run docs:validate`
- `npm run assets:check`
- 事务、Outbox 恢复、IPC sender、Runtime 边界和存储基准对应 Unit / Electron 测试。

边界审计证据：[`docs/architecture-boundary-audit.md`](../architecture-boundary-audit.md)。IPC 入口按两类收口：通用 handler 使用 `registerSecureIpcHandler`，MCP、Settings、Terminal、图片读取等已有窗口生命周期门禁的 handler 保留专用校验，并复用同一 `assertTrustedIpcSender` 规则或更严格的业务归属复核。执行账本按 DEC-2026-11-13-01 分为跨外部等待的生命周期元数据和本地事实关联，二者边界已固定。
