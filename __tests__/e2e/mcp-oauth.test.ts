import { test, expect } from '@playwright/test'
import { _electron as electron, chromium, type ElectronApplication } from 'playwright'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { startMcpOAuthFixture } from '../fixtures/mcp-oauth-server'

test('正式 OAuth 浏览器授权、工具许可、失效重新登录与重启无自动弹窗', async ({}, testInfo) => {
  const fixture = await startMcpOAuthFixture()
  const directory = await mkdtemp(path.join(os.tmpdir(), 'my-agent-oauth-'))
  const browser = await chromium.launch({ channel: 'chrome' })
  const consent = await browser.newPage()
  let app: ElectronApplication | undefined
  const launch = () => electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), `--user-data-dir=${directory}`, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  const instrument = async () => app!.evaluate(({ shell, dialog, BrowserWindow }) => {
    const state = globalThis as typeof globalThis & { oauthUrls: string[]; oauthReturns: number }
    state.oauthUrls = []; state.oauthReturns = 0
    // 只替换系统浏览器启动器；授权页在独立 Chromium 真实运行，不替换 OAuth 或 MCP 后端。
    shell.openExternal = async url => { state.oauthUrls.push(url) }
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    const win = BrowserWindow.getAllWindows()[0]
    const focus = win.focus.bind(win)
    win.focus = () => { state.oauthReturns++; focus() }
  })
  const urls = () => app!.evaluate(() => (globalThis as typeof globalThis & { oauthUrls: string[] }).oauthUrls)
  try {
    app = await launch()
    let page = await app.firstWindow()
    await instrument()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-mcp').click()
    await page.getByRole('button', { name: '+ 添加', exact: true }).click()
    const form = page.getByTestId('mcp-connection-form')
    await form.getByLabel('连接名称', { exact: true }).fill('OAuth 笔记')
    await form.getByLabel('服务 URL').fill(fixture.url)
    await form.getByLabel('认证方式').selectOption('oauth')
    await form.getByRole('button', { name: '登录并连接', exact: true }).click()
    await expect.poll(async () => (await urls()).length).toBe(1)
    expect(fixture.stats.tokenRequests).toBe(0)
    expect(JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers)).toEqual([])
    await consent.goto((await urls())[0])
    await consent.getByRole('button', { name: '授权', exact: true }).click()
    await expect(form.getByRole('status')).toContainText('已获取 1 个工具')
    await expect.poll(() => app!.evaluate(() => (globalThis as typeof globalThis & { oauthReturns: number }).oauthReturns)).toBe(1)
    await form.getByRole('checkbox', { name: '允许read_note' }).uncheck()
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    let card = page.locator('[data-testid^="settings-mcp-server-"]').filter({ hasText: 'OAuth 笔记' })
    await expect(card.getByRole('status')).toHaveText('已连接')
    const config = JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers)[0]
    expect(config.oauth).toEqual({})
    expect(config.allowedTools).toEqual([])
    expect(JSON.stringify(config)).not.toContain(fixture.accessToken)
    const runTool = () => page.evaluate(id => window.electronAPI.debug.toolRun({ name: `mcp__${id}__read_note`, args: {}, confirmRisk: true }), config.id)
    await runTool()
    expect(fixture.stats.toolCalls).toBe(0)
    await card.getByRole('checkbox', { name: '允许read_note' }).check()
    await runTool()
    expect(fixture.stats.toolCalls).toBe(1)
    await page.screenshot({ path: testInfo.outputPath('oauth-connected.png') })
    fixture.stats.rejectedTokens = true
    await runTool()
    await expect(card.getByRole('status')).toHaveText('需要登录')
    expect((await urls()).length).toBe(1)
    await card.getByRole('button', { name: '登录', exact: true }).click()
    await expect.poll(async () => (await urls()).length).toBe(2)
    await card.getByRole('button', { name: '取消', exact: true }).click()
    await expect(card.getByRole('button', { name: '登录', exact: true })).toBeEnabled()
    fixture.stats.rejectedTokens = false
    await card.getByRole('button', { name: '登录', exact: true }).click()
    await expect.poll(async () => (await urls()).length).toBe(3)
    await consent.goto((await urls())[2])
    await consent.getByRole('button', { name: '授权', exact: true }).click()
    await expect(card.getByRole('status')).toHaveText('已连接')
    await runTool()
    expect(fixture.stats.toolCalls).toBe(2)
    await app.close(); app = undefined
    expect((await readFile(path.join(directory, 'my-agent.db'))).includes(Buffer.from(fixture.accessToken))).toBe(false)
    app = await launch()
    page = await app.firstWindow()
    await instrument()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-mcp').click()
    card = page.locator('[data-testid^="settings-mcp-server-"]').filter({ hasText: 'OAuth 笔记' })
    await expect(card.getByRole('status')).toHaveText('需要登录')
    expect(await urls()).toEqual([])
    await expect(card.getByRole('button', { name: '登录', exact: true })).toBeEnabled()
    await page.screenshot({ path: testInfo.outputPath('oauth-restart-login.png') })
  } finally {
    await app?.close()
    await browser.close()
    await fixture.close()
    await rm(directory, { recursive: true, force: true })
  }
})
