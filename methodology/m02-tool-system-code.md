# M2：工具系统 — 代码走读

> 对照 `m02-tool-system.md` 的每个章节，展示 CC（Claude Code）和 Alice 的真实代码实现。
> 
> CC 版本：`2.1.88`，源码路径：`_reference/.../claude-code-sourcemap-main/.../restored-src/src/`
> Alice 版本：构建后压缩 JS，位于 `_reference/.../alice-source/main-chunks/`

---

## §1 对照：工具定义结构

### CC 的 ToolDef 类型

```typescript
// CC: Tool.ts L24-47
// 工具定义的最小必需字段 —— 调用方声明的接口
export type AnyToolDef = {
  name: string
  description: ToolDescription
  // ↑ ToolDescription = string | (() => string)
  //    可以是固定字符串，也可以是函数（动态生成描述）
  
  inputSchema: ZodObject<ZodRawShape>
  // ↑ Zod schema 定义工具的输入参数结构
  
  execute: (
    input: { [key: string]: unknown },
    ctx: ToolUseContext,
  ) => Promise<ToolResult>
  // ↑ 执行函数 —— 接收解析后的参数 + 上下文，返回结果
  
  maxResultSizeChars?: number
  // ↑ 结果大小上限（字符数）。超过此值时触发落盘。
  //    设为 Infinity 表示永不落盘（如 Read 工具，避免循环）
  
  // 下面这些元数据字段都是可选的 —— buildTool() 会填充默认值
  isConcurrencySafe?: (input: unknown) => boolean
  isReadOnly?: (input: unknown) => boolean
  isDestructive?: (input: unknown) => boolean
  // ... 还有 checkPermissions / toAutoClassifierInput 等
}
```

**关键设计**：元数据字段（`isConcurrencySafe` / `isReadOnly` / `isDestructive`）都是**接收输入参数的函数**，而不是固定布尔值。这样可以根据具体调用参数动态判断——比如 `bash` 工具根据命令内容判断是否只读。

### Alice 的工具定义结构

```javascript
// Alice: query-B_tFgAOJ.js L233-248（bash 工具）
// Alice 工具是扁平对象，元数据字段直接写在顶层
ie = {
    name: "bash",
    description: e => `在 ${ee?"cmd":"bash"} 中执行命令...`,
    // ↑ description 也可以是函数（接收上下文参数 e，动态生成描述）
    
    category: "bash",  // 工具分类（CC 没有这个字段）
    systemHint: a.yamlPtRaw("TOOL_BASH_HINT"),  // 系统提示（额外的内部指导）
    
    requiresPermission: !0,  // true —— 需要用户授权
    isReadOnly: !1,          // false —— 会修改状态
    isDestructive: !0,       // true —— 破坏性操作
    isConcurrencySafe: !1,   // false —— 不能并发
    // ↑ 注意：bash 工具的元数据是布尔值，不是函数
    
    maxResultSizeChars: 2e5,  // 200,000 字符上限
    
    inputSchema: t.z.object({
      command: t.z.string().describe("..."),
      timeout: t.z.number().optional().describe("..."),
      background: t.z.boolean().optional().describe("..."),
      show_console: t.z.boolean().optional().describe("...")
    }),
    
    async execute({ command: e, timeout: t = 120, background: s = !1 }, c) {
      // 执行逻辑...
    }
}
```

**关键差异**：Alice 的大多数工具元数据是**固定布尔值**，只有 `agent` 工具例外（见 §1.3）。

### Alice 的特例：agent 工具的函数式元数据

