import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvalContext } from '../../evals/types'

const chatComplete = vi.fn()

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete,
}))

const { makeModelBasedGrader } = await import('../../evals/graders/model-based')

describe('model-based grader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EVAL_MODE = 'real'
    process.env.LLM_API_KEY = 'test-key'
  })

  it('直接解析 chatComplete 返回的字符串', async () => {
    chatComplete.mockResolvedValue('[1] NOT_FOUND\n[2] VIOLATION_FOUND: 原文证据')
    const grader = makeModelBasedGrader(
      'judge',
      'context',
      [
        { id: 'first', question: 'first?' },
        { id: 'second', question: 'second?' },
      ],
    )
    const ctx: EvalContext = {
      workdir: 'C:\\tmp',
      scenarioId: 'T01',
      transcript: [
        { type: 'text', content: '完整' },
        { type: 'text', content: '回复' },
      ],
    }
    const result = await grader.grade(ctx)
    expect(result.pass).toBe(false)
    expect(result.violations).toEqual(['second: 原文证据'])
    expect(result.evidence).toContain('[1] NOT_FOUND')
    expect(chatComplete).toHaveBeenCalledOnce()
    const prompt = chatComplete.mock.calls[0][0].messages[0].content
    expect(prompt).toContain('完整回复')
  })

  it('兼容 Judge 省略方括号的编号格式', async () => {
    chatComplete.mockResolvedValue('1 NOT_FOUND\n2. NOT_FOUND\n3、VIOLATION_FOUND：原文证据')
    const grader = makeModelBasedGrader(
      'judge',
      '上下文',
      [
        { id: 'plain', question: '问题一？' },
        { id: 'dot', question: '问题二？' },
        { id: 'cn-separator', question: '问题三？' },
      ],
    )
    const result = await grader.grade({
      workdir: 'C:\\tmp',
      scenarioId: 'T03',
      transcript: [{ type: 'text', content: '回复' }],
    })
    expect(result.pass).toBe(false)
    expect(result.violations).toEqual(['cn-separator: 原文证据'])
    expect(result.evidence).toEqual([
      '[1] NOT_FOUND',
      '[2] NOT_FOUND',
      '[3] VIOLATION_FOUND: 原文证据',
    ])
  })

  it('Real 模式把 UNKNOWN 和无法解析视为失败', async () => {
    chatComplete.mockResolvedValue('[1] UNKNOWN: 证据不足')
    const grader = makeModelBasedGrader(
      'judge',
      'context',
      [
        { id: 'unknown', question: 'unknown?' },
        { id: 'missing', question: 'missing?' },
      ],
    )
    const result = await grader.grade({
      workdir: 'C:\\tmp',
      scenarioId: 'T02',
      transcript: [{ type: 'text', content: 'reply' }],
    })
    expect(result.pass).toBe(false)
    expect(result.violations).toEqual([
      'unknown: Judge 返回 UNKNOWN：证据不足',
      'missing: Judge 未返回可解析结论',
    ])
  })
})
