import { mkdtemp, rm } from 'node:fs/promises'
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
