# 人物世界核心引擎重构施工合同 v1

> 状态：进行中
> 生命周期：进行中，指导人物运行态、领域事件、投影、执行账本和通知 Outbox 的核心重构。

## 1. 需求背景

当前人物世界已经具备生活状态、日剧本、朋友圈、日记、信物、文化心愿、旅行、主动行为和关系变化，但这些能力仍由多个服务分别负责状态更新、持久化、主会话写入和 Renderer 广播。

这会产生四类结构性问题：

- 同一人物状态由不同入口分别修改，无法保证更新顺序和来源一致。
- 朋友圈、日记、信物、主会话和 Prompt 可能来自不同事实来源。
- 失败时只能做局部回滚，无法查询一次行为完整执行到哪一步。
- 新增生活能力需要复制角色校验、冷却、通知、重试和存储逻辑。

本合同把人物世界重构为一个模块化单体内的领域核心。Chat、LifeTicker、IPC、Debug 和 UI 都通过核心命令进入，人物世界状态和领域事件成为唯一事实源，各生活面成为可重放、可重试的投影。

## 2. 功能目标

- 建立统一的 `CompanionRuntimeState`，集中保存人物当前状态快照。
- 建立统一的领域命令入口，处理 activeRole、输入、幂等和版本校验。
- 建立统一领域事件模型，记录来源、因果链、人物和时间。
- 建立幂等投影机制，驱动朋友圈、日记、信物、关系、主会话和 Prompt Read Model。
- 建立统一执行账本，记录命令、事件、投影和通知的状态、重试次数与失败原因。
- 建立通知 Outbox，业务提交成功后再向 Renderer、Toast 和主会话投递。
- 迁移现有生活模块，移除直接从 IPC、ticker 或业务服务写多个事实表的路径。
- 在开发阶段允许破坏性 schema 和接口调整，不保留旧 IPC 兼容层。

## 3. 核心领域模型

### 3.1 稳定身份

Role Pack 负责稳定身份、背景、口吻、世界观和受保护人格。核心引擎只读取，不直接修改。

### 3.2 当前运行态

`companion_runtime_state` 以 `roleId` 为主键保存当前快照：

- mood
- energy
- socialNeed
- hunger
- sleepiness
- currentActivity
- currentLocation
- situation
- version
- updatedAt
- lastEventId

数字用于规则和 Debug。自然语言摘要由统一 formatter 派生，不能反向写入状态。

### 3.3 情绪与关系账本

- `companion_emotion_events` 保存情绪事件、强度、原因、来源事件和解决时间。
- `companion_relationship_state` 保存当前关系快照。
- `companion_relationship_events` 保存关系变化历史。

状态快照负责快速读取，事件账本负责解释和恢复。

### 3.4 领域事件

所有改变人物世界的事实使用统一事件结构：

```ts
interface CompanionDomainEvent {
  id: string
  roleId: string
  universeId: string
  type: string
  sourceType: string
  sourceId?: string
  causationId?: string
  correlationId: string
  occurredAt: number
  payloadJson: string
  schemaVersion: number
}
```

首批事件包括：

- `life_event_published`
- `moment_published`
- `moment_commented`
- `culture_wish_created`
- `culture_experience_completed`
- `journal_entry_created`
- `keepsake_gifted`
- `gift_received`
- `vulnerability_comforted`
- `travel_stop_reached`
- `wardrobe_changed`
- `relationship_changed`
- `state_changed`

### 3.5 执行账本

`companion_execution_runs` 记录 command、event、projection、notification 的执行状态：

```text
accepted → running → completed
                   ↘ failed → retryable
                   ↘ cancelled
```

每条记录必须带 `roleId`、`commandId`、`eventId`、`actionType`、`attempt`、时间和脱敏错误信息。

### 3.6 通知 Outbox

`companion_outbox` 保存待投递通知。业务事实提交成功后写入 Outbox，由投递器负责：

- BrowserWindow 事件
- Toast
- 主会话增量消息
- 时间轴刷新
- Debug 事件更新

投递失败不回滚领域事实，只进入可重试状态。

## 4. 分层与目录边界

