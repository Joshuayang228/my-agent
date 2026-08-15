# M11 Hook / 扩展点 — 代码走读

> 对照 [`m11-hook-extension-architecture.md`](m11-hook-extension-architecture.md)。
> 本轮**没有**新建 `hooks/` 模块——按方法论刻意不做用户 Hook。
> 本章展示：三层在现有代码里分别落在哪；CC / feiche 对照什么；我们缺什么是产品选择而非遗漏。

---

## §二 三层模型 — 在仓库里的落点

| 层 | 我们的代码 | 路径 |
|----|-----------|------|
| 观测面 | `startSpan` / Logger | `electron/main/utils/tracer.ts`、`electron/main/utils/logger.ts` |
| 控制面 | `checkToolPermission`、`confirmTool`、`filterTools`、`ToolMiddlewarePipeline` | `electron/main/sandbox/permission-engine.ts`、`electron/main/agent/loop.ts`、`electron/main/agent/runtime.ts`、`electron/main/tools/middleware.ts` |
| 通知面 | `AgentStreamEvent` yield → IPC | `electron/main/agent/loop.ts`、`electron/main/ipc/chat.ts`、`src/App.tsx` |

---

## §三 控制面：ToolMiddleware（执行横切）

### 我们的实现

```typescript
// electron/main/tools/middleware.ts

/**
 * ① 中间件签名：拿到 ctx，决定是否调用 next
 * ② 可修改 args / 结果；可不调 next（短路）——这是控制面能力
 * ③ 与「用户 Hook」不同：当前仅内置链，无 settings 注册
 * → m11 §三、§七
 */
export type ToolMiddleware = (
  ctx: ToolExecutionContext,
  next: ToolMiddlewareNext,
) => Promise<ToolResult>

export class ToolMiddlewarePipeline {
  private middlewares: { name: string; fn: ToolMiddleware }[] = []

  use(name: string, middleware: ToolMiddleware): void {
    // ↑ API 已暴露，生产路径尚无第三方调用方（→ 实战记录「暂缓」）
    this.middlewares.push({ name, fn: middleware })
  }

  build(executor: ToolMiddlewareNext): ToolMiddlewareNext {
    let chain = executor
    // ① 从尾到头包裹 → 洋葱模型：先注册的在外层
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const mw = this.middlewares[i]
      const next = chain
      chain = (ctx) => mw.fn(ctx, next)
    }
    return chain
  }
}

/** 错误隔离：工具/内层中间件抛错 → 变成 isError 结果，不炸 Loop */
export const errorFormattingMiddleware: ToolMiddleware = async (ctx, next) => {
  try {
    return await next(ctx)
  } catch (err) {
    // ↑ 对应 m11 §四：失败默认可继续（对 Loop 而言）
    return {
      toolCallId: ctx.call.id,
      content: `[Tool Error] ${err instanceof Error ? err.message : String(err)}`,
      isError: true,
    }
  }
}
```

① **控制面**：能短路、能改结果。  
② **不是用户 Hook**：没有 JSON/脚本注册。  
③ **错误隔离**已有雏形（error-formatting）。

### CC 的对照（PreToolUse，概念层）

CC 在工具执行前跑声明式 hooks，可 `permissionDecision` / `updatedInput` / exit 2 阻断。  
**发现**：能力上 Middleware ⊂ CC PreToolUse；产品上我们把「用户可配」砍掉，只保留框架内置横切。  
**方法论对照** → m11 §八、§九。

### feiche 的对照

feiche **没有**对等的 ToolMiddleware；工具前后是 Observer 的 `OnToolStart/End`（纯观测）。  
**发现**：feiche 把「打点」和「拦工具」拆开——我们 Middleware 偏控制，Tracer 偏观测，方向一致。  
**方法论对照** → m11 §二。

---

## §三 控制面：权限闸门 + 工具可见集

```typescript
// electron/main/agent/loop.ts（节选逻辑顺序）

// ① 每轮 LLM 前：filterTools 裁剪可见集（Skill allowed_tools）
const effectiveTools = filterTools ? filterTools(tools) : tools

// ② 拿到 tool_calls 后：工具级权限
const permResult = checkToolPermission(call.name)
// ↑ allowed === false → 不执行，写拒绝结果（控制面显式阻断）

// ③ 需要确认时：confirmTool 回调（IPC 等用户）——控制旁路，不是 Event 消费者「自己变成 Hook」
if (needsConfirm) {
  const blockedSpan = startSpan(/* tool_blocked */, ...) // ④ 观测面：用户等待单独计时
  const ok = await confirmTool(...)
  if (!ok) { /* Deny-and-Continue 结构化结果 */ }
}

// ⑤ 通过后才进 Middleware → tool.execute
```

**发现**：控制决策发生在 Middleware **之前**；Middleware 改不了「是否该问用户」。这是分层正确性，不是缺陷。  
**方法论对照** → m11 §二链路图、§六。

---

## §二 观测面：Tracer 不得否决

