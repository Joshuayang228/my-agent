# M12 Eval 体系 — 代码走读

> **上下章分工**：`m12-eval.md` 讲设计原则和判断；本篇讲实际代码——我们的实现如何对应三源参考、关键代码决策背后的理由、以及我们没有的东西。
>
> **参考源**：CC 的 Harness Engineering Guide（long-running-harness.md）/ lingxi observability/ 源码 / Anthropic Article 4（Demystifying Evals）。CC 的 sourcemap 没有独立 eval 目录，eval 能力内嵌在框架设计里——这是我们代码对应它时"设计即可测"的核心依据。

---

## 一、三源映射表

| 参考概念 | 参考来源 | 我们的实现 | 文件路径 |
|---------|---------|---------|---------|
| `transcript`（对话历史 + 工具调用 + 状态变化） | CC Harness Guide | `AgentStreamEvent[]`（agentLoop 产出的完整事件流） | `src/shared/types.ts` |
| `grader`（独立上下文的评估者） | Harness Guide Generator-Evaluator | `EvalGrader` 接口：`grade(ctx)` 只接受 transcript + workdir | `evals/graders/index.ts` |
| `harness`（task → trial 驱动器） | Anthropic Article 4 | `runner.ts: runScenario()` | `evals/runner.ts` |
| `task`（场景定义 + 成功标准） | Anthropic Article 4 | `EvalScenario`：buildOptions + mockResponses + graders | `evals/types.ts` |
| `OnLLMEnd / OnToolEnd` Observer 钩子 | lingxi `observer.go` | `agentLoop` yield 的 `error`、`tool_end`、`execution_mode_changed` 事件 | `electron/main/agent/loop.ts` |
| `CompositeObserver`（多 observer 扇出） | lingxi `composite_observer.go` | graders 列表：同一 transcript 顺序喂给每个 grader | `evals/runner.ts` |
| `NoopObserver`（测试/eval 场景静默运行） | lingxi `observer.go` | `_streamChatOverride = undefined`（真实 LLM 路径，无注入） | `evals/runner.ts` |
| `fixture`（确定性回放） | CC VCR（vcr.ts） | `MockTurn[]`：预设响应序列，每次 agentLoop 调用消费下一条 | `evals/mock-llm.ts` |

---

## 二、核心实现：`_streamChatOverride` 注入点

### 设计决策

Loop 的 LLM 调用原本是：
```typescript
import { streamChat } from '../llm/index'
// 在 loop 主体里直接调用
const stream = streamChat({ config, messages, ... })
```

这个模式在单元测试里只能通过 `vi.mock()` 替换模块级导入——而 eval runner 不使用 vitest 的 mock 机制（它在非测试运行时也需要工作）。

我们加了一个 DI 注入点：

```typescript
// src/shared/types.ts
interface AgentLoopOptions {
  // ...
  _streamChatOverride?: (options: any) => AsyncGenerator<any, any>
}

// electron/main/agent/loop.ts
const streamChat = options._streamChatOverride ?? defaultStreamChat
```

**为什么用 options 而不是单独的参数**：agentLoop 已经有较多参数，通过 options 对象扩展比在函数签名加参数更好改。`_` 前缀明确表示"非生产业务逻辑专用"，不会被正常调用路径误用。

**为什么不改 runner 用 vi.mock**：eval runner 的主要价值是在 `npm run eval:run` 下独立运行，不依赖 vitest。但实际上我们最终用 vitest 作为运行环境（解决 `moduleResolution: "bundler"` 的模块解析），只是不用 `vi.mock()` 而是用 DI 注入。这个区分很重要：vitest 是我们的 test runner，不是我们的 mock 框架。

---

## 三、MockStreamChat 设计

