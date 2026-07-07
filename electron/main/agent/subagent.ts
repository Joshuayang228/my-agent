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
import { startSpan } from '../utils/tracer'
import { registerSubAgent } from './subagent-registry'
import type {
  ChatMessage,
  LLMConfig,
  ToolDefinition,
  AgentStreamEvent,
  ToolContext,
  ExecutionMode,
} from '../../../src/shared/types'

const log = createLogger('SubAgent')

export interface SubAgentConfig {
  /** 子 Agent 角色描述（注入 system prompt）；匹配 AGENT_ROLES 预设时自动带默认工具集/只读性 */
  role: string
  /** 任务指令 */
  task: string
  /** 允许使用的工具名列表（空数组 = 不给工具，undefined = 用角色预设或父 Agent 只读工具） */
  allowedTools?: string[]
  /** 是否只读（只读子 Agent 不能使用破坏性工具） */
  readOnly?: boolean
  /** 最大迭代次数（默认 10，比父 Agent 少） */
  maxIterations?: number
  /** 父 span ID，用于调用链嵌套（M7 + M8） */
  parentSpanId?: string
  /** 工具运行时上下文（workdir/sessionId/signal）—— 传给子 Agent 的工具（G5） */
  toolContext?: ToolContext
  /** 父 Agent 的执行模式 —— 子 Agent 权限只降不升（G4） */
  parentExecutionMode?: ExecutionMode
}

export interface SubAgentResult {
  success: boolean
  content: string
  toolsUsed: string[]
  iterations: number
  /** 子 Agent 实例 ID，供 continue_task 后续追加消息续跑（Coordinator continue） */
  agentId: string
}

/**
 * 预设角色（Alice Ch.6 Agent 角色系统）。
 * 匹配到预设时，用其默认工具集和只读性；显式 allowedTools/readOnly 仍可覆盖。
 * 不匹配预设的 role 按自由字符串处理（向后兼容）。
 */
export interface AgentRole {
  systemPromptAddon: string
  defaultAllowedTools: string[]
  defaultReadOnly: boolean
}

export const AGENT_ROLES: Record<string, AgentRole> = {
  researcher: {
    systemPromptAddon: 'You are a research specialist. Gather and synthesize information thoroughly. Report findings with specifics (file paths, line numbers, sources). Do not modify anything.',
    defaultAllowedTools: ['file_read', 'code_search', 'web_search', 'url_fetch', 'rag_search'],
    defaultReadOnly: true,
  },
  coder: {
    systemPromptAddon: 'You are a coding specialist. Make targeted, correct changes. Fix root causes, not symptoms. Verify your changes compile/pass before reporting done.',
    defaultAllowedTools: ['file_read', 'file_edit', 'file_write', 'apply_patch', 'code_search', 'shell_exec'],
    defaultReadOnly: false,
  },
  analyst: {
    systemPromptAddon: 'You are a data/code analyst. Analyze structure and patterns, draw evidence-based conclusions. Do not modify anything.',
    defaultAllowedTools: ['file_read', 'code_search', 'rag_search'],
    defaultReadOnly: true,
  },
}

/** 模式严格程度序（数字越大越严）——用于权限只降不升比较 */
const MODE_STRICTNESS: Record<ExecutionMode, number> = {
  'auto': 0,
  'confirm-all': 1,
  'plan-first': 2,
}

/**
 * 子 Agent 权限只降不升：取父模式和 'auto' 中更严的那个，但不超过父模式。
 * 即子 Agent 默认想用 auto（省确认），但若父级更严（confirm-all/plan-first），
 * 子 Agent 必须继承父级的严格度，不能逃逸到更宽松。
 * 纯函数，便于测试。
 */
export function resolveChildExecutionMode(parentMode: ExecutionMode | undefined): ExecutionMode {
  if (!parentMode) return 'auto'
  // 子 Agent 期望 auto，但不能比父级更宽松 → 取更严的
  return MODE_STRICTNESS['auto'] >= MODE_STRICTNESS[parentMode] ? 'auto' : parentMode
}

function buildSubAgentSystemPrompt(role: string): string {
  const preset = AGENT_ROLES[role]
  // 预设角色用其专业化描述；自由字符串直接作为角色描述
  const roleDesc = preset ? preset.systemPromptAddon : role
  return `You are a specialized sub-agent with the following role:

${roleDesc}

IMPORTANT CONSTRAINTS:
- Focus exclusively on the task given to you.
- Do not engage in conversation or ask clarifying questions — just complete the task.
- Return your result as a clear, structured response.
- If you cannot complete the task with the available tools, explain what you need.
- Keep your response concise and actionable.`
}

