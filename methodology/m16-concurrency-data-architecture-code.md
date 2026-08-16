# M16 并发与数据架构 — 代码走读

> 理念章：[`m16-concurrency-data-architecture.md`](./m16-concurrency-data-architecture.md)
> 最近核对：2026-08-16

---

## 一、工具并发按有效 metadata 决定

ToolRegistry 保持 LLM 返回顺序：连续 `isConcurrencySafe=true` 的工具组成批次并行；遇到不可并发工具先 flush，再串行执行。单批最多 10 个。

参数化工具通过 `resolveEffectiveMetadata()` 合并静态/动态 metadata。权限、Debug 预检、并发和实际执行共享该入口；解析失败按可写、破坏性、不可并发 fail-closed。

## 二、并发安全不等于只读

`isReadOnly`、`isDestructive`、`isConcurrencySafe` 是三个独立维度。读网络、读缓存等操作也可能不适合无限并发；可写工具默认不可并发。调度器不按工具名硬编码特例。

## 三、TaskQueue 串行

对话后置任务共用一个串行队列，避免画像、标题、向量和反思同时写相邻状态。失败重试通过 timer 重新入队，不阻塞当前循环。

## 四、sql.js 的写盘模型

数据库在内存中运行，`persist()` 每次 export 全库。它没有 WAL 或多写者事务，因此主进程采用：

```text
persisting 标志
+ persistDirty 脏标记
+ 写临时文件
+ 原子替换正式数据库
```

写盘期间再次调用 persist 只标 dirty；当前写完后再导出最新快照一次，避免连续 I/O 和旧快照覆盖新状态。

## 五、Schema 迁移

`meta.schema_version` 单调递增；`runMigrations()` 按版本执行幂等 migration。新安装的 CREATE TABLE 包含最新列，旧库通过 `addColumnIfMissing` 或明确数据迁移前进。迁移失败应阻止启动，不能空 catch 后继续使用半结构数据库。

## 六、AsyncLocalStorage

Trace identity 用 AsyncLocalStorage 绑定到异步调用链，避免并发会话通过全局变量串 sessionId/spanId。后台任务在入队时捕获 linkSpanId，执行时重新进入 TraceContext。

## 七、结果和资源上限

- 并发工具批次上限 10；
- 单工具默认 30 秒超时，longRunning 显式例外；
- 大工具结果落盘并返回路径；
- Eval 单进程互斥；
- URL、Prompt、RAG、命令和报告均有长度/数量边界。

## 八、测试证据

- `tool-registry.test.ts`：顺序、并发批次、动态 metadata 和 fail-closed；
- `database-persist.test.ts`：dirty coalesce、原子写与迁移；
- `task-queue.test.ts`：串行、重试和状态；
- `trace-context.test.ts`：异步身份隔离；
- `middleware.test.ts`：超时与大结果。

## 九、当前缺口

- sql.js 全库 export 不适合超大数据量；
- 没有跨进程写锁，多实例由 single-instance lock 从产品层避免；
- longRunning 工具依赖自身 maxIterations/AbortSignal，不能无限放任；
- 没有通用全局请求调度器，只有各子系统的局部上限。