```javascript
// Alice: query-B_tFgAOJ.js L39099-39122
// agent 工具是 Alice 里唯一用函数形式 isConcurrencySafe 的工具
return {
  name: "agent",
  description: a.yamlPt("TOOL_AGENT_DESC", { roleDescriptions: l }),
  
  isConcurrencySafe: e => {
    // ↑ 接收输入参数 e（包含 role / isReadOnly 字段）
    const t = e?.role,
          n = e?.isReadOnly;
    // 判定逻辑：
    // 1. 如果调用方显式传了 isReadOnly=true，直接返回 true（只读 subagent 可并发）
    // 2. 否则查角色表 —— 如果该角色默认只读，也返回 true
    return !0 === n || !1 !== n && !!t && xE(t)
  },
  
  maxResultSizeChars: 1e5,  // 100,000
  
  inputSchema: t.z.object({
    prompt: t.z.string().describe("..."),
    role: t.z.string().optional().describe("..."),
    isReadOnly: t.z.boolean().optional().describe("..."),
    run_in_background: t.z.boolean().optional().describe("...")
  }),
  
  async execute({ prompt: t, role: c, isReadOnly: l }, p) { /* ... */ }
}

// 辅助函数：查角色的默认只读属性
// Alice: query-B_tFgAOJ.js L36852-36854
function xE(e) {
  return TE[e]?.concurrency.defaultReadOnly ?? !1
}
```

**设计洞察**：Alice 证明了元数据函数化的价值——subagent 能否并发取决于它要做什么（只读 researcher 可以并发，写文件的 coder 不行），无法在工具定义时写死。

**方法论对照**：→ `m02-tool-system.md` §二（元数据）

---

## §2 对照：description 四要素结构

### CC 的 Grep 工具描述

```typescript
// CC: tools/GrepTool/prompt.ts L6-18
export function getDescription(): string {
  return `A powerful search tool built on ripgrep

  Usage:
  - ALWAYS use ${GREP_TOOL_NAME} for search tasks. NEVER invoke \`grep\` or \`rg\` as a ${BASH_TOOL_NAME} command. The ${GREP_TOOL_NAME} tool has been optimized for correct permissions and access.
  // ↑ 第一条：强约束 —— "ALWAYS / NEVER" 引导模型选对工具
  
  - Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
  // ↑ 功能说明
  
  - Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
  - Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
  // ↑ 使用方式
  
  - Use ${AGENT_TOOL_NAME} tool for open-ended searches requiring multiple rounds
  // ↑ 何时不用（何时改用别的工具）—— 这是最容易被忽略的
  
  - Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)
  - Multiline matching: By default patterns match within single lines only. For cross-line patterns like \`struct \\{[\\s\\S]*?field\`, use \`multiline: true\`
  // ↑ 边界条件和特殊情况
`
}
```

**结构特征**：开头一句话说清楚 what，然后用 bullet list 展开"ALWAYS / NEVER / Use X instead"三类约束。每一条都在消除歧义——告诉模型"什么时候该用我，什么时候别用我"。

### Alice 的 write_file 描述

```javascript
// Alice: query-B_tFgAOJ.js L1355（write_file 工具）
description: "写入文件（会覆盖已有内容，自动创建目录）。\n\n使用提示：\n- 如果文件已存在，必须先用 read_file 读取，否则本工具会报错拒绝执行\n- 优先使用 edit_file 修改已有文件（只发送 diff，更高效）。本工具仅用于新建文件或完全重写\n- 不要主动创建 *.md 或 README 文件，除非用户明确要求",
```

**中文版的同等结构**：第一句说功能，"使用提示"下三条分别是前置条件（必须先读）、何时不用（优先用 edit_file）、特殊约束（不主动建文档）。虽然是中文、格式更紧凑，但本质上也是四要素：what / when to use / when NOT to use / constraints。

**方法论对照**：→ `m02-tool-system.md` §三（description 是工具最重要的字段）

---

## §3 对照：并发调度算法

### CC 的 partitionToolCalls

```typescript
// CC: services/tools/toolOrchestration.ts L91-116
// 把工具调用列表分批 —— 连续的并发安全工具合并成一批，遇到非安全的就打断
function partitionToolCalls(
  toolUseMessages: ToolUseBlock[],
  toolUseContext: ToolUseContext,
): Batch[] {
  return toolUseMessages.reduce((acc: Batch[], toolUse) => {
    const tool = findToolByName(toolUseContext.options.tools, toolUse.name)
    const parsedInput = tool?.inputSchema.safeParse(toolUse.input)
    
    // 核心判定：调用 isConcurrencySafe 函数，传入解析后的参数
    const isConcurrencySafe = parsedInput?.success
      ? (() => {
          try {
            return Boolean(tool?.isConcurrencySafe(parsedInput.data))
            // ↑ 这里调用的是函数！传入 parsedInput.data（解析后的输入对象）
          } catch {
            // 如果 isConcurrencySafe 抛异常（比如 shell-quote 解析失败）
            // 保守处理：视为不安全
            return false
          }
        })()
      : false  // 参数解析失败 → 不安全
    
    // 分批逻辑：如果当前工具安全 && 上一批也是安全批 → 追加到上一批
    if (isConcurrencySafe && acc[acc.length - 1]?.isConcurrencySafe) {
      acc[acc.length - 1]!.blocks.push(toolUse)
    } else {
      // 否则新建一批（不管是不安全工具，还是安全工具但上一批不安全，都打断）
      acc.push({ isConcurrencySafe, blocks: [toolUse] })
    }
    return acc
  }, [])
}
```

**算法保证**：LLM 返回的工具调用顺序被完整保留——不会为了凑并发而打乱顺序。

### CC 的并发上限 + runToolsConcurrently

```typescript
// CC: toolOrchestration.ts L8-12
// 环境变量覆盖，默认 10
function getMaxToolUseConcurrency(): number {
  return (
    parseInt(process.env.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY || '', 10) || 10
  )
}

