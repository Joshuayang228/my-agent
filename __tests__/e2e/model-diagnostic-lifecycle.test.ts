import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

test('正式 MCP 新增向导保存期间拒绝重载退出，重启恢复连接与工具许可', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'my-agent-mcp-wizard-'))
  let requests = 0
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST') { response.writeHead(405).end(); return }
    requests++
    const mcp = new McpServer({ name: 'wizard-fixture', version: '1.0.0' })
    mcp.registerTool('read_note', { description: '读取笔记', inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'note' }] }))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    response.on('close', () => { void mcp.close() })
    await mcp.connect(transport)
    await transport.handleRequest(request, response)
  })
  let app: ElectronApplication | undefined
  const launch = () => electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), '--user-data-dir=' + directory, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fixture address unavailable')
    const url = 'http://127.0.0.1:' + address.port + '/mcp'
    app = await launch()
    let page = await app.firstWindow()
    page.on('dialog', () => {})
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    // 背景：保存中离页曾只由 Renderer 夹具覆盖；这里仅延迟独占进程的原 handler。
    // 保留真实协议、校验和落盘；内部映射不可用必须失败，不能替换为假成功。
    await app.evaluate(({ ipcMain, BrowserWindow, dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
      const original = (ipcMain as any)._invokeHandlers?.get('mcp:save-tested')
      if (!original) throw new Error('mcp:save-tested handler unavailable')
      const state = { blocked: 0, release: null as null | (() => void) }
      ;(globalThis as any).__wizardLifecycle = state
      ipcMain.removeHandler('mcp:save-tested')
      ipcMain.handle('mcp:save-tested', async (...args) => {
        await new Promise<void>(resolve => { state.release = resolve })
        return original(...args)
      })
      BrowserWindow.getAllWindows()[0].webContents.on('will-prevent-unload', () => { state.blocked++ })
    })
    await page.getByTestId('settings-nav-mcp').click()
    await page.getByRole('button', { name: '+ 添加', exact: true }).click()
    const form = page.getByTestId('mcp-connection-form')
    await form.getByLabel('连接名称', { exact: true }).fill('向导真实连接')
    await form.getByLabel('服务 URL').fill(url)
    await form.getByRole('button', { name: '测试连接', exact: true }).click()
    await expect(form.getByRole('status')).toContainText('已获取 1 个工具')
    await form.getByRole('checkbox', { name: '允许read_note' }).uncheck()
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    await expect.poll(() => app!.evaluate(() => Boolean((globalThis as any).__wizardLifecycle.release))).toBe(true)
    expect(JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers)).toEqual([])
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.reload() })
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__wizardLifecycle.blocked)).toBe(1)
    await app.evaluate(({ app }) => { app.quit() })
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__wizardLifecycle.blocked)).toBe(2)
    await expect(form).toBeVisible()
    await app.evaluate(() => { (globalThis as any).__wizardLifecycle.release() })
    const card = () => page.locator('[data-testid^="settings-mcp-server-"]').filter({ hasText: '向导真实连接' })
    await expect(card().getByRole('status')).toHaveText('已连接', { timeout: 20_000 })
    await expect(form).toHaveCount(0)
    await page.reload()
    await page.getByTestId('settings-nav-mcp').click()
    await expect(card().getByRole('status')).toHaveText('已连接')
    await app.close(); app = undefined
    const beforeRestart = requests
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-mcp').click()
    await expect(card().getByRole('status')).toHaveText('已连接')
    await expect(card().getByRole('checkbox', { name: '允许read_note' })).not.toBeChecked()
    const saved = JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ name: '向导真实连接', url, enabled: true, allowedTools: [] })
    expect(requests).toBeGreaterThan(beforeRestart)
  } finally {
    if (app && app.process().exitCode === null) await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy() }).catch(() => {})
    await app?.close()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})

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

