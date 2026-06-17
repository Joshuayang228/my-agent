/**
 * Sub-Agent 系统 — 支持父 Agent 委派任务给专职子 Agent。
 *
 * Alice 方法论 Ch.6 三种模式中的第一种：Subagent 工具模式。
 * - 子 Agent 作为 tool_call 执行，结果作为 tool_result 返回
 * - 独立上下文（不污染父 Agent 的消息历史）
 * - 受限工具集（只给子 Agent 需要的工具）
 * - 只读子 Agent 可并发（isConcurrencySafe=true）
 *
 * 权限：只降不升。子 Agent 的工具集是父 Agent 工具集的子集。
 */

import { agentLoop } from './loop'
import { ToolRegistry } from '../tools/registry'
import { createLogger } from '../utils/logger'
import type {
  ChatMessage,
  LLMConfig,
  ToolDefinition,
  AgentStreamEvent,
} from '../../../src/shared/types'

const log = createLogger('SubAgent')

export interface SubAgentConfig {
  /** 子 Agent 角色描述（注入 system prompt） */
  role: string
  /** 任务指令 */
  task: string
  /** 允许使用的工具名列表（空数组 = 不给工具，undefined = 继承父 Agent 只读工具） */
  allowedTools?: string[]
  /** 是否只读（只读子 Agent 不能使用破坏性工具） */
  readOnly?: boolean
  /** 最大迭代次数（默认 10，比父 Agent 少） */
  maxIterations?: number
}

export interface SubAgentResult {
  success: boolean
  content: string
  toolsUsed: string[]
  iterations: number
}

const SUBAGENT_SYSTEM_TEMPLATE = (role: string) => `You are a specialized sub-agent with the following role:

${role}

IMPORTANT CONSTRAINTS:
- Focus exclusively on the task given to you.
- Do not engage in conversation or ask clarifying questions — just complete the task.
- Return your result as a clear, structured response.
- If you cannot complete the task with the available tools, explain what you need.
- Keep your response concise and actionable.`

/**
 * 执行子 Agent — 独立上下文 + 受限工具集。
 */
export async function runSubAgent(
  config: SubAgentConfig,
  llmConfig: LLMConfig,
  parentRegistry: ToolRegistry,
  signal?: AbortSignal,
): Promise<SubAgentResult> {
  const startTime = Date.now()
  const maxIterations = config.maxIterations ?? 10

  const childRegistry = buildChildRegistry(parentRegistry, config)

  const systemPrompt = SUBAGENT_SYSTEM_TEMPLATE(config.role)
  const messages: ChatMessage[] = [
    { id: 'sub-user', role: 'user', content: config.task, timestamp: Date.now() },
  ]

  log.info('SubAgent started', {
    role: config.role.slice(0, 50),
    task: config.task.slice(0, 100),
    toolCount: childRegistry.getAll().length,
    readOnly: config.readOnly ?? false,
  })

  let content = ''
  const toolsUsed: string[] = []
  let iterations = 0

  try {
    const stream = agentLoop(
      {
        config: llmConfig,
        messages,
        tools: childRegistry.getAll(),
        systemPrompt,
        maxIterations,
        signal,
        executionMode: 'auto',
      },
      childRegistry,
    )

    for await (const ev of stream) {
      if (ev.type === 'text') {
        content += ev.content
      }
      if (ev.type === 'tool_start') {
        toolsUsed.push(ev.name)
        iterations++
      }
      if (ev.type === 'error') {
        log.warn('SubAgent error', { error: ev.message })
        if (!content) content = `SubAgent error: ${ev.message}`
      }
    }

    log.info('SubAgent completed', {
      duration: Date.now() - startTime,
      contentLength: content.length,
      toolsUsed,
      iterations,
    })

    return { success: true, content, toolsUsed, iterations }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    log.error('SubAgent failed', { error: errMsg })
    return { success: false, content: `SubAgent failed: ${errMsg}`, toolsUsed, iterations }
  }
}

/** 为子 Agent 构建受限的工具注册表 */
function buildChildRegistry(parentRegistry: ToolRegistry, config: SubAgentConfig): ToolRegistry {
  const childRegistry = new ToolRegistry()
  const parentTools = parentRegistry.getAll()

  let allowedTools: ToolDefinition[]

  if (config.allowedTools) {
    const allowedSet = new Set(config.allowedTools)
    allowedTools = parentTools.filter(t => allowedSet.has(t.name))
  } else {
    allowedTools = parentTools.filter(t => t.metadata.isReadOnly)
  }

  if (config.readOnly) {
    allowedTools = allowedTools.filter(t => !t.metadata.isDestructive)
  }

  for (const tool of allowedTools) {
    childRegistry.register(tool)
  }

  return childRegistry
}