// L152-177
// 用 all() 信号量合并器限制并发数
async function* runToolsConcurrently(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  yield* all(
    toolUseMessages.map(async function* (toolUse) {
      // 标记工具为"进行中"
      toolUseContext.setInProgressToolUseIDs(prev =>
        new Set(prev).add(toolUse.id),
      )
      // 执行单个工具
      yield* runToolUse(toolUse, /* ... */)
      // 标记完成
      markToolUseAsComplete(toolUseContext, toolUse.id)
    }),
    getMaxToolUseConcurrency(),  // ← 第二个参数：最多同时跑 10 个
  )
}
```

**关键细节**：`all(generators, concurrency)` 是一个并发受限的 async generator 合并器（来自 `utils/generators.js`）。它保证同时运行的 generator 不超过 `concurrency` 个，用完一个槽位后才会启动下一个。

### Alice 的分批调度

```javascript
// Alice: query-B_tFgAOJ.js L42154-42194
// 分批逻辑与 CC 一致，但显式兼容函数和布尔两种形态
const it = ot,  // it = 工具调用列表
      st = [];  // st = 批次列表
let ct = [];    // ct = 当前批（累积中的并发安全工具）

for (const e of it) {
  const n = t.find(t => t.name === e.function.name),  // 找工具定义
        r = n?.isConcurrencySafe;
  
  let o = !1;  // o = 判定结果
  
  // 关键：判断 isConcurrencySafe 是函数还是布尔
  if ("function" == typeof r) 
    try {
      o = r(e.function.arguments ? JSON.parse(e.function.arguments) : {})
      // ↑ 是函数 → 调用它，传入解析后的参数
    } catch {
      o = !1  // 解析失败 → 不安全
    }
  else 
    o = r ?? !1  // 是布尔 → 直接取值（undefined 时默认 false）
  
  // 分批逻辑（与 CC 完全一致）
  o ? ct.push(e) : (ct.length > 0 && (st.push(ct), ct = []), st.push([e]))
}
ct.length > 0 && st.push(ct);