```typescript
// evals/mock-llm.ts
export function createMockStreamChat(turns: MockTurn[]) {
  let idx = 0
  return async function* mockStreamChat(_options) {
    const turn = turns[idx++] ?? { content: '[mock end]' }
    if (turn.content) yield { type: 'text', content: turn.content }
    return {
      content: turn.content ?? null,
      toolCalls: (turn.toolCalls ?? []).map(tc => ({
        id: tc.id, name: tc.name, arguments: JSON.stringify(tc.arguments)
      })),
      usage: turn.usage ?? { promptTokens: 10, completionTokens: 5 },
      stopReason: turn.toolCalls?.length ? 'tool_calls' : 'stop',
    }
  }
}
```

**关键设计点**：

1. **闭包计数器**：`idx` 在 mock 函数的闭包里，每次调用递增。agentLoop 每轮 LLM 调用消费一条 `MockTurn`。这比"每次调用传入不同 mock 函数"更自然，和 CC VCR fixture 的"hash → 录制/回放"模式是同种思想的简化版。

2. **超出范围时的 fallback**：`turns[idx++] ?? { content: '[mock end]' }`——如果 mock 序列用尽，返回一个空文本回复让 loop 正常结束，而不是抛错。这防止场景因 mock 序列设计不精确导致 loop 异常退出，掩盖真正的断言失败。

3. **不 yield `tool_calls` 事件**：标准 streamChat 会先 yield `tool_call_delta` 再 return。Mock 简化为直接在 return 值里放 toolCalls，由 loop 拿到后 yield `tool_calls` 事件。这不影响 grader 的断言，因为 grader 看到的 `tool_end` 事件仍然完整。

---

## 四、Runner 架构

```typescript
// evals/runner.ts
export async function runScenario(scenario: EvalScenario): Promise<ScenarioResult> {
  const workdir = join(tmpdir(), `eval-${scenario.id}-${Date.now()}`)
  mkdirSync(workdir, { recursive: true })
  const transcript: AgentStreamEvent[] = []

  // 1. 构建 registry
  const registry = new ToolRegistry()
  scenario.registerTools?.(registry)

  // 2. 注入 mock LLM（如 buildOptions 自己提供则优先）
  const baseOptions = await scenario.buildOptions(workdir, registry)
  const streamChatOverride = baseOptions._streamChatOverride
    ?? (scenario.mockResponses ? createMockStreamChat(scenario.mockResponses) : undefined)

  // 3. 运行 agentLoop
  for await (const ev of agentLoop({ ...baseOptions, _streamChatOverride: streamChatOverride }, registry)) {
    transcript.push(ev)
  }

  // 4. 每个 grader 独立上下文（只看 transcript + workdir）
  const ctx = { workdir, transcript, scenarioId: scenario.id }
  for (const grader of scenario.graders) {
    const result = await grader.grade(ctx)
    // ...
  }
}
```

**Runner 的三个不变量**（对应 Harness Guide 的 Generator-Evaluator 设计规则）：

1. **Grader 独立上下文**：每个 grader 拿到的 `ctx` 只包含 transcript 和 workdir，不包含 AgentLoopOptions、mockResponses、或 registry——grader 看不到推理过程，只看行为结果。

2. **Workdir 隔离**：每个场景用 `tmpdir()/eval-{id}-{timestamp}` 独立目录，场景之间文件系统不共享。场景结束后自动清理（可注释掉以调试文件状态）。

3. **Grader 异常不崩溃 Runner**：单个 grader 异常被 try/catch 包住，记为 fail + 错误信息，不中断其他 grader 的运行。

---

## 五、Graders 实现模式

```typescript
// evals/graders/index.ts — 统一返回结构
interface GraderResult {
  pass: boolean
  violations: string[]   // 具体问题（可操作），不是综合分数
  evidence: string[]     // 引用的事件作为证据
}
```

**关键设计**：`violations` 是字符串列表，每一条都是"某个具体的失败原因"，而不是 "7/10" 这类综合评分。这直接对应 Harness Guide 的反模式：

