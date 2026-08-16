# M14 可观测性 — 代码走读

> 理念章：[`m14-observability.md`](./m14-observability.md)
> 最近核对：2026-08-16

---

## 一、四种证据不要混用

| 类型 | 入口 | 保存什么 |
|---|---|---|
| 普通日志 | `utils/logger.ts` | 事件名、状态、长度、hash、错误类型 |
| Trace | `utils/tracer.ts` | span、父子关系、caller、耗时、token lane |
| LLM Debug | `storage/llm-debug-store.ts` | 调用结构、计数、模型、状态、资产证据 |
| Asset Usage | `utils/asset-usage.ts` / store | stable key、版本、fingerprint、relation |

日志用于诊断，Trace 用于因果链，LLM Debug 用于请求结构，Asset Usage 用于证明生产资产是否真正参与运行。

## 二、Logger

Logger 按日写本地文件并限制保留天数。敏感输入不直接进入字段：命令、路径、Prompt、任务、记忆和规则正文使用 hash/长度/类型；对外错误不带堆栈、SQL 或本机路径。

## 三、Trace 与 AsyncLocalStorage

`trace-context.ts` 用 AsyncLocalStorage 保存 sessionId、userId 和 interactionSpanId。`startSpan` / `startLinkedAsyncSpan` 形成主对话、LLM、工具、后台任务和子 Agent 的树。内存 span 有上限，旧记录 FIFO 淘汰。

子 Agent 的 role/task/continue message 只记录 hash 和长度，不保存委派正文。

## 四、LLM Debug Store

LLM Debug schema 当前不保存：

- System/User Prompt 正文；
- 模型回复正文；
- hidden reasoning；
- 工具参数和返回正文；
- API Key；
- 用户记忆正文。

它保存模型、baseUrl 脱敏摘要、caller、状态、token、消息角色/长度、工具名、Prompt 资产 key/fingerprint 和关联 span。Debug 列表先返回摘要，单条详情再按 ID 查询。

Persona Eval 报告是用户明确运行的独立本地产物，可以包含测试 System Prompt 和 messages；它不等同于普通 LLM Debug 日志。

## 五、Asset Usage

生产 Prompt、Role Pack、Memory Strategy、Permission/Sandbox、Tool、Skill、Eval、Provider、MCP 通过 stable key 记录使用关系：used/triggered/derived。metadata 经过键和值长度限制，拒绝 rawArgs、response 等正文型字段。

## 六、Debug IPC

`ipc/debug.ts` 提供只读生产快照、日志查询、资产证据、Trace、报告和世界状态；写操作只限人工审阅、清理/导出日志以及用户明确确认的 Eval/工具试跑。导出使用 Save Dialog，错误只返回友好文本。

## 七、保留与清理

- 普通日志按日期文件和保留天数清理；
- Trace 内存按 MAX_SPANS 裁剪；
- LLM Debug/Asset Usage 按 store 策略限制记录量；
- 子 Agent Debug 会话通过 mainSessionId 关联；
- 清理不会反向删除真实会话或用户记忆。

## 八、测试证据

`logger`、`tracer`、`trace-context`、`llm-debug-store`、`asset-usage-store`、`conversation-debug`、`debug-*` 测试覆盖脱敏、查询、关联和生命周期。安全回归检查普通日志和 Debug 不出现 Prompt/Key/记忆正文。

## 九、当前缺口

- 没有远程 Telemetry 后端；
- 没有分布式 Trace；
- 本地 Debug 数据仍需受磁盘空间和保留策略约束；
- 可观测性不能替代 Eval，结构证据不证明回答质量。

## 2026-08 资源与凭据审计

Terminal 输出、Session Diff、Eval 报告、工具结果和 MCP schema 均有大小/数量上限；设置 IPC 的 API Key/MCP env 不会进入 Renderer Debug 或日志。日志与 Trace 继续只保存错误类型、长度、hash 和结构证据。
