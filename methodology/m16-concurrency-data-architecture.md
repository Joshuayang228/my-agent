# M16 并发与数据架构方法论

> 这份文档沉淀我们对「并发边界」和「数据落点」的设计思考。
> 前半部分是**认知框架**——谁能并行、数据住哪一层、写盘如何不把自己写坏。
> 后半部分是**实战记录**——本轮 G1/G2/G3/G9 改了什么、刻意不做哪些。
>
> 对照源：Alice Ch.15 读写分离并发 × CC `StreamingToolExecutor` / `isConcurrencySafe` × wps-cowork Sandbox FIFO 排队（借思想不借 Redis）× 我们的 `registry.executeAll` / `database.persist` / `task-queue`
> 沉淀时间：2026-07-26
>
> **边界先写在前面**：工具分批并发的细节在 M04；任务五态在 M09；「状态住内存还是盘」的选型纪律在 M15 §五。本章回答的是横切问题——**并发模型与存储分工如何合成一套不会自我竞态的架构**。

---

# 第一部分：认知框架

## 一、第一性原理：并发边界与数据落点必须一起设计

做 Agent 时很容易把两件事拆开想：一边谈「工具能不能并行」，一边谈「SQLite 怎么存」。结果是：工具层看起来很安全，写库路径却 fire-and-forget 全量刷盘；或者存储选型很「省事」，却默许了多处同时 `persist` 把旧快照盖掉新数据。

我们的第一性原理：

**并发不是「能多开几个 Promise」，而是一份契约——谁可以并行、谁必须串行、共享状态写到哪一层、崩溃后哪份数据算数。边界和落点必须同一张图里画完。**

一旦接受这条，后面变成三组推论：工具/任务/写盘各自的并发边界；内存·SQLite·文件系统的分工；选型与演进（sql.js、schema version）的代价。

```
第一性原理：并发边界与数据落点必须一起设计

├─ 推论组 A：三层并发边界
│     §二 Loop 串行 · §三 工具分批并行 · §四 写盘串行/coalesce
│
├─ 推论组 B：存储三层分工
│     §五 内存 / SQLite / FS · §六 与 M15 持久化边界对齐
│
└─ 推论组 C：选型与演进
      §七 sql.js 代价 · §八 Schema 版本 · §九 刻意不做
```

---

# 推论组 A：三层并发边界

> 第一性原理说「谁可以并行」。Agent 里至少有三条轴，混在一起谈会灾难。

## 二、Agent Loop：一轮对话内串行迭代

`agentLoop` 是 **while 串行**：等 LLM → 执行工具 → 把结果塞回消息 → 再 LLM。这不是性能偷懒，而是语义：每一轮的 tool_result 是下一轮 prompt 的输入，乱序等于撒谎。

后台任务（画像 / 标题 / 向量）走 `TaskQueueManager` **另一条串行队列**，不插入 Loop 的迭代。两条轴并行存在，但**不共享可写业务状态的写锁**——任务写自己的 `background_tasks` 行，Loop 写 messages/sessions。

判据：**改变「当前对话真相」的路径必须能说出它和 Loop 的对齐点；说不清就串行。**

## 三、工具执行：声明式分批，默认不并发

受 Alice「读写分离并发」与 CC `isConcurrencySafe` 启发（注明：启发自调度哲学，非照搬 StreamingToolExecutor）：

| 元数据 | 调度含义 |
|--------|----------|
| `isConcurrencySafe: true` | 可与其他 safe 工具合批 `Promise.all` |
| `isConcurrencySafe: false`（默认） | 先 flush 当前批，再独占执行 |

`buildTool` fail-closed：忘了声明 → 当不可并发。这比「默认并行、出了竞态再修」便宜一个数量级。

动态 `isConcurrencySafe(input)`、全局并发信号量——M04 已暂缓；桌面单用户工具量级用不上。M16 只要求：**调度只认元数据，禁止 `if (name === 'file_read')` 特判。**

## 四、写盘：单写者 + coalesce + 原子替换

sql.js 没有 WAL。整库活在内存里，`persist()` = `export()` + 写文件。这里的并发危险不是「两个线程同时 write」，而是：

1. **崩溃半截文件**（写到一半进程没了）→ 原子写（tmp + rename/replace）
2. **连打 persist 的 I/O 风暴**（每个 upsert 全量刷盘）→ dirty coalesce：写盘中再来的调用只打脏标记，当前写完用最新快照再写一次
3. **关键状态转移丢写**（fire-and-forget 在崩溃窗口丢 status）→ 任务 running/completed/failed/notified **await 落盘**；enqueue 仍可非阻塞

wps-cowork 的「配额转让 / FIFO / 超时」是多实例沙箱池的解法；我们是单进程桌面 Agent——**借「失败要可见、等待要有界」的味道，不借 Redis 架构。**

---

# 推论组 B：存储三层分工

> 第一性原理说「落点」。层选错了，并发纪律再严也会在恢复时打脸。

## 五、内存 · SQLite · 文件系统

| 层 | 住什么 | 为什么 |
|----|--------|--------|
| **内存** | 任务 `fn`、LoopState、进行中的 Span、AbortSignal | 不可序列化 / 单次生命周期 / 极热路径 |
| **SQLite（sql.js）** | 会话消息、设置、记忆、任务元数据、持久审批 | 要跨重启、要查询、体量中等 |
| **文件系统** | 大工具结果（`maxResultSizeChars` 落盘）、将来可能的附件 | 避免撑爆上下文与 DB 导出体积 |

大结果走 FS 不是「优化」，是**保护另外两层**：结果进消息历史会炸上下文；进 SQLite 会让每次 `export()` 更沉。

