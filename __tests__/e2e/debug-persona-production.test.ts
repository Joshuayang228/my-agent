import { test, expect } from '@playwright/test'

test('正式人格报告快速切换保留当前选择', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __personaRelease: () => void }
    const report = (id: string) => ({ fileName: `${id}.json`, timestamp: '2026-10-26T06:00:00Z', mode: 'real', model: `model-${id}`, baseUrl: 'mock://local', pass: true, totalScenarios: 1, passedScenarios: 1, k: 1, scenarios: [{ id: 'B02', description: `报告 ${id} 场景`, pass: true, passes: 1, k: 1, trials: [{ id: 'saved-trial', description: '保存试验', pass: true, durationMs: 0, graderResults: [], agentTexts: ['保存回复'] }] }] })
    state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug,
      companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }], activeRoleId: 'lin', ready: true }),
      personaEvalReports: async () => ({ reports: ['C', 'B', 'A'].map(report), latest: report('C'), reportDir: 'eval-reports', skippedFiles: 0 }),
      personaEvalReportGet: async (file: string) => file === 'A.json' ? new Promise(resolve => { state.__personaRelease = () => resolve(report('A')) }) : report(file.replace('.json', '')),
      personaEvalHumanReviewsList: async () => [], evalRunPlans: async () => [], evalRunStatus: async () => ({ state: 'idle', output: '' }),
    } }
  })
  await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
  const panel = page.getByTestId('dev-panel')
  await panel.getByRole('navigation').getByRole('button', { name: '人格验收', exact: true }).click()
  const persona = panel.getByTestId('persona-eval-panel'), history = persona.getByRole('combobox', { name: '选择 Eval 历史报告' })
  await expect(persona).toContainText('报告 C 场景')
  await history.selectOption('A.json'); await history.selectOption('B.json')
  await expect(persona).toContainText('报告 B 场景')
  await page.evaluate(() => (window as unknown as { __personaRelease: () => void }).__personaRelease())
  await expect(history).toHaveValue('B.json')
  await expect(persona).toContainText('报告 B 场景')
})

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式人格报告与人工审阅 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      type Review = { reportFileName: string; scenarioId: string; trialId: string; notes: string; verdict?: string; updatedAt?: number }
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __persona: { mode: string; release: () => void; releaseSave: () => void; emit: (status: Record<string, unknown>) => void; starts: number; saves: number; saved: Record<string, Review[]> } }
      state.__persona = { mode: 'fail', release: () => {}, releaseSave: () => {}, emit: () => {}, starts: 0, saves: 0, saved: { 'C.json': [{ reportFileName: 'C.json', scenarioId: 'B02', trialId: 'B02-trial-1', notes: 'C 已保存审阅', verdict: 'revise', updatedAt: 1 }] } }
      const report = (id: string) => {
        const value = { fileName: `${id}.json`, timestamp: '2026-10-26T06:00:00Z', mode: 'real', model: `model-${id}`, baseUrl: 'mock://saved', pass: false, totalScenarios: 1, passedScenarios: 0, k: 1, scenarios: [{ id: 'B02', description: `报告 ${id} 场景`, pass: false, passes: 0, k: 1, trials: [{ id: 'original-trial', description: '原轮次描述', pass: false, durationMs: 0, mode: 'real', error: '保存轮次错误', agentTexts: ['保存的完整人格回复'], graderResults: [{ graderName: 'constructor', result: { pass: false, violations: ['保存违规'], evidence: ['保存依据'] } }], agentInput: { model: 'saved-input-model', baseUrl: 'mock://input', executionMode: 'confirm-all', systemPrompt: '保存的 System Prompt', toolNames: ['read'], messages: [{ role: 'user', content: '保存用户问题' }] }, judge: { graderName: 'SavedJudge', invocationMode: 'single-call', systemContext: '保存评分背景', checks: [{ id: 'saved-check', question: '保存评分问题' }] } }] }] }
        if (state.__persona.mode === 'long') value.scenarios[0].trials[0].agentTexts = ['完整人格长回复。'.repeat(180)]
        if (state.__persona.mode === 'duplicates') value.scenarios.push({ ...value.scenarios[0], description: '重复标识的第二项' })
        if (state.__persona.mode === 'counts') { value.totalScenarios = 9; value.passedScenarios = 8 }
        return value
      }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug,
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }], activeRoleId: 'lin', ready: true }),
        personaEvalReports: async () => { if (state.__persona.mode === 'fail') throw new Error('private report path'); return { reports: state.__persona.mode === 'empty' ? [] : ['C', 'B'].map(report), latest: state.__persona.mode === 'empty' ? null : report('C'), skippedFiles: 0, reportDir: 'eval-reports' } },
        personaEvalReportGet: async (file: string) => { if (state.__persona.mode === 'detail-fail') throw new Error('private detail path'); return file === 'missing.json' ? null : report(file.replace('.json', '')) },
        personaEvalHumanReviewsList: async (file: string) => { if (state.__persona.mode === 'review-fail') throw new Error('private review path'); if (state.__persona.mode === 'review-delay' && file === 'C.json') return new Promise(resolve => { state.__persona.release = () => resolve(state.__persona.saved[file] ?? []) }); return state.__persona.saved[file] ?? [] },
        personaEvalHumanReviewSave: async (input: Review) => { state.__persona.saves++; if (state.__persona.mode === 'save-fail') throw new Error('private save path'); const save = () => { const review = { ...input, updatedAt: 2 }; state.__persona.saved[input.reportFileName] = [review]; return { ok: true, review } }; return state.__persona.mode === 'save-delay' ? new Promise(resolve => { state.__persona.releaseSave = () => resolve(save()) }) : save() },
        personaEvalHumanReviewDelete: async (input: Review) => { if (state.__persona.mode === 'delete-fail') return { ok: false, error: 'private delete path' }; state.__persona.saved[input.reportFileName] = []; return { ok: true } },
        evalRunPlans: async () => [{ suite: 'persona-real', label: '运行真实人格验收', available: true, requiresConfirmation: true, model: 'plan-model', baseUrl: 'mock://plan', scenarioCount: 1, passK: 1, estimatedAgentCalls: 1, estimatedJudgeCalls: 1 }],
        evalRunStatus: async () => ({ state: 'idle', output: '' }),
        onEvalRunEvent: (listener: (event: unknown) => void) => { state.__persona.emit = status => listener({ type: 'status', status }); return () => {} },
        evalRunStart: async () => { state.__persona.starts++; if (state.__persona.mode === 'start-fail') throw new Error('private start path'); state.__persona.emit({ state: 'running', suite: 'persona-real', runId: 'run-exact', output: '保存运行输出', completedTrials: 0, totalTrials: 1 }); return { ok: true, status: { state: 'idle', output: '' } } },
        evalRunCancel: async (id: string) => { if (id !== 'run-exact') throw new Error('wrong run'); if (state.__persona.mode === 'stop-fail') throw new Error('private stop path'); state.__persona.emit({ state: 'cancelled', suite: 'persona-real', runId: id, output: '已取消输出' }); return { ok: true } },
      } }
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    await panel.getByRole('navigation').getByRole('button', { name: '人格验收', exact: true }).click()
    const persona = panel.getByTestId('persona-eval-panel'), history = persona.getByRole('combobox', { name: '选择 Eval 历史报告' }), report = persona.getByTestId('persona-eval-report')
    const mode = async (value: string) => page.evaluate(value => { (window as unknown as { __persona: { mode: string } }).__persona.mode = value }, value)
    const refresh = async () => panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(persona.getByRole('alert')).toContainText('人格报告读取失败')
    await expect(report).toHaveCount(0); await expect(persona).not.toContainText('还没有 Persona Eval')
    await mode('ready'); await persona.getByRole('button', { name: '重试', exact: true }).click()
    await expect(report).toContainText('报告 C 场景')
    await mode('review-delay'); await history.selectOption('B.json'); await history.selectOption('C.json'); await history.selectOption('B.json')
    await page.evaluate(() => (window as unknown as { __persona: { release: () => void } }).__persona.release())
    await expect(report).toContainText('人工审阅 0/1 轮')
    await mode('ready')
    await page.screenshot({ path: info.outputPath('persona-production-summary.png') })
    const scenario = report.locator('[data-case-id="B02"]')
    await scenario.getByRole('button').click()
    const trial = report.getByTestId('persona-eval-trial-B02-trial-1')
    await trial.locator(':scope > summary').click()
    await expect(trial).toContainText('保存的完整人格回复')
    await expect(trial).toContainText('0 ms')
    await expect(trial).toContainText('保存违规')
    await trial.getByText('Agent 实际输入', { exact: true }).click(); await trial.getByText('实际 System Prompt 快照', { exact: true }).click(); await trial.getByText('Judge 评分标准', { exact: true }).click()
    for (const value of ['saved-input-model', 'confirm-all', '保存用户问题', '保存的 System Prompt', '保存评分问题', 'SavedJudge']) await expect(trial).toContainText(value)
    const review = trial.getByTestId('persona-human-review')
    await review.locator('summary').click(); await review.locator('textarea').fill('B 独立草稿')
    await review.getByRole('button', { name: '活人感 / 自然度：5', exact: true }).click(); await review.getByRole('button', { name: '总体结论：通过', exact: true }).click()
    await refresh(); await expect(review.locator('textarea')).toHaveValue('B 独立草稿')
    await mode('review-fail'); await refresh()
    await expect(persona.getByRole('alert')).toContainText('人工审阅读取失败')
    await expect(review.getByRole('button', { name: '保存审阅', exact: true })).toBeDisabled()
    await expect(review.locator('textarea')).toHaveValue('B 独立草稿')
    await mode('ready'); await persona.getByRole('button', { name: '重试读取审阅', exact: true }).click()
    await mode('save-fail'); await review.getByRole('button', { name: '保存审阅', exact: true }).click()
    await expect(persona.getByRole('alert')).toContainText('保存人工审阅失败'); await expect(review.locator('textarea')).toHaveValue('B 独立草稿')
    await mode('save-delay'); await review.getByRole('button', { name: '保存审阅', exact: true }).click(); await history.selectOption('C.json')
    await page.evaluate(() => (window as unknown as { __persona: { releaseSave: () => void } }).__persona.releaseSave())
    await expect(report).toContainText('报告 C 场景'); await expect(report).toContainText('人工审阅 1/1 轮')
    await report.locator('[data-case-id="B02"] > button').click(); await trial.locator(':scope > summary').click()
    await expect(review.locator('textarea')).toHaveValue('C 已保存审阅')
    await mode('ready'); await history.selectOption('B.json'); await scenario.getByRole('button').click(); await trial.locator(':scope > summary').click()
    await expect(review.locator('textarea')).toHaveValue('B 独立草稿')
    await review.scrollIntoViewIfNeeded(); expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('persona-production-review.png') })
    await mode('delete-fail'); await review.getByRole('button', { name: '清空', exact: true }).click()
    await expect(persona.getByRole('alert')).toContainText('清空人工审阅失败'); await expect(review.locator('textarea')).toHaveValue('B 独立草稿')
    await mode('ready'); await review.getByRole('button', { name: '清空', exact: true }).click(); await expect(report).toContainText('人工审阅 0/1 轮')
    await mode('fail'); await refresh(); await expect(persona.getByRole('alert')).toContainText('已有报告保留'); await expect(trial.locator('summary').first()).toBeVisible()
    await mode('ready'); await persona.getByRole('button', { name: '重试', exact: true }).click(); await expect(history).toHaveValue('B.json')
    await mode('long'); await refresh(); await expect(trial).toContainText('完整人格长回复。'.repeat(180))
    await page.evaluate(() => document.documentElement.style.fontSize = '17px')
    const ratio = await trial.locator('.debug-quality-body').first().evaluate(node => ({ size: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight) }))
    expect(ratio.size / 17).toBeCloseTo(14 / 15, 2); expect(ratio.line / ratio.size).toBeCloseTo(1.75, 2)
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('persona-production-evidence.png') })
    await mode('duplicates'); await refresh(); await expect(report.locator('[data-case-id="B02"]')).toHaveCount(2)
    await expect(report).toContainText('重复场景不提供人工审阅写入'); await expect(report.getByTestId('persona-human-review')).toHaveCount(0)
    await mode('counts'); await refresh(); await expect(report).toContainText('8/9 场景通过'); await expect(report).toContainText('保留原值，不重新判分')
    await mode('ready'); await refresh()
    await persona.getByText('运行验收与诊断', { exact: true }).click()
    const run = persona.getByRole('button', { name: '运行真实人格验收', exact: true })
    await run.click()
    const dialog = page.getByRole('dialog', { name: '确认真实 Persona Eval', exact: true })
    await expect(dialog).toContainText('plan-model'); await expect(dialog).toContainText('会调用真实模型')
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(run).toBeFocused()
    expect(await page.evaluate(() => (window as unknown as { __persona: { starts: number } }).__persona.starts)).toBe(0)
    await mode('start-fail'); await run.click(); await dialog.getByRole('button', { name: '开始真实验收', exact: true }).click()
    await expect(persona.getByRole('alert')).toContainText('启动验收失败'); await expect(report).toBeVisible()
    await mode('ready'); await run.click(); await dialog.getByRole('button', { name: '开始真实验收', exact: true }).click()
    await expect(persona).toContainText('Persona Eval 正在运行'); await expect(report).toHaveCount(0)
    await expect(persona.getByText('保存运行输出', { exact: true })).toBeVisible()
    await mode('stop-fail'); await persona.getByRole('button', { name: '停止', exact: true }).click(); await expect(persona.getByRole('alert')).toContainText('停止验收失败')
    await mode('ready'); await persona.getByRole('button', { name: '停止', exact: true }).click(); await expect(persona).toContainText('已停止')
    await page.evaluate(() => (window as unknown as { __persona: { emit: (status: Record<string, unknown>) => void } }).__persona.emit({ suite: 'persona-real', state: 'succeeded', output: '', latestReportFile: 'missing.json' }))
    await expect(persona).toContainText('指定人格报告未返回'); await expect(report).toHaveCount(0)
    await history.selectOption('C.json'); await mode('detail-fail'); await history.selectOption('B.json')
    await expect(persona.getByRole('alert')).toContainText('上次成功报告保留'); await expect(persona).toContainText('下方仍为上次成功文件：C.json')
    await expect(persona).not.toContainText('private')
    await mode('empty'); await panel.getByRole('navigation').getByRole('button', { name: '提示词管理器', exact: true }).click(); await panel.getByRole('navigation').getByRole('button', { name: '人格验收', exact: true }).click()
    await expect(persona).toContainText('还没有 Persona Eval 报告'); await expect(report).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __persona: { starts: number } }).__persona.starts)).toBe(2)
  })
}
