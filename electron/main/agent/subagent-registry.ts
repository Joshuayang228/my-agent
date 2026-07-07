/**
 * Sub-Agent 实例注册表 — 支持 Coordinator continue 机制。
 *
 * 子 Agent 跑完后不立即销毁，而是把状态（messages 历史 + 工具集 + 配置）
 * 存进注册表，返回 agentId。父 Agent 之后可通过 continue_task(agentId, message)
 * 对同一子 Agent 追加消息续跑——复用其上下文，对应 CC 的 SendMessage。
 *
 * 生命周期：实例按 sessionId 分组，会话结束时 clearSessionSubAgents 清理。
 * 单一主对话流场景下，continue 是同步的（在父 Agent 的工具调用里跑完）。
 */

import { agentLoop } from './loop'
import { ToolRegistry } from '../tools/registry'
import { createLogger } from '../utils/logger'
import { startSpan } from '../utils/tracer'
import type { ChatMessage, LLMConfig, ExecutionMode, ToolContext } from '../../../src/shared/types'

const log = createLogger('SubAgentRegistry')

interface SubAgentInstance {
  agentId: string
  sessionId: string
  role: string
  messages: ChatMessage[]
  childRegistry: ToolRegistry
  llmConfig: LLMConfig
  executionMode: ExecutionMode
  maxIterations: number
  parentSpanId?: string
  createdAt: number
}

const instances = new Map<string, SubAgentInstance>()
let counter = 0

function generateAgentId(): string {
  return `subagent-${++counter}-${Date.now().toString(36)}`
}

/** 注册一个跑完的子 Agent 实例，返回 agentId */
export function registerSubAgent(params: {
  sessionId: string
  role: string
  messages: ChatMessage[]
  childRegistry: ToolRegistry
  llmConfig: LLMConfig
  executionMode: ExecutionMode
  maxIterations: number
  parentSpanId?: string
}): string {
  const agentId = generateAgentId()
  instances.set(agentId, { agentId, createdAt: Date.now(), ...params })
  log.info('Sub-agent registered', { agentId, role: params.role, sessionId: params.sessionId })
  return agentId
}

export function getSubAgent(agentId: string): SubAgentInstance | undefined {
  return instances.get(agentId)
}

export interface ContinueResult {
  success: boolean
  content: string
  toolsUsed: string[]
  iterations: number
}

/**
 * 对已有子 Agent 追加一条消息并续跑（Coordinator continue / CC SendMessage）。
 * 复用实例的 messages 历史、工具集、执行模式——子 Agent 带着之前的上下文继续。
 */
export async function continueSubAgent(
  agentId: string,
  message: string,
  signal?: AbortSignal,
): Promise<ContinueResult> {
  const inst = instances.get(agentId)
  if (!inst) {
    return { success: false, content: `[Error] Sub-agent "${agentId}" not found. It may have expired or the session ended.`, toolsUsed: [], iterations: 0 }
  }

  // 追加用户新消息到已有历史
  inst.messages.push({ id: `cont-user-${Date.now()}`, role: 'user', content: message, timestamp: Date.now() })

  const subSpan = startSpan('subagent_continue', 'subagent', 'subagent', inst.parentSpanId, {
    agentId,
    role: inst.role.slice(0, 100),
    message: message.slice(0, 200),
  })

  let content = ''
  const toolsUsed: string[] = []
  let iterations = 0

  try {
    const stream = agentLoop(
      {
        config: inst.llmConfig,
        messages: inst.messages,
        tools: inst.childRegistry.getAll(),
        maxIterations: inst.maxIterations,
        signal,
        executionMode: inst.executionMode,
      },
      inst.childRegistry,
    )

    for await (const ev of stream) {
      if (ev.type === 'text') content += ev.content
      if (ev.type === 'tool_start') { toolsUsed.push(ev.name); iterations++ }
      if (ev.type === 'error') {
        log.warn('Sub-agent continue error', { agentId, error: ev.message })
        if (!content) content = `SubAgent error: ${ev.message}`
      }
    }

    // 记录本轮 assistant 回复，保留完整历史供再次 continue
    inst.messages.push({ id: `cont-assistant-${Date.now()}`, role: 'assistant', content, timestamp: Date.now() })

    subSpan.setAttributes({ iterations, toolsUsed: toolsUsed.join(','), contentLength: content.length })
    subSpan.end('ok')

    log.info('Sub-agent continued', { agentId, iterations, contentLength: content.length })
    return { success: true, content, toolsUsed, iterations }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    log.error('Sub-agent continue failed', { agentId, error: errMsg })
    subSpan.end('error', errMsg)
    return { success: false, content: `SubAgent continue failed: ${errMsg}`, toolsUsed, iterations }
  }
}

/** 会话结束时清理该会话的所有子 Agent 实例 */
export function clearSessionSubAgents(sessionId: string): void {
  let cleared = 0
  for (const [id, inst] of instances) {
    if (inst.sessionId === sessionId) {
      instances.delete(id)
      cleared++
    }
  }
  if (cleared > 0) log.info('Session sub-agents cleared', { sessionId, cleared })
}

/** 测试辅助：清空所有实例 */
export function clearAllSubAgents(): void {
  instances.clear()
}

/** 当前存活实例数（调试/测试用） */
export function getSubAgentCount(): number {
  return instances.size
}