## 六、与 M15 对齐

M15 §五已经给出「必须落盘 vs 只活内存」的红线。M16 补上**怎么写才安全**：

- 落盘集合不变（任务状态、notified、会话…）
- 写路径必须满足：单写者语义 + 崩溃不留半截文件 + 关键转移可等待

**权威仍在主进程**；渲染进程是投影（→ M12 / wishlist「会话 Runtime 中心化」）。

---

# 推论组 C：选型与演进

## 七、为什么 sql.js，以及代价

| 选项 | 收益 | 代价 |
|------|------|------|
| **sql.js（我们）** | 无原生编译、Electron 打包简单、逻辑同 SQLite | 整库内存；每次 persist 全量写；无多进程共享 |
| **better-sqlite3（Alice）** | 同步 API、transaction、WAL、单写者友好 | native 依赖、跨平台构建成本 |

本阶段**不迁库**。承认代价，用 coalesce + 原子写把代价关进笼子。若有一天会话/记忆体量让全量 export 成为体感卡顿，再评估 better-sqlite3 或「分库 / 增量快照」——那是新决策，不是本章偷偷做的事。

## 八、Schema 演进：版本号，不要永恒的 try/catch ALTER

旧写法：`ALTER TABLE ... ADD COLUMN` 包在空 catch 里。能跑，但说不清「现在是第几版」。

纪律：

1. `meta.schema_version` 单调递增
2. `migrations[i]` 负责 `i → i+1`，且**幂等**（`addColumnIfMissing`）
3. 新安装的 `CREATE TABLE` 直接带上最新列；旧库走迁移

加列是主路径；真正的破坏性迁移（改语义/删列）要单独写迁移脚本并在实战记录留痕。

## 九、刻意不做

1. **不上 Redis / 全局沙箱配额队列**——产品是单用户桌面，不是多租户池。
2. **不把 `isConcurrencySafe` 改成按 input 的函数**——归 M04 增量；固定 boolean 够用。
3. **不引入工具并发数 semaphore**——同上，极端场景再开。
4. **本轮不迁 better-sqlite3**——先把写路径纪律做对。
5. **不在渲染进程直接写 SQLite**——违反权威原则。

---

# 第二部分：实战记录

## 本轮做了什么（2026-07-26）

### 学 / 审

1. **Alice Ch.15**：声明式并发 + 分层记忆生命周期。
2. **CC**：`Tool.isConcurrencySafe`、流式工具执行器、大结果落盘。
3. **wps-cowork** `2026-04-03-sandbox-concurrency-queue-design.md`：FIFO / 配额转让 / 超时——确认与我们 task-queue **问题域不同**。
4. **我们**：`executeAll` 已正确；缺口在 `persist` 直写、无 schema 版本、task upsert 全 fire-and-forget。

### 改（对齐 Gap）

| ID | 项 | 结果 |
|----|-----|------|
| G1 | persist dirty coalesce | ✅ `persisting` + `persistDirty` 循环写最新快照 |
| G9 | 原子写盘 | ✅ `atomicWriteFileSync`（tmp → rename，Windows 走 copy+unlink） |
| G2 | 关键转移 await 落盘 | ✅ running / retry-pending / notify；enqueue 仍 void |
| G3 | schema_version | ✅ `meta` 表 + `runMigrations`；v0→v1 幂等补 token 列 |
| G4 | sql.js 选型 | 只沉淀，不迁库 |
| G5 | 存储三层 | 本章成文 |
| G6/G7 | 函数化 metadata / 并发上限 | ✅ `resolveEffectiveMetadata` + 单批最多 10；失败 fail-closed |
| G8 | 全局统一排队 | 刻意不做；各子系统按资源边界局部调度 |

测试：`database-persist.test.ts` 新增；全量 264 通过；`tsc --noEmit` 通过。

## 暂缓项

| 项 | 归属 | 说明 |
|----|------|------|
| `isConcurrencySafe(input)` | M04 | 固定 boolean 够用 |
| 工具并发数上限 | M04 | 量级不够 |
| 迁 better-sqlite3 / 增量快照 | 工程债 | 等体量痛点 |
| 全局资源 FIFO | 刻意不做 | 单用户桌面 |
| 会话 Runtime 中心化 | wishlist | 与 M15 交点，非本章 |

## 设计检查清单

1. 这条路径和 **Loop / 工具批 / 写盘** 哪一层并发边界对齐？
2. 共享状态写在 **内存 / SQLite / FS** 哪一层？崩溃后谁算数？
3. 新增的 DB 列有没有进 **migration**（而不是裸 try/catch ALTER）？
4. 关键状态转移是 **await 落盘** 还是可丢失的 fire-and-forget？
5. 大结果是进上下文、进 DB，还是 **落 FS**？
6. 有没有用工具名硬编码调度，而不是 `isConcurrencySafe`？

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 第一性原理 | 边界与落点同图 | 分开设计必出写竞态 |
| 本轮代码范围 | G1+G9+G2 轻+G3 | 对齐用户确认的 Gap |
| sql.js | 保留 | 打包成本优先；用纪律关代价 |
| wps-cowork 排队 | 不搬 | 问题域是沙箱池不是桌面 Agent |
| 与 M04/M09/M15 | 交叉引用，不重写 | 避免三章抢真相 |


## 2026-08 当前实现

ToolRegistry 的权限、并发和执行阶段共享动态 metadata 解析；sql.js persist 使用 dirty coalesce + 临时文件原子替换；Schema 使用版本化迁移；TaskQueue 串行，TraceContext 使用 AsyncLocalStorage 隔离并发会话。
