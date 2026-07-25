# M8：多 Agent 协作代码走读

> 对照 m08-multi-agent.md 各章节，展示真实代码实现。
> 代码块带逐行中文注释（教学材料，不是生产代码）。

---

## §一：第一性原理的代码体现

第一性原理说"多 Agent = 分而治之"，体现在三处：

1. **独立上下文**（subagent.ts 创建新 messages 数组）
2. **受限工具集**（buildChildRegistry 过滤工具）
3. **结果返回**（runSubAgent 只返回 content，不返回中间过程）

---

## §二：信息积累型 vs 并发执行型 → delegate_task 的 description

→ m08 §二：任务性质决定 Agent 数量

**我们的实现**（delegate-task.ts）：

```typescript
export const delegateTaskTool = buildTool({
  name: 'delegate_task',
  description: `Delegate a task to a specialized sub-agent that runs in an isolated context with its own tool set.

**When to use (Alice Ch.6 判据):**
- **并发执行型任务**：需要并行做多个独立的事（查询多个数据源、分析多个文件）
- **Research + Implementation 拆分**：先让子 Agent 研究收集信息，父 Agent 综合后再启动新子 Agent 实现
- **独立子任务**：任务边界清晰、不需要父 Agent 的上下文

**When NOT to use:**
- **信息积累型任务**：任务需要持续积累上下文才能完成 → 用单 Agent 串行处理更可靠
- **简单单次工具调用**：直接调用工具即可，不需要子 Agent 包装
- **需要多轮对话澄清**：子 Agent 不能问用户问题

**典型场景:**
- "分析 docs/ 下所有 Markdown 文件，提取标题和摘要" → 可并发读取
- "查询五个城市的天气，汇总对比" → 可并发查询
- "研究 src/auth/ 的代码结构，找出所有 API 入口" → 独立研究任务`,
  // ... parameters
})
```

**关键设计**：

- description 不只说"能做什么"，还说"何时该用、何时不该用"
- 把 Alice Ch.6 的判据（信息积累型 vs 并发执行型）直接写进工具描述
- 给出典型场景，让 LLM 能对号入座

**方法论对照**：

- → m08 §二：这段 description 就是把判据表格转成 LLM 能理解的自然语言
- Alice Ch.6 原文是给人读的，我们的 description 是给 LLM 读的，但核心判据一致

---

## §三：三种协作模式 → 我们只实现了父子模式

→ m08 §三：父子/Coordinator/Swarm，我们只做父子

**父子模式的实现**（subagent.ts）：