/**
 * 执行子 Agent — 独立上下文 + 受限工具集。
 * 跑完后把状态注册进 subagent-registry，返回 agentId 供 continue_task 续跑。
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

  const systemPrompt = buildSubAgentSystemPrompt(config.role)
  const messages: ChatMessage[] = [
    { id: 'sub-user', role: 'user', content: config.task, timestamp: Date.now() },
  ]

  // G4 权限只降不升：子 Agent 执行模式不能比父级宽松
  const executionMode = resolveChildExecutionMode(config.parentExecutionMode)

  log.info('SubAgent started', {
    role: config.role.slice(0, 50),
    task: config.task.slice(0, 100),
    toolCount: childRegistry.getAll().length,
    readOnly: config.readOnly ?? false,
    executionMode,
  })

  const subSpan = startSpan(
    'subagent',
    'subagent',
    'subagent',
    config.parentSpanId,  // G1 修复：使用父 span ID，让子 Agent 挂到调用链树
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
    const stream = agentLoop(
      {
        config: llmConfig,
        messages,
        tools: childRegistry.getAll(),
        systemPrompt,
        maxIterations,
        signal,
        executionMode,           // G4：只降不升后的模式
        toolContext: config.toolContext,  // G5：子 Agent 工具拿到 workdir/sessionId/signal
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

    // 记录本轮产出的 assistant 回复到 messages（供 continue 时保留完整历史）
    messages.push({ id: `sub-assistant-${Date.now()}`, role: 'assistant', content, timestamp: Date.now() })

    // 注册实例，返回 agentId 供 continue_task 续跑
    const agentId = registerSubAgent({
      sessionId: config.toolContext?.sessionId ?? '',
      role: config.role,
      messages,
      childRegistry,
      llmConfig,
      executionMode,
      maxIterations,
      parentSpanId: config.parentSpanId,
    })

    log.info('SubAgent completed', {
      agentId,
      duration: Date.now() - startTime,
      contentLength: content.length,
      toolsUsed,
      iterations,
    })

    subSpan.setAttributes({ agentId, iterations, toolsUsed: toolsUsed.join(','), contentLength: content.length })
    subSpan.end('ok')

    return { success: true, content, toolsUsed, iterations, agentId }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    log.error('SubAgent failed', { error: errMsg })
    subSpan.end('error', errMsg)
    return { success: false, content: `SubAgent failed: ${errMsg}`, toolsUsed, iterations, agentId: '' }
  }
}

/** 子 Agent 不允许使用的工具 — 防止递归和越权 */
const SUBAGENT_TOOL_BLACKLIST = new Set([
  'delegate_task',  // 防止无限递归
  'continue_task',  // 子 Agent 不能 continue 别的子 Agent（防递归）
  'remember',       // 不应修改主 Agent 记忆
  'forget',         // 不应删除主 Agent 记忆
  'task_plan',      // 不应操作主 Agent 的任务计划
])

/**
 * 为子 Agent 构建受限的工具注册表。
 * 工具集来源优先级：显式 allowedTools > 角色预设默认 > 父 Agent 只读工具。
 * 只读性：显式 readOnly > 角色预设 defaultReadOnly。
 * 导出供 continue_task 复用（continue 时用同样的工具集）。
 */
export function buildChildRegistry(parentRegistry: ToolRegistry, config: SubAgentConfig): ToolRegistry {
  const childRegistry = new ToolRegistry()
  const parentTools = parentRegistry.getAll()
  const preset = AGENT_ROLES[config.role]

  // 工具集：显式 allowedTools > 角色预设 > 父只读工具
  const allowedNames = config.allowedTools ?? preset?.defaultAllowedTools
  let allowedTools: ToolDefinition[]
  if (allowedNames) {
    const allowedSet = new Set(allowedNames)
    allowedTools = parentTools.filter(t => allowedSet.has(t.name))
  } else {
    allowedTools = parentTools.filter(t => t.metadata.isReadOnly)
  }

  // 只读性：显式 readOnly 优先，否则用角色预设 defaultReadOnly
  const effectiveReadOnly = config.readOnly ?? preset?.defaultReadOnly ?? false
  if (effectiveReadOnly) {
    allowedTools = allowedTools.filter(t => !t.metadata.isDestructive)
  }

  allowedTools = allowedTools.filter(t => !SUBAGENT_TOOL_BLACKLIST.has(t.name))

  for (const tool of allowedTools) {
    childRegistry.register(tool)
  }

  log.debug('Child registry built', {
    role: config.role,
    matchedPreset: !!preset,
    parentToolCount: parentTools.length,
    childToolCount: allowedTools.length,
    effectiveReadOnly,
  })

  return childRegistry
}
