import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式人物档案与分源恢复 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __characterMode: string; __assetFail: boolean; __assetCalls: number }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__characterMode = 'fail'; state.__assetFail = true; state.__assetCalls = 0
      const asset = (key: string, role: string, type: string, name: string) => ({ key, name, category: 'companion', assetType: type, ownership: 'role-pack', source: 'role-pack://test/profile.json', version: '1', fingerprint: 'profile-fingerprint', status: 'active', contentKind: 'data', mode: 'static', content: '真实注册正文', locale: 'zh-CN', locales: {}, slots: [], roleIds: [role] })
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        modelContextAssets: async () => {
          state.__assetCalls++
          if (state.__assetFail) throw new Error('asset contract failure')
          return [asset('actual-profile-key', 'lin', 'companion-profile', '真实人物定义'), asset('foreign-key', 'yu', 'companion-profile', '另一人物定义'), asset('unrelated-key', 'lin', 'companion-scene', '无关场景')]
        },
        assetUsageQuery: async () => ({ records: [], total: 0 }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; recordId?: string }) => {
          if (state.__characterMode === 'fail') throw new Error('profile contract failure')
          const mode = state.__characterMode
          const profile = query.roleId === 'yu' ? null : mode === 'empty' ? {} : mode === 'bad' ? { interests: '异常兴趣结构', unknownField: ['原始数组保留'] } : mode === 'partial' ? { occupation: '', agePresentation: '', interests: ['阅读'] } : { schemaVersion: 1, occupation: '记录者', agePresentation: '成年人的表达', interests: ['阅读'], flaws: ['偶尔犹豫'], expression: { warmth: 6 }, extraMaterial: '应保留未知字段' }
          return { ...query, state: 'ready', source: 'Role Pack / Universe relations', timezone: 'Asia/Shanghai', total: null, generatedAt: Date.now(), hasMore: false, issues: [], boundary: '只读稳定定义', records: query.recordId === 'missing' || !['character', 'growth'].includes(query.view) ? [] : [{ id: query.roleId, roleId: query.roleId, kind: 'definition', title: '人物档案', time: null, status: '', body: mode === 'long' ? '完整人物简介。'.repeat(150) : query.roleId === 'yu' ? '予的简介仍可阅读' : '人物简介，独立于当前心情。', source: 'Role Pack / Universe relations', truncated: false, data: { profile, worldDefaults: null }, links: query.view === 'growth' ? [{ view: 'character', id: 'missing', label: '查看缺失人物引用' }] : [] }] }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel')
    const nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '人物档案', exact: true }).click()
    const character = panel.getByTestId('debug-evidence-character')
    const detail = character.getByRole('article', { name: '领域证据详情' })
    const toggle = character.getByRole('button', { name: /完整资料/ })
    await expect(character.getByRole('alert')).toContainText('读取失败')
    await expect(character.locator('.debug-character-summary')).toHaveCount(0)
    await page.evaluate(() => { (window as unknown as { __characterMode: string }).__characterMode = 'ready' })
    await character.getByRole('button', { name: '重试', exact: true }).click()
    await expect(character.locator('.debug-character-facts > div')).toHaveCount(3)
    await expect(detail).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('character-production-summary.png') })
    await toggle.click()
    await expect(detail.locator('.debug-character-profile')).toContainText('表达基线')
    await expect(detail.locator('.debug-character-profile')).toContainText('应保留未知字段')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.getByRole('alert')).toContainText('人物资料仍可阅读')
    await page.evaluate(() => { (window as unknown as { __assetFail: boolean }).__assetFail = false })
    await detail.getByRole('button', { name: '重试注册关联', exact: true }).click()
    await expect(detail.getByRole('alert')).toHaveCount(0)
    await expect(detail.getByRole('button', { name: /另一人物定义|无关场景/ })).toHaveCount(0)
    await detail.getByRole('button', { name: '查看注册定义 · 真实人物定义', exact: true }).click()
    await expect(panel.getByRole('article', { name: '资产详情' })).toContainText('真实注册正文')
    await nav.getByRole('button', { name: '人物档案', exact: true }).click()
    await character.getByRole('combobox').selectOption('yu')
    await expect(character.getByRole('status')).toContainText('详细人物资料未提供')
    await expect(character.locator('.debug-character-body')).toHaveText('予的简介仍可阅读')
    await toggle.click()
    await page.evaluate(() => { (window as unknown as { __characterMode: string }).__characterMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(character.getByRole('alert')).toContainText('保留上次资料')
    await expect(detail).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __characterMode: string }).__characterMode = 'empty' })
    await character.getByRole('button', { name: '重试', exact: true }).click()
    await character.getByRole('combobox').selectOption('lin')
    await expect(character.getByRole('status')).toContainText('空资料结构')
    for (const mode of ['partial', 'bad', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __characterMode: string }).__characterMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      if (mode === 'partial') await expect(character.locator('.debug-character-facts')).toContainText('未提供')
      if (mode === 'bad') await expect(character.getByRole('status')).toContainText('稳定兴趣字段格式异常')
      if (mode === 'long') await expect(character.locator('.debug-character-summary .debug-character-body')).toHaveText(`${'完整人物简介。'.repeat(150).slice(0, 160)}…`)
    }
    await toggle.click()
    await expect(detail.locator('.debug-character-body')).toHaveText('完整人物简介。'.repeat(150))
    await detail.getByText('默认世界定义', { exact: true }).click()
    await expect(detail).toContainText('不等于当前世界为空')
    for (const scale of ['sm', 'lg']) {
      await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
      expect(await character.locator('.debug-character-summary .debug-character-body').evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
      expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-font-scale', 'md'))
    await page.screenshot({ path: info.outputPath('character-production-detail.png') })
    await detail.getByRole('button', { name: '查看成长与反思', exact: true }).click()
    await panel.getByTestId('debug-evidence-growth').locator('[data-record-id="lin"] button').click()
    await panel.getByRole('button', { name: '查看缺失人物引用', exact: true }).click()
    await expect(character).toContainText('引用资料未在该人物范围找到，未选择替代人物。')
    await expect(character.locator('.debug-character-summary')).toHaveCount(0)
  })
}
