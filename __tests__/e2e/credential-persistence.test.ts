import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

test('首次正式保存模型凭据后立即强退，重启仍能使用原凭据', async () => {
  test.skip(process.platform !== 'win32', 'Windows 系统加密状态首次落盘回归')
  const secret = randomUUID()
  let receivedAuthorization = ''
  const server = createServer((request, response) => {
    receivedAuthorization = request.headers.authorization ?? ''
    response.writeHead(receivedAuthorization === 'Bearer ' + secret ? 200 : 401, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ data: [{ id: 'crash-fixture-model' }] }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing local address')
  const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-credential-recovery-'))
  let app: ElectronApplication | undefined
  const launch = async () => {
    app = await electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), '--user-data-dir=' + root, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    return page
  }
  try {
    let page = await launch()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    await page.getByRole('button', { name: '添加连接', exact: true }).click()
    const form = page.getByTestId('model-connection-form')
    await form.getByRole('radio', { name: '自定义连接', exact: true }).click()
    await form.getByLabel('连接名称', { exact: true }).fill('首次保存恢复')
    await form.getByLabel('Base URL', { exact: true }).fill('http://127.0.0.1:' + address.port + '/v1')
    await form.getByLabel('API Key', { exact: true }).fill(secret)
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    await expect(page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '首次保存恢复' })).toBeVisible({ timeout: 20_000 })
    // 保存应答后直接强退；不先正常关闭或等待 Local State，避免测试替产品补上持久化。
    const exited = app!.waitForEvent('close')
    execFileSync('taskkill', ['/PID', String(app!.process().pid), '/T', '/F'])
    await exited
    app = undefined
    const databaseBytes = await readFile(path.join(root, 'my-agent.db'))
    expect(databaseBytes.includes(Buffer.from(secret))).toBe(false)
    page = await launch()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    const restored = await page.evaluate(() => window.electronAPI.settings.get())
    expect(JSON.parse(restored.modelConnections)).toEqual([expect.objectContaining({ name: '首次保存恢复', hasApiKey: true, apiKey: '' })])
    await page.getByTestId('settings-nav-model').click()
    const profile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '首次保存恢复' })
    await profile.getByRole('button', { name: '获取 首次保存恢复 已有模型', exact: true }).click()
    await expect(profile.getByRole('button', { name: 'crash-fixture-model', exact: true })).toBeVisible()
    expect(receivedAuthorization).toBe('Bearer ' + secret)
  } finally {
    if (app) await app.close()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await rm(root, { recursive: true, force: true })
  }
})
