# M03 错误体系设计

> **所属**：Part I 核心运行时
> **参考源**：`electron/main/errs/index.ts` · CC sourcemap errors/ · feiche retrier.go

---

## 一、第一性原理

**错误不是终点，是决策节点——错误码决定系统下一步行为，而不只是记录失败。**

传统系统里，错误通常是这样处理的：catch → log → 显示"出错了"。这在单次请求的 HTTP 接口里够用，但在 Agent 系统里远远不够。

Agent 循环遇到错误时，需要回答几个问题：
- 这个错误可以重试吗？（LLM 限流可以重试，API Key 不对不可以）
- 重试应该等多久？（限流需要退避，工具超时可以立即重试）
- 告诉用户什么？（脱敏后的友好信息，不是堆栈）
- UI 应该如何响应？（重试按钮？切换模型提示？人格化道歉？）
- Agent 还能继续吗？（权限拒绝可以找替代方案，上下文超限只能停）

这些问题的答案不能靠"分析错误消息字符串"来判断——字符串是脆的，一换模型提供商就失效。答案必须来自结构化的**错误码**，作为 Agent 行为决策的依据。

推论地图：

```
根认知：错误码是决策依据，不是日志标签
    │
    ├─ ① 码如何分组才有意义？    → 按子系统分层（§2）
    ├─ ② 什么决定"能否重试"？    → retryable 元数据（§3）
    ├─ ③ 怎么保留排查信息？      → cause 链（§4）
    ├─ ④ 怎么统一任意错误来源？  → toAgentError 归一化（§5）
    ├─ ⑤ 错误如何到达 UI？       → toEventPayload + 事件流（§6）
    ├─ ⑥ 不同码如何驱动 UI？     → 按码分派行为（§7）
    └─ ⑦ 拒绝熔断怎么接入体系？  → too_many_denials 是特殊的终止码（§8）
```

---

## 二、错误码的子系统分层

`AgentErrorCode` 用前缀按**来源子系统**分组，而不是按严重程度（fatal/warning/info）分组。

```
CONFIG_    配置类：API Key 缺失、配置非法
SESSION_   会话类：会话繁忙、预算超限
CONTEXT_   上下文类：超出限制、超过轮次、用户取消
LLM_       模型层：限流、调用失败
TOOL_      工具层：执行抛错、超时
PERMISSION_ 权限层：操作被拒绝
UNKNOWN    兜底
```

**为什么按来源分组，不按严重程度？**

严重程度是主观的，而且会随上下文变化——工具超时（TOOL_TIMEOUT）在第一轮是可重试的，在第10次重试后就是 fatal。而来源是客观的：这个错误从哪里来，就映射到对应的子系统前缀。

子系统前缀还带来了一个副产品：你看一眼码就知道去哪里找这个错误的来源，不需要全局搜索。`LLM_RATE_LIMITED` 一定在 LLM 适配层抛出，`TOOL_TIMEOUT` 一定在工具执行层。

---

## 三、retryable：决定 loop 行为的关键字段

`retryable` 字段是错误码元数据里最重要的一个，直接决定 agentLoop 是否尝试重试当前操作。

判定标准：**错误原因是否可能随时间自行消失，且重试不会造成更大伤害。**

| 可重试 ✅ | 不可重试 ❌ |
|---|---|
| `LLM_RATE_LIMITED`（限流，等一等就好） | `CONFIG_MISSING_API_KEY`（重试没用，还是没有 key） |
| `LLM_REQUEST_FAILED`（网络抖动） | `PERMISSION_DENIED`（用户明确拒绝，重试是打扰） |
| `TOOL_TIMEOUT`（偶发超时） | `CONTEXT_TOO_LONG`（上下文超限，重试还是超限） |
| | `TOOL_EXECUTION_FAILED`（工具逻辑错误，重试不会修复） |

`retryable` 是 `AgentError` 的构造参数可以显式覆盖，但默认值从 `CODE_META` 表里查——这确保了"相同错误码、不同场景"可以有不同的重试策略，同时有合理的默认。

