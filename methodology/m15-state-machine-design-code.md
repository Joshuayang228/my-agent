# M15 状态机设计 — 代码走读

> 理念章：[`m15-state-machine-design.md`](./m15-state-machine-design.md)
> 最近核对：2026-08-16

---

## 一、Agent Loop 的继续与终止分开

```typescript
type ContinueReason = 'next_turn' | 'reactive_compact_retry' | 'max_output_recovery'

type TerminalReason =
  | 'completed'
  | 'aborted'
  | 'max_turns'
  | 'too_many_denials'
  | 'prompt_too_long'
  | 'failed'
```

ContinueReason 只控制内部下一轮；TerminalReason 进入 `done` 事件并被 Runtime 保存。二者不能用一个 `status` 字符串混合，否则 retry 会被误当完成。

## 二、Runtime 终态只发一次

`resolveRuntimeDoneEvent()` 判断 Loop 是否已经发过 done。Runtime 的 finally 只在缺失时补发，不覆盖真实 reason。只有 `completed` 才允许：

- 保存 assistant 正文；
- 发送成功桌面通知；
- 启动对话后置任务。

失败、取消、prompt_too_long 和拒绝熔断不能保存半截回复或触发成功副作用。

## 三、工具调用配对

Loop 把 assistant toolCalls 和 tool result 作为一组追加；拒绝、超时或未知工具也生成结构化错误 result，避免下一轮出现孤立 tool message。Message Pipeline 负责合并相邻文本和修复边界。

## 四、后台任务状态机

```text
pending → running → completed
        ↘ cancelled
running → pending(retry) → failed
```

状态转移、notified 和 checkpoint 由 TaskQueue 持久化。Scheduler 的 enabled/nextRunAt 是另一套状态，不与 BackgroundTaskInfo 混用。

## 五、Eval Runner 状态机

```text
idle → running → succeeded / failed / cancelled
```

同一时间只有一个子进程；cancel 必须匹配 runId；结束后记录 exitCode、endedAt、error 和最新报告文件。

## 六、伙伴状态

关系阶段、世界状态、MUTABLE 版本和 Presence 各自有明确 owner。它们可以被 Runtime 组装进 Prompt，但不能用一个全局“伙伴状态”对象无边界互改。

## 七、测试证据

- `runtime-terminal-reason.test.ts`：终态保真和去重；
- `agent-loop.test.ts`：六种终止、重试、拒绝和工具配对；
- `task-queue.test.ts` / persistence：后台任务状态；
- `eval-runner.test.ts`：Eval 子进程状态；
- `message-pipeline.test.ts`：消息结构。

## 八、当前缺口

- running 后台任务缺统一 Abort 状态；
- UI 部分局部 loading 状态仍由 React state 管理，没有统一状态图；
- 状态机类型散布在共享类型和模块内，新增状态需要同步事件消费者。
