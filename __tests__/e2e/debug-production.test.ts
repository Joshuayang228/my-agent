import { mkdtemp, rm, mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { DEBUG_PERSPECTIVES } from '../../src/shared/debug-navigation'
import { DEBUG_EVIDENCE_VIEWS } from '../../src/shared/debug-evidence'

/** 背景：浏览器契约替身不能证明正式 preload / IPC 可用。
 * 意图：用独立用户目录运行真实构建，读取所有现有 Debug 数据源并逐页操作。
 * 约束：不配置模型、不运行工具或 Eval，不触碰用户数据；空库只证明读取与真实空/unsupported，不证明历史内容质量。
 */
test('正式 Debug 全导航与真实只读接口', async ({}, info) => {
  test.setTimeout(120_000)
  const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-debug-production-'))
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [path.resolve('dist-electron/index.js'), `--user-data-dir=${root}`, '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'production', VITE_DEV_SERVER_URL: '', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' },
    })
    expect(path.resolve(await app.evaluate(({ app }) => app.getPath('userData')))).toBe(path.resolve(root))
    const page = await app.firstWindow()
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#startup-splash')).toBeHidden()
    // 测试目录中明确打开开发入口；不修改用户 profile，也不启动任何计费诊断。
    await page.evaluate(() => window.electronAPI.settings.set('developerMode', 'true'))
    await page.reload()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-back').click()
    const scope = await page.evaluate(() => window.electronAPI.debug.companionEvidenceScope())
    expect(scope.ready).toBe(true)
    expect(scope.roles.length).toBeGreaterThan(0)
    const roleId = scope.activeRoleId ?? scope.roles[0].id
    const characterRecord = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'character', roleId }), roleId)).records[0]
    expect(characterRecord).toBeDefined()
    const homeRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'residence', roleId }), roleId)).records
    const tripRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'footprints', roleId }), roleId)).records
    const growthRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'growth', roleId }), roleId)).records
    const momentRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'moments', roleId }), roleId)).records
    const relationRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'relations', roleId }), roleId)).records
    const wardrobeRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'wardrobe', roleId }), roleId)).records
    const cultureRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'items', roleId }), roleId)).records
    const linkRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'links', roleId }), roleId)).records
    const profileRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'profile', roleId }), roleId)).records
    const memoryRecords = (await page.evaluate(roleId => window.electronAPI.debug.companionEvidenceQuery({ view: 'memories', roleId }), roleId)).records
    const traceSnapshot = await page.evaluate(() => window.electronAPI.debug.traces())
    const skillIndex = await page.evaluate(() => window.electronAPI.debug.skillEvalReports())
    for (const view of DEBUG_EVIDENCE_VIEWS.filter(view => view !== 'context')) {
      const result = await page.evaluate(({ view, roleId }) => window.electronAPI.debug.companionEvidenceQuery({ view, roleId, date: view === 'schedule' ? new Date().toLocaleDateString('sv-SE') : undefined }), { view, roleId })
      expect(result.view).toBe(view)
      expect(result.roleId).toBe(roleId)
      expect(result.state).toBe(view === 'proactive' ? 'unsupported' : 'ready')
    }
    const evidence = await page.evaluate(async roleId => {
      const debug = window.electronAPI.debug
      const [assets, tools, system, traces, logs, absent, usage, skill, persona] = await Promise.all([
        debug.modelContextAssets(), debug.tools(), debug.systemInfo(), debug.traces(), debug.llmLogsQuery({ limit: 1 }),
        debug.llmLogGet('missing-debug-call'), debug.assetUsageQuery({ limit: 1 }), debug.skillEvalReports(), debug.personaEvalReports(),
      ])
      return { assetCount: assets.length, toolCount: tools.length, electron: system.electron, spans: traces.spans.length, logCount: logs.total, absent, usageCount: usage.total, skills: Array.isArray(skill.reports), personas: Array.isArray(persona.reports), roleSources: assets.filter(asset => asset.roleIds?.includes(roleId) && ['companion-manifest', 'companion-profile', 'companion-world'].includes(asset.assetType)).map(asset => asset.name) }
    }, roleId)
    expect(evidence.assetCount).toBeGreaterThan(0)
    expect(evidence.toolCount).toBeGreaterThan(0)
    expect(evidence.electron).toBeTruthy()
    expect(evidence.absent).toBeNull()
    expect(evidence.skills && evidence.personas).toBe(true)
    expect(evidence.roleSources.length).toBeGreaterThan(0)
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    for (const [theme, width] of [['porcelain-blue', 1096], ['yao-stone', 600]] as const) {
      await page.setViewportSize({ width, height: 800 })
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme)
      for (const entry of DEBUG_PERSPECTIVES) {
        await panel.getByRole('navigation').getByRole('button', { name: entry.label, exact: true }).click()
        await expect(panel.getByRole('heading', { name: entry.label, exact: true, level: 1 })).toBeVisible()
        await expect(panel.getByText(/正在读取/)).toHaveCount(0)
        await expect(panel.getByText(/读取失败|此页面需要桌面应用|需要 Electron 环境/)).toHaveCount(0)
        if (entry.id === 'character') {
          const character = panel.getByTestId('debug-evidence-character')
          await expect(character.locator('.debug-character-summary .debug-character-body')).toHaveText(characterRecord.body.length > 160 ? `${characterRecord.body.slice(0, 160)}…` : characterRecord.body || '简介未提供')
          await character.getByRole('button', { name: /完整资料/ }).click()
          const detail = character.getByRole('article', { name: '领域证据详情' })
          await detail.getByText('来源与原始记录', { exact: true }).click()
          for (const name of evidence.roleSources) await expect(detail.getByRole('button', { name: `查看注册定义 · ${name}`, exact: true })).toBeVisible()
          await expect(detail.getByRole('alert')).toHaveCount(0)
        }
        if (entry.id === 'residence') {
          const home = panel.getByTestId('debug-evidence-residence')
          await expect(home.locator('.debug-home-range')).toHaveText(`${homeRecords.length} 项已读 · 总数未知`)
          expect(await home.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(homeRecords.map(record => record.id).sort())
          if (!homeRecords.length) await expect(home).toContainText('不推断默认住所或世界状态')
        }
        if (entry.id === 'items') {
          const culture = panel.getByTestId('debug-evidence-items')
          expect(await culture.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(cultureRecords.map(record => record.id).sort())
          await expect(culture.getByRole('tablist', { name: '文化分类' })).toBeVisible()
          if (!cultureRecords.length) await expect(culture).toContainText('不推断没有兴趣或从未体验')
        }
        if (entry.id === 'links') {
          const links = panel.getByTestId('debug-evidence-links')
          expect(await links.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(linkRecords.map(record => record.id).sort())
          if (!linkRecords.length) await expect(links).toContainText('不推断事件从未有关联')
          else {
            await links.locator('[data-record-id] button').first().click()
            const detail = links.getByRole('article', { name: '领域证据详情' })
            await detail.getByText('来源与原始记录', { exact: true }).click()
            await expect(detail.locator('pre')).toHaveText(JSON.stringify(linkRecords[0].data, null, 2))
          }
        }
        if (entry.id === 'profile') {
          const profile = panel.getByTestId('debug-evidence-profile')
          expect(await profile.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(profileRecords.map(record => record.id).sort())
          if (!profileRecords.length) await expect(profile).toContainText('不代表用户没有相关资料')
          else {
            for (const name of ['身份', '协作方式', '表达偏好']) await expect(profile.getByRole('heading', { name, exact: true })).toBeVisible()
          }
          await profile.getByText('查询范围与其他入口', { exact: true }).click()
          await expect(profile).toContainText(`当前页 ${profileRecords.length} 条已读来源`)
        }
        if (entry.id === 'memories') {
          const memory = panel.getByTestId('debug-evidence-memories')
          expect(await memory.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(memoryRecords.map(record => record.id).sort())
          await expect(memory.getByRole('combobox', { name: '记忆人物范围' })).toHaveValue(roleId)
          if (!memoryRecords.length) await expect(memory).toContainText('不代表系统没有长期记忆')
          await memory.getByText('查询边界与关联入口', { exact: true }).click()
          await expect(memory).toContainText('画像查询的非反馈资料可跨桶读取')
        }
        if (entry.id === 'traces') {
          const traces = panel.getByTestId('debug-evidence-traces')
          expect(await traces.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual([...new Set(traceSnapshot.spans.map(span => span.id))].sort())
          if (!traceSnapshot.spans.length) await expect(traces).toContainText('不代表运行时没有调用')
          await traces.getByText('统计与使用量', { exact: true }).click()
          await expect(traces).toContainText('前台输入 / 输出')
          await traces.getByText('来源与诊断边界', { exact: true }).click()
          await expect(traces).toContainText('最近最多 100 条内存 Span 快照')
        }
        if (entry.id === 'quality') {
          const skill = panel.getByTestId('skill-eval-panel')
          if (skillIndex.latest) {
            await expect(skill.getByTestId('skill-eval-report')).toBeVisible()
            await expect(skill.locator('[data-case-id]')).toHaveCount(skillIndex.latest.cases.length)
            await expect(skill.getByRole('combobox', { name: 'Skill Eval 历史报告' })).toHaveValue(skillIndex.latest.fileName)
            await skill.getByText('报告来源与字段', { exact: true }).click()
            await expect(skill).toContainText(skillIndex.latest.fileName)
          } else {
            await expect(skill).toContainText('还没有 Skill Eval 报告')
            await expect(skill.getByTestId('skill-eval-report')).toHaveCount(0)
          }
          await skill.getByText('来源与诊断边界', { exact: true }).click()
          await expect(skill).toContainText('本页不运行 Eval、不改报告、不重新评分')
        }
        if (entry.id === 'events') {
          const events = panel.getByTestId('debug-evidence-events')
          await expect(events).toContainText('0 条缓存')
          await expect(events.locator('[data-record-id]')).toHaveCount(0)
          await events.getByText('来源与诊断边界', { exact: true }).click()
          await expect(events).toContainText('最多保留 501 条')
          await expect(events).toContainText('本页只显示已保存摘要')
        }
        if (entry.id === 'wardrobe') {
          const wardrobe = panel.getByTestId('debug-evidence-wardrobe')
          expect(await wardrobe.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(wardrobeRecords.map(record => record.id).sort())
          if (!wardrobeRecords.length) await expect(wardrobe).toContainText('不推断没有衣物或当前未穿着')
        }
        if (entry.id === 'proactive') {
          const proactive = panel.getByTestId('debug-evidence-proactive')
          await expect(proactive).toContainText('尚无独立投递记录源')
          await expect(proactive.locator('input, select, [data-record-id]')).toHaveCount(0)
          await proactive.getByText('来源与边界', { exact: true }).click()
          await expect(proactive.locator('pre')).toContainText('"state": "unsupported"')
          await expect(proactive).not.toContainText('0 条')
        }
        if (entry.id === 'relations') {
          const contacts = panel.getByTestId('debug-evidence-relations')
          expect(await contacts.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(relationRecords.map(record => record.id).sort())
          const first = relationRecords[0]
          if (first) {
            await contacts.locator('[data-record-id]').first().getByRole('button').click()
            const detail = contacts.getByRole('article', { name: '领域证据详情' })
            await expect(detail.locator('.debug-relations-definition')).toHaveCount(Array.isArray(first.data.relations) ? first.data.relations.length : 0)
            await detail.getByText('来源与原始记录', { exact: true }).click()
            await expect(detail.locator('pre')).toContainText(first.id)
          } else await expect(contacts).toContainText('不推断没有关系')
        }
        if (entry.id === 'moments') {
          const moments = panel.getByTestId('debug-evidence-moments')
          expect(await moments.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(momentRecords.map(record => record.id).sort())
          if (!momentRecords.length) await expect(moments).toContainText('不据此推断人物从未发布')
        }
        if (entry.id === 'growth') {
          const growth = panel.getByTestId('debug-evidence-growth')
          expect(await growth.locator('[data-source-key]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-source-key')).sort())).toEqual(growthRecords.map(record => `${record.source}:${record.id}`).sort())
          const current = growthRecords.find(record => ['companion_mutable', 'Role Pack mutable.default'].includes(record.source))
          if (current) await expect(growth.locator('.debug-growth-current > .debug-growth-body')).toHaveText(current.body ? `${current.body.slice(0, 180)}${current.body.length > 180 ? '…' : ''}` : '当前覆盖正文为空；未改用默认正文。')
        }
        if (entry.id === 'footprints') {
          const trips = panel.getByTestId('debug-evidence-footprints')
          await expect(trips.locator('.debug-travel-range')).toHaveText(`${tripRecords.length} 项已读 · 总数未知`)
          expect(await trips.locator('[data-record-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-record-id')).sort())).toEqual(tripRecords.map(record => record.id).sort())
          if (!tripRecords.length) await expect(trips).toContainText('不推断人物从未到访')
        }
        expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), entry.id).toBe(true)
        await page.screenshot({ path: info.outputPath(`${entry.id}-${theme}.png`) })
      }
    }
    expect(failures).toEqual([])
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click()
    await expect(page.getByTestId('primary-sidebar')).toBeVisible()
  } finally {
    if (app) await app.close()
    // mkdtemp 的绝对路径只允许在本测试的临时父目录下清理。
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('my-agent-debug-production-')) throw new Error('拒绝清理测试范围外目录')
    await rm(root, { recursive: true, force: true })
  }
})