```typescript
/**
 * 执行子 Agent — 独立上下文 + 受限工具集。
 */
export async function runSubAgent(
  config: SubAgentConfig,           // ① 子 Agent 配置（role/task/allowedTools/readOnly）
  llmConfig: LLMConfig,              // ② LLM 配置（从 delegate-task.ts 传入，已切换为 auxModel）
  parentRegistry: ToolRegistry,      // ③ 父 Agent 的工具注册表
  signal?: AbortSignal,              // ④ 取消信号（继承父 Agent）
): Promise<SubAgentResult> {         // ⑤ 返回结构化结果（success/content/toolsUsed/iterations）
  const startTime = Date.now()
  const maxIterations = config.maxIterations ?? 10  // ⑥ 子 Agent 默认 10 轮（父 Agent 是 50）

  // ⑦ 构建子 Agent 的受限工具集（§五 工具隔离）
  const childRegistry = buildChildRegistry(parentRegistry, config)

  // ⑧ 子 Agent 的 system prompt（简化版，不与用户对话，只完成任务）
  const systemPrompt = SUBAGENT_SYSTEM_TEMPLATE(config.role)
  
  // ⑨ 子 Agent 的独立消息历史（§四 上下文隔离）
  const messages: ChatMessage[] = [
    { id: 'sub-user', role: 'user', content: config.task, timestamp: Date.now() },
  ]

  log.info('SubAgent started', {
    role: config.role.slice(0, 50),
    task: config.task.slice(0, 100),
    toolCount: childRegistry.getAll().length,
    readOnly: config.readOnly ?? false,
  })

  // ⑩ 创建子 Agent 的 span，挂到父 span（§一 G1 修复）
  const subSpan = startSpan(
    'subagent',
    'subagent',
    'subagent',
    config.parentSpanId,  // ← G1: 使用父 span ID，形成调用链树
    {
      role: config.role.slice(0, 100),
      task: config.task.slice(0, 200),
      toolCount: childRegistry.getAll().length,
    }
  )

  let content = ''
  const toolsUsed: string[] = []
  let iterations = 0

  try {
    // ⑪ 调用 agentLoop，传入子 Agent 的独立配置
    const stream = agentLoop(
      {
        config: llmConfig,          // 已切换为 auxModel（G2）
        messages,                    // 子 Agent 独立消息历史
        tools: childRegistry.getAll(),  // 受限工具集
        systemPrompt,                // 子 Agent 专用 prompt
        maxIterations,               // 10 轮（不是父 Agent 的 50）
        signal,                      // 继承取消信号
        executionMode: 'auto',       // 固定 auto（§六 权限暂未传递）
      },
      childRegistry,
    )

    // ⑫ 消费事件流，只保留最终 content（§四 上下文隔离）
    for await (const ev of stream) {
      if (ev.type === 'text') {
        content += ev.content        // 累积最终输出
      }
      if (ev.type === 'tool_start') {
        toolsUsed.push(ev.name)      // 记录工具使用（返回给父 Agent 参考）
        iterations++
      }
      if (ev.type === 'error') {
        log.warn('SubAgent error', { error: ev.message })
        if (!content) content = `SubAgent error: ${ev.message}`
      }
      // ⑬ 注意：tool_calls / tool_results 不返回给父 Agent，只返回最终 content
    }

    log.info('SubAgent completed', {
      duration: Date.now() - startTime,
      contentLength: content.length,
      toolsUsed,
      iterations,
    })

    subSpan.setAttributes({ iterations, toolsUsed: toolsUsed.join(','), contentLength: content.length })
    subSpan.end('ok')

    // ⑭ 返回结构化结果（§七 结构化返回）
    return { success: true, content, toolsUsed, iterations }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    log.error('SubAgent failed', { error: errMsg })
    subSpan.end('error', errMsg)
    return { success: false, content: `SubAgent failed: ${errMsg}`, toolsUsed, iterations }
  }
}
```

**编号说明**：

① **SubAgentConfig**：封装子 Agent 的所有配置，包括 G1 新增的 `parentSpanId`

⑥ **maxIterations=10**：子 Agent 的迭代限制比父 Agent 少（父 50，子 10），防止子任务失控

⑨ **独立 messages 数组**：这是上下文隔离的核心——子 Agent 只看到自己的消息，看不到父 Agent 的对话历史

⑩ **parentSpanId**：G1 修复的关键——子 Agent span 的 parentId 指向父 span，形成调用链树

⑪ **executionMode='auto'**：子 Agent 固定用 auto 模式，权限传递暂未实现（§六 暂缓项）

⑬ **只返回 content**：子 Agent 的中间过程（tool_calls/tool_results）不返回给父 Agent，只有最终输出作为 tool_result

⑭ **结构化返回**：不是纯文本，而是 `{ success, content, toolsUsed, iterations }`，方便父 Agent 判断和日志

**方法论对照**：

- → m08 §三：这是父子模式的完整实现，对应 Alice Ch.6 第一种模式
- → m08 §四：⑨ 的独立 messages 数组就是上下文隔离
- → m08 §五：⑦ 的 buildChildRegistry 就是工具隔离
- → m08 §七：⑭ 的结构化返回就是不写全局状态

---

## §四：上下文隔离 → 独立的 messages 数组

→ m08 §四：子 Agent 有自己的消息历史

**关键代码**（上面 runSubAgent 的 ⑨）：

