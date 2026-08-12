/**
 * B02–B07 真实模型 pass^k 门禁。
 *
 * 背景：普通 eval:run 需要保持无网络、无费用；远程人格验收必须明确调用真实模型并保存报告。
 * 设计意图：使用单个 Vitest test 串行运行六个场景，每场景 k 次，最后统一输出 JSON/Markdown。
 * 关键约束：固定 real 模式；缺 Key 直接失败；只有全部场景 pass^k 才通过。
 */

import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getEvalModelInfo, getEvalPassK, loadEvalEnvironment } from './eval-config'
import { runPassK } from './runner'
import { PERSONA_BEHAVIOR_SCENARIOS } from './scenarios/b02-protagonist-behavior'
import { writePersonaEvalReport, type PersonaEvalReport } from './report'

describe('Persona Real Eval', () => {
  it('B02–B07 pass^k', { timeout: 15 * 60 * 1000 }, async () => {
    loadEvalEnvironment()
    process.env.EVAL_MODE = 'real'
    const modelInfo = getEvalModelInfo()
    expect(modelInfo.hasApiKey, 'Real Persona Eval 缺少 API Key').toBe(true)
    const k = getEvalPassK(3)
    const scenarios = []

    for (const scenario of PERSONA_BEHAVIOR_SCENARIOS) {
      const result = await runPassK(scenario, k, ({ trialIndex, result: trial }) => {
        console.log(`[PERSONA_EVAL_PROGRESS]${JSON.stringify({
          scenarioId: scenario.id,
          trial: trialIndex + 1,
          k,
          pass: trial.pass,
        })}`)
      })
      scenarios.push({
        id: scenario.id,
        description: scenario.description,
        pass: result.pass,
        passes: result.passes,
        k,
        trials: result.trials,
      })
    }

    const passedScenarios = scenarios.filter((scenario) => scenario.pass).length
    const report: PersonaEvalReport = {
      timestamp: new Date().toISOString(),
      mode: 'real',
      model: modelInfo.model,
      baseUrl: modelInfo.baseUrl,
      pass: passedScenarios === scenarios.length,
      totalScenarios: scenarios.length,
      passedScenarios,
      k,
      scenarios,
    }
    const output = writePersonaEvalReport(
      report,
      path.resolve(process.cwd(), 'eval-reports'),
    )
    console.log(`Persona Eval JSON: ${output.jsonPath}`)
    console.log(`Persona Eval Markdown: ${output.markdownPath}`)

    const failures = scenarios
      .filter((scenario) => !scenario.pass)
      .map((scenario) => `${scenario.id} ${scenario.passes}/${scenario.k}`)
    expect(report.pass, `Persona pass^k 失败：${failures.join(', ')}`).toBe(true)
  })
})