> "7/10" 没有用。"函数 `parse_input` 没有处理空字符串" 是有用的。

每个工厂函数返回一个 `EvalGrader`，而不是类实例。这样可以以任意方式组合：

```typescript
// 用法示例
const graders = [
  makeTerminalReasonGrader('completed'),
  makeToolCallGrader('write_file', { called: true, isError: false }),
  makeFilesystemGrader([{ relativePath: 'output.txt', exists: true }]),
  SecurityGrader,
]
```

`SecurityGrader` 是单例（无参数），其余通过工厂函数参数化。

**与 lingxi OTelObserver 的对应**：lingxi 的 `OnLLMEnd` 记录的 `ToolNames`、`FinishReason`、`InputTokens` 等字段——我们的 grader 断言的是同等信息，只是来源是 agentLoop yield 的事件流而非 OTel span。两者本质都是"在生命周期结束点拿到证据，由独立模块判定"。

---

## 六、Eval Suite 与 Unit Test 的隔离机制

```
npm run test        → vitest run                      # 只扫 __tests__/unit/**/*.test.ts
npm run eval:run    → vitest run --config vitest.eval.config.ts  # 只扫 evals/eval.test.ts
```

**为什么不共用 vitest 配置**：

1. 超时不同：单元测试<2s，eval 场景最多 30s
2. 运行频率不同：单元测试每次提交，eval 手动或发版前
3. 失败语义不同：单元测试失败 = 代码 bug，eval 失败 = Agent 行为问题
4. token 消耗：真实 LLM eval 会消耗 API token，不能混进自动 CI

`evals/eval.test.ts` 是 vitest 的包装层，`evals/runner.ts` 是真正的 runner——两层分离使 runner 理论上可以被其他测试框架（或直接 Node.js 执行）调用。

---

## 七、F08 的实现策略：消息捕获

F08 场景（压缩后任务说明保留）需要断言 agentLoop 内部的 `state.messages[0].content`——这是 loop 内部状态，外部无法直接访问。

**解决方案**：让 `_streamChatOverride` 的实现在被调用时记录传入的 messages：

```typescript
// evals/scenarios/f08.ts
const capturedCalls: { messages: ChatMessage[] }[] = []

function createCapturingMock(turns: MockTurn[]) {
  const mock = createMockStreamChat(turns)
  return async function* capturingMock(options: StreamChatOptions) {
    // 记录每次 LLM 调用时的 messages
    capturedCalls.push({ messages: [...options.messages] })
    yield* mock(options)
  }
}
```

`buildOptions` 返回值中直接包含 `_streamChatOverride: createCapturingMock(turns)`，grader 通过闭包访问 `capturedCalls`。

这是对 lingxi `OnLLMStart(ctx, info, messages)` 钩子的等效实现——`OnLLMStart` 就是在 LLM 调用前拿到完整 messages 的机会，我们的"注入时记录"做的是同一件事。

---

## 八、我们没有（暂缓）的部分

**基线对比和回归检测**：lingxi 的 eval 脚本对 Jaeger trace 做了 baseline diff（耗时 > 1.5x 报警）。我们 v1 只做绝对断言，没有历史 baseline。需要引入版本化 baseline 后补。

**LLM-as-Judge Grader**：B 类主观评分（人格一致性、记忆自然度）需要 `ModelBasedGrader`，目前只有 `CodeBasedGrader`。接口已预留（`EvalGrader` 是通用接口），等 v2 补实现。

**pass^k 采样**：当前每个场景 k=1。对真实 LLM 场景，需要多次运行并统计 pass 率。runner.ts 的 `runSuite` 参数已预留空间，需要扩展为 `k` 次循环 + 聚合报告。

**Eval 专属 Agent 版本快照**：CC 把 eval 结果和 Agent 版本绑定（capability eval 在 saturation 后变 regression eval）。我们还没有版本管理 eval baseline 的机制。