```typescript
const messages: ChatMessage[] = [
  { id: 'sub-user', role: 'user', content: config.task, timestamp: Date.now() },
]
```

**为什么这样设计**：

- 父 Agent 的 messages 可能有几十条（整个对话历史）
- 子 Agent 只需要看到"当前任务"（config.task）
- 子 Agent 的中间过程（工具调用、推理）写入这个独立的 messages，不会污染父 Agent

**对比错误做法**：

```typescript
// ❌ 错误：把父 Agent 的 messages 传给子 Agent
const stream = agentLoop({ messages: parentMessages, ... })

// 问题：
// 1. 子 Agent 看到父 Agent 的整个对话历史（无关信息干扰推理）
// 2. 子 Agent 的中间过程写回 parentMessages（污染父 Agent 上下文）
```

**方法论对照**：

- → m08 §四：独立 messages 数组就是上下文隔离的实现
- Alice Ch.6 原文："Each subagent has its own ContextManager"

---

## §五：工具隔离 → buildChildRegistry 过滤

→ m08 §五：子 Agent 只能用受限工具集

**核心代码**（subagent.ts）：

```typescript
/** 子 Agent 不允许使用的工具 — 防止递归和越权 */
const SUBAGENT_TOOL_BLACKLIST = new Set([
  'delegate_task',  // ① 防止无限递归（子 Agent 再创建子 Agent）
  'remember',       // ② 不应修改主 Agent 记忆
  'forget',         // ③ 不应删除主 Agent 记忆
  'task_plan',      // ④ 不应操作主 Agent 的任务计划
])

/** 为子 Agent 构建受限的工具注册表 */
function buildChildRegistry(parentRegistry: ToolRegistry, config: SubAgentConfig): ToolRegistry {
  const childRegistry = new ToolRegistry()  // ⑤ 新建独立注册表（不复用父注册表）
  const parentTools = parentRegistry.getAll()  // ⑥ 拿到父 Agent 的全部工具

  let allowedTools: ToolDefinition[]

  // ⑦ 白名单逻辑：显式指定 > 默认只读
  if (config.allowedTools) {
    // 用户显式指定了允许的工具列表
    const allowedSet = new Set(config.allowedTools)
    allowedTools = parentTools.filter(t => allowedSet.has(t.name))
  } else {
    // 未指定，默认只给只读工具（安全）
    allowedTools = parentTools.filter(t => t.metadata.isReadOnly)
  }

  // ⑧ readOnly 模式额外过滤：去掉破坏性工具
  if (config.readOnly) {
    allowedTools = allowedTools.filter(t => !t.metadata.isDestructive)
  }

  // ⑨ 黑名单过滤：无论如何都不给这些工具
  allowedTools = allowedTools.filter(t => !SUBAGENT_TOOL_BLACKLIST.has(t.name))

  // ⑩ 注册到子注册表
  for (const tool of allowedTools) {
    childRegistry.register(tool)
  }

  log.debug('Child registry built', {
    parentToolCount: parentTools.length,
    childToolCount: allowedTools.length,
    blacklisted: [...SUBAGENT_TOOL_BLACKLIST].filter(n => parentRegistry.has(n)),
  })

  return childRegistry
}
```

**编号说明**：

①-④ **黑名单**：这四个工具无论如何不能给子 Agent，否则会出现递归（delegate_task）或越权（remember/forget/task_plan）

⑤ **新建注册表**：子 Agent 用独立的 ToolRegistry 实例，不是父的引用

⑦ **白名单逻辑**：
  - 如果用户显式指定 `allowedTools: ['file_read', 'web_search']`，只给这两个
  - 如果未指定，默认只给 `isReadOnly=true` 的工具（安全）

⑧ **readOnly 额外过滤**：如果 `config.readOnly=true`，再过滤掉 `isDestructive=true` 的工具（双重保险）

⑨ **黑名单最后防护**：即使用户显式指定 `allowedTools: ['delegate_task']`，黑名单也会拦掉

**方法论对照**：

