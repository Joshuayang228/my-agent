/**
 * Agent 错误体系 —— 结构化错误码 + 因果链 + 可作为 UI 事件。
 *
 * 动机（对照 lingxi errs/ + 缺口审计 gap-audit-2026-07 缺口 4）：
 * 之前错误全是裸字符串（`{ type: 'error'; message: string }`），前端只能统一渲染
 * `⚠️ message`，无法按错误类型区分 UI 表现（该显示重试按钮？降级提示？人格化道歉？）。
 *
 * 这个模块提供三件事：
 * 1. AgentErrorCode —— agent 领域的错误码枚举（每个码对应真实抛错场景）
 * 2. AgentError —— 带 code + 因果链（cause）+ 可重试标记的结构化错误
 * 3. toAgentError —— 把任意 unknown 错误归一成 AgentError（含 LLMError 互操作）
 *
 * 联动 M9 人格引擎：错误码决定"伙伴"用什么语气回应失败——参考 lingxi 权限拒绝话术
 * （"请以「您拒绝了…」开头回复用户"），错误码是人格化话术的分派依据。
 */

import { sanitizeError } from '../utils/sanitize-error'

/**
 * Agent 领域错误码。
 * 每个码都对应代码里真实存在的抛错/终止场景，不凭空造。
 * 命名用 SCREAMING_SNAKE，前缀按子系统分组（CONFIG_/SESSION_/CONTEXT_/LLM_/TOOL_/PERMISSION_）。
 */
export enum AgentErrorCode {
  // 配置类
  CONFIG_MISSING_API_KEY = 'CONFIG_MISSING_API_KEY',   // runtime.ts: 未配置 API Key
  // 会话类
  SESSION_BUSY = 'SESSION_BUSY',                       // runtime.ts: 会话已在处理中
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',                 // runtime.ts: token 预算超限
  // 上下文类
  CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',               // loop.ts: 413 压缩后仍超限
  MAX_TURNS_REACHED = 'MAX_TURNS_REACHED',             // loop.ts: 达到最大迭代次数
  ABORTED = 'ABORTED',                                 // loop.ts: 被用户取消
  // LLM 类
  LLM_RATE_LIMITED = 'LLM_RATE_LIMITED',               // 429/限流（可重试）
  LLM_REQUEST_FAILED = 'LLM_REQUEST_FAILED',           // 其他 LLM 调用失败
  // 工具类
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',     // 工具执行抛错
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',                       // 工具超时
  // 权限类
  PERMISSION_DENIED = 'PERMISSION_DENIED',             // 沙箱/权限拒绝
  // 兜底
  UNKNOWN = 'UNKNOWN',
}

/** 每个错误码的元数据：是否可重试（指导 loop 重试）+ 是否用户可操作（指导 UI） */
interface CodeMeta {
  /** 是否值得自动重试（对照 M1 §5.1 可重试/不可重试分类） */
  retryable: boolean
}

const CODE_META: Record<AgentErrorCode, CodeMeta> = {
  [AgentErrorCode.CONFIG_MISSING_API_KEY]: { retryable: false },
  [AgentErrorCode.SESSION_BUSY]: { retryable: false },
  [AgentErrorCode.BUDGET_EXCEEDED]: { retryable: false },
  [AgentErrorCode.CONTEXT_TOO_LONG]: { retryable: false },
  [AgentErrorCode.MAX_TURNS_REACHED]: { retryable: false },
  [AgentErrorCode.ABORTED]: { retryable: false },
  [AgentErrorCode.LLM_RATE_LIMITED]: { retryable: true },
  [AgentErrorCode.LLM_REQUEST_FAILED]: { retryable: true },
  [AgentErrorCode.TOOL_EXECUTION_FAILED]: { retryable: false },
  [AgentErrorCode.TOOL_TIMEOUT]: { retryable: true },
  [AgentErrorCode.PERMISSION_DENIED]: { retryable: false },
  [AgentErrorCode.UNKNOWN]: { retryable: false },
}

/**
 * 结构化 Agent 错误。
 * - code：领域错误码，供分类处置
 * - cause：因果链上一环（保留原始错误，不丢失堆栈信息）
 * - retryable：是否可自动重试（从 code 元数据推导，也可显式覆盖）
 */
export class AgentError extends Error {
  readonly code: AgentErrorCode
  readonly cause?: unknown
  readonly retryable: boolean

  constructor(
    code: AgentErrorCode,
    message: string,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(message)
    this.name = 'AgentError'
    this.code = code
    this.cause = options?.cause
    this.retryable = options?.retryable ?? CODE_META[code].retryable
  }

  /** 是否是某个错误码（类型安全的判断，替代裸字符串比较） */
  is(code: AgentErrorCode): boolean {
    return this.code === code
  }

  /**
   * 转成流事件用的 payload：脱敏后的 message + code。
   * 前端可按 code 分派 UI 表现（重试按钮/降级提示/人格化话术）。
   */
  toEventPayload(): { message: string; code: AgentErrorCode } {
    return { message: sanitizeError(this.message), code: this.code }
  }

  /** 沿 cause 链收集所有 message，便于日志排查（不给前端看，仅内部诊断） */
  chain(): string {
    const parts: string[] = [`[${this.code}] ${this.message}`]
    let cur: unknown = this.cause
    let depth = 0
    while (cur && depth < 10) {
      if (cur instanceof Error) {
        parts.push(`  ↳ ${cur.name}: ${cur.message}`)
        cur = (cur as { cause?: unknown }).cause
      } else {
        parts.push(`  ↳ ${String(cur)}`)
        cur = undefined
      }
      depth++
    }
    return parts.join('\n')
  }
}

/**
 * 把任意 unknown 错误归一成 AgentError。
 * - 已是 AgentError：原样返回
 * - LLMError：按 status 映射到 LLM_RATE_LIMITED（429）或 LLM_REQUEST_FAILED，保留 cause
 * - 其他 Error / 字符串：包成 UNKNOWN，保留原始为 cause
 *
 * 用 duck-typing 识别 LLMError（避免 errs → llm 的循环 import）。
 */
export function toAgentError(err: unknown): AgentError {
  if (err instanceof AgentError) return err

  // LLMError duck-typing：有 status 数字字段的 Error 视为 LLM 错误
  if (err instanceof Error && typeof (err as { status?: unknown }).status === 'number') {
    const status = (err as { status: number }).status
    const code = status === 429 ? AgentErrorCode.LLM_RATE_LIMITED : AgentErrorCode.LLM_REQUEST_FAILED
    return new AgentError(code, err.message, { cause: err })
  }

  if (err instanceof Error) {
    return new AgentError(AgentErrorCode.UNKNOWN, err.message, { cause: err })
  }

  return new AgentError(AgentErrorCode.UNKNOWN, String(err))
}
