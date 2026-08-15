/**
 * Eval Suite 的 Vitest 包装器
 *
 * 用 vitest 运行而非 ts-node，复用项目已有的 bundler 模块解析，
 * 与主单测套件（__tests__/unit）完全隔离。
 *
 * 运行：npm run eval:run
 * 跑单场景：EVAL_ID=F01 npm run eval:run
 */

import { describe, it, expect } from 'vitest'
import { runSuite, runScenario } from './runner'

import { EVAL_SCENARIOS } from './scenario-registry'

const idFilter = process.env['EVAL_ID']
const scenarios = idFilter
  ? EVAL_SCENARIOS.filter((s) => s.id === idFilter)
  : EVAL_SCENARIOS

describe('Eval Suite', () => {
  if (idFilter && scenarios.length === 0) {
    it(`场景 ${idFilter} 不存在`, () => {
      expect.fail(`未找到场景 ID: ${idFilter}`)
    })
    return
  }

  // 每个场景一个独立 test，便于单独查看失败原因
  for (const scenario of scenarios) {
    it(`${scenario.id} — ${scenario.description}`, { timeout: 30000 }, async () => {
      const result = await runScenario(scenario)
      if (!result.pass) {
        const details = result.graderResults
          .filter((gr) => !gr.result.pass)
          .map((gr) => `[${gr.graderName}] ${gr.result.violations.join('; ')}`)
          .join('\n')
        const errorInfo = result.error ? `\nRunner Error: ${result.error}` : ''
        expect.fail(`场景失败:\n${details}${errorInfo}`)
      }
    }, { timeout: 30000 })
  }
})
