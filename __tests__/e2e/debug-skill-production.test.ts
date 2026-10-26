import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式 Skill 报告读取 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __skill: { mode: string; release: () => void; releaseStatus: () => void; statusPending: boolean; emit: (status: Record<string, unknown>) => void; reads: string[]; executions: number } }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__skill = { mode: 'fail', release: () => {}, releaseStatus: () => {}, statusPending: false, emit: () => {}, reads: [], executions: 0 }
      const report = (id: string) => {
        const value = { fileName: `${id}.json`, timestamp: '2026-10-26T06:00:00Z', mode: 'mock', model: `model-${id}`, baseUrl: 'mock://local', pass: false, totalCases: 2, passedCases: 1, cases: [true, false].map((pass, index) => ({ id: `${id}-${index}`, description: `报告 ${id} 场景 ${index}`, pass, durationMs: 0, input: { userPrompt: '已保存用户输入', model: `model-${id}`, baseUrl: 'mock://local', skill: { name: 'demo-skill', version: 'v1', source: 'builtin', fingerprint: 'fingerprint', toolName: 'skill_invoke_demo' }, expectedActivation: true, allowedTools: ['read'] }, evidence: { activations: [{ name: 'demo-skill', toolName: 'skill_invoke_demo', version: 'v1', source: 'builtin', fingerprint: 'fingerprint', activatedAt: 1, reason: '明确激活原因' }], toolCalls: ['read'], injectionObserved: true, agentText: '已保存 Agent 回复' }, graderResults: [{ graderName: 'SkillActivation', result: { pass, violations: pass ? [] : ['未按契约触发'], evidence: ['逐项判定证据'] } }], ...(pass ? {} : { error: '已保存场景错误' }) })) }
        if (state.__skill.mode === 'long') { value.cases[1].evidence.agentText = '长 Agent 回复。'.repeat(180); value.cases[1].input.userPrompt = '完整用户输入。'.repeat(100) }
        if (state.__skill.mode === 'unknown') value.cases[1].graderResults[0].graderName = 'constructor'
        if (state.__skill.mode === 'counts') { value.totalCases = 9; value.passedCases = 8 }
        if (state.__skill.mode === 'duplicates') value.cases.forEach(item => { item.id = 'same' })
        if (state.__skill.mode === 'empty-reply') value.cases[1].evidence.agentText = ''
        return value
      }
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        skillEvalReports: async () => {
          if (state.__skill.mode === 'fail') throw new Error('private internal report path')
          return { reportDir: 'eval-reports', reports: state.__skill.mode === 'empty' ? [] : ['C', 'B', 'A'].map(id => { const { cases: _cases, ...summary } = report(id); return summary }), latest: state.__skill.mode === 'empty' ? null : report('C'), skippedFiles: state.__skill.mode === 'partial' ? 2 : 0 }
        },
        skillEvalReportGet: async (file: string) => { state.__skill.reads.push(file); if (state.__skill.mode === 'detail-fail') throw new Error('private report detail path'); if (state.__skill.mode === 'empty') return null; if (file === 'A.json') return new Promise(resolve => { state.__skill.release = () => resolve(report('A')) }); return file === 'missing.json' ? null : report(file.replace('.json', '')) },
        evalRunStatus: async () => state.__skill.mode === 'status-delay' ? new Promise(resolve => { state.__skill.statusPending = true; state.__skill.releaseStatus = () => resolve({ state: 'idle', output: '' }) }) : ({ state: 'idle', output: '' }),
        onEvalRunEvent: (listener: (event: unknown) => void) => { state.__skill.emit = status => listener({ type: 'status', status }); return () => {} },
        evalRunStart: async () => { state.__skill.executions++; throw new Error('must remain readonly') },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    await panel.getByRole('navigation').getByRole('button', { name: 'Skill 验收', exact: true }).click()
    const skill = panel.getByTestId('skill-eval-panel'), history = skill.getByRole('combobox', { name: 'Skill Eval 历史报告' }), report = skill.getByTestId('skill-eval-report')
    await expect(skill.getByRole('alert')).toContainText('读取失败')
    await expect(report).toHaveCount(0)
    await expect(skill).not.toContainText('还没有 Skill Eval 报告')
    await expect(skill).not.toContainText('private internal')
    const mode = async (value: string) => page.evaluate(value => { (window as unknown as { __skill: { mode: string } }).__skill.mode = value }, value)
    const refresh = async () => panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await mode('ready')
    await skill.getByRole('button', { name: '重试', exact: true }).click()
    await expect(report).toContainText('报告 C 场景')
    await history.selectOption('A.json')
    await history.selectOption('B.json')
    await expect(report).toContainText('报告 B 场景')
    await page.evaluate(() => (window as unknown as { __skill: { release: () => void } }).__skill.release())
    await expect(report).toContainText('报告 B 场景')
    await expect(history).toHaveValue('B.json')
    await page.screenshot({ path: info.outputPath('skill-production-summary.png') })
    const failed = report.locator('[data-case-id="B-1"]')
    await failed.getByRole('button').click()
    await expect(failed).toContainText('未按契约触发')
    await expect(failed).toContainText('已保存 Agent 回复')
    await failed.getByText('实际输入', { exact: true }).click()
    await failed.getByText('运行证据与字段', { exact: true }).click()
    await expect(failed).toContainText('已保存用户输入')
    await expect(failed.locator('pre')).toContainText('明确激活原因')
    await mode('fail'); await refresh()
    await expect(skill.getByRole('alert')).toContainText('已有报告保留')
    await expect(failed.locator('pre')).toBeVisible()
    await expect(skill).not.toContainText('private internal')
    await mode('ready'); await skill.getByRole('button', { name: '重试', exact: true }).click()
    await expect(skill.getByRole('alert')).toHaveCount(0)
    await expect(history).toHaveValue('B.json')
    await expect(failed.locator('pre')).toBeVisible()
    for (const value of ['unknown', 'counts', 'empty-reply', 'partial', 'long']) {
      await mode(value); await refresh()
      if (value === 'unknown') await expect(failed.getByText('constructor', { exact: false })).toBeVisible()
      if (value === 'counts') { await expect(skill).toContainText('保存计数与逐项内容不一致'); await expect(skill).toContainText('8/9 通过') }
      if (value === 'empty-reply') await expect(failed.getByText('（空）', { exact: true })).toBeVisible()
      if (value === 'partial') await expect(skill).toContainText('2 个报告文件未能读取')
      if (value === 'long') {
        const reply = failed.getByRole('heading', { name: 'Agent 回复', exact: true }).locator('..').locator('p')
        await expect(reply).toHaveText('长 Agent 回复。'.repeat(180))
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await reply.evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await reply.evaluate(node => parseFloat(getComputedStyle(node).lineHeight) / parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(1.75, 3)
          expect(await failed.locator('[data-foundation="badge"]').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(11 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await failed.locator('.debug-quality-evidence').evaluate(node => node.scrollIntoView({ block: 'start' }))
        await page.screenshot({ path: info.outputPath('skill-production-evidence.png') })
      }
    }
    await mode('duplicates'); await refresh()
    await expect(skill).toContainText('重复场景标识')
    await expect(skill).toContainText('选中场景未在当前报告返回')
    const duplicates = report.locator('[data-case-id="same"]')
    await expect(duplicates).toHaveCount(2)
    await duplicates.nth(0).getByRole('button').click()
    await expect(duplicates.nth(0).locator('.debug-quality-evidence')).toBeVisible()
    await duplicates.nth(1).getByRole('button').click()
    await expect(duplicates.nth(0).locator('.debug-quality-evidence')).toHaveCount(0)
    await expect(duplicates.nth(1).locator('.debug-quality-evidence')).toBeVisible()
    await mode('ready'); await refresh()
    await expect(report).toContainText('报告 B 场景')
    await mode('status-delay'); await refresh()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __skill: { statusPending: boolean } }).__skill.statusPending)).toBe(true)
    await page.evaluate(() => (window as unknown as { __skill: { emit: (status: Record<string, unknown>) => void } }).__skill.emit({ suite: 'skill', state: 'running' }))
    await expect(skill).toContainText('Skill Eval 正在运行')
    await expect(report).toHaveCount(0)
    await page.evaluate(async () => { (window as unknown as { __skill: { releaseStatus: () => void } }).__skill.releaseStatus(); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
    await expect(skill).toContainText('Skill Eval 正在运行')
    await expect(report).toHaveCount(0)
    await page.evaluate(() => (window as unknown as { __skill: { emit: (status: Record<string, unknown>) => void } }).__skill.emit({ suite: 'skill', state: 'succeeded', latestReportFile: 'missing.json' }))
    await expect(skill).toContainText('指定报告未返回，未用最新报告代替')
    await expect(report).toHaveCount(0)
    await history.selectOption('C.json')
    await expect(report).toContainText('报告 C 场景')
    await mode('detail-fail'); await history.selectOption('B.json')
    await expect(skill.getByRole('alert')).toContainText('上次成功报告保留')
    await expect(skill).toContainText('下方仍为上次成功文件')
    await expect(report).toContainText('报告 C 场景')
    await expect(skill).not.toContainText('private report detail')
    await mode('ready'); await skill.getByRole('button', { name: '重试', exact: true }).click()
    await expect(report).toContainText('报告 B 场景')
    await mode('empty')
    await panel.getByRole('navigation').getByRole('button', { name: '提示词管理器', exact: true }).click()
    await panel.getByRole('navigation').getByRole('button', { name: 'Skill 验收', exact: true }).click()
    await expect(skill.getByText('还没有 Skill Eval 报告', { exact: true })).toBeVisible()
    await expect(report).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __skill: { executions: number } }).__skill.executions)).toBe(0)
  })
}
