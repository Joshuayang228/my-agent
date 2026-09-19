import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

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
