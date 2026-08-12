import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { PersonaEvalReport } from '../../src/shared/types'
import { getPersonaEvalReport, listPersonaEvalReports } from '../../electron/main/debug/persona-eval-reports'

const tempDirs: string[] = []

function makeDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'persona-eval-report-'))
  tempDirs.push(dir)
  return dir
}

function makeReport(timestamp: string, pass = true): PersonaEvalReport {
  return {
    timestamp,
    mode: 'real',
    model: 'deepseek-test',
    baseUrl: 'https://example.test',
    pass,
    totalScenarios: 1,
    passedScenarios: pass ? 1 : 0,
    k: 3,
    scenarios: [{
      id: 'B04',
      description: '复杂任务先找阻塞点',
      pass,
      passes: pass ? 3 : 1,
      k: 3,
      trials: [],
    }],
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('persona eval report reader', () => {
  it('按报告时间倒序返回，并附带最新完整报告', async () => {
    const dir = makeDir()
    const older = '2026-08-11T10-00-00-000Z-persona-b02-b07-pass-3.json'
    const newer = '2026-08-12T10-00-00-000Z-persona-b02-b07-pass-3.json'
    writeFileSync(path.join(dir, older), JSON.stringify(makeReport('2026-08-11T10:00:00.000Z', false)))
    writeFileSync(path.join(dir, newer), JSON.stringify(makeReport('2026-08-12T10:00:00.000Z')))
    writeFileSync(path.join(dir, 'broken-persona-b02-b07-pass-3.json'), '{broken')

    const result = await listPersonaEvalReports(dir)

    expect(result.reports.map((report) => report.fileName)).toEqual([newer, older])
    expect(result.latest?.fileName).toBe(newer)
    expect(result.latest?.scenarios[0].id).toBe('B04')
    expect(result.skippedFiles).toBe(1)
  })

  it('目录不存在时返回空态，且拒绝目录穿越文件名', async () => {
    const root = makeDir()
    const missing = path.join(root, 'missing')
    const empty = await listPersonaEvalReports(missing)
    expect(empty.latest).toBeNull()
    expect(empty.reports).toEqual([])
    expect(await getPersonaEvalReport(root, '../secret.json')).toBeNull()
  })
})
