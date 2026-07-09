import { describe, it, expect } from 'vitest'
import { AgentError, AgentErrorCode, toAgentError } from '../../electron/main/errs'

describe('AgentError', () => {
  it('从 code 元数据推导 retryable', () => {
    const rateLimited = new AgentError(AgentErrorCode.LLM_RATE_LIMITED, 'rate limited')
    expect(rateLimited.retryable).toBe(true)

    const configErr = new AgentError(AgentErrorCode.CONFIG_MISSING_API_KEY, 'no key')
    expect(configErr.retryable).toBe(false)
  })

  it('可显式覆盖 retryable', () => {
    const err = new AgentError(AgentErrorCode.UNKNOWN, 'x', { retryable: true })
    expect(err.retryable).toBe(true)
  })

  it('is() 类型安全判断错误码', () => {
    const err = new AgentError(AgentErrorCode.SESSION_BUSY, 'busy')
    expect(err.is(AgentErrorCode.SESSION_BUSY)).toBe(true)
    expect(err.is(AgentErrorCode.UNKNOWN)).toBe(false)
  })

  it('toEventPayload 返回脱敏 message + code', () => {
    const err = new AgentError(AgentErrorCode.LLM_REQUEST_FAILED, 'failed with key sk-abcd1234efgh5678')
    const payload = err.toEventPayload()
    expect(payload.code).toBe(AgentErrorCode.LLM_REQUEST_FAILED)
    expect(payload.message).not.toContain('sk-abcd1234efgh5678')
    expect(payload.message).toContain('sk-***')
  })

  it('chain() 沿 cause 链收集诊断信息', () => {
    const root = new Error('root cause')
    const mid = new AgentError(AgentErrorCode.LLM_REQUEST_FAILED, 'mid', { cause: root })
    const chain = mid.chain()
    expect(chain).toContain('[LLM_REQUEST_FAILED] mid')
    expect(chain).toContain('root cause')
  })

  it('chain() 防止无限循环（深度上限）', () => {
    // 构造自引用 cause，确认不死循环
    const err = new AgentError(AgentErrorCode.UNKNOWN, 'a')
    ;(err as { cause?: unknown }).cause = err
    expect(() => err.chain()).not.toThrow()
  })
})

describe('toAgentError', () => {
  it('AgentError 原样返回', () => {
    const orig = new AgentError(AgentErrorCode.SESSION_BUSY, 'busy')
    expect(toAgentError(orig)).toBe(orig)
  })

  it('LLMError (status=429) 映射到 LLM_RATE_LIMITED', () => {
    const llmErr = Object.assign(new Error('too many requests'), { status: 429 })
    const agentErr = toAgentError(llmErr)
    expect(agentErr.code).toBe(AgentErrorCode.LLM_RATE_LIMITED)
    expect(agentErr.retryable).toBe(true)
    expect(agentErr.cause).toBe(llmErr)
  })

  it('LLMError (status=500) 映射到 LLM_REQUEST_FAILED', () => {
    const llmErr = Object.assign(new Error('server error'), { status: 500 })
    const agentErr = toAgentError(llmErr)
    expect(agentErr.code).toBe(AgentErrorCode.LLM_REQUEST_FAILED)
  })

  it('普通 Error 包成 UNKNOWN 并保留 cause', () => {
    const plain = new Error('boom')
    const agentErr = toAgentError(plain)
    expect(agentErr.code).toBe(AgentErrorCode.UNKNOWN)
    expect(agentErr.cause).toBe(plain)
  })

  it('字符串包成 UNKNOWN', () => {
    const agentErr = toAgentError('just a string')
    expect(agentErr.code).toBe(AgentErrorCode.UNKNOWN)
    expect(agentErr.message).toBe('just a string')
  })
})
