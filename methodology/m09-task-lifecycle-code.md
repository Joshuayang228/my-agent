# M09 任务生命周期代码走读

> 对应 `m11-task-lifecycle.md` 认知框架。记录 v2 SQLite 持久化实现的关键代码路径和设计决策。

---

## 一、架构全貌

**核心模块**：
- `electron/main/storage/database.ts`（DDL：background_tasks 表）
- `electron/main/services/task-queue.ts`（TaskQueueManager：内存队列 + SQLite 双层）
- `electron/main/services/runtime.ts`（启动恢复 + 函数注册）
- `electron/main/ipc/agent.ts`（send 流程写入 pending 任务）

**数据流**：
```
用户发消息 → agent.ts:send
           → TaskQueueManager.enqueue(type, fn)
           → 写 background_tasks (status=pending)
           → 内存队列 push
           → 执行 fn()
           → 完成后更新 status=completed, notified=1
           → 发 agent:background-task-completed 事件

应用重启 → runtime.ts:init
         → TaskQueueManager.recoverPendingTasks()
         → 读 background_tasks WHERE status IN (pending, running)
         → 重置 running → pending
         → 重新注册函数（通过 taskTypeToFunction map）
         → 恢复任务进入内存队列
```

---

## 二、DDL Schema

文件：`electron/main/storage/database.ts`

```typescript
CREATE TABLE background_tasks (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  type        TEXT NOT NULL,          -- 'profile-extraction' | 'title-generation' | 'vector-indexing'
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  notified    INTEGER NOT NULL DEFAULT 0,       -- 0=未通知, 1=已通知（幂等）
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  error       TEXT                     -- 失败原因
)
```

**设计要点**：
- `id` 用 uuid，全局唯一防重复。
- `type` 是任务类型枚举，用于恢复时查找对应函数。
- `notified` 标志防止重复通知（断线重连或轮询场景下可能多次读取同一任务）。
- `status` 五态：pending（待执行）、running（执行中）、completed（成功）、failed（失败）、cancelled（用户取消）。
- `error` 只在 failed 时有值，记录失败原因。

---

## 三、TaskQueueManager 实现

文件：`electron/main/services/task-queue.ts`

### 3.1 内部结构

```typescript
class TaskQueueManager {
  private queue: Array<{ id: string; fn?: () => Promise<void> }> = []
  private running = false
  private db: Database

  constructor(db: Database) {
    this.db = db
  }
}
```

**关键设计**：队列元素只存 `{id, fn?}`，不存完整任务信息（type/sessionId/status 都在 SQLite）。`fn` 可选是为了支持恢复任务——恢复时先从 DB 读 id，再通过 type 查找函数重新注册。

### 3.2 入队流程

