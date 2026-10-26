import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DebugSkillEvalReport, SkillEvalCaseReport } from '../../src/shared/types'
import { SkillReportEvidence, skillReportNotices } from '../../src/components/debug/SkillReportEvidence'
import { QualityReportReading, qualityCaseKey } from '../../src/components/debug/QualityReportReading'
import { getSkillEvalReport } from '../../electron/main/debug/skill-eval-reports'

const item = (): SkillEvalCaseReport => ({ id: 'case', description: '原场景', pass: false, durationMs: 0, input: { userPrompt: '原用户问题', model: 'model', baseUrl: 'mock://local', skill: { name: '原 Skill', version: 'v1', source: 'builtin', fingerprint: 'saved-fingerprint', toolName: 'skill_invoke_saved' }, expectedActivation: true, allowedTools: ['read'] }, evidence: { agentText: '完整原回复。'.repeat(100), injectionObserved: false, toolCalls: ['read'], activations: [{ name: '原 Skill', source: 'builtin', version: 'v1', fingerprint: 'saved-fingerprint', toolName: 'skill_invoke_saved', activatedAt: 1, reason: '实际激活理由' }] }, graderResults: [{ graderName: 'constructor', result: { pass: false, violations: ['保存违规'], evidence: ['保存判定证据'] } }], error: '保存错误' })
const report = (): DebugSkillEvalReport => ({ fileName: 'saved-skill-eval-mock-fail.json', timestamp: '2026-10-26T06:00:00Z', mode: 'mock', model: 'model', baseUrl: 'mock://local', pass: false, totalCases: 1, passedCases: 0, cases: [item()] })

describe('Skill 报告的保存值阅读', () => {
  it('输入、运行、回复与未知 grader 原值保留，零耗时不补默认', () => {
    const value = item(), before = JSON.stringify(value), html = renderToStaticMarkup(createElement(SkillReportEvidence, { item: value }))
    for (const text of ['原用户问题', '原 Skill', 'v1', 'builtin', 'saved-fingerprint', 'skill_invoke_saved', 'read', '实际激活理由', 'constructor', '保存违规', '保存判定证据', '保存错误', '0 ms', value.evidence.agentText]) expect(html).toContain(text)
    expect(JSON.stringify(value)).toBe(before)
  })
  it('重复 ID 独立选择，保存计数矛盾只提示，不重算结论或补空场景', () => {
    const value = report(); value.totalCases = 9; value.passedCases = 8; value.cases.push({ ...item(), description: '第二条保存项' })
    const before = JSON.stringify(value)
    expect(skillReportNotices(value)).toHaveLength(2)
    const cases = value.cases.map(source => ({ id: source.id, title: source.description, pass: source.pass, source }))
    const html = renderToStaticMarkup(createElement(QualityReportReading, { title: '报告', result: '8/9 通过', pass: value.pass, judgment: '保存值', cases, selectedKey: qualityCaseKey(cases[1], 1), onSelect: () => {}, renderEvidence: row => createElement('p', null, row.source.description) }))
    expect(html.match(/data-case-id="case"/g)).toHaveLength(2)
    expect(html).toContain('8/9 通过')
    expect(html.match(/debug-quality-evidence/g)).toHaveLength(1)
    const empty = renderToStaticMarkup(createElement(QualityReportReading, { title: '空报告', result: '保存值', pass: false, judgment: '保存值', cases: [], selectedKey: 'missing', onSelect: () => {}, renderEvidence: () => null }))
    expect(empty).toContain('不补默认验收结果')
    expect(empty).toContain('未选择其他场景代替')
    expect(JSON.stringify(value)).toBe(before)
  })
  it('真实报告读取后沿相同证据组件展示，读取与呈现不改文件或判分', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'my-agent-skill-reading-'))
    try {
      const value = report(), original = JSON.stringify(value)
      await writeFile(path.join(dir, value.fileName), original)
      const loaded = await getSkillEvalReport(dir, value.fileName)
      expect(loaded?.pass).toBe(false)
      expect(loaded?.cases[0].input.baseUrl).toBe('mock://local')
      expect(skillReportNotices(loaded!)).toEqual([])
      expect(renderToStaticMarkup(createElement(SkillReportEvidence, { item: loaded!.cases[0] }))).toContain('保存判定证据')
      expect(JSON.stringify(await getSkillEvalReport(dir, value.fileName))).toBe(original)
      expect(await getSkillEvalReport(dir, '../saved-skill-eval-mock-fail.json')).toBeNull()
    } finally {
      const target = path.resolve(dir)
      if (path.dirname(target) !== path.resolve(tmpdir()) || !path.basename(target).startsWith('my-agent-skill-reading-')) throw new Error('拒绝清理测试目录之外路径')
      await rm(target, { recursive: true, force: true })
    }
  })
})
