# M19 多 Agent 协作 — 代码走读

> 理念章：[`m19-multi-agent.md`](./m19-multi-agent.md)
> 最近核对：2026-08-16
> 事实源：`electron/main/agent/subagent.ts`、`subagent-registry.ts`、`tools/builtins/delegate-task.ts`、`continue-task.ts`

---

## 一、当前只实现父子工具模式

My Agent 没有异步 Coordinator 总线或 Swarm。父 Agent 通过 `delegate_task` 同步运行一个隔离子 Agent；结果作为 tool_result 回到父循环。`continue_task` 可以复用已完成子 Agent 的历史，但仍在父 Agent 当前工具调用中同步跑完。

## 二、子 Agent 输入与上下文隔离

`runSubAgent()` 只给子 Agent：

- 角色描述；
- 自包含 task；
- 独立 messages；
- 子 ToolRegistry；
- 统一辅助模型配置；
- 父级传下来的 workdir、sessionId、signal 和 executionMode；
- 独立 Trace / LLM Debug 子会话 ID。

它看不到父对话全文。父 Agent 必须自己理解用户请求并写出完整委派任务，不能用“根据你刚才看到的内容继续”代替上下文。

## 三、角色预设

```text
researcher → file_read / code_search / web_search / url_fetch / rag_search，只读
analyst    → file_read / code_search / rag_search，只读
coder      → read/edit/write/patch/search/shell，可写
```

自由角色在没有显式工具列表时只继承父 Registry 的只读工具。显式 `allowed_tools` 只能从父工具集中取子集，不能凭空获得父级没有的能力。

## 四、工具黑名单

子 Registry 永久排除：

```text
delegate_task
continue_task
remember / forget
```

这样防止递归创建、跨子 Agent 操作和直接修改父会话长期记忆。召唤会话还有额外 sessionKind 边界，只有 main / summon 可以委派。

## 五、权限只降不升

`resolveChildExecutionMode()` 的顺序：

```text
full-access(-1) < auto(0) < confirm-all(1) < plan-first(2)
```

子 Agent 默认使用 auto，但父级若是 confirm-all 或 plan-first，子级必须继承更严格模式；父级 full-access 时子级仍降到 auto。工具集同时是父工具集的子集，因此执行模式和能力集合都不能向上提升。

## 六、委派工具自身的风险 metadata

`delegate_task` 是否只读取决于参数：

- researcher / analyst 默认只读；
- `read_only=true` 可证明只读，并在 Registry 构建时过滤破坏性工具；
- coder、`read_only=false`、自由角色显式工具列表按潜在可写处理。

`resolveDelegateTaskMetadata()` 返回参数化 metadata。Loop、Debug 预检、并发调度和执行链统一通过 `ToolRegistry.resolveEffectiveMetadata()` 读取；解析失败按破坏性、不可并发 fail-closed。

`continue_task` 无法只凭 agentId 判断旧实例是否持有写工具，因此静态标记为破坏性、不可并发，auto 模式必须确认。Headless 仍显式拒绝这两个工具。

## 七、ToolContext 传递

子工具获得父调用的：

```text
workdir
sessionId（Debug 时改成独立 subagent debugSessionId）
signal
executionMode
sessionKind
asset usage reporter
```

文件与 Shell 工具优先使用 `ToolContext.workdir`，避免子 Agent 回退到全局项目根。取消信号继续传入 Agent Loop 和工具执行。

## 八、continue 生命周期

`subagent-registry.ts` 保存：messages、childRegistry、llmConfig、executionMode、maxIterations、toolContext 和 parentSpanId。实例按父 sessionId 分组，会话结束时清理。

`continueSubAgent()`：

1. 追加新的 user message；
2. 复用原 messages、Registry 和执行模式；
3. 运行 Agent Loop；
4. 追加 assistant 回复；
5. 返回工具和迭代证据。

不存在的 agentId 返回用户友好错误，不恢复已清理会话。

## 九、可观测与隐私

Trace 和普通日志只保存 role/task/message 的 hash、长度、工具数、迭代数和 contentLength，不保存委派正文或继续消息。LLM Debug 通过独立 debugSessionId 关联父会话，但不把 hidden reasoning 当作报告证据。

## 十、测试证据

- `subagent-roles.test.ts`：模式只降不升、预设、工具子集、黑名单与委派 metadata；
- `subagent-registry.test.ts`：注册、continue、会话清理；
- `agent-loop.test.ts`：参数化 metadata 在 auto 模式触发确认；
- `tool-registry.test.ts`：动态 metadata 合并与失败 fail-closed；
- `debug-tool-run.test.ts`：Debug 预检读取动态 metadata；
- `headless-policy.test.ts`：后台拒绝 delegate / continue；
- `summon-delegation.test.ts`：召唤任务工边界。

## 十一、当前缺口

- 没有真正异步并行的 Coordinator/Worker 消息总线；
- 子 Agent 实例只在内存中，应用重启后不能 continue；
- continue 仍是同步工具调用，不支持 worker 主动回报；
- 目前没有跨 Agent 共享黑板，父 Agent 必须自行综合。

## 2026-08 安全校准

委派文本和继续消息只保存 hash/长度；子 Agent 的动态 metadata、`ToolContext.workdir` 和 Headless 策略都在实际执行路径重新解析，不能依赖父 Agent 传来的静态只读标记。