- → m08 §五：这段代码实现"子 Agent 工具集是受限子集"
- Alice Ch.6："Workers have a restricted toolset"

---

## §六：权限只降不升 → 暂未实现

→ m08 §六：子 Agent 继承或降级父权限，不能升级

**当前实现**（subagent.ts:102）：

```typescript
const stream = agentLoop(
  {
    // ...
    executionMode: 'auto',  // ← 固定 auto，未从父 Agent 继承
  },
  childRegistry,
)
```

**问题**：

- 父 Agent 可能是 `confirm-all` 模式（所有工具都需用户确认）
- 子 Agent 固定用 `auto` 模式（自动执行）
- 这是权限升级（从 confirm-all → auto），不符合"只降不升"原则

**正确做法**（暂未实现）：

```typescript
// ✅ 应该从 toolContext 继承父 Agent 的 executionMode
const stream = agentLoop(
  {
    // ...
    executionMode: toolContext.executionMode || 'auto',  // 继承父模式
  },
  childRegistry,
)
```

**为什么暂未实现**：

- 子 Agent 只能调只读工具（isReadOnly=true），本身就是受限的
- 只读工具不触发权限确认弹窗，风险可控
- 等后续引入写操作的子 Agent 时，必须实现权限继承

**方法论对照**：

- → m08 §六：这是一个安全 gap，但因子 Agent 只读，风险可控
- Alice Ch.6："Permission mode is inherited or downgraded, never upgraded"

---

## §七：结构化返回 → SubAgentResult

→ m08 §七：每个 Agent 返回结构化文本，不写全局状态

**返回类型**（subagent.ts）：

```typescript
export interface SubAgentResult {
  success: boolean      // ① 子 Agent 是否成功完成
  content: string       // ② 子 Agent 的最终输出（作为 tool_result）
  toolsUsed: string[]   // ③ 使用了哪些工具（供父 Agent 日志和调试）
  iterations: number    // ④ 执行了多少轮（供父 Agent 判断子任务复杂度）
}
```

**delegate-task 如何使用这个结果**（delegate-task.ts）：

```typescript
const result = await runSubAgent(
  { role, task, allowedTools, readOnly, parentSpanId: toolContext.parentSpanId },
  llmConfig,
  registry,
  toolContext.signal,
)

// ⑤ 格式化为 tool_result（父 Agent 会收到这段文字）
const header = result.success ? '✅ Sub-agent completed' : '❌ Sub-agent failed'
const meta = result.toolsUsed.length > 0
  ? `\nTools used: ${result.toolsUsed.join(', ')} (${result.iterations} iterations)`
  : ''

return `${header}${meta}\n\n${result.content}`
```

**为什么不用全局状态**：

```typescript
// ❌ 反模式：写全局状态
globalState.subagentResults.push({ task, content })  // 竞态！多个子 Agent 并发写

// ✅ 正确模式：结构化返回
return { success: true, content, toolsUsed, iterations }  // 每个子 Agent 返回独立结果
```

**方法论对照**：

- → m08 §七：SubAgentResult 就是结构化返回，父 Agent 从 tool_result 拿结果
- Alice Ch.6："Each agent returns structured text, coordinator synthesizes"

---

## §八：不委托理解 → description 里的提醒

→ m08 §八：父 Agent 必须自己综合，禁止"based on your findings"

**我们的实现**（delegate-task.ts description）：

虽然我们的 description 没有显式写"不要说 based on your findings"，但我们通过**要求自包含 prompt**来达成同样效果：

```typescript
description: `...

**典型场景:**
- "分析 docs/ 下所有 Markdown 文件，提取标题和摘要" → 可并发读取
- "查询五个城市的天气，汇总对比" → 可并发查询
- "研究 src/auth/ 的代码结构，找出所有 API 入口" → 独立研究任务`,

parameters: {
  // ...
  task: {
    type: 'string',
    description: 'The specific task to delegate. Be clear and self-contained — sub-agent cannot see your conversation history.',
    //                                           ^^^^^^^^^^^^^^^^^ ⑥ 强调自包含，隐式要求父 Agent 综合
  },
}
```