// 逐批执行
for (const e of st) {
  // ...
  const n = Promise.all(e.map(e => Ge(e, tt)));  // 一批内全量并发
  // ↑ 注意：Alice 没有显式的并发上限，Promise.all 全部同时跑
  // ...
}
```

**与 CC 的差异**：
1. Alice 兼容两种元数据形态（函数 / 布尔），CC 统一为函数
2. Alice 一批内 `Promise.all` 全量并发，**没有并发上限**；CC 用信号量限制为 10

**方法论对照**：→ `m02-tool-system.md` §四（并发调度）

---

## §4 对照：大结果落盘

### CC 的阈值解析

```typescript
// CC: utils/toolResultStorage.ts L55-78
// getPersistenceThreshold：计算某个工具的实际落盘阈值
export function getPersistenceThreshold(
  toolName: string,
  declaredMaxResultSizeChars: number,
): number {
  // Infinity = 硬退出（永不落盘）
  // 典型场景：Read 工具自身已有 maxTokens 边界，如果落盘会形成循环：
  //   Read 大文件 → 结果落盘 → 返回"结果在 xxx.txt" → 模型调 Read 读 xxx.txt → 又落盘 → 无限循环
  if (!Number.isFinite(declaredMaxResultSizeChars)) {
    return declaredMaxResultSizeChars
  }
  
  // 检查是否有工具级覆盖（feature flag）
  const overrides = getFeatureValue_CACHED_MAY_BE_STALE<Record<string, number> | null>(
    PERSIST_THRESHOLD_OVERRIDE_FLAG, {}
  )
  const override = overrides?.[toolName]
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return override
  }
  
  // 默认：取声明值和全局默认值的较小值
  return Math.min(declaredMaxResultSizeChars, DEFAULT_MAX_RESULT_SIZE_CHARS)
}
```

**设计洞察**：`Infinity` 不是"没有上限"，而是"我不走落盘流程"——这是一种显式的 opt-out 机制，避免某些工具陷入循环。

### CC 的落盘实现

```typescript
// CC: toolResultStorage.ts L137-184
// persistToolResult：把工具结果写到磁盘
export async function persistToolResult(
  content: NonNullable<ToolResultBlockParam['content']>,
  toolUseId: string,
): Promise<PersistedToolResult | PersistToolResultError> {
  const isJson = Array.isArray(content)
  
  // 只能落盘纯文本 —— 如果结果包含图片块，拒绝
  if (isJson) {
    const hasNonTextContent = content.some(block => block.type !== 'text')
    if (hasNonTextContent) {
      return { error: 'Cannot persist tool results containing non-text content' }
    }
  }
  
  await ensureToolResultsDir()  // 确保 projectDir/sessionId/tool-results/ 存在
  const filepath = getToolResultPath(toolUseId, isJson)
  const contentStr = isJson ? jsonStringify(content, null, 2) : content
  
  // 关键技巧：用 'wx' flag（写时若文件已存在则失败）
  // tool_use_id 是唯一的 → 如果文件已存在，说明之前写过了（可能是 microcompact 重放消息）
  // → 跳过写入，直接用已有文件生成预览
  try {
    await writeFile(filepath, contentStr, { encoding: 'utf-8', flag: 'wx' })
    logForDebugging(
      `Persisted tool result to ${filepath} (${formatFileSize(contentStr.length)})`,
    )
  } catch (error) {
    if (getErrnoCode(error) !== 'EEXIST') {
      // 不是"文件已存在"错误 → 真的失败了
      logError(toError(error))
      return { error: getFileSystemErrorMessage(toError(error)) }
    }
    // EEXIST：之前已经写过了，fall through 到预览生成
  }
  
  // 生成预览（前 2000 字节）
  const { preview, hasMore } = generatePreview(contentStr, PREVIEW_SIZE_BYTES)
  
  return { filepath, originalSize: contentStr.length, isJson, preview, hasMore }
}
```

**幂等性保证**：靠 `tool_use_id` 唯一性 + `flag: 'wx'` 实现——重放消息时不会重复写盘。

### CC 返回给模型的提示

```typescript
// CC: toolResultStorage.ts L189-199
export function buildLargeToolResultMessage(result: PersistedToolResult): string {
  let message = `${PERSISTED_OUTPUT_TAG}\n`
  message += `Output too large (${formatFileSize(result.originalSize)}). Full output saved to: ${result.filepath}\n\n`
  message += `Preview (first ${formatFileSize(PREVIEW_SIZE_BYTES)}):\n`
  message += result.preview
  message += result.hasMore ? '\n...\n' : '\n'
  message += PERSISTED_OUTPUT_CLOSING_TAG
  return message
}

