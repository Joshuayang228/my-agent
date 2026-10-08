import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

test('正式朋友圈赞评经数据页备份到新目录、重启展示且重复导入不覆盖', async ({}, testInfo) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-moment-backup-'))
  const input = path.join(root, 'history.json')
  const output = path.join(root, 'export.json')
  const timestamp = Date.now()
  const png = await sharp({ create: { width: 24, height: 16, channels: 3, background: '#348368' } }).png({ compressionLevel: 0 }).toBuffer()
  const sourceId = createHash('sha256').update(png).digest('hex')
  const reference = { id: sourceId, fileName: 'moment.png', width: 24, height: 16, byteLength: png.length, mimeType: 'image/png' }
  const { fileName: _fileName, ...media } = reference
  await writeFile(input, JSON.stringify({ version: 1, exportedAt: timestamp, sessions: [], memories: [], settings: {},
    livingAssets: [{ id: 'history-picture', roleId: 'lin', kind: 'culture', name: '真实媒体验收', payload: { type: 'photography', image: reference }, acquiredAt: timestamp, sourceEventId: 'history-event' }],
    generatedImageMedia: [{ ...media, data: png.toString('base64') }], momentHistory: {
    events: [{ id: 'history-event', roleId: 'lin', scheduledAt: timestamp, status: 'published', type: 'rest', payload: { location: '窗边', imageId: sourceId, imageIds: [sourceId] } }],
    moments: [{ id: 'history-moment', roleId: 'lin', eventId: 'history-event', publishedAt: timestamp, text: '今天读完了一本书。', meta: { location: '窗边', interactions: [{ kind: 'comment', castName: '朋友', text: '读完记得聊聊' }] } }],
    interactions: [],
    links: [{ id: 'history-image-link', roleId: 'lin', eventId: 'history-event', targetType: 'image', targetId: sourceId, relation: 'depicts', metadata: { position: 0 }, createdAt: timestamp }],
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
    const sourceMoments = await page.evaluate(() => window.electronAPI.companion.getMoments({ limit: 80 }))
    const imageId = sourceMoments.items.find(row => row.id === 'history-moment')?.imageIds?.[0]
    expect(imageId).toMatch(/^[a-f0-9]{64}$/)
    expect(imageId).not.toBe(sourceId)
    expect(await page.evaluate(id => window.electronAPI.companion.readMomentImage('history-moment', id), imageId!)).toMatchObject({ ok: true })
    expect(await page.evaluate(() => window.electronAPI.companion.toggleMomentLike('history-moment'))).toMatchObject({ ok: true })
    expect(await page.evaluate(() => window.electronAPI.companion.addMomentComment('history-moment', '下次一起读这本书'))).toMatchObject({ ok: true })
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }) }, output)
    await page.getByTestId('section-data').getByTestId('export').click()
    await expect(page.getByTestId('section-data').getByRole('status')).toContainText('导出成功')
    const backup = JSON.parse(await readFile(output, 'utf8'))
    expect(backup.momentHistory.interactions.filter((row: any) => row.momentId === 'history-moment')).toHaveLength(2)
    expect(backup.momentHistory.events.every((row: any) => row.status === 'published')).toBe(true)
    expect(backup.momentHistory.links.find((row: any) => row.id === 'history-image-link')?.targetId).toBe(imageId)
    expect(backup.generatedImageMedia.map((row: any) => row.id)).toContain(imageId)
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
    expect(restored.items.find(row => row.id === 'history-moment')?.imageIds).toEqual([imageId])
    expect(await page.evaluate(id => window.electronAPI.companion.readMomentImage('history-moment', id), imageId!)).toMatchObject({ ok: true })
    expect(await page.evaluate(id => window.electronAPI.companion.readMomentImage('history-moment', id), sourceId)).toMatchObject({ ok: false })
    expect(await page.evaluate(id => window.electronAPI.companion.readAssetImage('history-picture', id), imageId!)).toMatchObject({ ok: true })
    expect(await page.evaluate(id => window.electronAPI.companion.readAssetImage('history-picture', id), sourceId)).toMatchObject({ ok: false })
    expect(await page.evaluate(id => window.electronAPI.companion.readAssetImage('missing-picture', id), imageId!)).toMatchObject({ ok: false })
    await app.evaluate(({ shell }) => {
      const state = globalThis as typeof globalThis & { revealedWorldImages?: string[] }
      state.revealedWorldImages = []
      shell.showItemInFolder = file => { state.revealedWorldImages!.push(file) }
    })
    expect(await page.evaluate(id => window.electronAPI.companion.revealAssetImage('history-picture', id), sourceId)).toMatchObject({ ok: false })
    expect(await app.evaluate(() => (globalThis as typeof globalThis & { revealedWorldImages: string[] }).revealedWorldImages)).toEqual([])
    expect(await page.evaluate(id => window.electronAPI.companion.revealAssetImage('history-picture', id), imageId!)).toMatchObject({ ok: true })
    const revealed = await app.evaluate(() => (globalThis as typeof globalThis & { revealedWorldImages: string[] }).revealedWorldImages)
    expect(revealed).toHaveLength(1)
    expect(path.relative(destination, revealed[0])).not.toMatch(/^\.\./)
    expect(restored.socialByMomentId['history-moment']).toMatchObject({ liked: true, likeCount: 1, commentCount: 2 })
    expect(restored.socialByMomentId['history-moment'].comments.map(row => row.text)).toEqual(['下次一起读这本书', '恢复之后新增的评论'])
    await page.getByTestId('settings-back').click()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    const card = page.getByTestId('moment-post').filter({ hasText: '今天读完了一本书。' }).first()
    await expect(card).toBeVisible()
    await expect.poll(() => card.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(24)
    await card.getByRole('button', { name: /预览/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: '关闭图片预览', exact: true }).click()
    await expect(card.getByTestId('moment-like-button')).toHaveAttribute('aria-label', '取消赞')
    await expect(card.getByTestId('moment-comment')).toHaveText(['朋友：读完记得聊聊', '我：下次一起读这本书', '我：恢复之后新增的评论'])
    await page.getByRole('tab', { name: '文化角', exact: true }).click()
    await page.getByRole('tab', { name: '摄影', exact: true }).click()
    const artwork = page.getByRole('article', { name: '真实媒体验收', exact: true })
    await expect.poll(() => artwork.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(24)
    await artwork.getByRole('button', { name: '查看作品：真实媒体验收', exact: true }).click()
    await expect.poll(() => page.getByTestId('culture-artwork').locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(24)
    await page.screenshot({ path: testInfo.outputPath('restored-moment.png'), animations: 'disabled' })
  } finally {
    await app?.close()
    await rm(root, { recursive: true, force: true })
  }
})
