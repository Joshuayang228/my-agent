import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

test('正式模型草稿隐藏恢复与重载退出的保存边界', async ({}, testInfo) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'my-agent-draft-lifecycle-'))
  let app: ElectronApplication | undefined
  const launch = () => electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), '--user-data-dir=' + directory, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  const draftName = '尚未保存的连接'
  const draftKey = 'synthetic-unsaved-key'
  try {
    app = await launch()
    let page = await app.firstWindow()
    // Electron 自行取消 beforeunload；只观察事件，禁止 Playwright 再用 CDP 关闭已不存在的原生对话框。
    page.on('dialog', () => {})
    const edit = async () => {
      await expect(page.getByTestId('settings-panel')).toBeVisible()
      await page.getByTestId('settings-nav-model').click()
      await page.getByRole('button', { name: '添加连接', exact: true }).click()
      const form = page.getByTestId('model-connection-form')
      await form.getByRole('radio', { name: '本地模型', exact: true }).click()
      await form.getByLabel('连接名称', { exact: true }).fill(draftName)
      await form.getByLabel('API Key', { exact: true }).fill(draftKey)
      return form
    }
    const savedBefore = await page.evaluate(() => window.electronAPI.settings.get())
    const form = await edit()
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close() })
    await expect.poll(() => app!.evaluate(({ BrowserWindow }) => ({ count: BrowserWindow.getAllWindows().length, visible: BrowserWindow.getAllWindows()[0]?.isVisible() }))).toEqual({ count: 1, visible: false })
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].show() })
    await expect(form.getByLabel('连接名称', { exact: true })).toHaveValue(draftName)
    await expect(form.getByLabel('API Key', { exact: true })).toHaveValue(draftKey)
    await page.getByTestId('settings-back').click()
    await expect(page.getByText('模型设置有未保存内容，请先保存、取消编辑或清空模型输入。', { exact: true })).toBeVisible()
    await expect(form).toBeVisible()
    expect((await page.evaluate(() => window.electronAPI.settings.get())).modelConnections).toBe(savedBefore.modelConnections)
    await app.evaluate(({ BrowserWindow }) => {
      const state = globalThis as { __preventedUnloads?: number }
      state.__preventedUnloads = 0
      BrowserWindow.getAllWindows()[0].webContents.on('will-prevent-unload', () => { state.__preventedUnloads!++ })
      BrowserWindow.getAllWindows()[0].webContents.reload()
    })
    await expect.poll(() => app!.evaluate(() => (globalThis as { __preventedUnloads?: number }).__preventedUnloads)).toBe(1)
    await expect(form.getByLabel('API Key', { exact: true })).toHaveValue(draftKey)
    expect((await page.evaluate(() => window.electronAPI.settings.get())).modelConnections).toBe(savedBefore.modelConnections)
    await app.evaluate(({ app }) => { app.quit() })
    await expect.poll(() => app!.evaluate(() => (globalThis as { __preventedUnloads?: number }).__preventedUnloads)).toBe(2)
    await expect(form.getByLabel('连接名称', { exact: true })).toHaveValue(draftName)
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close() })
    await expect.poll(() => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())).toBe(false)
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].show() })
    await form.getByRole('button', { name: '取消', exact: true }).click()
    await page.reload()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await app.close()
    app = undefined
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    await expect(page.getByTestId('model-connection-form')).toHaveCount(0)
    expect((await page.evaluate(() => window.electronAPI.settings.get())).modelConnections).toBe(savedBefore.modelConnections)
    await testInfo.attach('draft-lifecycle-boundary', { body: JSON.stringify({ closeHidesWindow: true, hiddenDraftRetained: true, internalNavigationBlocked: true, dirtyReloadBlocked: true, dirtyQuitBlocked: true, cleanReloadAndQuitSucceeded: true, unsavedConnectionCommitted: false }), contentType: 'application/json' })
  } finally {
    // 失败时仅销毁本测试独占窗口，避免被正在验收的草稿保护阻塞清理。
    if (app && app.process().exitCode === null) await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy() }).catch(() => {})
    await app?.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('正式模型诊断重载取消真实 HTTP，重新进入可发现与测试', async () => {
  let hang = true
  const received: string[] = []
  const closed: string[] = []
  const server = createServer(async (request, response) => {
    for await (const _chunk of request) { /* 消费请求体，关闭观察绑定响应而非请求读取完成。 */ }
    const url = request.url ?? ''
    received.push(url)
    if (hang) { response.on('close', () => closed.push(url)); return }
    if (url.endsWith('/models')) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ id: 'local-fixture' }] }))
    } else {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '连接成功' }, finish_reason: null }] })}\n\n`)
      response.end('data: [DONE]\n\n')
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture address')
  const baseUrl = `http://127.0.0.1:${address.port}/v1`
  const directory = await mkdtemp(path.join(os.tmpdir(), 'my-agent-diagnostic-'))
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), `--user-data-dir=${directory}`, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
    const page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    await page.getByRole('button', { name: '添加连接', exact: true }).click()
    const form = page.getByTestId('model-connection-form')
    await form.getByRole('radio', { name: '本地模型', exact: true }).click()
    await form.getByLabel('连接名称', { exact: true }).fill('生命周期验证')
    await form.getByLabel('Base URL', { exact: true }).fill(baseUrl)
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    const profile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '生命周期验证' })
    await profile.getByRole('button', { name: '获取 生命周期验证 已有模型', exact: true }).click()
    await expect.poll(() => received).toContain('/v1/models')
    await page.reload()
    await expect.poll(() => closed).toContain('/v1/models')
    hang = false
    await page.getByTestId('settings-nav-model').click()
    await profile.getByRole('button', { name: '获取 生命周期验证 已有模型', exact: true }).click()
    await profile.getByRole('button', { name: 'local-fixture', exact: true }).click()
    hang = true
    await profile.getByRole('button', { name: '测试连接 生命周期验证', exact: true }).click()
    await expect.poll(() => received).toContain('/v1/chat/completions')
    await page.reload()
    await expect.poll(() => closed).toContain('/v1/chat/completions')
    hang = false
    await page.getByTestId('settings-nav-model').click()
    await profile.getByRole('button', { name: '测试连接 生命周期验证', exact: true }).click()
    await expect(profile).toContainText('连接测试通过')
    expect(received.filter(url => url === '/v1/chat/completions')).toHaveLength(2)
  } finally {
    await app?.close()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})
