import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getSkillEvalReport, listSkillEvalReports } from '../../electron/main/debug/skill-eval-reports'
import type { SkillEvalReport } from '../../src/shared/types'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function makeReport(timestamp: string, pass = true): SkillEvalReport {
  return {
    timestamp,
    mode: 'mock',
    model: 'mock-model',
    baseUrl: 'mock://local',
    pass,
    totalCases: 1,
    passedCases: pass ? 1 : 0,
    cases: [{
      id: 'S01',
      description: '触发 Skill',
      pass,
      durationMs: 10,
      input: {
        userPrompt: '请审阅代码',
        model: 'mock-model',
        baseUrl: 'mock://local',
        skill: { name: 'code-review', version: '1.0', source: 'builtin', fingerprint: 'abc', toolName: 'skill_invoke_code_review' },
        expectedActivation: true,
        allowedTools: [],
      },
      evidence: {
        activations: [{ name: 'code-review', toolName: 'skill_invoke_code_review', source: 'builtin', version: '1.0', fingerprint: 'abc', activatedAt: 1 }],
        toolCalls: ['skill_invoke_code_review'],
        injectionObserved: true,
        agentText: '完成审阅',
      },
      graderResults: [{ graderName: 'SkillActivation', result: { pass, violations: [], evidence: ['已激活'] } }],
    }],
  }
}

describe('skill eval reports', () => {
  it('只读取合法 Skill Eval JSON，并按时间倒序返回', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'skill-eval-reports-'))
    dirs.push(dir)
    const older = '2026-08-13T10-00-00-000Z-skill-eval-mock-pass.json'
    const newer = '2026-08-14T10-00-00-000Z-skill-eval-mock-fail.json'
    writeFileSync(path.join(dir, older), JSON.stringify(makeReport('2026-08-13T10:00:00.000Z')))
    writeFileSync(path.join(dir, newer), JSON.stringify(makeReport('2026-08-14T10:00:00.000Z', false)))
    writeFileSync(path.join(dir, '2026-08-14T11-00-00-000Z-skill-eval-mock-pass.json'), '{broken')
    writeFileSync(path.join(dir, 'unrelated.json'), '{}')

    const index = await listSkillEvalReports(dir)
    expect(index.reports.map((item) => item.fileName)).toEqual([newer, older])
    expect(index.latest?.fileName).toBe(newer)
    expect(index.skippedFiles).toBe(1)
    expect(await getSkillEvalReport(dir, '../secret.json')).toBeNull()
  })
})
