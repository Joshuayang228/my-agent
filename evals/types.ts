/**
 * Eval 体系核心类型
 *
 * 对应 methodology/m12-eval.md 的架构设计：
 * - EvalScenario：task 的完整定义（setup / mock LLM / graders）
 * - EvalGrader：独立上下文的评估者（只看 transcript，不看推理过程）
 * - GraderResult：具体问题列表，不是综合分数
 */

import type {
  AgentLoopOptions,
  LLMConfig,
  PersonaEvalAgentInputSnapshot,
  PersonaEvalJudgeSnapshot,
} from '../src/shared/types'
import type { ToolRegistry } from '../electron/main/tools/registry'
import { loadEvalEnvironment } from './eval-config'

// ── Mock LLM ──

/** 一轮 LLM 调用的预设响应（脚本 LLM 模式） */
export interface MockTurn {
  /** 文本回复（可选） */
  content?: string
  /** 工具调用列表（可选） */
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
  }>
  /** usage 统计（可选，有默认值） */
  usage?: { promptTokens: number; completionTokens: number }
}

// ── Grader ──

export interface GraderResult {
  /** 是否通过 */
  pass: boolean
  /** 具体违规点（可操作），空数组 = 通过 */
  violations: string[]
  /** 引用的具体事件或状态作为证据 */
  evidence: string[]
}

export interface EvalContext {
  /** 临时工作目录（每个场景独立） */
  workdir: string
  /** 完整事件流 */
  transcript: AgentStreamEvent[]
  /** 场景 ID，供 grader 组织报告 */
  scenarioId: string
}

export interface ViolationCheck {
  /** 便于报告和证据引用的稳定 ID。 */
  id: string
  /** 负向二元判断问题：是否存在某种违规。 */
  question: string
}

export interface EvalModelJudgePlan {
  kind: 'model-judge'
  invocationMode: 'single-call'
  systemContext: string
  checks: ViolationCheck[]
}

export interface EvalGraderAssetDefinition {
  /** 稳定的评分器种类，用于 Case 范围内生成资产 key。 */
  kind: string
  /** 实际 grade 实现或工厂所在的生产源文件。 */
  source: string
  /** 与真实评分器实例共享的结构化判据；不得包含运行时 transcript。 */
  criteria: Record<string, unknown>
}

export interface EvalGrader {
  name: string
  assetDefinition: EvalGraderAssetDefinition
  /** 仅用于报告解释评分计划，不参与判定。 */
  reportPlan?: EvalModelJudgePlan
  grade(ctx: EvalContext): GraderResult | Promise<GraderResult>
}

// ── Scenario ──

export interface EvalScenario {
  /** 唯一 ID，如 'F01' / 'P03' */
  id: string
  /** 一句话描述 */
  description: string
  /**
   * 构建 agentLoop options。
   * 可以返回完整 AgentLoopOptions（含 _streamChatOverride）供需要自定义 mock 的场景使用；
   * 也可以不包含 _streamChatOverride，runner 会根据 mockResponses 自动注入。
   */
  buildOptions: (
    workdir: string,
    registry: ToolRegistry,
  ) => Promise<AgentLoopOptions>
  /**
   * 注册场景所需的工具（runner 新建空 ToolRegistry 后调用）。
   * 不传则使用空 registry。
   */
  registerTools?: (registry: ToolRegistry) => void
  /**
   * 脚本 LLM 响应序列。
   * 为 undefined 时使用真实 LLM（需要 API key）。
   * 每个 MockTurn 对应一次 streamChat 调用。
   */
  mockResponses?: MockTurn[]
  /** Grader 列表（顺序执行，有任何一个不通过 = 场景失败） */
  graders: EvalGrader[]
  /** 发版时是否必须通过（false = 仅参考，不阻断） */
  required: boolean
}

// ── Report ──

export interface ScenarioResult {
  id: string
  description: string
  pass: boolean
  durationMs: number
  graderResults: Array<{
    graderName: string
    result: GraderResult
  }>
  /** 供远程报告审阅的用户可见回复，不含 reasoning / tool 原始输出。 */
  agentTexts: string[]
  /** 本次 Trial 实际传给 AgentLoop 的初始输入，不含 API Key。 */
  agentInput?: PersonaEvalAgentInputSnapshot
  /** Agent 回复后，一次性发送给 Model Judge 的全部检查项。 */
  judge?: PersonaEvalJudgeSnapshot
  error?: string
  mode?: 'mock' | 'real'
}

export interface EvalReport {
  timestamp: string
  mode: 'mock' | 'real'
  model?: string
  baseUrl?: string
  hasApiKey: boolean
  totalScenarios: number
  passed: number
  failed: number
  required_failed: number
  results: ScenarioResult[]
}

// ── LLM config for eval ──

/** 给 eval 用的最小 LLMConfig（real LLM 场景需传入真实 key） */
export function makeEvalLLMConfig(overrides?: Partial<LLMConfig>): LLMConfig {
  loadEvalEnvironment()
  return {
    apiKey: process.env.TEST_LLM_API_KEY || process.env.LLM_API_KEY || 'eval-mock-key',
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4o',
    ...overrides,
  }
}