**为什么这样设计**：

- 工具的 description 是给父 Agent（LLM）读的
- 如果 description 说"sub-agent cannot see your conversation history"，父 Agent 就知道不能说"based on your findings"（子 Agent 看不到）
- 这是隐式的"不委托理解"——逼着父 Agent 把研究结果综合后再写进 task

**CC 的显式提醒**（coordinatorMode.ts）：

```typescript
// CC 在 Coordinator system prompt 里显式写：
"Never write 'based on your findings' or 'based on the research.'"
```

**我们的选择**：

- 我们没有 Coordinator 模式（只有父子模式）
- 父 Agent 是通用 Agent（不是专门的 Coordinator），不适合在 system prompt 里加这条
- 所以我们通过工具 description 的"self-contained"来隐式约束

**方法论对照**：

- → m08 §八：我们用"self-contained"隐式约束，CC 用 system prompt 显式约束，目的一致
- CC coordinatorMode.ts："Never write 'based on your findings'"

---

## §九：continue vs spawn → 我们只有 spawn

→ m08 §九：根据上下文重叠度决定继续还是新建

**当前实现**：每次调用 `delegate_task` 都是新建子 Agent（spawn）

```typescript
// delegate-task.ts execute 方法每次都调 runSubAgent
const result = await runSubAgent(
  { role, task, allowedTools, readOnly, parentSpanId: toolContext.parentSpanId },
  llmConfig,
  registry,
  toolContext.signal,
)
```

**没有 continue 机制**：

- 子 Agent 完成后，它的上下文就丢弃了
- 如果想让同一个子 Agent 继续执行，需要再次 `delegate_task`（但这是新实例）

**CC 的 continue 机制**（coordinatorMode.ts）：

```typescript
// CC 有 SendMessage 工具，可以继续已有的 Worker
SendMessage({ to: "agent-a1b", message: "Fix the null pointer in src/auth/validate.ts:42..." })
```

**为什么我们暂未实现**：

- continue 需要维护 Agent 实例的生命周期（不能 await 完就销毁）
- 需要 Agent ID 映射表（to: "agent-a1b" 如何找到对应的实例）
- 这是 Coordinator 模式的特性，我们的父子模式用不上

**方法论对照**：

- → m08 §九：我们只有 spawn，CC 有 spawn + continue，适用场景不同
- CC coordinatorMode.ts："Choose continue vs spawn by context overlap"

---

## §十：P0 破损修复 → toolContext.registry

→ m08 实战记录：delegate_task 的 _registry 永远 undefined

**旧代码**（delegate-task.ts，已修复）：

```typescript
// ❌ P0 bug：尝试从工具对象本身读取 _registry 私有字段
const { _registry } = delegateTaskTool as unknown as { _registry: unknown }
if (!_registry) {
  return '[Error] Sub-agent system not initialized. The tool registry is not available.'
}

const result = await runSubAgent(
  { role, task, allowedTools, readOnly },
  llmConfig,
  _registry as any,  // ← 永远是 undefined
)
```

**问题根因**：

- `delegateTaskTool` 是工具定义对象，不是工具注册表
- 它没有 `_registry` 字段
- 这段代码每次都进入 error 分支

**修复后代码**（delegate-task.ts）：

```typescript
// ✅ 从 toolContext 取 registry（runtime.ts 已带入）
execute: async (args, toolContext) => {  // ← 接收 toolContext 第二参数
  // ...
  
  if (!toolContext?.registry) {
    return '[Error] Sub-agent system not initialized. Tool registry is not available in toolContext.'
  }

  const registry = toolContext.registry as ToolRegistry  // ← 从 toolContext 取，断言类型

  const result = await runSubAgent(
    { role, task, allowedTools, readOnly, parentSpanId: toolContext.parentSpanId },
    llmConfig,
    registry,  // ← 正确传入注册表
    toolContext.signal,
  )
}
```

**配套修改**（types.ts）：