/** 背景：替身无法证明人工审阅真正落库。
 * 意图：向既有报告目录写唯一命名的测试文件，在独立 profile 中操作真实 preload / IPC / SQL。
 * 约束：夹具不是模型质量证据；不启动模型 / Eval，不覆盖已有报告，结束只删除本次独占创建文件。
 */
test('正式人格报告与真实审阅保存刷新清空', async ({}, info) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-persona-production-'))
  const reportDir = path.resolve('eval-reports'), name = `${new Date().toISOString().replace(/[:.]/g, '-')}-persona-b02-b07-pass-1.json`, file = path.join(reportDir, name)
  const original = JSON.stringify({ timestamp: new Date().toISOString(), mode: 'real', model: 'isolated-saved-fixture', baseUrl: 'mock://not-executed', pass: false, totalScenarios: 1, passedScenarios: 0, k: 1, scenarios: [{ id: 'P0', description: '仅验证已保存报告的读取与审阅', pass: false, passes: 0, k: 1, trials: [{ id: 'source-trial', description: '测试报告轮次', pass: false, durationMs: 0, graderResults: [], agentTexts: ['这是保存文件夹具，没有运行模型。'] }] }] })
  let app: ElectronApplication | undefined, created = false
  try {
    await mkdir(reportDir, { recursive: true }); await writeFile(file, original, { flag: 'wx' }); created = true
    app = await electron.launch({ args: [path.resolve('dist-electron/index.js'), `--user-data-dir=${root}`, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', VITE_DEV_SERVER_URL: '', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
    expect(path.resolve(await app.evaluate(({ app }) => app.getPath('userData')))).toBe(path.resolve(root))
    const page = await app.firstWindow(); await page.waitForLoadState('domcontentloaded'); await expect(page.locator('#startup-splash')).toBeHidden()
    await page.evaluate(() => window.electronAPI.settings.set('developerMode', 'true')); await page.reload()
    await expect(page.getByTestId('settings-panel')).toBeVisible(); await page.getByTestId('settings-back').click()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'); await panel.getByRole('navigation').getByRole('button', { name: '人格验收', exact: true }).click()
    const persona = panel.getByTestId('persona-eval-panel')
    await persona.getByRole('combobox', { name: '选择 Eval 历史报告' }).selectOption(name)
    await persona.locator('[data-case-id="P0"] > button').click()
    await persona.getByTestId('persona-eval-trial-P0-trial-1').locator(':scope > summary').click()
    const review = persona.getByTestId('persona-human-review'); await review.locator('summary').click()
    await review.getByRole('button', { name: '活人感 / 自然度：5', exact: true }).click()
    await review.getByRole('button', { name: '总体结论：通过', exact: true }).click()
    await review.locator('textarea').fill('真实 IPC 独立保存，不改自动判定')
    await review.getByRole('button', { name: '保存审阅', exact: true }).click()
    await expect(review.getByText('已审阅 · 通过', { exact: true })).toBeVisible()
    const stored = await page.evaluate(name => window.electronAPI.debug.personaEvalHumanReviewsList(name), name)
    expect(stored).toHaveLength(1); expect(stored[0].notes).toBe('真实 IPC 独立保存，不改自动判定'); expect(stored[0].trialId).toBe('P0-trial-1')
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(review.locator('textarea')).toHaveValue('真实 IPC 独立保存，不改自动判定')
    await expect(persona).toContainText('报告标记：未通过')
    await page.screenshot({ path: info.outputPath('persona-real-review.png') })
    await review.getByRole('button', { name: '清空', exact: true }).click()
    await expect(persona).toContainText('人工审阅 0/1 轮')
    expect(await page.evaluate(name => window.electronAPI.debug.personaEvalHumanReviewsList(name), name)).toEqual([])
    expect(await readFile(file, 'utf8')).toBe(original)
    expect((await page.evaluate(() => window.electronAPI.debug.evalRunStatus())).state).toBe('idle')
  } finally {
    if (app) await app.close()
    if (created) { if (path.dirname(file) !== reportDir || path.basename(file) !== name) throw new Error('拒绝清理非本次创建报告'); await unlink(file) }
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('my-agent-persona-production-')) throw new Error('拒绝清理测试范围之外目录')
    await rm(root, { recursive: true, force: true })
  }
})
