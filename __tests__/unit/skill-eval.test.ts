import { afterEach, describe, expect, it, vi } from 'vitest'
import { CODE_REVIEW_SKILL, SKILL_EVAL_CASES } from '../../evals/skill/cases'
import { formatSkillEvalReportMarkdown, sanitizeSkillEvalReport } from '../../evals/skill/report'
import {
  gradeSkillActivation,
  gradeSkillResponse,
  gradeSkillToolBoundary,
  runSkillEvalSuite,
} from '../../evals/skill/runner'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('skill eval', () => {
  it('三个内置 Case 验证触发、非触发和 allowed_tools 边界', async () => {
    const report = await runSkillEvalSuite(SKILL_EVAL_CASES)
    expect(report.pass).toBe(true)
    expect(report.cases.map((item) => [item.id, item.pass])).toEqual([
      ['S01', true],
      ['S02', true],
      ['S03', true],
    ])
    expect(report.cases[0].evidence.injectionObserved).toBe(true)
    expect(report.cases[1].evidence.activations).toEqual([])
    expect(report.cases[2].evidence.toolCalls).toContain('file_read')
  })

  it('应触发但未激活、误触发、越权工具和回复缺项都会失败', () => {
    const trace = [{
      name: CODE_REVIEW_SKILL.meta.name,
      toolName: 'skill_invoke_code_review',
      source: CODE_REVIEW_SKILL.source,
      version: CODE_REVIEW_SKILL.meta.version || 'unversioned',
      fingerprint: 'fingerprint',
      reason: '误触发',
      activatedAt: Date.now(),
    }]
    expect(gradeSkillActivation(true, CODE_REVIEW_SKILL.meta.name, []).pass).toBe(false)
    expect(gradeSkillActivation(false, CODE_REVIEW_SKILL.meta.name, trace).pass).toBe(false)
    expect(gradeSkillToolBoundary('skill_invoke_code_review', ['file_read'], ['skill_invoke_code_review', 'shell_exec']).pass).toBe(false)
    expect(gradeSkillResponse('只有普通回复', ['必须修复']).pass).toBe(false)
  })

  it('报告只保存元数据和证据，不包含 Skill 正文或 API Key', async () => {
    vi.stubEnv('LLM_API_KEY', 'sk-super-secret-value')
    const report = await runSkillEvalSuite([SKILL_EVAL_CASES[0]])
    const unsafeReport = {
      ...report,
      baseUrl: 'https://user:password@example.test/v1?api_key=hidden-value',
      cases: report.cases.map((testCase) => ({
        ...testCase,
        input: { ...testCase.input, baseUrl: 'https://user:password@example.test/v1?token=hidden-value' },
        evidence: { ...testCase.evidence, agentText: `${testCase.evidence.agentText} Bearer sk-abcdefghijklmnop` },
      })),
    }
    const safeReport = sanitizeSkillEvalReport(unsafeReport)
    const json = JSON.stringify(safeReport)
    const markdown = formatSkillEvalReportMarkdown(unsafeReport)
    expect(json).not.toContain(CODE_REVIEW_SKILL.body)
    expect(markdown).not.toContain(CODE_REVIEW_SKILL.body)
    expect(json).not.toContain('sk-super-secret-value')
    expect(markdown).not.toContain('sk-super-secret-value')
    expect(json).not.toContain('password')
    expect(json).not.toContain('hidden-value')
    expect(json).not.toContain('sk-abcdefghijklmnop')
    expect(markdown).not.toContain('hidden-value')
  })

  it('Real 模式缺少 API Key 时不发起模型请求', async () => {
    vi.stubEnv('EVAL_MODE', 'real')
    vi.stubEnv('LLM_API_KEY', '')
    vi.stubEnv('TEST_LLM_API_KEY', '')
    const report = await runSkillEvalSuite([SKILL_EVAL_CASES[0]])
    expect(report.pass).toBe(false)
    expect(report.cases[0].error).toBe('Real Skill Eval 缺少 API Key')
    expect(report.cases[0].evidence.toolCalls).toEqual([])
  })
})
