# M16 并发与数据架构 — 代码走读

> 对照 [`m16-concurrency-data-architecture.md`](m16-concurrency-data-architecture.md)。
> 展示：工具分批并发、persist coalesce + 原子写、schema 迁移、任务关键转移 await 落盘。

---

## §三 工具分批 — isConcurrencySafe

### CC 的实现

```typescript
// _reference/.../claude-code-sourcemap-main/.../src/Tool.ts（概念摘录）

// ① 可以是按 input 计算的函数，默认 () => false
isConcurrencySafe(input: z.infer<Input>): boolean {
  return false
}
```

```typescript
// StreamingToolExecutor / toolOrchestration：safe 并行，unsafe 独占；结果按序归并
```

### 我们的实现

```typescript
// electron/main/tools/registry.ts

/**
 * ① 连续 safe 合批 Promise.all；遇到 unsafe 先 flush 再串行
 * ② 默认 false（工具不存在或未声明 → 不并发）
 */
async executeAll(calls: ToolCall[], toolContext?: ToolContext): Promise<ToolResult[]> {
  const results: ToolResult[] = []
  let safeBatch: ToolCall[] = []

  const flushBatch = async () => {
    if (safeBatch.length === 0) return
    const batch = safeBatch
    safeBatch = []
    const batchResults = await Promise.all(
      batch.map((call) => this.executeSingle(call, toolContext)),
    )
    results.push(...batchResults)
  }

  for (const call of calls) {
    const tool = this.tools.get(call.name)
    const isSafe = tool?.metadata.isConcurrencySafe ?? false  // ↑ fail-closed

    if (isSafe) {
      safeBatch.push(call)
    } else {
      await flushBatch()
      results.push(await this.executeSingle(call, toolContext))
    }
  }

  await flushBatch()
  return results
}
```

```typescript
// electron/main/tools/builder.ts — 工厂默认值

const METADATA_DEFAULTS = {
  isReadOnly: false,
  isDestructive: false,
  isConcurrencySafe: false,  // ↑ 宁可慢，不要默认可并行
} as const
```

| CC | 我们 | 说明 |
|----|------|------|
| `isConcurrencySafe(input)` 函数 | 固定 `boolean` | 我们暂缓动态判定（→ M04） |
| StreamingToolExecutor 边收边跑 | `executeAll` 收齐再跑 | Loop 已等完整 tool_calls；流式边跑是下一档优化 |
| 默认 false | 默认 false | 同构 |

**发现**：调度哲学一致；我们缺的是「按 input 动态」和「流式边到边执行」，不是分批算法本身。  
**方法论对照** → m16 §三；细节 → m04。

---

## §四 / §七 写盘 — coalesce + 原子写

### Alice 的实现（方向）

Alice 用 **better-sqlite3**：同步写入、可 `.transaction()`，天然单写者友好，不必整库 export。

### 我们的实现

```typescript
// electron/main/storage/database.ts

let persisting = false
let persistDirty = false

/**
 * ① 写盘中再来的 persist 只打脏标记
 * ② 当前写完用最新 export 再写，直到干净
 * ③ 配合 atomicWriteFileSync，避免半截文件
 */
export function persist(): void {
  if (!db || !dbPath) return

  if (persisting) {
    persistDirty = true
    return
  }

  persisting = true
  try {
    do {
      persistDirty = false
      const data = db.export()           // ↑ 全量快照（sql.js 代价）
      atomicWriteFileSync(dbPath, data)
    } while (persistDirty)
  } finally {
    persisting = false
  }
}

export function atomicWriteFileSync(filePath: string, data: Uint8Array): void {
  const tmpPath = `${filePath}.${process.pid}.tmp`
  fs.writeFileSync(tmpPath, Buffer.from(data))
  try {
    fs.renameSync(tmpPath, filePath)   // ↑ POSIX：替换近似原子
  } catch {
    // Windows：目标存在时 rename 失败 → copy 覆盖再删 tmp
    fs.copyFileSync(tmpPath, filePath)
    try { fs.unlinkSync(tmpPath) } catch { /* 残留不致命 */ }
  }
}
```

