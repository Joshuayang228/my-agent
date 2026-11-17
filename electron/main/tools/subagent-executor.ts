import type { ExecutionMode, ToolContext, LLMConfig } from '../../../src/shared/types'
import type { ToolRegistry } from './registry'

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


export interface SubAgentExecutor {
  run: (config: SubAgentConfig, llmConfig: LLMConfig, registry: ToolRegistry, signal?: AbortSignal) => Promise<SubAgentResult>
  continue: (agentId: string, message: string, signal?: AbortSignal) => Promise<Omit<SubAgentResult, 'agentId'>>
}

let executor: SubAgentExecutor | undefined

/**
 * 背景：委派工具需要宿主的子任务执行能力，直接导入 agent 会形成工具层向上反向依赖。
 * 设计意图：Runtime 在组合入口注入执行端口，工具层只拥有调用契约，运行实例仍由 Agent Runtime 管理。
 * 关键约束：未装配时拒绝执行，权限、取消和父会话边界仍由原子任务运行时检查。
 */
export function configureSubAgentExecutor(value: SubAgentExecutor): void { executor = value }

export function getSubAgentExecutor(): SubAgentExecutor {
  if (!executor) throw new Error('子任务运行时尚未初始化。')
  return executor
}
