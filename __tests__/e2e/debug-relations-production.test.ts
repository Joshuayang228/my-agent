import { test, expect } from '@playwright/test'

for (const theme of ['porcelain-blue', 'yao-stone']) for (const width of [1096, 600]) {
  test(`正式通讯录方向与来源 ${theme} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme)
    await page.goto('/')
    await page.evaluate(() => {
      const state = window as unknown as { electronAPI: { debug: Record<string, unknown> }; __relationsMode: string; __relationsQueries: Array<{ view: string; recordId?: string }> }
      state.electronAPI = { ...state.electronAPI, debug: { ...state.electronAPI?.debug } }
      state.__relationsMode = 'fail'; state.__relationsQueries = []
      Object.assign(state.electronAPI.debug, {
        companionEvidenceScope: async () => ({ roles: [{ id: 'lin', name: '林' }, { id: 'yu', name: '予' }], activeRoleId: 'lin', universeId: 'test', ready: true }),
        companionEvidenceQuery: async (query: { view: string; roleId: string; recordId?: string }) => {
          state.__relationsQueries.push(query)
          if (state.__relationsMode === 'fail') throw new Error('relations contract failure')
          const at = Date.parse('2026-10-25T06:00:00Z')
          const record = (id: string, data: Record<string, unknown>) => ({ id, roleId: query.roleId, source: 'Role Pack / Universe relations', kind: 'relation', data, body: '', title: id, status: '', time: null, truncated: state.__relationsMode === 'truncated', links: [] })
          const experiences = [{ id: 'event-real', time: state.__relationsMode === 'undated' ? 0 : at, payload: { activity: '整理旧书', location: '书房', text: state.__relationsMode === 'long' ? '共同经历长正文。'.repeat(180) : '共同经历正文' } }, { id: 'second-event', time: at, payload: { activity: '阅读笔记', story: '另一次明确共同在场' } }]
          const rows = [record('person-a', { id: 'person-a', name: state.__relationsMode === 'unregistered' ? 'person-a' : '予', relations: [{ from: 'lin', to: 'person-a', type: 'friend', note: state.__relationsMode === 'long' ? '关系长说明。'.repeat(150) : '正方向关系说明' }, { from: 'person-a', to: 'lin', type: 'colleague', note: '反方向关系说明' }], experiences: state.__relationsMode === 'no-source' ? undefined : state.__relationsMode === 'bad' ? [null, { id: '', payload: { text: '坏事件原文' } }] : state.__relationsMode === 'partial' ? experiences.slice(1) : experiences }), record('person-b', { id: 'person-b', name: '予', relations: [{ from: 'lin', to: 'person-b', type: 'friend' }], experiences: [] })]
          const records = query.roleId === 'yu' ? [] : query.view === 'recent' ? [{ ...record('event-real', { scheduled_at: at }), source: 'companion_events', kind: 'reading', body: '来源事件正文', links: [{ view: 'relations', id: 'missing', label: '查看缺失人物' }] }] : query.view !== 'relations' ? [] : query.recordId ? rows.filter(row => row.id === query.recordId) : rows
          return { ...query, records, state: 'ready', timezone: 'Asia/Shanghai', source: 'Role Pack / Universe relations', total: null, generatedAt: Date.now(), hasMore: false, issues: state.__relationsMode === 'partial' ? ['一条共同经历格式损坏'] : [], boundary: '共同事件先限量后按人物分配；没有后续游标' }
        },
      })
    })
    await page.getByTestId('primary-sidebar').getByRole('button', { name: 'Debug', exact: true }).click()
    const panel = page.getByTestId('dev-panel'), nav = panel.getByRole('navigation')
    await nav.getByRole('button', { name: '通讯录', exact: true }).click()
    const contacts = panel.getByTestId('debug-evidence-relations'), detail = contacts.getByRole('article', { name: '领域证据详情' }), search = contacts.getByRole('textbox', { name: '搜索当前页证据' })
    const person = contacts.locator('[data-record-id="person-a"] button')
    await expect(contacts.getByRole('alert')).toContainText('读取失败')
    await expect(contacts.locator('.debug-relations-range')).toHaveCount(0)
    await expect(search).toBeDisabled()
    await page.evaluate(() => { (window as unknown as { __relationsMode: string }).__relationsMode = 'ready' })
    await contacts.getByRole('button', { name: '重试', exact: true }).click()
    await expect(contacts.getByRole('button', { name: '查看人物：予', exact: true })).toHaveCount(2)
    await expect(contacts).not.toContainText('共同经历正文')
    await expect(contacts.getByRole('button', { name: /下一页/ })).toHaveCount(0)
    await person.click()
    await expect(detail.locator('.debug-relations-definition')).toHaveCount(2)
    await expect(detail.locator('.debug-relations-definition').first()).toContainText('林 → 予')
    await expect(detail.locator('.debug-relations-definition').last()).toContainText('予 → 林')
    await detail.getByText('共同在场的事件', { exact: true }).click()
    await expect(detail.locator('.debug-relations-experience')).toHaveCount(2)
    await expect(detail).toContainText('不是完整交往历史')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.locator('pre')).toContainText('person-a')
    await page.evaluate(() => { (window as unknown as { __relationsMode: string }).__relationsMode = 'fail' })
    await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
    await expect(contacts.getByRole('alert')).toContainText('保留原人物、筛选和关系详情')
    await expect(detail.locator('pre')).toBeVisible()
    await page.evaluate(() => { (window as unknown as { __relationsMode: string }).__relationsMode = 'ready' })
    await contacts.getByRole('button', { name: '重试', exact: true }).click()
    await expect(contacts.getByRole('alert')).toHaveCount(0)
    await expect(detail.locator('pre')).toBeVisible()
    await detail.getByRole('button', { name: '返回列表', exact: true }).click()
    await expect(person).toBeFocused()
    await search.fill('旧书')
    await expect(contacts.locator('[data-record-id]')).toHaveCount(1)
    await search.fill('')
    await page.screenshot({ path: info.outputPath('relations-production-list.png') })
    await contacts.locator('[data-record-id="person-b"] button').click()
    await detail.getByText('共同在场的事件', { exact: true }).click()
    await expect(detail).toContainText('本次已读范围没有共同在场事件')
    await detail.getByText('来源与原始记录', { exact: true }).click()
    await expect(detail.locator('pre')).not.toContainText('person-a')
    await person.click()
    await detail.getByText('共同在场的事件', { exact: true }).click()
    await detail.locator('.debug-relations-experience').first().getByRole('button', { name: '查看共同事件来源', exact: true }).click()
    const event = panel.getByTestId('debug-evidence-recent').getByRole('article', { name: '领域证据详情' })
    await expect(event).toContainText('来源事件正文')
    expect(await page.evaluate(() => (window as unknown as { __relationsQueries: Array<{ view: string; recordId?: string }> }).__relationsQueries.at(-1))).toMatchObject({ view: 'recent', recordId: 'event-real' })
    await event.getByRole('button', { name: '查看缺失人物', exact: true }).click()
    await expect(contacts).toContainText('未选择替代记录')
    await expect(detail).toHaveCount(0)
    await contacts.getByRole('button', { name: '返回当前领域列表', exact: true }).click()
    for (const mode of ['no-source', 'undated', 'bad', 'partial', 'truncated', 'unregistered', 'long']) {
      await page.evaluate(mode => { (window as unknown as { __relationsMode: string }).__relationsMode = mode }, mode)
      await panel.getByRole('button', { name: '刷新当前分区', exact: true }).click()
      await person.click()
      const fold = detail.locator('.debug-relations-experiences')
      if (!(await fold.getAttribute('open'))) {
        // getAttribute 返回空字符串也代表已展开，故用 DOM 属性区分真正的 null。
        if (await fold.getAttribute('open') === null) await detail.getByText('共同在场的事件', { exact: true }).click()
      }
      if (mode === 'no-source') await expect(detail).toContainText('本次查询未提供共同经历')
      if (mode === 'undated') await expect(detail).toContainText('事件计划时间：未记录')
      if (mode === 'bad') {
        await expect(detail).toContainText('事件标识异常')
        await expect(detail.locator('.debug-relations-experience button')).toHaveCount(0)
      }
      if (mode === 'partial') { await expect(contacts).toContainText('一条共同经历格式损坏'); await expect(detail.locator('.debug-relations-experience')).toHaveCount(1) }
      if (mode === 'truncated') await expect(detail).toContainText('以下仅含已返回内容')
      if (mode === 'unregistered') await expect(contacts.locator('[data-record-id="person-a"]')).toContainText('姓名未登记')
      if (mode === 'long') {
        await expect(detail.locator('.debug-relations-definition .debug-relations-body').first()).toHaveText('关系长说明。'.repeat(150))
        await expect(detail.locator('.debug-relations-experience .debug-relations-body').first()).toHaveText('共同经历长正文。'.repeat(180))
        for (const scale of ['sm', 'lg']) {
          await page.evaluate(scale => document.documentElement.setAttribute('data-font-scale', scale), scale)
          expect(await detail.locator('.debug-relations-definition .debug-relations-body').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(14 / 15, 3)
          expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
        }
        await page.screenshot({ path: info.outputPath('relations-production-detail.png') })
      }
    }
    await contacts.getByRole('combobox', { name: '诊断人物' }).selectOption('yu')
    await expect(detail).toHaveCount(0)
    await expect(contacts).toContainText('不推断没有关系')
  })
}
