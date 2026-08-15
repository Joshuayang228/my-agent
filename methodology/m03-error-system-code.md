# M03 错误体系设计 — 代码走读

> 对照 `m03-error-system.md` 的各章节，展示 feiche 和我们的真实实现。
>
> feiche 参考：`_reference/feiche/feiche/feiche-agents/errs/` （Go 实现）
> 我们的实现：`electron/main/errs/index.ts` + `electron/main/agent/loop.ts` + `src/App.tsx`

---

## §2 对照：错误码的子系统分层

### feiche 的实现（errs/error.go）

```go
// feiche: errs/error.go（Go 版本，结构类似）

// ① const iota = Go 的自增枚举，每个 Code 是一个整数
//    但 feiche 用了字符串 Code，更语义化
type ErrorCode string

const (
  // 工具类错误
  ToolNameNotFound    ErrorCode = "ToolNameNotFound"    // ↑ 工具不存在
  MaxGenerationExceeded ErrorCode = "MaxGenerationExceeded" // ↑ 超过生成限制
  ContentEmpty        ErrorCode = "ContentEmpty"        // ↑ 内容为空

  // LLM 类错误
  GateWayLimitError   ErrorCode = "GateWayLimitError"   // ↑ 限流（可重试）
  // ...
)
```

### 我们的实现

```typescript
// electron/main/errs/index.ts L24-44

// ① enum = TypeScript 的枚举，每个值是字符串常量
//    用 SCREAMING_SNAKE 命名：全大写 + 下划线分隔
export enum AgentErrorCode {

  // ── 配置类（CONFIG_前缀） ──
  CONFIG_MISSING_API_KEY = 'CONFIG_MISSING_API_KEY',
  // ↑ runtime.ts 里：调用 chat 时发现没有 API Key

  // ── 会话类（SESSION_前缀） ──
  SESSION_BUSY = 'SESSION_BUSY',
  // ↑ runtime.ts 里：收到新请求但上一个还在跑
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  // ↑ runtime.ts 里：token 预算超限

  // ── 上下文类（CONTEXT_前缀） ──
  CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',
  // ↑ loop.ts 里：413 压缩后仍超限
  MAX_TURNS_REACHED = 'MAX_TURNS_REACHED',
  // ↑ loop.ts 里：while 循环达到最大迭代次数
  ABORTED = 'ABORTED',
  // ↑ loop.ts 里：AbortSignal 触发取消

  // ── LLM 类（LLM_前缀） ──
  LLM_RATE_LIMITED = 'LLM_RATE_LIMITED',
  // ↑ loop.ts 里：429 限流（retryable=true）
  LLM_REQUEST_FAILED = 'LLM_REQUEST_FAILED',
  // ↑ loop.ts 里：其他 LLM 调用失败（retryable=true）

  // ── 工具类（TOOL_前缀） ──
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  // ↑ tools 层：工具执行抛错（retryable=false）
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  // ↑ tools 层：工具执行超时（retryable=true）

  // ── 权限类（PERMISSION_前缀） ──
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  // ↑ sandbox 层：权限检查拒绝（retryable=false）

  // ── 兜底 ──
  UNKNOWN = 'UNKNOWN',
  // ↑ toAgentError 里：无法识别的错误类型
}
```

**发现**：feiche 用 Go 的常量字符串，我们用 TypeScript enum——两者语义完全一致，都是"字符串枚举"。关键设计一致的地方是**前缀按子系统分组**，而不是按严重程度。feiche 的 `ToolNameNotFound`、`GateWayLimitError` 等也是按来源命名。

**方法论对照**：→ `m03-error-system.md` §2（错误码的子系统分层）

---

## §3 对照：retryable 元数据表

### feiche 的实现（retrier.go）

