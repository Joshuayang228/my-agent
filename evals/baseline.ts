/**
 * Baseline diff（M18）— 对比当前 EvalReport 与版本化基线，标出回归。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { EvalReport } from './types'

export interface BaselineDiff {
  regressions: string[]
  improvements: string[]
  unchanged: string[]
  newScenarios: string[]
  missingScenarios: string[]
}

export function loadBaseline(path: string): EvalReport | null {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as EvalReport
}

export function saveBaseline(path: string, report: EvalReport): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf-8')
}

/** 对比当前报告与基线：基线通过 → 当前失败 = 回归 */
export function diffBaseline(current: EvalReport, baseline: EvalReport): BaselineDiff {
  const baseMap = new Map(baseline.results.map(r => [r.id, r.pass]))
  const curMap = new Map(current.results.map(r => [r.id, r.pass]))

  const regressions: string[] = []
  const improvements: string[] = []
  const unchanged: string[] = []
  const newScenarios: string[] = []
  const missingScenarios: string[] = []

  for (const [id, pass] of curMap) {
    if (!baseMap.has(id)) {
      newScenarios.push(id)
      continue
    }
    const was = baseMap.get(id)!
    if (was && !pass) regressions.push(id)
    else if (!was && pass) improvements.push(id)
    else unchanged.push(id)
  }

  for (const id of baseMap.keys()) {
    if (!curMap.has(id)) missingScenarios.push(id)
  }

  return { regressions, improvements, unchanged, newScenarios, missingScenarios }
}