// 常量定义（L27-34）
export const PERSISTED_OUTPUT_TAG = '<persisted-output>'
export const PERSISTED_OUTPUT_CLOSING_TAG = '</persisted-output>'
export const PREVIEW_SIZE_BYTES = 2000
```

**返回格式示例**：
```
<persisted-output>
Output too large (1.2 MB). Full output saved to: /path/to/tool-results/abc123.txt

Preview (first 2.0 KB):
[前 2000 字节的实际内容]
...
</persisted-output>
```

模型看到这段提示后,可以自己决定：是直接用预览，还是调 Read 工具读完整文件。

### CC 的空结果保护

```typescript
// CC: toolResultStorage.ts L272-334（部分）
async function maybePersistLargeToolResult(
  toolResultBlock: ToolResultBlockParam,
  toolName: string,
  persistenceThreshold?: number,
): Promise<ToolResultBlockParam> {
  const content = toolResultBlock.content
  
  // 空结果保护（inc-4586 bug 修复）
  // 问题：某些模型遇到空 tool_result 会提前结束回合（误以为任务完成）
  // 解法：空结果时注入占位文本 "(工具名 completed with no output)"
  if (isToolResultContentEmpty(content)) {
    logEvent('tengu_tool_empty_result', {
      toolName: sanitizeToolNameForAnalytics(toolName),
    })
    return {
      ...toolResultBlock,
      content: `(${toolName} completed with no output)`,
    }
  }
  
  // 后面才是正常的大小判断 + 落盘逻辑...
}
```

**工程洞察**：看似"空结果直接返回就好"，但实际遇到过模型 bug——空 `tool_result` 会触发某些模型的提前停止。这种边缘 case 只有在真实场景大量运行后才会暴露，纯理论设计发现不了。

**方法论对照**：→ `m02-tool-system.md` §五（大结果落盘）

---

## §5 对照：buildTool 工厂

### CC 的 TOOL_DEFAULTS

```typescript
// CC: Tool.ts L757-769
const TOOL_DEFAULTS = {
  isEnabled: () => true,
  isConcurrencySafe: (_input?: unknown) => false,  // 默认不安全
  isReadOnly: (_input?: unknown) => false,          // 默认会写
  isDestructive: (_input?: unknown) => false,       // 默认不破坏
  checkPermissions: (input, _ctx?) => 
    Promise.resolve({ behavior: 'allow', updatedInput: input }),
  toAutoClassifierInput: (_input?: unknown) => '',
  userFacingName: (_input?: unknown) => '',
}
```

**fail-closed 原则**：`isConcurrencySafe` 和 `isReadOnly` 默认都是 `false`（假设工具会写、不能并发），这样即使开发者忘记声明元数据，调度系统也会选择安全侧（串行执行）。

### CC 的 buildTool 函数

```typescript
// CC: Tool.ts L783-792
export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D> {
  // 运行时就是一个对象 spread：
  // { ...默认值, userFacingName: () => def.name, ...用户定义 }
  // 用户定义的字段会覆盖默认值
  return {
    ...TOOL_DEFAULTS,
    userFacingName: () => def.name,
    ...def,
  } as BuiltTool<D>
}
```

**类型安全保证**：泛型 `<D extends AnyToolDef>` 确保返回类型 `BuiltTool<D>` 精确追踪用户定义的字段，TypeScript 能在编译时检查工具定义的完整性。60 多个内置工具用这个工厂，零类型错误。

### Alice 的共享元数据基底

```javascript
// Alice: manager-HYfeA7e3.js L121-166（todo 工具集）
createTools(e) {
    const a = this,
      o = {  // 基底对象 —— 所有 todo 工具的共享默认值
        category: "task",
        requiresPermission: !1,
        isReadOnly: !1,
        isDestructive: !1,
        isConcurrencySafe: !1,
        maxResultSizeChars: 1e4
      },
      i = {  // 只读工具的基底 —— spread o 后覆盖两个字段
        ...o,
        isReadOnly: !0,
        isConcurrencySafe: !0
      };
    
    return [{
      ...o,  // 用基底 spread
      name: "todo_plan",
      description: "创建任务计划...",
      inputSchema: t.z.object({ /* ... */ }),
      async execute({ tasks: t }, s) { /* ... */ }
    },
    {
      ...i,  // 用只读基底
      name: "todo_list",
      // ...
    }]
}
```

**对比**：Alice 是**手动 spread 基底对象**，CC 是**统一工厂函数**。工厂的优势：新增元数据字段时只需改一处（TOOL_DEFAULTS），不用改每个工具。

**方法论对照**：→ `m02-tool-system.md` §六（工厂模式）

---

## 附加发现：超出方法论的工程细节

### 1. CC 的 ContentReplacementState（聚合预算）

```typescript
// CC: toolResultStorage.ts L390-412
// ContentReplacementState：跨回合稳定的消息级落盘决策状态
export type ContentReplacementState = {
  seenIds: Set<string>
  // ↑ 已决策的 tool_use_id 集合 —— 冻结决策，后续回合不再重新判断
  
  replacements: Map<string, string>
  // ↑ 被替换结果的精确文本 —— 重放时纯 Map 查找、零 IO、字节级一致
}
```

**为什么需要这个状态**：工具结果落盘后，对话历史里保留的是"(结果在 xxx.txt)"。下一轮 LLM 调用时，Anthropic API 要求 prompt cache 前缀必须字节级一致才能命中缓存。如果每次都重新判断"这个结果该不该落盘"，可能因为临时文件被删、阈值动态调整等原因导致决策不一致 → cache miss。

**解法**：第一次决策后，把 `tool_use_id` 和替换后的文本都存到 `ContentReplacementState` 里。后续回合直接查 Map，保证返回的文本完全一样。

**我们的实现状态**：✅ 已有类似机制 —— `resultPersistenceMiddleware` 的 `replacementCache` Map（见 `middleware.ts` L183-190）。

### 2. Alice 的工具去重（单次调用防护）

```javascript
// Alice: query-B_tFgAOJ.js L42123-42150
// 某些工具一次回合只允许调一次（如 alice_diary_write）
const nt = new Set(["alice_diary_write"])

for (const e of ot) {
  if (nt.has(e.function.name)) {
    // 检查这批调用里是否已经有同名工具
    const t = ot.filter(t => t.function.name === e.function.name);
    if (t.length > 1) {
      // 有重复 → 合并成一次调用（取第一个，忽略其余）
      // ...
    }
  }
}

// send_to_channel 工具还做了消息内容去重（L42151-42170）
```

**用途**：防止模型"抽风"连续发起多次相同操作（比如连续写 3 次日记）。Alice 在调度层做了去重保护。

**我们的实现状态**：❌ 未实现。当前没有单次去重需求，等遇到实际问题再加。

---

## 更新记录

| 日期 | 变更 |
|------|------|
| 2026-06-26 | 初始创建，覆盖 §1-§5 的 CC × Alice 代码对照 + 附加发现 2 项 |