for (const target of ['permissionRules', 'mcpServers'] as const) {
test(`正式独立保存拒绝重载退出并在重启后恢复 ${target}`, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'my-agent-permission-lifecycle-'))
  let app: ElectronApplication | undefined
  const launch = () => electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), '--user-data-dir=' + directory, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  try {
    app = await launch()
    let page = await app.firstWindow()
    page.on('dialog', () => {})
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    if (target === 'permissionRules') {
      await page.getByTestId('settings-nav-permissions').click()
      await page.getByTestId('settings-permission-rules-toggle').click()
      await page.getByTestId('settings-add-rule').click()
      await page.getByLabel('规则匹配内容', { exact: true }).fill('npm publish')
    } else {
      await page.evaluate(() => window.electronAPI.settings.set('mcpServers', JSON.stringify([{ id: 'lifecycle', name: '生命周期测试', command: 'node', args: [], enabled: false, transport: 'stdio' }])))
      await page.reload()
      await page.getByRole('button', { name: 'MCP', exact: true }).click()
      await expect(page.getByTestId('settings-mcp-server-lifecycle')).toBeVisible()
    }
    // 仅在独占测试进程中延迟原 handler 的执行；保留真实 preload、参数校验、存储与热更新。
    // Electron 升级若移除该内部映射必须显式失败，不能降级为假保存或跳过验证。
    await app.evaluate(({ ipcMain, BrowserWindow }, target) => {
      const handlers = (ipcMain as any)._invokeHandlers as Map<string, (...args: any[]) => unknown>
      const original = handlers?.get('settings:set')
      if (!original) throw new Error('settings:set handler unavailable')
      const state = { blocked: 0, release: null as null | (() => void) }
      ;(globalThis as any).__permissionLifecycle = state
      ipcMain.removeHandler('settings:set')
      ipcMain.handle('settings:set', async (event, key, value) => {
        if (key === target) await new Promise<void>(resolve => { state.release = resolve })
        return original(event, key, value)
      })
      BrowserWindow.getAllWindows()[0].webContents.on('will-prevent-unload', () => { state.blocked++ })
    }, target)
    if (target === 'permissionRules') await page.getByTestId('settings-save-rule').click()
    else await page.getByRole('button', { name: '删除生命周期测试', exact: true }).click()
    await expect.poll(() => app!.evaluate(() => Boolean((globalThis as any).__permissionLifecycle.release))).toBe(true)
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.reload() })
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__permissionLifecycle.blocked)).toBe(1)
    await app.evaluate(({ app }) => { app.quit() })
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__permissionLifecycle.blocked)).toBe(2)
    if (target === 'permissionRules') await expect(page.getByLabel('规则匹配内容', { exact: true })).toHaveValue('npm publish')
    else await expect(page.getByTestId('settings-mcp-server-lifecycle')).toBeVisible()
    await app.evaluate(() => { (globalThis as any).__permissionLifecycle.release() })
    if (target === 'permissionRules') {
      await expect(page.getByLabel('规则匹配内容', { exact: true })).toHaveCount(0)
      await expect.poll(() => page.evaluate(async () => (await window.electronAPI.settings.get()).permissionRules)).toContain('npm publish')
    } else {
      await expect(page.getByTestId('settings-mcp-server-lifecycle')).toHaveCount(0)
      await expect.poll(() => page.evaluate(async () => (await window.electronAPI.settings.get()).mcpServers)).toBe('[]')
    }
    await app.close()
    app = undefined
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    if (target === 'permissionRules') {
      await page.getByTestId('settings-nav-permissions').click()
      await page.getByTestId('settings-permission-rules-toggle').click()
      await expect(page.getByTestId('settings-rule-card')).toContainText('npm publish')
    } else {
      await page.getByRole('button', { name: 'MCP', exact: true }).click()
      await expect(page.getByTestId('settings-mcp-server-lifecycle')).toHaveCount(0)
      expect((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers).toBe('[]')
    }
  } finally {
    if (app && app.process().exitCode === null) await app.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.destroy() }).catch(() => {})
    await app?.close()
    await rm(directory, { recursive: true, force: true })
  }
})
}

test('普通设置防抖草稿拒绝重载退出并在保存后重启恢复', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'my-agent-settings-queue-'))
  let app: ElectronApplication | undefined
  const launch = () => electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), '--user-data-dir=' + directory, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  try {
    app = await launch()
    let page = await app.firstWindow()
    page.on('dialog', () => {})
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-companion').click()
    // 仅扣住设置的 800ms 防抖回调，不替换 Chromium 全局时钟或真实 IPC / 数据库。
    await page.evaluate(() => {
      const schedule = window.setTimeout.bind(window)
      const cancel = window.clearTimeout.bind(window)
      const held = new Map<number, () => void>()
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: any[]) => {
        if (delay !== 800 || typeof handler !== 'function') return schedule(handler, delay, ...args)
        const id = schedule(() => {}, 60000)
        held.set(id, () => handler(...args))
        return id
      }) as typeof window.setTimeout
      window.clearTimeout = (id?: number) => { if (id !== undefined) held.delete(id); cancel(id) }
      ;(window as any).__releaseSettingsDebounce = () => {
        window.setTimeout = schedule
        window.clearTimeout = cancel
        for (const [id, run] of held) { cancel(id); run() }
        held.clear()
      }
      ;(window as any).__settingsDebounceCount = () => held.size
    })
    const note = page.getByRole('textbox', { name: '相处补充说明', exact: true })
    await note.fill('重载退出前必须保存的伙伴说明')
    await expect.poll(() => page.evaluate(() => (window as any).__settingsDebounceCount())).toBe(1)
    expect((await page.evaluate(() => window.electronAPI.settings.get())).companionResponseNote).toBe('')
    await app.evaluate(({ BrowserWindow }) => {
      const state = globalThis as { __queueBlocked?: number }
      state.__queueBlocked = 0
      BrowserWindow.getAllWindows()[0].webContents.on('will-prevent-unload', () => { state.__queueBlocked!++ })
      BrowserWindow.getAllWindows()[0].webContents.reload()
    })
    await expect.poll(() => app!.evaluate(() => (globalThis as { __queueBlocked?: number }).__queueBlocked)).toBe(1)
    await app.evaluate(({ app }) => { app.quit() })
    await expect.poll(() => app!.evaluate(() => (globalThis as { __queueBlocked?: number }).__queueBlocked)).toBe(2)
    await expect(note).toHaveValue('重载退出前必须保存的伙伴说明')
    await page.evaluate(() => (window as any).__releaseSettingsDebounce())
    await expect.poll(async () => (await page.evaluate(() => window.electronAPI.settings.get())).companionResponseNote).toBe('重载退出前必须保存的伙伴说明')
    await expect.poll(() => page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true)
    await page.reload()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await app.close()
    app = undefined
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-companion').click()
    await expect(page.getByRole('textbox', { name: '相处补充说明', exact: true })).toHaveValue('重载退出前必须保存的伙伴说明')
  } finally {
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
