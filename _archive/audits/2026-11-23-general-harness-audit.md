# 通用 Agent Harness 源码审计

> 审计日期：2026-11-23。范围是 My Agent 通用 Harness 底层，不含人物世界领域和前端视觉。本轮只更新参考源码并审计，不修改产品代码。

## 参考版本

| 参考 | 本地位置 | 版本 |
|---|---|---|
| Claude Code 源码快照 | `_reference/framework-harness/repos/claude-code-sourcemap-main/claude-code-sourcemap-main/restored-src` | 非官方快照，Claude Code 2.1.88 |
| DeepSeek harness | `_reference/framework-harness/repos/deepseek-harness` | `4b399c39a6d1479cd84ca591b4d7c88e24d38a96`，dsh 0.2.3-alpha.2 |
| OpenAI Codex | `_reference/framework-harness/repos/codex` | `b46c087c7e52ca8c1aba775dad99d9549b537312` |

## 当前结构判断

My Agent 已形成 Runtime、Agent Loop、Context Manager、Prompt Registry、LLM Provider、Tool Registry、Permission Engine、Session Store、Trace 和 Debug Sink 的模块化单体。Prompt 注册、Manifest 双端工具权限、SQLite 事务、取消信号、工具超时和基础压缩均已具备。当前主要缺口是通用 Harness 的事实提交边界还没有完全闭合。

## P0 缺口

### H-01 工具异常会中断整批调用

证据位于 `electron/main/agent/loop.ts:724` 和 `electron/main/tools/registry.ts:219`。Loop 直接等待 `registry.executeAll`，而 Registry 对非取消异常重新抛出。一个工具异常可能让同批其他工具没有结果，已写入的 assistant tool call 只能靠后续消息清洗补占位。

参考 Claude Code 的 `StreamingToolExecutor` 和 DSH 的 canonical tool output contract，每个已接受 tool call 都应产生一个结构化结果。建议把单工具异常转换为 `ToolResult`，批次异常不能破坏其他工具的结果，并补齐“一个失败、一个成功、一个取消”的回归。

### H-02 流式失败重试可能重复展示半截输出

`electron/main/llm/index.ts:370-376` 在任意流事件后标记 `modelOutputStarted`，`electron/main/agent/loop.ts:317-381` 仍会重试整个请求。第一次已经发布的 text、thinking 或 tool delta 无法撤回，第二次可能重复发布。

Codex 将 turn、response item 和 retry 分开，Claude Code 为工具和中断维护独立状态。建议为每次 attempt 建立独立 segment，未完成 segment 不得直接并入最终 assistant 消息。

### H-03 Token 估算没有包含完整请求

`electron/main/agent/context-manager.ts:73-91` 只估算消息、图片占位和 tool arguments，`135-149` 还会复用上一轮 `promptTokens`。工具 schema、Skill、Provider 包装和输出预留没有进入同一预算。

DSH 把 token measurement 抽成独立服务，Codex 和 Claude Code 都以模型运行时实际预算驱动压缩。建议建立统一 Request Token Meter，至少纳入 system、messages、tools、附件、Provider overhead 和 output reserve。

### H-04 主对话缺少 durable turn checkpoint

Runtime 在 `electron/main/agent/runtime.ts:207`、`533-573` 分别保存用户、assistant 和 tool 消息，但 turn、attempt、工具进行中状态、权限等待和 retry 只存在 Loop 内存。崩溃后只能依靠 `sanitizeToolCallPairs` 修补。

Codex 有 thread / turn / step / response item / compaction checkpoint，DSH 有 session event 和 retry projection。建议建立最小 Turn Ledger，记录 turnId、attempt、请求快照哈希、工具状态、取消原因和终态，重启时只恢复可证明安全的状态。

## P1 缺口

### H-05 模型能力目录不完整

`model-context-window.ts` 主要按模型名启发式推断窗口，连接中的模型条目只有 ID。DSH catalog 保存 `contextWindow` 和 `maxTokens`，Codex 使用 model info 和 truncation policy。当前已移除 DeepSeek 路径的全局 4096，但还没有统一的模型能力 descriptor。