**retryable 和重试策略是两件事**：`retryable: true` 只表示"值得重试"，具体退避时间（1s / 2s / 4s）、最大重试次数（`MAX_LLM_RETRIES=2`）是另一层策略，在 agentLoop 的重试逻辑里控制。

---

## 四、cause 链：诊断与展示的分离

`AgentError` 保留 `cause` 字段，可以一路向上传递原始错误：

```
AgentError (LLM_REQUEST_FAILED)
  ↳ LLMError: 503 Service Unavailable
      ↳ TypeError: Failed to fetch
```

这条因果链服务于两个完全不同的目的，必须分开处理：

**诊断（仅内部）**：`chain()` 方法展开完整因果链，每一层的错误类型和原始消息都保留，送到内部日志。开发者排查"为什么失败"时能看到完整路径。

**展示（给用户）**：`toEventPayload()` 只返回脱敏后的 `message` 和 `code`。不暴露堆栈、内部路径、SQL 语句、API endpoint。用户看到的是"请求暂时失败，可以稍后重试"，不是 `TypeError: Failed to fetch at ...`。

这个分离不是可选的，是安全要求：内部路径泄露给前端，等于把系统结构暴露给可能的攻击者。

**10 层深度限制**：`chain()` 最多遍历10 层 cause，防止循环引用导致的无限遍历。实践中从没见过超过 3 层的因果链，10 层是保守兜底。

---

## 五、toAgentError：任意错误归一化

Agent 系统里抛出的错误来自各处：LLM 适配层、工具执行、IPC 处理、数据库……它们各自有不同的错误类型。

`toAgentError` 是一个归一化函数，把任意 `unknown` 错误转成 `AgentError`，让 agentLoop 只需要处理一种错误类型：

```typescript
// LLMError duck-typing：有 status 字段的 Error 视为 LLM 错误
if (err instanceof Error && typeof (err as { status? }).status === 'number') {
  const code = status === 429 ? LLM_RATE_LIMITED : LLM_REQUEST_FAILED
  return new AgentError(code, err.message, { cause: err })
}
```

**duck-typing 识别 LLMError** 是一个有意思的设计决策：我们没有让 `errs/` 模块直接 import `llm/` 里的 `LLMError` 类型，而是通过"有没有 `status` 数字字段"来识别。原因是避免循环 import——`errs/` 是最底层的模块，不应该依赖上层模块。

这个模式来自 feiche 的 `errs/` 设计：错误体系模块应该是依赖链的最底端，其他所有模块都可以 import 它，但它不 import 任何人。

---

## 六、错误直达 UI：从 AgentError 到 AgentStreamEvent

错误不只是要被 catch 和 log，它需要告诉前端发生了什么。

传播路径：

```
agentLoop catch AgentError
    → yield { type: 'error', message, code }   ← toEventPayload() 的输出
    → yield { type: 'done', reason: 'model_error' | ... }
    → IPC 转发给渲染进程
    → handleEvent(ev) 按 ev.type === 'error' 处理
```

`code` 字段通过 IPC 到达前端时，类型是 `string`（渲染进程不依赖主进程的枚举）。前端按字符串值分派，而不是按枚举比较——这让主进程可以自由扩展错误码，不需要同步更新渲染进程的类型定义。

**错误事件是一个"通知"，不是"终止"**：yield `error` 事件之后，agentLoop 还会 yield `done` 事件。消费方收到 `error` 知道出了什么问题，收到 `done` 知道流结束了。两个事件职责不同，不合并。

---

## 七、错误码驱动 UI 差异行为

有了结构化错误码，前端可以按码而不是按错误消息文本做不同的 UI 响应：

| 错误码 | UI 响应 |
|---|---|
| `LLM_RATE_LIMITED` | "请求暂时失败，可以稍后重试" + 重试提示 |
| `LLM_REQUEST_FAILED` | "请求暂时失败，可以稍后重试" + 重试提示 |
| `TOOL_TIMEOUT` | "工具执行超时，可以重试" |
| `PERMISSION_DENIED` | "操作被权限策略拒绝，可调整审批模式或让 Agent 找替代方案" |
| `CONFIG_MISSING_API_KEY` | 跳转设置页 |
| `CONTEXT_TOO_LONG` | "当前对话已达上下文限制" + 建议新开对话 |