```go
// feiche: retrier.go（重试白名单）

// ① feiche 不在错误本身存 retryable，而是在 retrier 里维护可重试的错误码白名单
var retryableErrorCodes = map[ErrorCode]bool{
  GateWayLimitError:   true,  // ↑ 限流：等一等再试
  RateLimitedError:    true,  // ↑ 另一种限流形式
  EmptyToolCalls:      true,  // ↑ 模型返回空工具调用（豆包等模型的已知问题）
  // 其余默认 false，不重试
}
```

### 我们的实现

```typescript
// electron/main/errs/index.ts L46-65

// ① interface CodeMeta = 每个错误码的元数据对象
interface CodeMeta {
  retryable: boolean  // ↑ 是否值得自动重试
}

// ② CODE_META = 错误码 → 元数据的映射表
//    Record<Key, Value> = 所有 Key 都有 Value 类型的值
const CODE_META: Record<AgentErrorCode, CodeMeta> = {
  [AgentErrorCode.CONFIG_MISSING_API_KEY]: { retryable: false },
  // ↑ [] 是计算属性名，用枚举值作为 key
  [AgentErrorCode.SESSION_BUSY]:          { retryable: false },
  [AgentErrorCode.BUDGET_EXCEEDED]:       { retryable: false },
  [AgentErrorCode.CONTEXT_TOO_LONG]:      { retryable: false },
  [AgentErrorCode.MAX_TURNS_REACHED]:     { retryable: false },
  [AgentErrorCode.ABORTED]:               { retryable: false },
  [AgentErrorCode.LLM_RATE_LIMITED]:      { retryable: true },  // ③ 限流，等一等可以重试
  [AgentErrorCode.LLM_REQUEST_FAILED]:    { retryable: true },  // ③ 网络抖动，可以重试
  [AgentErrorCode.TOOL_EXECUTION_FAILED]: { retryable: false }, // ④ 工具逻辑错，重试无效
  [AgentErrorCode.TOOL_TIMEOUT]:          { retryable: true },  // ③ 偶发超时，可以重试
  [AgentErrorCode.PERMISSION_DENIED]:     { retryable: false }, // ④ 用户明确拒绝，不重试
  [AgentErrorCode.UNKNOWN]:               { retryable: false },
}
```

**差异**：feiche 把可重试逻辑放在 retrier.go（调用侧），我们把它放在错误码元数据里（定义侧）。我们的方式让"这个错误可以重试"的知识和错误本身绑在一起，不需要在多处同步。feiche 的方式更灵活（不同 retrier 可以有不同策略），但需要保持两个地方同步。

**方法论对照**：→ `m03-error-system.md` §3（retryable：决定 loop 行为的关键字段）

---

## §4 对照：AgentError — cause 链与诊断/展示分离

### 我们的实现

```typescript
// electron/main/errs/index.ts L73-120

export class AgentError extends Error {
  readonly code: AgentErrorCode   // ↑ 错误码，决策依据
  readonly cause?: unknown        // ↑ 原始错误（保留因果链，不丢失底层堆栈）
  readonly retryable: boolean     // ↑ 从 CODE_META 推导，也可显式覆盖

  constructor(
    code: AgentErrorCode,
    message: string,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(message)  // ① 调用父类 Error 的构造器，设置 this.message
    this.name = 'AgentError'  // ② 覆盖默认的 'Error' 名称，便于日志识别
    this.code = code
    this.cause = options?.cause       // ③ ?.（可选链）：options 存在才访问 .cause
    // ④ ?? = nullish 合并：左边是 null/undefined 才取右边
    //    优先用显式传入的 retryable，否则从 CODE_META 查
    this.retryable = options?.retryable ?? CODE_META[code].retryable
  }

  // ⑤ 诊断用：展开完整因果链（只给内部日志看，不给前端）
  chain(): string {
    const parts: string[] = [`[${this.code}] ${this.message}`]
    let cur: unknown = this.cause
    let depth = 0
    while (cur && depth < 10) {   // ⑥ 最多10层防循环引用
      if (cur instanceof Error) {
        parts.push(`  ↳ ${cur.name}: ${cur.message}`)
        cur = (cur as { cause?: unknown }).cause  // ⑦ 沿 cause 链继续向下
      } else {
        parts.push(`  ↳ ${String(cur)}`)
        cur = undefined
      }
      depth++
    }
    return parts.join('\n')
    // 输出示例：
    // [LLM_REQUEST_FAILED] Service unavailable
    //   ↳ LLMError: 503 Service Unavailable
    //       ↳ TypeError: Failed to fetch
  }

  // ⑧ 展示用：脱敏后的 message + code（给前端看）
  toEventPayload(): { message: string; code: AgentErrorCode } {
    return {
      message: sanitizeError(this.message),  // ⑨ sanitizeError 过滤掉路径/堆栈/SQL
      code: this.code,
    }
  }
}
```

