import { buildTool } from '../builder'
import { runSubAgent } from '../../agent/subagent'
import type { ToolRegistry } from '../registry'
import * as settings from '../../storage/settings-store'

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
  parameters: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        description: 'The role/specialization of the sub-agent (e.g., "code researcher", "file analyzer", "API tester")',
      },
      task: {
        type: 'string',
        description: 'The specific task to delegate. Be clear and self-contained — sub-agent cannot see your conversation history.',
      },
      allowed_tools: {
        type: 'string',
        description: 'Comma-separated tool names the sub-agent can use (e.g., "file_read,code_search"). Omit to give only read-only tools.',
      },
      read_only: {
        type: 'string',
        description: 'Whether sub-agent should be restricted to read-only operations. "true" (default) or "false"',
      },
    },
    required: ['role', 'task'],
  },
  metadata: {
    isReadOnly: true,       // delegate_task 本身不修改文件，只是启动子 Agent
    isConcurrencySafe: true, // 多个子 Agent 可以并发启动（只读子 Agent 安全）
  },
  execute: async (args, toolContext) => {  // ← 修复：接收 toolContext 参数
    const role = args.role as string
    const task = args.task as string
    const allowedToolsStr = args.allowed_tools as string | undefined
    const readOnly = (args.read_only as string) !== 'false'

    const allowedTools = allowedToolsStr
      ? allowedToolsStr.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const s = await settings.getAllSettings()

    // G2: 优先用辅助模型（auxModel），子 Agent 任务通常更轻量
    const modelToUse = s.auxModel || s.llmModel || process.env.LLM_MODEL || 'gpt-4o'

    const llmConfig = {
      apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
      baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      model: modelToUse,
    }

    // G0 修复：从 toolContext 取 registry（runtime.ts 已带入）
    if (!toolContext?.registry) {
      return '[Error] Sub-agent system not initialized. Tool registry is not available in toolContext.'
    }

    const registry = toolContext.registry as ToolRegistry

    const result = await runSubAgent(
      {
        role,
        task,
        allowedTools,
        readOnly,
        parentSpanId: toolContext.parentSpanId,  // G1: 传入父 span ID
      },
      llmConfig,
      registry,
      toolContext.signal,  // 传入取消信号
    )

    const header = result.success ? '✅ Sub-agent completed' : '❌ Sub-agent failed'
    const meta = result.toolsUsed.length > 0
      ? `\nTools used: ${result.toolsUsed.join(', ')} (${result.iterations} iterations)`
      : ''

    return `${header}${meta}\n\n${result.content}`
  },
})