```typescript
// electron/main/utils/tracer.ts

/**
 * startSpan 只记录，不返回「是否允许继续」
 * → m11 §二、§九.2：观测面禁止否决权
 */
export function startSpan(
  name: string,
  caller: SpanCaller,
  type: SpanType,
  parentId?: string,
  attributes?: Record<string, unknown>,
): SpanHandle {
  // ...写入环形缓冲，供 DevPanel / debug IPC 查询
  return { end(status, error?) { /* 只收尾 */ } }
}
```

### feiche Observer（对照）

```text
OnAgentRunStart/End · OnTurnStart/End · OnToolStart/End · OnLLMStart/End
Start → context；End → void；无 decision 返回值
```

**发现**：我们用 SpanType + parentId 表达嵌套；feiche 用 context 链式传递。语义同属观测面。  
**方法论对照** → m11 §二；细读见 `m14-observability-code.md`。

---

## §三 通知面：AgentStreamEvent

```typescript
// src/shared/types.ts（概念）
type AgentStreamEvent =
  | { type: 'text'; ... }
  | { type: 'tool_start' | 'tool_end' | 'tool_confirm'; ... }
  | { type: 'error'; code?: string; ... }
  | { type: 'done'; reason?: string; ... }
  // ...

// loop 内：yield 事件 —— 不决定「能不能跑工具」
// runtime / App：订阅后落盘、画 UI、Toast
```

**发现**：`tool_confirm` 事件只是**通知 UI 弹窗**；真正阻断靠 `confirmTool` 返回值。事件本身仍是通知面。  
**方法论对照** → m11 §三「半事件半 Hook」易混点：看返回通道，不看事件名。

---

## §六 不能越过权限 — 现状与缺口

```typescript
// electron/main/sandbox/permission-engine.ts
export function checkToolPermission(toolName: string): PermissionCheckResult { /* ... */ }
export function checkCommandPermission(command: string): PermissionCheckResult { /* 五层链 */ }
```

| 路径 | 现状 |
|------|------|
| Loop → `checkToolPermission` | ✅ 接入 |
| `shell-exec` → 自管 `guardCommand` | ⚠️ 未统一走 `checkCommandPermission`（M10 债，非本轮） |
| `loadRules` | ⚠️ 无生产加载 |

**发现**：分层方法论要求「扩展不越权」；命令路径尚未完全收到引擎——这是**安全债**，不是「缺用户 Hook」。  
**方法论对照** → m11 实战记录「暂缓 / 另案」。

---

## §八 用户扩展通道（非 Hook）— 代码落点

| 通道 | 入口 |
|------|------|
| Skill | `electron/main/skills/` + `runtime.ts` 里 `filterTools` |
| MCP | `electron/main/mcp/` 动态注册进 ToolRegistry |
| 人格 | `electron/main/agent/prompt-builder.ts` |
| 审批/沙箱 | settings → `ExecutionMode` / `SandboxPolicy` |

**发现**：用户扩展早已有主通道；再做 lifecycle Hook 会叠床架屋。  
**方法论对照** → m11 §八。

---

## §九 刻意不做 — 仓库里「找不到」才是正确状态

| 不应存在 | 验证 |
|----------|------|
| `settings.hooks.PreToolUse` | 设置 Schema 无此字段 |
| `electron/main/hooks/` 用户脚本执行器 | 目录不存在 |
| Observer 返回 deny | `startSpan` 无决策返回值 |

**发现**：缺失即设计。Code 章不把「抄 CC executeHooks」列为 TODO。

---

## 字段 / 结构对比（控制信号）

| 能力 | CC Hook | feiche Observer | 我们 |
|------|---------|-----------------|------|
| 工具前拦截 | PreToolUse + JSON/exit2 | — | permission + confirmTool |
| 工具后处理 | PostToolUse | OnToolEnd（观测） | Middleware + tool_end 事件 |
| 改工具入参 | `updatedInput` | — | 暂无通用层（可按需加内部 API） |
| 注入上下文 | `additionalContext` | — | PromptBuilder / 记忆注入（非 Hook） |
| 用户脚本注册 | settings.json | — | **刻意不做** |
| 观测 | 旁路 hookEvents | Observer 接口 | Tracer |

**发现**：我们用「权限引擎 + Middleware + 事件」拆开了 CC 揉在 hooks 里的能力；观测对齐 feiche「不可拦截」。差异是产品定位，不是实现落后。  
**方法论对照** → m11 §一、§九。

## 2026-08 当前实现校准

仓库没有 `electron/main/hooks/`，这是刻意的架构边界，不是漏实现。当前扩展分层是：

- Observer / Tracer：只观测，不改变业务决策；
- Permission / Middleware：在工具执行前后做控制与验证；
- `AgentStreamEvent` / IPC：把运行证据通知 Renderer；
- Skill / MCP / Role Pack / Settings：面向用户的扩展通道。

`shell-exec.ts`、文件工具和 `debug-tool-run.ts` 已统一走权限/沙箱链；`loadRules` 在主进程启动和设置变更时加载。当前没有用户可编程的生命周期 Hook API，因此不要把 Observer 或 Middleware 写成可由外部任意注册的 Hook 系统。
