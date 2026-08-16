# M09 后台任务生命周期 — 代码走读

> 理念章：[`m09-task-lifecycle.md`](./m09-task-lifecycle.md)
> 最近核对：2026-08-16
> 事实源：`electron/main/services/task-queue.ts`、`electron/main/agent/runtime.ts`、`electron/main/ipc/tasks.ts`、`electron/main/scheduler/index.ts`、`electron/main/storage/database.ts`

---

## 一、两类“后台任务”不能混成一个系统

当前仓库有两条不同生命周期：

| 类型 | 入口 | 用途 | 持久化 |
|---|---|---|---|
| 对话后置任务 | `services/task-queue.ts` | 标题、画像、向量索引、Persona 反思 | `background_tasks` |
| 用户定时任务 | `scheduler/index.ts` | cron / interval 触发 Headless Prompt | `scheduled_tasks` |

前者追随一次对话并可通过 `task:sync` 恢复 UI 状态；后者由用户创建并由 Scheduler 计算下一次触发时间。两者共享“后台运行”的表象，但不能共用 ID、状态机或恢复逻辑。

## 二、TaskQueue 的当前数据结构

```typescript
interface InternalTask extends BackgroundTaskInfo {
  fn?: () => Promise<void>
  linkSpanId?: string
}

class TaskQueueManager {
  private tasks = new Map<string, InternalTask>()
  private queue: string[] = []
  private running = false
}
```

- `tasks` 是当前进程的运行真相；
- SQLite 是崩溃恢复、状态同步和通知幂等的持久证据；
- `fn` 不能序列化，所以恢复任务先只有描述，必须由 Runtime 重新注册执行函数；
- `linkSpanId` 把后台调用关联回触发它的主对话 Trace。

## 三、入队：UUID、内存先行与非阻塞落盘

```typescript
const id = `task-${randomUUID()}`
this.tasks.set(id, task)
this.queue.push(id)
void dbUpsertTask(this.toInfo(task))
void this.processNext()
```

ID 使用 `node:crypto.randomUUID()`，避免时间戳加短随机串的碰撞窗口。当前设计刻意允许 pending 入队非阻塞落盘：用户回复不应等待后台任务写库；代价是极小的进程崩溃窗口可能丢失刚入队、尚未落盘的 pending 任务。关键状态转移则必须 `await dbUpsertTask`。

## 四、持久化 Schema 与迁移

`electron/main/storage/database.ts` 的 `background_tasks` 当前字段：

```text
id / session_id / type / status / notified
created_at / updated_at / error / checkpoint
```

`checkpoint` 是 M09 断点续接的结构化进度，不是日志正文。数据库迁移由 `meta.schema_version` 顺序执行；旧库通过幂等 `addColumnIfMissing` 增加 checkpoint。

## 五、状态机与重试

```text
pending
  ├─ cancel → cancelled
  └─ execute → running
                 ├─ success → completed → notified
                 └─ failure
                      ├─ retryCount ≤ 3 → pending（1s / 2s / 4s）
                      └─ exhausted → failed → notified
```

关键约束：

1. `running`、`completed`、`failed`、`notified` 都先落盘再广播；
2. 任务串行执行，避免多个画像/标题/反思任务同时改相邻状态；
3. 取消只接受仍处于 pending 的任务；已经 running 的函数目前没有统一 AbortSignal；
4. `notified` 先写为 true，再发 `task:event`，避免重启后重复 Toast。

## 六、崩溃恢复与函数重注册

启动时 `recoverPendingTasks()` 查询：

```sql
WHERE status IN ('pending', 'running')
ORDER BY created_at ASC
```

- 上次崩溃时的 running 会重置为 pending；
- checkpoint 一并恢复；
- 恢复对象暂时没有 `fn`；
- `agent/runtime.ts` 根据 `TaskType` 和会话上下文调用 `reRegisterRecoveredTask()`；
- 无法重建执行函数的任务不会伪装为成功。

这解释了为什么“任务数据已恢复”和“任务已经继续执行”是两件事。

## 七、Renderer 同步

`electron/main/ipc/tasks.ts` 暴露：

```text
task:list(sessionId?)
task:sync(sessionId?)
task:cancel(taskId)
```

实时事件统一使用 `task:event`：

```text
task:started
task:completed
task:failed
```

Renderer 首次挂载或断线重连时先拉 `task:sync`，再监听事件；不能只依赖事件流推断当前状态。

## 八、Scheduler 的独立边界

`scheduler/index.ts` 使用 `randomUUID()` 创建定时任务，校验 name、prompt、cron 和 interval 范围。触发后由 Headless Runtime 执行，并遵守无交互环境的安全策略：只自动批准明确只读工具，拒绝 Shell、子 Agent 和其他副作用工具。

Scheduler 的 timer 是进程内资源；任务定义和 `next_run_at` 才是持久状态。应用退出时 `shutdownScheduler()` 清理 timer。

## 九、可观测性

后台任务执行通过 `runWithTraceContext` 和 `startLinkedAsyncSpan` 继承：

- `sessionId`
- `interactionSpanId`
- caller（title / profile / memory / system）

日志只记录 taskId、类型、状态和错误元数据；用户消息、画像正文和 Prompt 不应作为普通任务日志落盘。

## 十、测试证据

当前相关门禁包括：

- `__tests__/unit/task-queue.test.ts`：UUID、完成、失败重试、耗尽、通知、取消和串行；
- `__tests__/unit/task-queue-persistence.test.ts`：Schema、状态持久化与 notified；
- `__tests__/unit/task-queue.test.ts`：checkpoint 更新、状态转移与恢复路径；
- `__tests__/unit/tasks-ipc.test.ts`：list / sync / cancel 输入边界；
- `__tests__/unit/scheduler.test.ts`：定时任务 CRUD 与调度；
- `__tests__/unit/headless-policy.test.ts`：无交互审批只读边界。

## 十一、当前缺口

- running 任务尚无统一的可持久化取消协议；
- pending 入队采用非阻塞落盘，仍有极小崩溃丢失窗口；
- 重试次数只在内存任务对象中维护，重启后不会延续之前的 retryCount；
- checkpoint 能保存进度，但每个任务类型是否支持真正的步骤级续接仍取决于其执行函数。

这些是明确边界，不应把 v2/v3 历史版本号当作当前能力说明。
