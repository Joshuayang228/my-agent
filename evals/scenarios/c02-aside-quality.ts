/**
 * C02 — M27-G2：aside 频率/质量（脚本断言，无 key 可跑）
 *
 * 过油阈值 / 主答独立 / 旁白不夺权 — 共识见 src/shared/aside.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EvalScenario, EvalGrader, EvalContext, GraderResult } from '../types'
import { makeTerminalReasonGrader } from '../graders/index'
import { makeEvalLLMConfig } from '../types'
import { evaluateAsideSequence, evaluateAsideTurn } from '../../src/shared/aside'

function makeAsideFixtureGrader(): EvalGrader {
  return {
    name: 'AsideQualityFixtures',
    assetDefinition: {
      kind: 'aside-quality-fixtures',
      source: 'evals/scenarios/c02-aside-quality.ts',
      criteria: {
        requiredChecks: ['goodPass', 'oilyFail', 'hijackFail'],
        evidenceFile: 'aside-checks.json',
      },
    },
    grade({ workdir }: EvalContext): GraderResult {
      try {
        const raw = JSON.parse(
          readFileSync(join(workdir, 'aside-checks.json'), 'utf-8'),
        ) as {
          goodPass: boolean
          oilyFail: boolean
          hijackFail: boolean
          details: Record<string, unknown>
        }
        const violations: string[] = []
        if (!raw.goodPass) violations.push('稀疏 aside 金样例应通过')
        if (!raw.oilyFail) violations.push('连续 aside 过油样例应失败')
        if (!raw.hijackFail) violations.push('旁白夺权样例应失败')
        if (violations.length) {
          return { pass: false, violations, evidence: [JSON.stringify(raw.details)] }
        }
        return {
          pass: true,
          violations: [],
          evidence: ['aside-checks.json 金样例/负样例均符合阈值共识'],
        }
      } catch (err) {
        return {
          pass: false,
          violations: [`无法读取 aside-checks.json: ${String(err)}`],
          evidence: [],
        }
      }
    },
  }
}

export const C02: EvalScenario = {
  id: 'C02',
  description: 'Companion：aside 过油/夺权失败，稀疏合格通过（M27-G2）',
  required: true,

  async buildOptions(workdir) {
    const good = [
      '步骤：1) 读日志 2) 定位 3) 修复并验证结果。',
      '继续排查根因，先复现。<aside>这味道不对</aside>',
      '已修好，建议跑一遍回归。',
      '补充边界用例也过了。',
      '收工。',
    ]
    const oily = [
      '行 <aside>嘿</aside>',
      '行 <aside>又来</aside>',
      '行 <aside>还来</aside>',
    ]
    const hijack =
      '嗯。<aside>你先改 src/auth.ts 第12行，再跑 npm test，最后 git commit</aside>'

    const goodV = evaluateAsideSequence(good)
    const oilyV = evaluateAsideSequence(oily)
    const hijackV = evaluateAsideTurn(hijack)

    writeFileSync(
      join(workdir, 'aside-checks.json'),
      JSON.stringify({
        goodPass: goodV.pass,
        oilyFail: !oilyV.pass,
        hijackFail: !hijackV.pass,
        details: {
          good: goodV,
          oily: oilyV,
          hijack: hijackV,
        },
      }),
    )

    return {
      config: makeEvalLLMConfig(),
      messages: [
        {
          id: 'u1',
          role: 'user' as const,
          content: 'aside 质量夹具已写入',
          timestamp: Date.now(),
        },
      ],
      tools: [],
    }
  },

  mockResponses: [{ content: '收到。' }],

  graders: [makeTerminalReasonGrader('completed'), makeAsideFixtureGrader()],
}