### H-06 流结束没有统一完整性状态

OpenAI-compatible、Anthropic、Gemini 适配器在 reader 结束时主要返回累计内容和可选 stopReason，异常 EOF 与正常终态没有统一区分。应将 clean completion、EOF、abort、length、tool incomplete、refusal 统一结构化。

### H-07 Loop 与 Runtime 对中间文本的语义不一致

Loop 在有工具调用时明确丢弃 companion text，但 Runtime 在 `runtime.ts:566` 累加所有 `text` 事件，最终可能把工具前的过程话术保存为最终回复。应区分 intermediate text、tool preamble 和 final assistant text。

### H-08 执行模式降级写入全局设置

`runtime.ts:517` 将某个会话的 `execution_mode_changed` 写入全局 `executionMode`。Codex 将 approval / sandbox / turn controls 绑定到 thread。当前设计会让一个会话的拒绝影响其他会话和人物，应改为 session / run scope。

### H-09 Query source 是进程级可变状态

`context-manager.ts:34-45` 使用模块级 `activeQuerySource`，Runtime 和压缩流程在 `context-manager.ts:549-633`、`runtime.ts:683-699` 修改它。多会话并发可能相互覆盖。应使用 AsyncLocalStorage 或显式 QueryContext。

### H-10 Session 写入和 fork 的事务边界不完整

`session-store.ts:273-307` 在 SAVEPOINT 外先读取 MAX(sort_order)，`forkSession:317-384` 复制过程也没有统一事务。并发写入可能得到相同 sort_order，fork 失败可能留下半成品。

### H-11 Retry 只存在内存

Loop 当前是固定 2 次重试和退避，缺少 durable retry identity 和恢复事件。DSH 的 `llm-retry` 先写 `llm/retry`，等待可取消，再写 `llm/retry-started`。Codex 也区分 server retry advice、transport fallback 和 retry budget。

### H-12 Failover 过程提示会混入最终回复

LLM failover 会向流发送主模型切换提示，Runtime 会把该 text 累加到 assistantContent。过程事件和最终 assistant 内容应分离。

### H-13 工具结果没有独立历史级修剪层

当前 middleware 有字符上限，但大工具结果主要等到后续压缩才处理。DSH 将 tool-result-pruner 作为独立能力，建议在 compact 前优先修剪旧工具结果。

### H-14 工具配对清洗按全局 ID 集合判断

`message-pipeline.ts` 用整段历史的 toolCallId 集合判断结果存在，重复 ID、迟到结果和跨段关联可能误配。应按 assistant tool call 后续局部序列验证。

## P2 缺口

- Trace 在截断恢复路径可能重复结束。Loop 先 `onLLMEnd(..., true)`，随后又以失败结束同一 span。
- 上下文窗口推断没有使用 base URL、Provider 或远端 model catalog。
- 主会话和子 Agent 的 durable ownership、parent run、cancel propagation 和 recovery contract 尚未统一。
- Provider 适配器没有统一处理 capability mismatch、content filter、reasoning-only 和 incomplete tool call。

## 建议的收敛顺序

1. 先完成单工具异常隔离、流式 attempt segment、Request Token Meter 和 durable Turn Ledger。
2. 再完成模型能力目录、session-scoped execution mode、AsyncLocalStorage QueryContext、durable retry 和 tool-result-pruner。
3. 最后统一 response item、Provider completion taxonomy、Trace lifecycle 和长任务 replay。

## 结论

当前架构方向正确，不需要推倒重来。核心缺口是“LLM stream → UI event → Loop memory → Runtime 保存 → SQLite”仍是松散链路。目标应收敛为 `Thread / Turn / Step / Response Item` 驱动的可取消、可重试、可恢复 durable lifecycle，让 LLM、Tool、Permission、Compaction 和 Persistence 共用同一事实链。

本轮没有修改产品代码。参考仓库已更新到上述版本，Codex 在启用 Git 长路径后完成 checkout。
