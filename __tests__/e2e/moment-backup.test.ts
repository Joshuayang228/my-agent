import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

test('正式朋友圈赞评经数据页备份到新目录、重启展示且重复导入不覆盖', async ({}, testInfo) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-moment-backup-'))
  const input = path.join(root, 'history.json')
  const output = path.join(root, 'export.json')
  const timestamp = Date.now()
  await writeFile(input, JSON.stringify({ version: 1, exportedAt: timestamp, sessions: [], memories: [], settings: {}, momentHistory: {
    events: [{ id: 'history-event', roleId: 'lin', scheduledAt: timestamp, status: 'published', type: 'rest', payload: { location: '窗边' } }],
    moments: [{ id: 'history-moment', roleId: 'lin', eventId: 'history-event', publishedAt: timestamp, text: '今天读完了一本书。', meta: { location: '窗边', interactions: [{ kind: 'comment', castName: '朋友', text: '读完记得聊聊' }] } }],
    interactions: [],
  } }))
  const launch = async (directory: string) => {
    await mkdir(directory, { recursive: true })
    return electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), `--user-data-dir=${directory}`, '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  }
  let app: ElectronApplication | undefined
  try {
    app = await launch(path.join(root, 'source'))
    let page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-data').click()
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }) }, input)
    await page.getByTestId('section-data').getByTestId('import').click()
    await expect(page.getByTestId('section-data').getByRole('status')).toContainText('导入成功')
    expect(await page.evaluate(() => window.electronAPI.companion.toggleMomentLike('history-moment'))).toMatchObject({ ok: true })
    expect(await page.evaluate(() => window.electronAPI.companion.addMomentComment('history-moment', '下次一起读这本书'))).toMatchObject({ ok: true })
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, output)
    await page.getByTestId('section-data').getByTestId('export').click()
    await expect(page.getByTestId('section-data').getByRole('status')).toContainText('导出成功')
    const backup = JSON.parse(await readFile(output, 'utf8'))
    expect(backup.momentHistory.interactions.filter((row: any) => row.momentId === 'history-moment')).toHaveLength(2)
    expect(backup.momentHistory.events.every((row: any) => row.status === 'published')).toBe(true)
    await app.close(); app = undefined

    const destination = path.join(root, 'destination')
    app = await launch(destination)
    page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-data').click()
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }) }, output)
    await page.getByTestId('section-data').getByTestId('import').click()
    // 新目录导入包含加密配置，会等待 Windows Local State 落盘；生产最多等待 15 秒，
    // 此处给 IPC / 渲染留余量而非固定休眠，仍须成功并通过下方真实重启数据断言。
    await expect(page.getByTestId('section-data').getByRole('status')).toContainText('导入成功', { timeout: 20_000 })
    expect(await page.evaluate(() => window.electronAPI.companion.addMomentComment('history-moment', '恢复之后新增的评论'))).toMatchObject({ ok: true })
    expect(await page.evaluate(() => window.electronAPI.data.import())).toMatchObject({ success: true })
    await app.close(); app = undefined
    app = await launch(destination)
    page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    const restored = await page.evaluate(() => window.electronAPI.companion.getMoments({ limit: 80 }))
    expect(restored.items.find(row => row.id === 'history-moment')?.text).toBe('今天读完了一本书。')
    expect(restored.socialByMomentId['history-moment']).toMatchObject({ liked: true, likeCount: 1, commentCount: 2 })
    expect(restored.socialByMomentId['history-moment'].comments.map(row => row.text)).toEqual(['下次一起读这本书', '恢复之后新增的评论'])
    await page.getByTestId('settings-back').click()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    const card = page.getByTestId('moment-post').filter({ hasText: '今天读完了一本书。' }).first()
    await expect(card).toBeVisible()
    await expect(card.getByTestId('moment-like-button')).toHaveAttribute('aria-label', '取消赞')
    await expect(card.getByTestId('moment-comment')).toHaveText(['朋友：读完记得聊聊', '我：下次一起读这本书', '我：恢复之后新增的评论'])
    await page.screenshot({ path: testInfo.outputPath('restored-moment.png'), animations: 'disabled' })
  } finally {
    await app?.close()
    await rm(root, { recursive: true, force: true })
  }
})
