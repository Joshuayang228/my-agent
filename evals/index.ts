/**
 * Eval Suite 入口
 *
 * 使用方式：
 *   npx ts-node evals/index.ts               # 跑全部场景（脚本 LLM）
 *   npx ts-node evals/index.ts --id F01      # 只跑单个场景
 *   npx ts-node evals/index.ts --verbose     # 详细输出
 */

import { runSuite } from './runner'
import type { EvalScenario } from './types'

import { F01 } from './scenarios/f01'
import { F02, F03, F04, F05, F06, F07 } from './scenarios/f02-f07'
import { F08 } from './scenarios/f08'
import { P01, P02, P03, P04 } from './scenarios/p01-p04'
import { P05, P06 } from './scenarios/p05-p06'
import { B01 } from './scenarios/b01-persona-tone'
import { C01 } from './scenarios/c01-companion'

const ALL_SCENARIOS: EvalScenario[] = [
  F01, F02, F03, F04, F05, F06, F07, F08,
  P01, P02, P03, P04,
  P05, P06,
  B01,
  C01,
]

async function main() {
  const args = process.argv.slice(2)
  const idFilter = args.includes('--id') ? args[args.indexOf('--id') + 1] : undefined
  const verbose = args.includes('--verbose') || args.includes('-v')

  const scenarios = idFilter
    ? ALL_SCENARIOS.filter((s) => s.id === idFilter)
    : ALL_SCENARIOS

  if (scenarios.length === 0) {
    console.error(`未找到场景 ID: ${idFilter}`)
    process.exit(1)
  }

  console.log(`\n📋 My Agent Eval Suite — ${new Date().toISOString()}`)
  console.log(`   场景数: ${scenarios.length}（脚本 LLM 模式）\n`)

  const report = await runSuite(scenarios, { verbose })

  console.log('\n──────────────────────────────')
  console.log(`结果: ${report.passed}/${report.totalScenarios} 通过`)
  if (report.required_failed > 0) {
    console.log(`⚠️  必须通过的场景失败: ${report.required_failed} 个`)
  }
  console.log('──────────────────────────────\n')

  // 打印失败详情
  for (const r of report.results) {
    if (!r.pass) {
      console.log(`❌ ${r.id}: ${r.description}`)
      if (r.error) console.log(`   Error: ${r.error}`)
      for (const gr of r.graderResults) {
        if (!gr.result.pass) {
          console.log(`   [${gr.graderName}]`)
          for (const v of gr.result.violations) {
            console.log(`     · ${v}`)
          }
        }
      }
    }
  }

  process.exit(report.required_failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Eval runner 异常:', err)
  process.exit(1)
})
