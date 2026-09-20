import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

// 本地协议服务只验证应用调用链，不证明任意本地模型的工具、图片或推理能力。
test('无 Key 本地连接从正式设置发现、测试、重启并流式对话，认证失败可编辑重试', async () => {
  const requests: Array<{ url: string; authorization?: string; body: Record<string, unknown> }> = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const text = Buffer.concat(chunks).toString('utf8')
    const entry = { url: request.url ?? '', authorization: request.headers.authorization, body: text ? JSON.parse(text) : {} }
    requests.push(entry)
    if (entry.url.startsWith('/failed/') && entry.url.endsWith('/chat/completions')) {
      response.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { message: 'fixture unavailable' } }))
      return
    }
    if (entry.url.startsWith('/protected/') && entry.authorization !== 'Bearer fixture-local-key') {
      response.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { message: 'authentication required' } }))
      return
    }
    if (request.method === 'GET' && entry.url.endsWith('/models')) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ id: 'local-fixture' }] }))
      return
    }
    if (request.method === 'POST' && entry.url.endsWith('/chat/completions')) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '本地连接验证成功' }, finish_reason: null }] })}\n\n`)
      response.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 2 } })}\n\n`)
      response.end('data: [DONE]\n\n')
      return
    }
    response.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Local test server unavailable')
  const baseUrl = `http://127.0.0.1:${address.port}/v1`
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'my-agent-keyless-'))
  const entry = fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url))
  const launch = () => electron.launch({ args: [entry, `--user-data-dir=${dataDir}`, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: 'fixture-unused-environment', LLM_BASE_URL: baseUrl, LLM_MODEL: 'unused-environment-model' } })
  let app: ElectronApplication | undefined
  try {
    app = await launch()
    let page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    await page.getByRole('button', { name: '添加连接', exact: true }).click()
    let form = page.getByTestId('model-connection-form')
    await form.getByRole('radio', { name: '本地模型', exact: true }).click()
    await form.getByLabel('连接名称', { exact: true }).fill('无密钥本地连接')
    await form.getByLabel('Base URL', { exact: true }).fill(baseUrl)
    await expect(form.getByLabel('API Key', { exact: true })).toHaveValue('')
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    let profile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '无密钥本地连接' })
    await expect(profile).toContainText('可留空', { timeout: 20_000 })
    await profile.getByRole('button', { name: '获取 无密钥本地连接 已有模型', exact: true }).click()
    await profile.getByRole('button', { name: 'local-fixture', exact: true }).click()
    await profile.getByRole('button', { name: '测试连接 无密钥本地连接', exact: true }).click()
    await expect(profile).toContainText('连接测试通过')
    await page.getByLabel('添加主对话模型').selectOption({ label: '无密钥本地连接 · local-fixture' })
    await expect(page.getByText('当前主连接', { exact: true })).toHaveCount(0)
    await expect.poll(() => page.evaluate(async () => (await window.electronAPI.settings.get()).llmConnectionReady)).toBe('true')
    await page.getByTestId('settings-model-advanced-toggle').click()
    const advanced = page.getByTestId('settings-model-advanced')
    await advanced.getByLabel('Temperature', { exact: true }).fill('0')
    await advanced.getByLabel('会话预算（Token）', { exact: true }).fill('12000')
    await advanced.getByLabel('每日预算（Token）', { exact: true }).fill('50000')
    await expect.poll(() => page.evaluate(async () => {
      const current = await window.electronAPI.settings.get()
      return [current.llmTemperature, current.sessionTokenBudget, current.dailyTokenBudget]
    })).toEqual(['0', '12000', '50000'])
    const beforeAdvancedTest = requests.length
    await advanced.getByTestId('settings-model-test').click()
    await expect(advanced.getByRole('status')).toContainText('连接测试通过：local-fixture')
    expect(requests.slice(beforeAdvancedTest).some(item => item.url === '/v1/chat/completions' && item.body.model === 'local-fixture' && item.authorization === undefined)).toBe(true)
    const rejected = await page.evaluate(async () => {
      try { await window.electronAPI.settings.set('llmTemperature', '3'); return false } catch { return true }
    })
    expect(rejected).toBe(true)
    const settings = await page.evaluate(() => window.electronAPI.settings.get())
    // 旧字段因启动环境存在密钥，但本地用途仍必须不带认证头，不能借用它。
    expect(settings.llmApiKeyConfigured).toBe('true')
    expect(JSON.parse(settings.modelConnections).find((item: { name: string }) => item.name === '无密钥本地连接')).toMatchObject({ hasApiKey: false, apiKey: '' })
    await app.close()
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('chat-messages')).toBeVisible()
    await expect(page.getByTestId('settings-panel')).toHaveCount(0)
    await expect(page.getByTestId('chat-current-model')).toHaveText('local-fixture')
    const restoredParameters = await page.evaluate(() => window.electronAPI.settings.get())
    expect([restoredParameters.llmTemperature, restoredParameters.sessionTokenBudget, restoredParameters.dailyTokenBudget]).toEqual(['0', '12000', '50000'])
    const beforeFirstChat = requests.length
    await page.getByPlaceholder(/和.*说说/).fill('无密钥本地对话验收')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByText('本地连接验证成功', { exact: true })).toBeVisible()
    expect(requests.some((item) => item.url === '/v1/models')).toBe(true)
    expect(requests.some((item) => item.url === '/v1/chat/completions' && item.body.model === 'local-fixture')).toBe(true)
    expect(requests.slice(beforeFirstChat).some(item => item.url === '/v1/chat/completions' && item.body.model === 'local-fixture' && item.body.temperature === 0)).toBe(true)
    expect(requests.filter((item) => item.authorization !== undefined).map((item) => ({ url: item.url, emptyBearer: item.authorization?.trim() === 'Bearer' }))).toEqual([])

    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-model').click()
    profile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '无密钥本地连接' })
    await profile.getByRole('button', { name: /^编辑连接 / }).click()
    form = page.getByTestId('model-connection-form')
    await form.getByLabel('Base URL', { exact: true }).fill(baseUrl.replace('/v1', '/protected/v1'))
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    await profile.getByRole('button', { name: '获取 无密钥本地连接 已有模型', exact: true }).click()
    await expect(profile).toContainText('API Key 无效或没有权限')
    await profile.getByRole('button', { name: '测试连接 无密钥本地连接', exact: true }).click()
    await expect(profile).toContainText('API Key 无效或没有权限')
    await profile.getByRole('button', { name: /^编辑连接 / }).click()
    await form.getByLabel('API Key', { exact: true }).fill('fixture-local-key')
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    await profile.getByRole('button', { name: '测试连接 无密钥本地连接', exact: true }).click()
    await expect(profile).toContainText('连接测试通过')
    await profile.getByRole('button', { name: '获取 无密钥本地连接 已有模型', exact: true }).click()
    await expect(profile.locator('[data-testid^="settings-fetched-models-"]')).toBeVisible()
    expect(requests.some((item) => item.url === '/protected/v1/models' && item.authorization === 'Bearer fixture-local-key')).toBe(true)
    await page.getByRole('button', { name: '添加连接', exact: true }).click()
    form = page.getByTestId('model-connection-form')
    await form.getByRole('radio', { name: '本地模型', exact: true }).click()
    await form.getByLabel('连接名称', { exact: true }).fill('故障首选')
    await form.getByLabel('Base URL', { exact: true }).fill(baseUrl.replace('/v1', '/failed/v1'))
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    const failedProfile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '故障首选' })
    await failedProfile.getByRole('button', { name: '获取 故障首选 已有模型', exact: true }).click()
    await failedProfile.getByRole('button', { name: 'local-fixture', exact: true }).click()
    await page.getByLabel('添加主对话模型').selectOption({ label: '故障首选 · local-fixture' })
    await page.getByRole('button', { name: '上移 故障首选 · local-fixture', exact: true }).click()
    await expect.poll(() => page.evaluate(async () => JSON.parse((await window.electronAPI.settings.get()).modelRoutes)[0].connectionId)).toBe(await failedProfile.getAttribute('data-testid').then(id => id!.replace('settings-model-profile-', '')))
    await app.close()
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('chat-messages')).toBeVisible()
    const beforeFallback = requests.length
    await page.getByPlaceholder(/和.*说说/).fill('请验证已保存的用途备用链')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByTestId('chat-messages')).toContainText('已切换到 local-fixture')
    await expect.poll(() => requests.slice(beforeFallback).filter(item => item.url.endsWith('/chat/completions')).length).toBeGreaterThanOrEqual(2)
    const attempts = requests.slice(beforeFallback).filter(item => item.url.endsWith('/chat/completions'))
    expect(attempts.slice(0, 2).map(item => item.url)).toEqual(['/failed/v1/chat/completions', '/protected/v1/chat/completions'])
    expect(attempts[0].authorization).toBeUndefined()
    expect(attempts[1].authorization).toBe('Bearer fixture-local-key')
    await page.screenshot({ path: 'var/verification/local-model-electron.png', fullPage: true })
    await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0)
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-model').click()
    await page.getByRole('button', { name: '删除 故障首选', exact: true }).click()
    await page.getByRole('button', { name: '删除 无密钥本地连接', exact: true }).click()
    await expect(page.getByTestId('settings-model-empty')).toBeVisible()
    await page.evaluate(async url => {
      await window.electronAPI.settings.set('llmBaseUrl', url)
      await window.electronAPI.settings.set('llmApiKey', 'fixture-unused-legacy')
      await window.electronAPI.settings.set('llmModel', 'unused-legacy-model')
      await window.electronAPI.settings.set('auxModel', 'unused-aux-model')
    }, baseUrl)
    await expect.poll(() => page.evaluate(async () => (await window.electronAPI.settings.get()).llmConnectionReady)).toBe('false')
    await page.getByTestId('settings-back').click()
    await expect(page.getByTestId('chat-current-model')).toHaveText('未配置模型')
    await app.close()
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    await expect(page.getByTestId('settings-model-empty')).toBeVisible()
    const cleared = await page.evaluate(() => window.electronAPI.settings.get())
    expect(JSON.parse(cleared.modelConnections)).toEqual([])
    expect(JSON.parse(cleared.modelRoutes)).toEqual([])
    expect(cleared.llmEffectiveModel).toBe('')
    expect(cleared.llmEffectiveBaseUrl).toBe('')
    await page.getByTestId('settings-back').click()
    const afterClear = requests.length
    await page.getByPlaceholder(/和.*说说/).fill('空配置不得调用旧连接')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByTestId('chat-messages')).toContainText('请先在设置中添加可用连接，并为主对话安排模型。')
    await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0)
    expect(requests).toHaveLength(afterClear)
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-model').click()
    await page.getByTestId('settings-model-add').click()
    form = page.getByTestId('model-connection-form')
    await form.getByRole('radio', { name: '本地模型', exact: true }).click()
    await form.getByLabel('连接名称', { exact: true }).fill('重新配置')
    await form.getByLabel('Base URL', { exact: true }).fill(baseUrl)
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    await page.getByRole('textbox', { name: '手动添加模型 重新配置', exact: true }).fill('local-fixture')
    await page.getByRole('button', { name: '手动添加模型', exact: true }).click()
    await page.getByLabel('添加主对话模型').selectOption({ label: '重新配置 · local-fixture' })
    await page.getByTestId('settings-back').click()
    await expect(page.getByTestId('chat-current-model')).toHaveText('local-fixture')
    await page.getByPlaceholder(/和.*说说/).fill('重新配置后可用')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect.poll(() => requests.slice(afterClear).some(item => item.url === '/v1/chat/completions' && item.body.model === 'local-fixture' && item.authorization === undefined)).toBe(true)
    await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0)
  } finally {
    await app?.close()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    const cleanupPath = path.resolve(dataDir)
    if (path.dirname(cleanupPath) !== path.resolve(os.tmpdir()) || !path.basename(cleanupPath).startsWith('my-agent-keyless-')) throw new Error('Unexpected test data directory')
    await rm(cleanupPath, { recursive: true, force: true })
  }
})
