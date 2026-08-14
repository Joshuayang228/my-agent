/**
 * Skill Eval 的独立 Vitest 入口。
 *
 * 背景：Skill 证据链需要与普通 Mock Eval、付费 Persona Eval 分开运行和展示。
 * 设计意图：默认使用确定性的 Mock LLM 串行执行内置 Case，并统一写入 JSON / Markdown 报告。
 * 关键约束：Real 模式只通过环境变量启用；任何 Case 失败都阻断该命令。
 */

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKILL_EVAL_CASES } from './skill/cases'
import { writeSkillEvalReport } from './skill/report'
import { runSkillEvalSuite } from './skill/runner'

describe('Skill Eval', () => {
  it('验证触发、注入、工具边界和回复证据', { timeout: 120_000 }, async () => {
    const report = await runSkillEvalSuite(SKILL_EVAL_CASES)
    const output = writeSkillEvalReport(report, path.resolve(process.cwd(), 'eval-reports'))
    console.log(`Skill Eval JSON: ${output.jsonPath}`)
    console.log(`Skill Eval Markdown: ${output.markdownPath}`)

    const failures = report.cases
      .filter((testCase) => !testCase.pass)
      .map((testCase) => `${testCase.id}: ${testCase.error || testCase.graderResults.flatMap((item) => item.result.violations).join('；')}`)
    expect(report.pass, `Skill Eval 失败：${failures.join(' | ')}`).toBe(true)
  })
})
