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

import { F01 } from './scenarios/f01'
import { F02, F03, F04, F05, F06, F07 } from './scenarios/f02-f07'
import { F08 } from './scenarios/f08'
import { P01, P02, P03, P04 } from './scenarios/p01-p04'
import { P05, P06 } from './scenarios/p05-p06'
import { C01 } from './scenarios/c01-companion'
import { C02 } from './scenarios/c02-aside-quality'
import { B01 } from './scenarios/b01-persona-tone'
import { B02, B03, B04, B05, B06, B07 } from './scenarios/b02-protagonist-behavior'
import type { EvalScenario } from './types'

const ALL_SCENARIOS: EvalScenario[] = [
  F01, F02, F03, F04, F05, F06, F07, F08,
  P01, P02, P03, P04,
  P05, P06,
  B01, B02, B03, B04, B05, B06, B07,
  C01,
  C02,
]

const idFilter = process.env['EVAL_ID']
const scenarios = idFilter
  ? ALL_SCENARIOS.filter((s) => s.id === idFilter)
  : ALL_SCENARIOS

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