**发现**：feiche 的 `errs.Error` 同样有 `Code + Message + InnerErr（cause）` 三字段，结构完全一致。关键差异：feiche 的 Error 实现了 `EventType() string` 接口，错误可以直接作为 AGUI 事件推给前端——我们用 `toEventPayload()` 达到同样效果，只是不让错误对象直接实现事件接口（避免主进程/渲染进程类型混用）。

**方法论对照**：→ `m03-error-system.md` §4（cause 链：诊断与展示的分离）

---

## §5 对照：toAgentError — 任意错误归一化

### 我们的实现

```typescript
// electron/main/errs/index.ts L130-145

export function toAgentError(err: unknown): AgentError {
  // ① 已经是 AgentError，原样返回（幂等）
  if (err instanceof AgentError) return err

  // ② LLMError duck-typing：有 status 字段的 Error 视为 LLM 错误
  //    不直接 import LLMError 类型，避免循环依赖（errs → llm → errs）
  if (err instanceof Error && typeof (err as { status?: unknown }).status === 'number') {
    const status = (err as { status: number }).status
    // ③ 429 = HTTP Too Many Requests = 限流，其他 LLM 错误统一为 REQUEST_FAILED
    const code = status === 429
      ? AgentErrorCode.LLM_RATE_LIMITED
      : AgentErrorCode.LLM_REQUEST_FAILED
    return new AgentError(code, err.message, { cause: err })
    // ↑ cause: err 保留原始 LLMError，chain() 里能看到
  }

  // ④ 普通 Error：包成 UNKNOWN，原始错误保留在 cause
  if (err instanceof Error) {
    return new AgentError(AgentErrorCode.UNKNOWN, err.message, { cause: err })
  }

  // ⑤ 非 Error（字符串、对象等）：转成字符串，没有 cause
  return new AgentError(AgentErrorCode.UNKNOWN, String(err))
}
```

**duck-typing 的原因**：

```
依赖链：
  errs/ (底层) ← loop/ ← llm/
  
如果 errs/ 直接 import llm/LLMError：
  errs/ → llm/ → (llm 依赖 errs/) → 循环！
  
duck-typing 解法：
  errs/ 不 import 任何人，只检查 .status 字段是否存在
  → errs/ 永远是依赖链的最底端
```

**方法论对照**：→ `m03-error-system.md` §5（toAgentError：任意错误归一化）

---

## §6 对照：错误事件如何到达 UI

### loop.ts 中的错误 yield（关键路径）

```typescript
// loop.ts L410-414（LLM 不可恢复错误的处理路径）

} catch (err) {
  const agentErr = toAgentError(err)   // ① 任意错误归一化为 AgentError
  log.error('LLM call failed', { error: agentErr.chain() })
  // ↑ chain() 只给日志（内部诊断），前端不可见

  yield { type: 'error', ...agentErr.toEventPayload() }
  // ② toEventPayload() = { message: 脱敏后的message, code: AgentErrorCode }
  //    ...（展开运算符）把两个字段平铺进 error 事件对象
  //    前端收到：{ type: 'error', message: '...', code: 'LLM_REQUEST_FAILED' }

  yield { type: 'done', reason: 'model_error' }
  // ③ error 事件之后必须 yield done，通知消费方流结束
  return
}
```