这些差异在 `App.tsx` 的 `handleEvent` 里实现，通过 `ev.code` 分派——不是正则匹配消息文本，而是精确的码匹配。

**为什么这比匹配消息文本好**：消息文本会变（模型升级、错误描述改写），但错误码是我们自己控制的稳定契约。前端按码分派，对上游的消息格式变化完全绝缘。

---

## 八、与熔断的关系：too_many_denials 是特殊的终止码

`TerminalReason` 里有一个 `too_many_denials`——它不对应任何 `AgentErrorCode`，但在概念上处于同一个体系里：都是"系统决定终止，并说明原因"。

它们的区别：`AgentError` 是"发生了一个错误"，`TerminalReason` 是"Loop 决定以某个原因结束"。`too_many_denials` 不是错误——权限被拒绝是系统正常工作，只是达到了设计的熔断阈值。

**联动逻辑**：
- 每次 `PERMISSION_DENIED` 事件 → `consecutiveDenials++` / `totalDenials++`
- 连续 `MAX_CONSECUTIVE_DENIALS` 次 → 降级执行模式（yield `execution_mode_changed`）
- 连续 `MAX_CONSECUTIVE_DENIALS + 1` 次或累计 `MAX_TOTAL_DENIALS` 次 → yield `error (PERMISSION_DENIED)` + `done (too_many_denials)`

这个设计把"单次拒绝"（工具级错误）和"反复拒绝导致终止"（Loop 级决策）分成了两个层次，而不是混在同一个错误类型里。

---

## 九、暂缓：联动人格引擎

最有潜力但尚未实现的方向：**错误码驱动人格化话术**。

feiche 的权限拒绝话术模板是这样的：

> "请以「您拒绝了…操作」开头回复用户，用温和的语气解释发生了什么，并提供替代方案。"

这个话术是硬编码在 system prompt 里的。更好的设计是：根据 `AgentErrorCode`，动态选择对应的话术模板，注入 system prompt。

- `PERMISSION_DENIED` → 温和解释 + 提供替代方案的语气模板
- `LLM_RATE_LIMITED` → 诚实说明"服务暂时繁忙"的语气模板
- `TOOL_TIMEOUT` → "正在处理，稍慢一些"的语气模板

这是 M21（人格引擎）的工作，不是 M03 的工作。M03 负责定义错误码和它们的语义，M21 负责把错误码映射到具体的语气和话术。两章之间有一个待设计的接口。

---

## 实战记录

### 踩过的坑

**循环 import 陷阱**

第一版实现直接在 `errs/` 里 import 了 `llm/` 里的 `LLMError` 类型，导致 `llm/` → `errs/` 的反向依赖链，引发了循环 import 编译错误。改用 duck-typing 识别 LLMError 后，`errs/` 成为了真正的最底层依赖，任何模块都可以 import 它，不会产生循环。

**`toAgentError` 在多处手动调用**

早期实现里，各个调用方各自判断"是不是 LLMError"，逻辑散落多处。统一收拢到 `toAgentError` 后，LLMError 的识别逻辑只在一处，一旦 LLMError 的结构变了，只改一个函数。

**前端枚举同步问题**

早期渲染进程直接 import 主进程的 `AgentErrorCode` 枚举——这在 Electron 里是一个反模式，渲染进程不应该依赖主进程模块。改为通过 IPC 传递字符串值，渲染进程按字符串做 switch 分派。

### 设计检查清单

- [ ] 新增错误码时：加进 `AgentErrorCode` 枚举 + `CODE_META` 表（设定 retryable）
- [ ] 捕获新的外部错误类型时：在 `toAgentError` 里加 duck-typing 识别，不要让裸错误绕过归一化
- [ ] 向前端 yield `error` 事件时：用 `toEventPayload()` 脱敏，不要直接暴露原始 message
- [ ] 新增用户可见的错误提示时：在 `handleEvent` 里按 `ev.code` 分派，不要 match 消息文本
