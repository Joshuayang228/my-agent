# M16 并发与数据架构

> **所属**：Part IV 可观测与质量
> **核心问题**：Agent 系统的并发模型是什么？数据如何在内存、SQLite、文件系统之间分工？
> **状态**：📋 待写

---

## 待覆盖内容

- 并发模型：agentLoop 串行、工具执行并发的设计边界
- isConcurrencySafe 元数据的判定标准
- SQLite 写入竞争防护（fire-and-forget 模式的风险与缓解）
- 存储分工原则：内存（运行时状态）vs SQLite（持久化/恢复）vs 文件系统（大结果落盘）
- sql.js WASM vs better-sqlite3 的选型理由与代价
- Schema 演进策略：如何安全地添加字段

## 参考源

- 我们的 database.ts / task-queue.ts 实现
- feiche: concurrency-queue-design.md
