/**
 * 普通 Eval Scenario 唯一注册表。
 *
 * 背景：CLI 与 Vitest 曾分别维护场景数组，已经出现 C02 只在测试入口存在的漂移。
 * 设计意图：把场景对象、来源和套件元数据放在同一注册入口，Runner 与 Debug 资产目录共同消费。
 * 关键约束：本文件只登记静态场景，不执行 Runner、不读取环境变量，也不包含 Skill Eval Case。
 */

import type { EvalScenario } from './types'
import { B01 } from './scenarios/b01-persona-tone'
import { B02, B03, B04, B05, B06, B07 } from './scenarios/b02-protagonist-behavior'
import { C01 } from './scenarios/c01-companion'
import { C02 } from './scenarios/c02-aside-quality'
import { F01 } from './scenarios/f01'
import { F02, F03, F04, F05, F06, F07 } from './scenarios/f02-f07'
import { F08 } from './scenarios/f08'
import { P01, P02, P03, P04 } from './scenarios/p01-p04'
import { P05, P06 } from './scenarios/p05-p06'

export type EvalScenarioSuite = 'framework' | 'persona' | 'companion'

export interface RegisteredEvalScenario {
  scenario: EvalScenario
  source: string
  suite: EvalScenarioSuite
}

function register(
  scenarios: EvalScenario[],
  source: string,
  suite: EvalScenarioSuite,
): RegisteredEvalScenario[] {
  return scenarios.map((scenario) => ({ scenario, source, suite }))
}

export const REGISTERED_EVAL_SCENARIOS: RegisteredEvalScenario[] = [
  ...register([F01], 'evals/scenarios/f01.ts', 'framework'),
  ...register([F02, F03, F04, F05, F06, F07], 'evals/scenarios/f02-f07.ts', 'framework'),
  ...register([F08], 'evals/scenarios/f08.ts', 'framework'),
  ...register([P01, P02, P03, P04], 'evals/scenarios/p01-p04.ts', 'persona'),
  ...register([P05, P06], 'evals/scenarios/p05-p06.ts', 'persona'),
  ...register([B01], 'evals/scenarios/b01-persona-tone.ts', 'persona'),
  ...register([B02, B03, B04, B05, B06, B07], 'evals/scenarios/b02-protagonist-behavior.ts', 'persona'),
  ...register([C01], 'evals/scenarios/c01-companion.ts', 'companion'),
  ...register([C02], 'evals/scenarios/c02-aside-quality.ts', 'companion'),
]

export const EVAL_SCENARIOS: EvalScenario[] = REGISTERED_EVAL_SCENARIOS.map(({ scenario }) => scenario)
