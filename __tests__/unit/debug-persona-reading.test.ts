import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DebugPersonaEvalReport } from '../../src/shared/types'
import { PersonaReportEvidence, personaReportNotices, personaReviewKey, personaTrialId } from '../../src/components/debug/PersonaReportEvidence'
import { getPersonaEvalReport } from '../../electron/main/debug/persona-eval-reports'

const report = (): DebugPersonaEvalReport => ({ fileName: '2026-10-26T06-00-00-000Z-persona-b02-b07-pass-1.json', timestamp: '2026-10-26T06:00:00Z', mode: 'real', model: 'saved-model', baseUrl: 'mock://saved', pass: false, totalScenarios: 1, passedScenarios: 0, k: 1, scenarios: [{ id: 'B02', description: '保存场景', pass: false, passes: 0, k: 1, trials: [{ id: 'original-trial', description: '原轮次', pass: false, durationMs: 0, error: '保存错误', agentTexts: ['原始人格回复。'.repeat(100)], graderResults: [{ graderName: 'constructor', result: { pass: false, violations: ['保存违规'], evidence: ['保存依据'] } }], agentInput: { model: 'input-model', baseUrl: 'mock://input', executionMode: 'confirm-all', messages: [{ role: 'user', content: '原用户问题' }], toolNames: ['read'], systemPrompt: '原始系统快照' }, judge: { graderName: 'saved-judge', invocationMode: 'single-call', systemContext: '原评分背景', checks: [{ id: 'check', question: '原评分问题' }] } }] }] })
const render = (value: DebugPersonaEvalReport, ambiguous = false, ready = true) => renderToStaticMarkup(createElement(PersonaReportEvidence, { reportFileName: value.fileName, scenario: value.scenarios[0], reviews: {}, reviewsReady: ready, reviewWritable: ready, ambiguous, onSave: async () => false, onDelete: async () => false }))

describe('人格报告保存证据阅读', () => {
  it('完整回复、实际输入、Judge、原字段与历史轮次键保留，不改判分', () => {
    const value = report(), before = JSON.stringify(value), html = render(value)
    for (const text of [value.scenarios[0].trials[0].agentTexts[0], '保存错误', 'constructor', '保存违规', '保存依据', 'input-model', '原用户问题', 'confirm-all', 'read', '原始系统快照', 'saved-judge', '原评分背景', '原评分问题', 'original-trial', '原轮次', '0 ms', '人工审阅']) expect(html).toContain(text)
    expect(personaTrialId('B02', 0)).toBe('B02-trial-1')
    expect(personaReviewKey('a::b', 'c')).not.toBe(personaReviewKey('a', 'b::c'))
    expect(JSON.stringify(value)).toBe(before)
  })
  it('矛盾计数只提示，重复场景 / 未读审阅不可写；历史缺字段不补快照', () => {
    const value = report(); value.totalScenarios = 9; value.passedScenarios = 8; value.scenarios.push({ ...value.scenarios[0] })
    expect(personaReportNotices(value)).toHaveLength(2)
    expect(render(value, true)).not.toContain('data-testid="persona-human-review"')
    expect(render(value, false, false)).toContain('不能判定未审阅')
    delete value.scenarios[0].trials[0].agentInput; delete value.scenarios[0].trials[0].judge
    const html = render(value)
    expect(html).toContain('历史报告未记录输入快照')
    expect(html).toContain('没有保存 Judge 计划')
  })
  it('真实临时报告读取到同一阅读层，内容保持不变', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'my-agent-persona-reading-'))
    try {
      const value = report(), original = JSON.stringify(value), file = path.join(dir, value.fileName)
      await writeFile(file, original)
      const loaded = await getPersonaEvalReport(dir, value.fileName)
      expect(personaReportNotices(loaded!)).toEqual([])
      expect(render(loaded!)).toContain('原评分问题')
      expect(await readFile(file, 'utf8')).toBe(original)
      expect(await getPersonaEvalReport(dir, '../outside.json')).toBeNull()
    } finally {
      if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('my-agent-persona-reading-')) throw new Error('拒绝清理测试范围外目录')
      await rm(dir, { recursive: true, force: true })
    }
  })
})