```typescript
async enqueue(
  sessionId: string,
  type: BackgroundTaskType,
  fn: () => Promise<void>
): Promise<string> {
  const id = uuidv4()
  const now = Date.now()

  // 1. 写入 SQLite（status=pending, notified=0）
  this.db
    .prepare(
      `INSERT INTO background_tasks
         (id, session_id, type, status, notified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, sessionId, type, 'pending', 0, now, now)

  // 2. 进入内存队列
  this.queue.push({ id, fn })
  this.processQueue() // 不阻塞

  return id
}
```

**关键点**：先落盘，后入队。保证崩溃时任务不丢（崩溃前已写 SQLite，下次启动恢复）。

### 3.3 执行循环

```typescript
private async processQueue() {
  if (this.running) return
  this.running = true

  while (this.queue.length > 0) {
    const item = this.queue.shift()!

    // 1. 更新 status=running
    this.db
      .prepare('UPDATE background_tasks SET status=?, updated_at=? WHERE id=?')
      .run('running', Date.now(), item.id)

    try {
      // 2. 执行任务（可能是新任务的 fn，也可能是恢复任务重新注册的 fn）
      if (item.fn) {
        await item.fn()
      } else {
        logger.warn(`Task ${item.id} has no function (recovery may have failed)`)
      }

      // 3. 成功：status=completed, notified=1
      this.db
        .prepare('UPDATE background_tasks SET status=?, notified=?, updated_at=? WHERE id=?')
        .run('completed', 1, Date.now(), item.id)

      // 4. 发送通知事件
      const row = this.db
        .prepare('SELECT session_id, type FROM background_tasks WHERE id=?')
        .get(item.id) as { session_id: string; type: string }

      mainWindow?.webContents.send('agent:background-task-completed', {
        taskId: item.id,
        sessionId: row.session_id,
        type: row.type,
      })
    } catch (err) {
      // 失败：status=failed, error=..., notified=1
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.db
        .prepare(
          'UPDATE background_tasks SET status=?, error=?, notified=?, updated_at=? WHERE id=?'
        )
        .run('failed', errorMsg, 1, Date.now(), item.id)

      logger.error(`Background task ${item.id} failed:`, err)
    }
  }

  this.running = false
}
```

**关键点**：
- 每次循环：pending → running → completed/failed。
- `notified=1` 在成功或失败时都立即置位，防止后续重复通知。
- 发事件用 `webContents.send`，前端通过 `ipcRenderer.on` 监听。

---

## 四、崩溃恢复

文件：`electron/main/services/runtime.ts`

### 4.1 启动时恢复

```typescript
export async function init() {
  const db = getDatabase()
  const taskQueue = new TaskQueueManager(db)

  // 注册任务类型 → 函数映射
  const taskTypeToFunction = new Map<
    BackgroundTaskType,
    (sessionId: string) => Promise<void>
  >([
    ['profile-extraction', async (sessionId) => {
      await maybeExtractProfile(getDatabase(), sessionId)
    }],
    ['title-generation', async (sessionId) => {
      await maybeSuggestTitle(getDatabase(), sessionId)
    }],
    ['vector-indexing', async (sessionId) => {
      await maybeIndexMessages(getDatabase(), sessionId)
    }],
  ])

  // 恢复 pending/running 任务
  await taskQueue.recoverPendingTasks(taskTypeToFunction)

  // ...
}
```

**关键点**：`taskTypeToFunction` 是恢复机制的核心。恢复任务时：
1. 从 DB 读 type
2. 查 map 找到对应函数
3. 重新注册到队列

如果 type 不在 map 里（代码删除了某类任务），恢复失败但不崩溃，只记 warn 日志。

### 4.2 恢复逻辑

文件：`electron/main/services/task-queue.ts`

```typescript
async recoverPendingTasks(
  taskTypeToFunction: Map<BackgroundTaskType, (sessionId: string) => Promise<void>>
): Promise<void> {
  // 1. 查询未完成任务
  const rows = this.db
    .prepare('SELECT * FROM background_tasks WHERE status IN (?, ?)')
    .all('pending', 'running') as Array<{
    id: string
    session_id: string
    type: BackgroundTaskType
    status: string
  }>

  if (rows.length === 0) return

  logger.info(`Recovering ${rows.length} pending/running background tasks`)

  // 2. 重置 running → pending（崩溃时可能停在 running）
  this.db
    .prepare('UPDATE background_tasks SET status=? WHERE status=?')
    .run('pending', 'running')

  // 3. 重新注册函数并入队
  for (const row of rows) {
    const fn = taskTypeToFunction.get(row.type)
    if (!fn) {
      logger.warn(`Cannot recover task ${row.id}: type ${row.type} not registered`)
      continue
    }

    // 包装函数（捕获 sessionId）
    const wrappedFn = async () => {
      await fn(row.session_id)
    }

    this.queue.push({ id: row.id, fn: wrappedFn })
  }

  // 4. 启动执行
  this.processQueue()
}
```

**关键点**：
- `running` 状态重置为 `pending`——崩溃时任务可能停在 running，恢复后重新执行（幂等性由业务函数保证，如 profile 提取有节流）。
- `fn` 通过 map 查找重新注册，不是从 DB 读（DB 无法序列化函数）。
- 恢复任务和新任务共用同一个 `processQueue()` 循环。

---

## 五、与其他模块的集成

### 5.1 agent.ts 调用入口

文件：`electron/main/ipc/agent.ts`

```typescript
async function send(sessionId: string, userMessage: string) {
  // ... 主对话循环 ...

  // 后台任务入队（非阻塞）
  if (needsProfileExtraction) {
    await runtime.enqueueBackgroundTask(
      sessionId,
      'profile-extraction',
      async () => maybeExtractProfile(db, sessionId)
    )
  }

  if (needsTitleGeneration) {
    await runtime.enqueueBackgroundTask(
      sessionId,
      'title-generation',
      async () => maybeSuggestTitle(db, sessionId)
    )
  }

  // 继续主流程
}
```

**关键点**：`enqueueBackgroundTask` 是 `runtime.ts` 暴露的封装，内部调用 `TaskQueueManager.enqueue()`。主流程不等待后台任务，立即返回。

### 5.2 前端监听事件

文件：`src/App.tsx`（或类似入口）

```typescript
useEffect(() => {
  const handleTaskCompleted = (event: any, payload: {
    taskId: string
    sessionId: string
    type: string
  }) => {
    console.log(`Task ${payload.type} completed for session ${payload.sessionId}`)
    // 可触发 UI 更新（如刷新记忆列表、刷新标题）
  }

  window.electron.ipcRenderer.on('agent:background-task-completed', handleTaskCompleted)

  return () => {
    window.electron.ipcRenderer.off('agent:background-task-completed', handleTaskCompleted)
  }
}, [])
```

**关键点**：前端通过 IPC 事件感知任务完成，可触发 UI 局部刷新（如侧边栏标题更新）。

---

## 六、测试覆盖

文件：`__tests__/unit/task-queue-persistence.test.ts`

**测试场景**（7 个）：
1. 入队后写入 SQLite
2. 完成后更新 status + notified
3. 恢复 pending/running 任务
4. 不恢复 completed/failed 任务
5. notified 幂等标志防重复通知
6. 任务取消
7. 失败时记录 error

**测试策略**：直接操作 sql.js 内存数据库，不启动完整 Electron 环境。验证 SQL 逻辑正确性，不测 IPC 和 UI 集成（E2E 测试另做）。

---

## 七、已知限制（v3 后）

已在 v3 补齐：指数退避重试（`MAX_RETRIES=3`）、侧边栏「更新中」pill、完成/失败 Toast。

仍开着：

1. **无 token 分离**：后台任务的 LLM 调用 token 混入主会话统计（`caller` 字段已埋点，但 token 归因未分离）。
2. **无长任务断点续接**：任务必须一次执行完，中途崩溃会从头重做（幂等性由业务函数自行保证）。
3. **无断线重连同步**：渲染进程重挂后靠事件流，缺主动拉取对齐。
4. **无 linked span**：后台任务没有独立 span，影响 trace 耗时准确性（交可观测性 / 原 M14）。

---

## 八、下一步扩展方向

按 `m09-task-lifecycle.md` § 九 优先级判断：

1. **前后台 token 分离**（影响 token 预算准确性）
2. **断线重连后任务状态同步**
3. **长任务断点续接**（等真实需求出现时再设计）
4. **linked span**（与可观测性一起做）

v2/v3 已完成持久化、恢复、重试与基础可见性；后续在此基础上增量添加。
