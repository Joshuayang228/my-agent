import type { ToolDefinition } from '../../../../src/shared/types'
import { runSubAgent } from '../../agent/subagent'
import * as settings from '../../storage/settings-store'

export const delegateTaskTool: ToolDefinition = {
  name: 'delegate_task',
  description: 'Delegate a task to a specialized sub-agent. The sub-agent runs in an isolated context with its own tool set. Use this for: (1) Research tasks that need multiple tool calls, (2) Complex file operations, (3) Any task that benefits from focused, independent execution. The sub-agent result is returned as a single response.',
  parameters: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        description: 'The role/specialization of the sub-agent (e.g., "code researcher", "file organizer", "web researcher")',
      },
      task: {
        type: 'string',
        description: 'The specific task to delegate. Be clear and detailed about what you need.',
      },
      allowed_tools: {
        type: 'string',
        description: 'Comma-separated tool names the sub-agent can use (e.g., "file_read,code_search"). Omit to give only read-only tools.',
      },
      read_only: {
        type: 'string',
        description: 'Whether sub-agent should be restricted to read-only operations. "true" or "false" (default: "true")',
      },
    },
    required: ['role', 'task'],
  },
  metadata: {
    isReadOnly: true,
    isDestructive: false,
    isConcurrencySafe: true,
  },
  execute: async (args) => {
    const role = args.role as string
    const task = args.task as string
    const allowedToolsStr = args.allowed_tools as string | undefined
    const readOnly = (args.read_only as string) !== 'false'

    const allowedTools = allowedToolsStr
      ? allowedToolsStr.split(',').map(s => s.trim()).filter(Boolean)
      : undefined

    const s = await settings.getAllSettings()
    const llmConfig = {
      apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
      baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      model: s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
    }

    const { _registry } = delegateTaskTool as unknown as { _registry: unknown }
    if (!_registry) {
      return '[Error] Sub-agent system not initialized. The tool registry is not available.'
    }

    const result = await runSubAgent(
      { role, task, allowedTools, readOnly },
      llmConfig,
      _registry as any,
    )

    const header = result.success ? '✅ Sub-agent completed' : '❌ Sub-agent failed'
    const meta = result.toolsUsed.length > 0
      ? `\nTools used: ${result.toolsUsed.join(', ')} (${result.iterations} iterations)`
      : ''

    return `${header}${meta}\n\n${result.content}`
  },
}