| Alice | 我们 | 说明 |
|-------|------|------|
| better-sqlite3 页级写 | sql.js 全量 export | 打包简单换 I/O 代价 |
| `transaction()` | coalesce 循环 | 不同层的「一次逻辑写」 |
| OS 文件完整性靠 SQLite | tmp+rename 自管 | 我们没有 WAL |

**发现**：不是「谁更正确」，是选型锁定了防护姿势——选了 sql.js，就必须把 coalesce 和原子写写成纪律，而不是指望引擎。  
**方法论对照** → m16 §四、§七。

---

## §八 Schema 版本

### 我们的实现（旧 → 新）

```typescript
// 旧：无版本号
try {
  db.run('ALTER TABLE sessions ADD COLUMN total_prompt_tokens ...')
} catch { /* column already exists */ }

// 新：meta.schema_version + 有序 migration
export const SCHEMA_VERSION = 1

export function runMigrations(database: SqlJsDatabase): void {
  let version = getSchemaVersion(database)
  const migrations = [
    (d) => {
      addColumnIfMissing(d, 'sessions', 'total_prompt_tokens', 'INTEGER NOT NULL DEFAULT 0')
      addColumnIfMissing(d, 'sessions', 'total_completion_tokens', 'INTEGER NOT NULL DEFAULT 0')
    },
  ]
  while (version < SCHEMA_VERSION) {
    migrations[version](database)
    version += 1
    setSchemaVersion(database, version)
  }
}
```

| 旧 | 新 | 说明 |
|----|-----|------|
| 空 catch ALTER | `addColumnIfMissing` + version | 可叙述「现在是 vN」 |
| 无账本 | `meta` 表 | 下次破坏性迁移有挂点 |

**发现**：迁移系统的价值不在第一列，在于**第 N 列时你还敢改**。  
**方法论对照** → m16 §八。

---

## §四 G2 — 任务关键转移 await 落盘

### 我们的实现

```typescript
// electron/main/services/task-queue.ts

async function dbUpsertTask(task: BackgroundTaskInfo): Promise<void> {
  try {
    const database = await getDatabase()
    database.run(`INSERT OR REPLACE INTO background_tasks ...`, [/* ... */])
    persist()
  } catch (err) {
    log.warn('Failed to persist task to SQLite', { taskId: task.id, error: String(err) })
  }
}

// enqueue：非阻塞——内存已有真相
void dbUpsertTask(this.toInfo(task))

// processNext：pending → running 必须 await
await dbUpsertTask(this.toInfo(task))

// notify：先落盘 notified，再发 IPC（防重启重复 Toast）
await dbUpsertTask(this.toInfo(task))
BrowserWindow.getAllWindows()[0]?.webContents.send('task:event', event)
```

| 转移 | 落盘策略 | 理由 |
|------|----------|------|
| enqueue → pending | void（可丢） | 内存队列在；丢了最多少一个后台任务 |
| → running / failed / notified | await | 崩溃恢复与幂等通知的契约（→ M09 / M15） |

**发现**：不是「所有写都 await」，而是**按契约分级**——和 M15「哪些必须落盘」同一条轴。  
**方法论对照** → m16 §四；M15 §五；M09。

---

## §五 大结果落 FS

### CC

`toolResultStorage.ts`：超大 tool result 落盘，消息里留引用。

### 我们的实现

```typescript
// electron/main/tools/middleware.ts — resultPersistenceMiddleware

// 超过 maxResultSizeChars（默认 50_000）→ workdir/.tmp/tool-results/
// maxResultSizeChars=Infinity（如 file_read）永不落盘，防循环
```

**发现**：FS 层保护的是上下文和 DB export 体积，不是「又一个数据库」。  
**方法论对照** → m16 §五。

---

## 文件索引

| 主题 | 路径 |
|------|------|
| 工具分批 | `electron/main/tools/registry.ts` |
| 元数据默认 | `electron/main/tools/builder.ts` |
| persist / migration | `electron/main/storage/database.ts` |
| 任务落盘 | `electron/main/services/task-queue.ts` |
| 大结果落盘 | `electron/main/tools/middleware.ts` |
| 单测 | `__tests__/unit/database-persist.test.ts` |