```typescript
export interface ToolContext {
  workdir: string
  sessionId: string
  signal?: AbortSignal
  parentSpanId?: string
  /**
   * 工具注册表引用，供 delegate_task 等需要创建子 Agent 的工具使用。
   * 类型为 unknown 避免 shared/types.ts 循环 import 主进程模块，使用方按需断言。
   */
  registry?: unknown  // ← G0 修复：新增字段
}
```

**配套修改**（runtime.ts）：

```typescript
const toolContext: ToolContext = {
  workdir: getWorkspaceRoot() || process.cwd(),
  sessionId,
  signal: abortController.signal,
  parentSpanId: chatSpan.id,
  registry: toolRegistry,  // ← G0 修复：传入注册表
}
```

**为什么 registry 类型是 unknown**：

- `ToolContext` 在 `src/shared/types.ts`（renderer 和 main 都 import）
- `ToolRegistry` 在 `electron/main/tools/registry.ts`（主进程模块）
- 如果 shared/types import main 模块会循环依赖
- 用 `unknown` 避免循环依赖，使用方（delegate-task.ts）按需断言类型

**方法论对照**：

- → m08 实战记录坑1：这是 shared 类型文件不能依赖具体实现的常见模式
- 类似问题：`compactMetadata` 也是先在 shared/types 定义，main 按需断言

---

## 总结：方法论 → 代码的映射

| 方法论章节 | 代码实现 | 关键文件 |
|-----------|---------|---------|
| §二 信息积累型 vs 并发执行型 | description 的 When to use / NOT to use | delegate-task.ts |
| §三 三种协作模式（父子） | runSubAgent 完整流程 | subagent.ts |
| §四 上下文隔离 | 独立 messages 数组 | subagent.ts:73 |
| §五 工具隔离 | buildChildRegistry + BLACKLIST | subagent.ts:141-179 |
| §六 权限只降不升 | executionMode 固定 auto（暂未实现继承）| subagent.ts:102 |
| §七 结构化返回 | SubAgentResult 接口 | subagent.ts:39-44 |
| §八 不委托理解 | description 的"self-contained"提醒 | delegate-task.ts |
| §九 continue vs spawn | 只有 spawn（每次新建）| delegate-task.ts |
| P0 破损修复 | toolContext.registry | types.ts + runtime.ts + delegate-task.ts |
| G1 调用链嵌套 | parentSpanId 传递链 | types.ts + runtime.ts + delegate-task.ts + subagent.ts |
| G2 辅助模型优先 | auxModel fallback 主模型 | delegate-task.ts:70 |

**核心设计原则回顾**：

1. **独立上下文**：子 Agent 看不到父 Agent 的对话历史
2. **受限工具集**：子 Agent 工具是父工具的子集 + 黑名单防护
3. **结构化返回**：不写全局状态，返回 `{ success, content, toolsUsed, iterations }`
4. **自包含 prompt**：description 强调"self-contained"，隐式约束父 Agent 综合

**Alice Ch.6 vs CC vs 我们的实现对比**（2026-07-05 更新）：

| | Alice Ch.6 | CC coordinatorMode | 我们 |
|---|-----------|-------------------|------|
| 协作模式 | 父子/Coordinator/Swarm | Coordinator（主力）| 父子 + continue（Swarm 缓）|
| continue 机制 | 支持 | SendMessage（异步总线）| continue_task（同步续跑）|
| 权限传递 | 明确要求 | 隐含在 Worker 设计里 | resolveChildExecutionMode 只降不升 |
| 角色系统 | researcher/writer/developer | worker | AGENT_ROLES: researcher/coder/analyst |
| 不委托理解 | 提及 | 显式 system prompt 约束 | 隐式 description 约束 |
| 调用链嵌套 | 未提及 | 未提及 | 我们实现了（G1）|

---

## 补做走读（2026-07-05）：continue / 角色 / 权限

### 权限只降不升（G4）