### IPC 传输中的类型处理

```typescript
// 主进程 → 渲染进程的 IPC 通道（electron/main/ipc/chat.ts 简化版）

// ④ AgentStreamEvent 通过 IPC 序列化（JSON）发给渲染进程
//    code 字段是字符串（不是枚举对象），渲染进程按字符串判断

// 渲染进程收到的 error 事件形状：
// { type: 'error', message: '请求暂时失败', code: 'LLM_RATE_LIMITED' }
//   ↑ message 已脱敏                      ↑ code 是字符串，不是枚举
```

**方法论对照**：→ `m03-error-system.md` §6（错误直达 UI：从 AgentError 到 AgentStreamEvent）

---

## §7 对照：前端按码分派 UI 行为

### App.tsx 的 handleEvent

```typescript
// src/App.tsx L396-409（error 事件处理）

case 'error':
  // ① 把错误消息展示在聊天流里（作为 assistant 消息）
  setMessages((prev) => {
    const last = prev[prev.length - 1]
    // ② 如果最后一条 assistant 消息还是空的（正在流式），就替换它
    if (last?.role === 'assistant' && !last.content) {
      return [...prev.slice(0, -1), { ...last, content: `⚠️ ${ev.message}` }]
    }
    // ③ 否则新建一条消息
    return [...prev, { id: genId(), role: 'assistant', content: `⚠️ ${ev.message}`, timestamp: Date.now() }]
  })

  // ④ 按 code 分派不同的 UI 提示（这是按码分派的核心逻辑）
  if (ev.code === 'PERMISSION_DENIED') {
    // ↑ 权限拒绝：提示用户可以切换审批模式或让 Agent 找替代方案
    setModeChangeNotice('操作被权限策略拒绝。可以在输入区切换审批模式，或让 Agent 尝试更安全的替代方案。')
  } else if (ev.code === 'LLM_RATE_LIMITED' || ev.code === 'LLM_REQUEST_FAILED' || ev.code === 'TOOL_TIMEOUT') {
    // ↑ 可重试错误：提示可以稍后重试（不是用户造成的，语气不同）
    setModeChangeNotice('请求暂时失败，可以稍后重试。')
  }
  // ⑤ CONFIG_MISSING_API_KEY、CONTEXT_TOO_LONG、BUDGET_EXCEEDED 等目前没有独立 UI 分支，错误消息仍会展示

  setIsStreaming(false)  // ⑥ 无论什么错误，都结束流式状态
  break
```

**发现**：当前只区分了两类错误的 UI 行为，其他码（CONTEXT_TOO_LONG、BUDGET_EXCEEDED 等）都走默认展示。这是有意识的简化——随着产品迭代，每种码可以有更精确的 UI 响应（比如 CONTEXT_TOO_LONG 可以增加“新开对话”按钮，CONFIG_MISSING_API_KEY 可以增加显式打开设置入口）。

**方法论对照**：→ `m03-error-system.md` §7（错误码驱动 UI 差异行为）

---

## 关键设计对比

| 设计维度 | feiche（Go） | 我们（TypeScript） | 差异说明 |
|---|---|---|---|
| 错误码类型 | `type ErrorCode string` + const 块 | `enum AgentErrorCode` | 语法不同，语义相同 |
| retryable 位置 | retrier.go 里的白名单 map | CODE_META 表里的元数据 | 我们把知识放在定义侧 |
| cause 链 | InnerErr 字段 + Unwrap() | cause 字段 + chain() | Go 标准接口 vs 我们的 chain 方法 |
| 错误直达 UI | Error 实现 EventType() 接口 | toEventPayload() 方法 | feiche 更优雅，我们避免跨进程类型混用 |
| LLMError 识别 | 直接类型断言（同语言无循环依赖） | duck-typing（避免循环 import） | 语言差异导致的设计差异 |