```text
electron/main/companion/core/
├─ commands/       命令类型与校验
├─ handlers/       用例编排
├─ state/          运行态快照与 reducer
├─ events/         领域事件与事件存储
├─ policies/       频率、关系、状态和角色规则
├─ projections/    朋友圈、日记、信物、关系、Prompt 读模型
├─ execution/      执行账本与重试
├─ outbox/         通知出站队列
└─ read-models/    UI、Prompt、Debug 只读视图
```

入口边界：

- IPC、Chat Tool、LifeTicker、Debug 只能提交 Command。
- LLM 只能返回候选内容或候选状态变化，不能直接持久化事实。
- Projection 只能消费事件，不能反向创建新的领域事实。
- UI 只能读取 Read Model 和订阅 Outbox 投影事件。
- Role Pack 只能提供稳定人格和世界观资料，不能保存运行态。

## 5. 标准数据流

```text
Adapter
  → Command Gateway
  → activeRole / schema / idempotency 校验
  → World Core 状态决策
  → Domain Event
  → Runtime State Reducer
  → Projection Runner
  → Execution Ledger
  → Outbox
  → UI / Prompt / Main Session / Debug
```

LLM 参与内容生成时：

```text
Core State
  → Prompt Builder
  → LLM Proposal
  → Schema 校验
  → Domain Policy 校验
  → Event Commit
```

## 6. 实施步骤

### P0 核心基础

1. 新增共享 Command、Domain Event、Execution Run、Outbox 类型。
2. 新增核心表、schema migration 和参数化存储层。
3. 建立 `CompanionRuntimeState` 读写 API 和统一 reducer。
4. 建立 `CommandGateway`，集中处理角色隔离、幂等和版本。
5. 建立执行账本与 Outbox 基础投递器。

### P1 垂直迁移

1. 迁移聊天文化心愿链路。
2. 迁移日剧本 → LifeEvent → Moment 投影链路。
3. 迁移朋友圈评论和人物回复。
4. 迁移赠礼、信物、脆弱安慰与关系变化。
5. 迁移日记、旅行、衣柜和主动消息。

### P2 入口收口

1. IPC 改为纯 Command Adapter。
2. Chat Tool 改为 Command Adapter。
3. LifeTicker 改为调度 Command。
4. 业务模块删除直接多表写入和直接 BrowserWindow 广播。
5. UI、Prompt、Debug 改读统一 Read Model。

### P3 验收与收工

1. 补正常、重复、失败、重试、并发、重启、切角和跨角色测试。
2. 补聊天到生活、生活到朋友圈、朋友圈到主会话的 Electron 旅程测试。
3. 通过类型检查、完整测试、构建、资产审计和文档门禁。
4. 将稳定边界回流 `docs/modules/companion.md`、`docs/architecture.md` 和 `docs/quality.md`。

## 7. 关键不变量

- 一个领域事实只能由一个 Domain Event 表示。
- 所有写入都必须带 `roleId`，并由主进程确认当前人物。
- Event Store 是事实来源，状态快照和页面数据都是派生结果。
- Projection 可重复执行，重复执行不能产生重复业务记录。
- Outbox 投递可重试，投递失败不能撤销已经提交的领域事实。
- LLM 输出不能绕过 schema、角色、关系和状态策略。
- UI、Prompt 和 Debug 不能各自维护人物生活事实。
- 人物身份、运行态、情绪事件、关系账本、生活资产和短期动态必须分层保存。

## 8. 质量与风险

### 质量要求

- 每个 Command 至少覆盖正常、拒绝、重复和重试路径。
- 每个 Projection 至少覆盖幂等和部分失败路径。
- 每个 Outbox 消费者至少覆盖投递失败和重启恢复。
- 每个用户旅程至少验证真实 roleId、sourceId、correlationId 和最终 UI 回显。

### 风险与取舍

- 事件和投影会增加数据表与调试复杂度，但能换取统一恢复和追溯能力。
- 开发阶段直接迁移 schema，减少兼容层长期负担。
- SQLite 继续作为本地存储，使用事务、版本号和有界重试支撑一致性。
- 暂不引入外部消息队列、微服务或完整事件溯源框架，先把边界和不变量做实。

## 9. 明确不做

- 不新增人物世界一级 Tab。
- 不把 Playground 或 Debug 当作生产事实来源。
- 不重写 Agent Loop 和最终人物 Prompt 体系。
- 不为每个页面建立独立生活事实表。
- 不让 LLM 直接写数据库或直接广播产品事件。