```typescript
// subagent.ts —— 模式严格度序 + 只降不升纯函数
const MODE_STRICTNESS: Record<ExecutionMode, number> = {
  'auto': 0,          // 最松（自动执行）
  'confirm-all': 1,   // 中（每次确认）
  'plan-first': 2,    // 最严（先计划）
}

export function resolveChildExecutionMode(parentMode: ExecutionMode | undefined): ExecutionMode {
  if (!parentMode) return 'auto'
  // 子 Agent 期望 auto，但不能比父级更宽松 → 取更严的
  // auto 严格度 >= 父级？说明父级就是 auto（或更松，不存在）→ 用 auto
  // 否则父级更严 → 子 Agent 被拉到父级严格度
  return MODE_STRICTNESS['auto'] >= MODE_STRICTNESS[parentMode] ? 'auto' : parentMode
}
```

关键：不是简单复制父模式，而是"子可以更保守、不能更激进"。父 confirm-all 时子必须 confirm-all（不能逃到 auto）；父 auto 时子也 auto。

### 角色系统（G6）

```typescript
// subagent.ts —— 预设角色表
export const AGENT_ROLES: Record<string, AgentRole> = {
  researcher: { systemPromptAddon: '...', defaultAllowedTools: ['file_read','code_search','web_search','url_fetch','rag_search'], defaultReadOnly: true },
  coder:      { systemPromptAddon: '...', defaultAllowedTools: ['file_read','file_edit','file_write','apply_patch','code_search','shell_exec'], defaultReadOnly: false },
  analyst:    { systemPromptAddon: '...', defaultAllowedTools: ['file_read','code_search','rag_search'], defaultReadOnly: true },
}

// buildChildRegistry —— 工具集来源优先级：显式 > 角色预设 > 父只读
const preset = AGENT_ROLES[config.role]
const allowedNames = config.allowedTools ?? preset?.defaultAllowedTools  // ← 三级 fallback
const effectiveReadOnly = config.readOnly ?? preset?.defaultReadOnly ?? false
```

匹配预设→用预设默认；显式参数→覆盖预设；自由字符串→回退父只读工具（向后兼容）。

### continue 机制（Coordinator）

```typescript
// subagent-registry.ts —— 实例保活 + 续跑
const instances = new Map<string, SubAgentInstance>()  // agentId → 实例（含 messages/工具集/模式）

// runSubAgent 跑完后注册，返回 agentId
const agentId = registerSubAgent({ sessionId, role, messages, childRegistry, llmConfig, executionMode, maxIterations, parentSpanId })

// continue_task 工具 → continueSubAgent：取实例、追加消息、复用上下文续跑
export async function continueSubAgent(agentId, message, signal) {
  const inst = instances.get(agentId)
  if (!inst) return { success: false, content: '... not found ...' }
  inst.messages.push({ role: 'user', content: message, ... })  // 追加到已有历史
  const stream = agentLoop({ messages: inst.messages, tools: inst.childRegistry.getAll(), executionMode: inst.executionMode, ... }, inst.childRegistry)
  // ... 消费 stream，回写 assistant 消息保留历史供再次 continue
}

// runtime.ts —— 会话结束清理（实例生命周期绑定会话）
try { clearSessionSubAgents(sessionId) } catch { /* ok */ }
```

关键：continue 复用实例的 messages 历史 + childRegistry + executionMode——子 Agent 带着完整上下文续跑，这是 continue 相对 spawn 的核心价值。

### longRunning 超时豁免（G7）

```typescript
// registry.ts rawExecute —— longRunning 工具跳过 30s 超时
const content = ctx.tool.metadata.longRunning
  ? await ctx.tool.execute(ctx.args, ctx.toolContext)          // 不包 withTimeout
  : await withTimeout(ctx.tool.execute(...), TOOL_TIMEOUT_MS, ctx.call.name)
```

delegate_task / continue_task 标 `longRunning: true`——它们跑完整子 Agent 循环，靠子 Agent 自己的 maxIterations + abort signal 兜底，不受 30s 工具超时限制。
