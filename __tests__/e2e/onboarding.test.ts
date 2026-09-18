/**
 * 首次配置 Electron E2E。
 *
 * 背景：首次旅程必须经过真实 preload / IPC / LLM 路由，但不能依赖开发者的 API Key。
 * 设计意图：测试内启动本地 OpenAI 兼容 SSE 服务，并使用独立 user-data-dir 隔离真实应用数据。
 * 关键约束：不访问外网、不读取或覆盖用户设置；结束后关闭 Electron、HTTP 服务和临时目录。
 */
import { createServer, type IncomingMessage } from 'node:http'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import type { AddressInfo } from 'node:net'
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

interface CapturedRequest {
  url: string
  authorization: string
  body: Record<string, unknown>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let electronApp: ElectronApplication
let page: Page
let userDataDir = ''
let server: ReturnType<typeof createServer>
let baseUrl = ''
let capturedRequest: CapturedRequest | null = null
const capturedRequests: CapturedRequest[] = []
let heldStreamClosed = false
let mainOutput = ''
const fixtureReportName = '2099-01-01T00-00-00-000Z-persona-b02-b07-pass-1.json'
const fixtureReportPath = path.resolve(__dirname, '../../eval-reports', fixtureReportName)

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

test.beforeAll(async () => {
  await mkdir(path.dirname(fixtureReportPath), { recursive: true })
  await writeFile(fixtureReportPath, JSON.stringify({
    timestamp: '2099-01-01T00:00:00.000Z',
    mode: 'real',
    model: 'fixture-model',
    baseUrl: 'http://127.0.0.1/fixture',
    pass: true,
    totalScenarios: 1,
    passedScenarios: 1,
    k: 1,
    scenarios: [{
      id: 'B02',
      description: 'E2E 人工审阅夹具',
      pass: true,
      passes: 1,
      k: 1,
      trials: [{
        id: 'B02-trial',
        description: 'E2E 人工审阅 Trial',
        pass: true,
        durationMs: 12,
        graderResults: [],
        agentTexts: ['先接住你的感受，再一起想下一步。'],
        agentInput: {
          model: 'fixture-model',
          baseUrl: 'http://127.0.0.1/fixture',
          executionMode: 'auto',
          systemPrompt: 'fixture prompt',
          messages: [{ role: 'user', content: '我今天有点累。' }],
          toolNames: [],
        },
        judge: {
          graderName: 'fixture-judge',
          invocationMode: 'single-call',
          systemContext: 'fixture context',
          checks: [{ id: 'check-1', question: '是否先承接用户感受？' }],
        },
      }],
    }],
  }), 'utf8')
  server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/v1/messages') {
      capturedRequest = { url: request.url, authorization: String(request.headers['x-api-key'] ?? ''), body: JSON.parse(await readBody(request)) }
      capturedRequests.push(capturedRequest)
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' })
      for (const event of [
        { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '连接成功' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 2 } },
        { type: 'message_stop' },
      ]) response.write(`data: ${JSON.stringify(event)}\n\n`)
      response.end()
      return
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
      response.writeHead(404).end()
      return
    }

    const rawBody = await readBody(request)
    capturedRequest = {
      url: request.url,
      authorization: request.headers.authorization ?? '',
      body: JSON.parse(rawBody) as Record<string, unknown>,
    }
    capturedRequests.push(capturedRequest)
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const messages = capturedRequest.body.messages as Array<{ role: string; content: unknown }> | undefined
    if (messages?.some((message) => message.role === 'user' && JSON.stringify(message.content).includes('workspace-close-regression'))) {
      heldStreamClosed = false
      response.on('close', () => { heldStreamClosed = true })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '正在等待关闭验证' }, finish_reason: null }] })}\n\n`)
      return
    }
    response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '连接成功' }, finish_reason: null }] })}\n\n`)
    response.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 8, completion_tokens: 2 } })}\n\n`)
    response.end('data: [DONE]\n\n')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('本地模型测试服务启动失败')
  baseUrl = `http://127.0.0.1:${address.port}/v1`

  userDataDir = await mkdtemp(path.join(os.tmpdir(), 'my-agent-onboarding-'))
  electronApp = await electron.launch({
    args: [
      path.join(__dirname, '../../dist-electron/index.js'),
      `--user-data-dir=${userDataDir}`,
      '--no-sandbox',
    ],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      LLM_API_KEY: '',
      LLM_BASE_URL: '',
      LLM_MODEL: '',
    },
  })
  const collect = (chunk: Buffer) => { mainOutput = (mainOutput + chunk.toString()).slice(-100_000) }
  electronApp.process().stdout?.on('data', collect)
  electronApp.process().stderr?.on('data', collect)
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
  await unlink(fixtureReportPath).catch(() => undefined)
  if (server) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
  if (userDataDir && path.basename(userDataDir).startsWith('my-agent-onboarding-')) {
    await rm(userDataDir, { recursive: true, force: true })
  }
})

test('正式 Skills 经真实 IPC 编辑启停并完整重启恢复', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.evaluate(() => window.electronAPI.skills.reload())
  const builtins = (await page.evaluate(() => window.electronAPI.skills.list())).filter((skill) => skill.source === 'builtin')
  expect(builtins.length, '构建后的 Electron 必须实际载入内置 Skills').toBeGreaterThan(0)
  const builtin = builtins[0]
  expect(await page.evaluate((name) => window.electronAPI.skills.get(name), builtin.name)).toContain(builtin.name)
  const name = 'electron-skill-check'
  const raw = `---\nname: ${name}\ndescription: 验收技能\nwhen_to_use: 仅验收使用\nversion: "1.0"\n---\n原始正文`
  expect(await page.evaluate(({ name, raw }) => window.electronAPI.skills.save(name, raw), { name, raw })).toMatchObject({ success: true })
  if (!(await page.getByTestId('settings-panel').isVisible())) await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-skills').click()
  await page.getByRole('button', { name, exact: true }).click()
  const panel = page.getByTestId('skills-panel')
  await panel.getByRole('button', { name: '编辑 Skill', exact: true }).click()
  const edited = raw.replace('原始正文', '真实编辑后的正文')
  await panel.getByRole('textbox', { name: '编辑 SKILL.md', exact: true }).fill(edited)
  await panel.getByRole('button', { name: '校验并保存', exact: true }).click()
  await expect(panel.getByTestId('skill-file-preview')).toHaveText(edited)
  await panel.getByRole('switch', { name, exact: true }).click()
  await expect(panel.getByRole('switch', { name, exact: true })).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate((name) => window.electronAPI.skills.get(name), name)).toBe(edited)
  await electronApp.close()
  electronApp = await electron.launch({ args: [path.join(__dirname, '../../dist-electron/index.js'), '--user-data-dir=' + userDataDir, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('#startup-splash')).toBeHidden()
  expect((await page.evaluate(() => window.electronAPI.skills.list())).find((skill) => skill.name === name)?.enabled).toBe(false)
  expect(await page.evaluate((name) => window.electronAPI.skills.get(name), name)).toBe(edited)
  if (!(await page.getByTestId('settings-panel').isVisible())) await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-skills').click()
  await page.getByRole('button', { name, exact: true }).click()
  await page.getByTestId('skills-panel').getByRole('button', { name: '删除 Skill', exact: true }).click()
  await page.getByRole('group', { name: `删除 Skill「${name}」？`, exact: true }).getByRole('button', { name: '删除 Skill', exact: true }).click()
  await expect(page.getByTestId(`skill-card-${name}`)).toHaveCount(0)
  expect((await page.evaluate(() => window.electronAPI.skills.list())).some((skill) => skill.name === name)).toBe(false)
})

test('首次进入通过模型路由配置后开始对话', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.getByRole('button', { name: '模型', exact: true }).click()
  await expect(page.getByTestId('settings-model-routing')).toBeVisible()
  await page.getByRole('button', { name: '添加连接', exact: true }).click()
  await page.getByPlaceholder('连接名称').fill('本地测试连接')
  await page.getByPlaceholder('Base URL').fill(baseUrl)
  await page.getByLabel('API Key', { exact: true }).fill('local-test-key')
  await page.getByRole('button', { name: '保存连接', exact: true }).click()
  await expect(page.getByText('本地测试连接已启用', { exact: false })).toBeVisible()
  const modelInput = page.getByRole('textbox', { name: '手动添加模型 本地测试连接', exact: true })
  await modelInput.fill('local-test-model')
  await modelInput.press('Enter')
  await page.getByLabel('添加主对话模型').selectOption({ label: '本地测试连接 · local-test-model' })
  await page.getByRole('button', { name: '移除 当前主连接 · gpt-4o', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => JSON.parse((await window.electronAPI.settings.get()).modelRoutes).filter((route: { purpose: string }) => route.purpose === 'primary').map((route: { model: string }) => route.model))).toEqual(['local-test-model'])
  expect((await page.evaluate(() => window.electronAPI.settings.get())).llmConnectionReady).toBe('true')
  await page.locator('[data-testid="settings-back"]').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  await page.getByPlaceholder(/和.*说说/).fill('连接验证')
  const send = page.locator('button[title="发送"]')
  await expect(send).toBeEnabled()
  await send.click()
  await expect(page.getByText('连接成功', { exact: true })).toBeVisible({ timeout: 30_000 })
  expect(capturedRequest).toMatchObject({ url: '/v1/chat/completions', authorization: 'Bearer local-test-key', body: { model: 'local-test-model', stream: true } })
})

test('正式自定义模型连接保存协议并在重载后通过真实协议测试', async () => {
  await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-model').click()
  const models = page.getByTestId('settings-model-routing')
  await models.getByRole('button', { name: '添加连接', exact: true }).click()
  const form = models.getByTestId('model-connection-form')
  await form.getByRole('radio', { name: '自定义连接', exact: true }).click()
  await form.getByLabel('连接名称', { exact: true }).fill('协议本地验收')
  await form.getByLabel('连接适配器', { exact: true }).selectOption('anthropic')
  await form.getByLabel('Base URL', { exact: true }).fill(baseUrl)
  await form.getByLabel('API Key', { exact: true }).fill('local-anthropic-fixture')
  const beforeDraftLeave = (await page.evaluate(() => window.electronAPI.settings.get())).modelConnections
  await page.getByTestId('settings-nav-appearance').click()
  await expect(form.getByLabel('连接名称', { exact: true })).toHaveValue('协议本地验收')
  await page.keyboard.press('Escape')
  await expect(form.getByLabel('API Key', { exact: true })).toHaveValue('local-anthropic-fixture')
  expect((await page.evaluate(() => window.electronAPI.settings.get())).modelConnections).toBe(beforeDraftLeave)
  await form.getByRole('button', { name: '保存连接', exact: true }).click()
  const profile = models.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '协议本地验收' })
  await expect(profile).toContainText('自定义连接 · Anthropic')
  const manual = profile.getByRole('textbox', { name: '手动添加模型 协议本地验收', exact: true })
  await manual.fill('protocol-fixture-model')
  await manual.press('Enter')
  await models.getByLabel('添加辅助任务模型').selectOption({ label: '协议本地验收 · protocol-fixture-model' })
  const saved = JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).modelConnections).find((item: { name: string }) => item.name === '协议本地验收')
  expect(saved).toMatchObject({ source: 'custom', provider: 'anthropic', apiKey: '', hasApiKey: true })
  const beforeInvalid = await page.evaluate(() => window.electronAPI.settings.get())
  const invalidRejected = await page.evaluate(async () => {
    try { await window.electronAPI.settings.saveModelConfiguration({ connections: '[]', routes: '{}' }); return false }
    catch { return true }
  })
  expect(invalidRejected).toBe(true)
  expect(await page.evaluate(() => window.electronAPI.settings.get())).toMatchObject({ modelConnections: beforeInvalid.modelConnections, modelRoutes: beforeInvalid.modelRoutes })
  await electronApp.close()
  electronApp = await electron.launch({ args: [path.join(__dirname, '../../dist-electron/index.js'), '--user-data-dir=' + userDataDir, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('#startup-splash')).toBeHidden()
  const restored = await page.evaluate(() => window.electronAPI.settings.get())
  expect(restored).toMatchObject({ modelConnections: beforeInvalid.modelConnections, modelRoutes: beforeInvalid.modelRoutes })
  if (!(await page.getByTestId('settings-panel').isVisible())) await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-model').click()
  const restoredProfile = page.getByTestId('settings-model-routing').locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '协议本地验收' })
  const restoredForm = page.getByTestId('model-connection-form')
  await restoredProfile.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(restoredForm.getByLabel('连接适配器', { exact: true })).toHaveValue('anthropic')
  await expect(restoredForm.getByLabel('API Key', { exact: true })).toHaveValue('')
  await restoredForm.getByRole('button', { name: '取消', exact: true }).click()
  await restoredProfile.getByRole('button', { name: '测试连接 协议本地验收', exact: true }).click()
  await expect.poll(() => capturedRequests.some((entry) => entry.url === '/v1/messages' && entry.authorization === 'local-anthropic-fixture' && entry.body.model === 'protocol-fixture-model')).toBe(true)
  await expect(restoredProfile.getByRole('status')).toBeVisible()
  await restoredProfile.getByRole('button', { name: '删除 协议本地验收', exact: true }).click()
  await expect(restoredProfile).toHaveCount(0)
  const removed = await page.evaluate(() => window.electronAPI.settings.get())
  expect(JSON.parse(removed.modelConnections).some((item: { id: string }) => item.id === saved.id)).toBe(false)
  expect(JSON.parse(removed.modelRoutes).some((item: { connectionId: string }) => item.connectionId === saved.id)).toBe(false)
  await page.getByTestId('settings-back').click()
})

test('正式伙伴设置经真实 IPC 保存独立偏好并在重载后恢复', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  const debugBack = page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: '返回', exact: true })
  if (await debugBack.isVisible().catch(() => false)) await debugBack.click()
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const previous = await page.evaluate(() => window.electronAPI.settings.get())
  const noteText = '先给我结论，再说明依据。\n'.repeat(60)
  try {
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-companion').click()
    const note = page.getByRole('textbox', { name: '相处补充说明', exact: true })
    await note.fill(noteText)
    await page.getByTestId('settings-back').click()
    await expect.poll(async () => (await page.evaluate(() => window.electronAPI.settings.get())).companionResponseNote).toBe(noteText)
    expect((await page.evaluate(() => window.electronAPI.settings.get())).systemPrompt).toBe(previous.systemPrompt)
    await page.reload()
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-companion').click()
    await expect(note).toHaveValue(noteText)
    for (const kind of ['main', 'workspace'] as const) {
      const marker = `companion-note-runtime-${kind}`
      await page.evaluate(async ({ kind, marker }) => {
        const session = await (kind === 'workspace' ? window.electronAPI.session.createWorkspace() : window.electronAPI.session.create())
        try {
          await window.electronAPI.chat.send(session.id, { id: crypto.randomUUID(), role: 'user', content: marker, timestamp: Date.now() })
        } finally {
          await window.electronAPI.session.delete(session.id)
        }
      }, { kind, marker })
      const request = capturedRequests.find((entry) => {
        const messages = entry.body.messages as Array<{ role: string; content: unknown }> | undefined
        return messages?.some((message) => message.role === 'user' && typeof message.content === 'string' && message.content.split('\n').at(-1) === marker)
      })
      expect(request, `${kind} 必须到达本地测试模型`).toBeDefined()
      const messages = request!.body.messages as Array<{ role: string; content: unknown }>
      const system = JSON.stringify(messages.filter((message) => message.role === 'system'))
      if (kind === 'main') {
        expect(system).toContain('## 用户相处偏好')
        expect(system).toContain('先给我结论，再说明依据。')
      } else {
        expect(system).not.toContain('## 用户相处偏好')
        expect(system).not.toContain('先给我结论，再说明依据。')
      }
    }
    await note.fill('')
    await page.getByTestId('settings-back').click()
    await expect.poll(async () => (await page.evaluate(() => window.electronAPI.settings.get())).companionResponseNote).toBe('')
    const rejected = await page.evaluate(async () => {
      try {
        await window.electronAPI.settings.set('companionResponseNote', '好'.repeat(4001))
        return false
      } catch { return true }
    })
    expect(rejected).toBe(true)
  } finally {
    await page.evaluate((value) => window.electronAPI.settings.set('companionResponseNote', value), previous.companionResponseNote || '')
  }
})

test('正式文化角通过真实资产 IPC 更新并在重载后保留作品与笔记', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.evaluate(() => window.electronAPI.settings.set('llmApiKey', 'local-test-key'))
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const response = await page.evaluate(() => window.electronAPI.companion.getAssets())
  const reading = response.items.find((item) => item.kind === 'culture' && item.payload.type === 'reading')
  expect(reading).toBeDefined()
  const original = reading!
  const note = '这是一条通过真实资产 IPC 保存的长笔记。\n'.repeat(40)
  try {
    const result = await page.evaluate(({ id, note }) => window.electronAPI.companion.updateAsset(id, {
      name: '文化角持久化验收作品', payload: { detail: '摘要和笔记应同时可见', note },
    }), { id: original.id, note })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.asset.payload.note).toBe(note)
    const oversized = await page.evaluate((id) => window.electronAPI.companion.updateAsset(id, {
      name: '不得覆盖作品', payload: { note: '长'.repeat(4001) },
    }), original.id)
    expect(oversized).toMatchObject({ ok: false, code: 'INVALID' })
    await page.reload()
    await expect(page.locator('#startup-splash')).toBeHidden()
    if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    await page.getByTestId('world-tab-culture').click()
    const culture = page.locator('[data-world-content="culture"]')
    await expect(culture.getByRole('article', { name: '文化角持久化验收作品', exact: true })).toContainText('摘要和笔记应同时可见')
    await expect(culture.locator('blockquote').filter({ hasText: '文化角持久化验收作品' })).toContainText(note.trim())
    for (const label of ['读书', '音乐', '电影', '摄影']) await expect(culture).toContainText(label)
    expect(await culture.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    const persisted = await page.evaluate(() => window.electronAPI.companion.getAssets())
    expect(persisted.roleId).toBe(response.roleId)
    expect(persisted.items.find((item) => item.id === original.id)?.payload.note).toBe(note)
    await page.screenshot({ path: 'test-results/world-culture-electron.png', fullPage: true })
  } finally {
    await page.evaluate((item) => window.electronAPI.companion.updateAsset(item.id, {
      name: item.name, payload: { ...item.payload, note: item.payload.note ?? '' },
    }), original)
    const back = page.getByTestId('world-hub').getByRole('button', { name: '返回聊天', exact: true })
    if (await back.isVisible()) await back.click()
  }
})

test('正式生活资产可通过真实 IPC 新增、重载保留并拒绝超限', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.evaluate(() => window.electronAPI.settings.set('llmApiKey', 'local-test-key'))
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const createdIds: string[] = []
  const note = '这是一条通过真实资产 IPC 新增的长笔记。\n'.repeat(40)
  const oversized = '长'.repeat(4001)
  try {
    const culture = await page.evaluate(({ note }) => window.electronAPI.companion.createAsset({
      kind: 'culture',
      name: '文化角新增验收作品',
      payload: { type: 'reading', detail: '摘要和笔记应同时可见', note },
    }), { note })
    expect(culture).toMatchObject({ ok: true })
    if (!culture.ok) return
    createdIds.push(culture.asset.id)
    expect(culture.asset.payload.note).toBe(note)

    const furniture = await page.evaluate(() => window.electronAPI.companion.createAsset({
      kind: 'furniture',
      name: '家居新增验收台灯',
      payload: { description: '桌边一盏真实台灯' },
    }))
    expect(furniture).toMatchObject({ ok: true })
    if (!furniture.ok) return
    createdIds.push(furniture.asset.id)

    const footprint = await page.evaluate(() => window.electronAPI.companion.createAsset({
      kind: 'footprint',
      name: '足迹新增验收地点',
      payload: { visitStatus: 'wanted', city: '北海', description: '想去但还没有去过' },
    }))
    expect(footprint).toMatchObject({ ok: true })
    if (!footprint.ok) return
    createdIds.push(footprint.asset.id)

    const rejected = await page.evaluate(({ oversized }) => window.electronAPI.companion.createAsset({
      kind: 'culture',
      name: '不得写入超限作品',
      payload: { note: oversized },
    }), { oversized })
    expect(rejected).toMatchObject({ ok: false, code: 'INVALID' })

    await page.reload()
    await expect(page.locator('#startup-splash')).toBeHidden()
    if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()

    await page.getByTestId('world-tab-culture').click()
    const cultureView = page.locator('[data-world-content="culture"]')
    await expect(cultureView.getByRole('article', { name: '文化角新增验收作品', exact: true })).toContainText('摘要和笔记应同时可见')
    await expect(cultureView.locator('blockquote').filter({ hasText: '文化角新增验收作品' })).toContainText(note.trim())

    await page.getByTestId('world-tab-home').click()
    const homeView = page.locator('[data-world-content="home"]')
    await expect(homeView.getByRole('article').filter({ hasText: '家居新增验收台灯' })).toContainText('桌边一盏真实台灯')

    await page.getByTestId('world-tab-footprints').click()
    const footprintsView = page.locator('[data-world-content="footprints"]')
    await expect(footprintsView.getByRole('region', { name: '想去的地方' })).toContainText('足迹新增验收地点')
    await expect(footprintsView.getByRole('region', { name: '常去地点' }).getByText('足迹新增验收地点', { exact: true })).toHaveCount(0)

    const persisted = await page.evaluate(() => window.electronAPI.companion.getAssets())
    expect(persisted.items.find((item) => item.name === '文化角新增验收作品')?.payload.note).toBe(note)
    expect(persisted.items.find((item) => item.name === '家居新增验收台灯')?.payload.description).toBe('桌边一盏真实台灯')
    expect(persisted.items.find((item) => item.name === '足迹新增验收地点')?.payload.visitStatus).toBe('wanted')
    expect(persisted.items.some((item) => item.name === '不得写入超限作品')).toBe(false)
    await page.screenshot({ path: 'test-results/world-living-create-electron.png', fullPage: true })
  } finally {
    for (const id of createdIds) {
      await page.evaluate((assetId) => window.electronAPI.companion.deleteAsset(assetId), id)
    }
    const leftover = await page.evaluate(() => window.electronAPI.companion.getAssets())
    expect(leftover.items.some((item) => ['文化角新增验收作品', '家居新增验收台灯', '足迹新增验收地点', '不得写入超限作品'].includes(item.name))).toBe(false)
    const back = page.getByTestId('world-hub').getByRole('button', { name: '返回聊天', exact: true })
    if (await back.isVisible()) await back.click()
  }
})

test('正式生活资产经真实备份导出导入后保留且不覆盖现有记录', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.evaluate(() => window.electronAPI.settings.set('llmApiKey', 'local-test-key'))
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const note = '这是一条通过真实备份往返的长笔记。\n'.repeat(20)
  const created = await page.evaluate(({ note }) => window.electronAPI.companion.createAsset({
    kind: 'culture',
    name: '备份往返验收作品',
    payload: { type: 'reading', detail: '备份应带回摘要', note },
  }), { note })
  expect(created).toMatchObject({ ok: true })
  if (!created.ok) return
  const exportPath = path.join(userDataDir, 'living-asset-backup.json')
  const importDir = await mkdtemp(path.join(os.tmpdir(), 'my-agent-backup-import-'))
  let importApp: ElectronApplication | undefined
  try {
    await electronApp.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, exportPath)
    const exported = await page.evaluate(() => window.electronAPI.data.export())
    expect(exported).toMatchObject({ success: true })
    expect(exported.stats?.livingAssets).toBeGreaterThan(0)
    const raw = JSON.parse(await readFile(exportPath, 'utf8')) as { livingAssets?: Array<{ name: string }>; livingAssetSeeds?: unknown[] }
    expect(raw.livingAssets?.some((item) => item.name === '备份往返验收作品')).toBe(true)
    expect(Array.isArray(raw.livingAssetSeeds)).toBe(true)

    importApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/index.js'), `--user-data-dir=${importDir}`, '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' },
    })
    const importPage = await importApp.firstWindow()
    await importPage.waitForLoadState('domcontentloaded')
    await expect(importPage.locator('#startup-splash')).toBeHidden()
    await importApp.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
    }, exportPath)
    const imported = await importPage.evaluate(() => window.electronAPI.data.import())
    expect(imported).toMatchObject({ success: true })
    expect(imported.stats?.livingAssets).toBeGreaterThan(0)
    const restored = await importPage.evaluate(() => window.electronAPI.companion.getAssets())
    const item = restored.items.find((entry) => entry.name === '备份往返验收作品')
    expect(item?.payload.note).toBe(note)
    const again = await importPage.evaluate(() => window.electronAPI.data.import())
    expect(again).toMatchObject({ success: true })
    expect(again.stats?.livingAssets).toBe(0)
    const afterMerge = await importPage.evaluate(() => window.electronAPI.companion.getAssets())
    expect(afterMerge.items.filter((entry) => entry.name === '备份往返验收作品')).toHaveLength(1)
  } finally {
    await page.evaluate((assetId) => window.electronAPI.companion.deleteAsset(assetId), created.asset.id)
    if (importApp) await importApp.close()
    await rm(importDir, { recursive: true, force: true })
  }
})

test('正式朋友圈赞评经真实 IPC 重载保留并拒绝空值超长', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.evaluate(() => window.electronAPI.settings.set('llmApiKey', 'local-test-key'))
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const seeded = await electronApp.evaluate(async () => {
    const store = (globalThis as { __lifeStore?: { insertMoment: Function } }).__lifeStore
    if (!store) throw new Error('__lifeStore missing')
    const moment = await store.insertMoment({
      roleId: 'lin',
      eventId: `e2e-moment-${Date.now()}`,
      publishedAt: Date.now(),
      text: '今天把书桌收拾出来了。',
      meta: {
        location: '家中',
        interactions: [
          { kind: 'comment', castId: 'chen', castName: '陈晨', text: '这桌面终于能看见了' },
          { kind: 'coframe', castId: 'ayu', castName: '阿雨' },
        ],
      },
    })
    if (!moment) throw new Error('seed moment failed')
    return moment
  })
  try {
    const listed = await page.evaluate(() => window.electronAPI.companion.getMoments({ limit: 80 }))
    expect(listed.roleId).toBe('lin')
    expect(listed.items.some((item) => item.id === seeded.id && item.text === '今天把书桌收拾出来了。')).toBe(true)
    const empty = await page.evaluate((momentId) => window.electronAPI.companion.addMomentComment(momentId, '   '), seeded.id)
    expect(empty).toMatchObject({ ok: false, code: 'INVALID' })
    const oversized = await page.evaluate((momentId) => window.electronAPI.companion.addMomentComment(momentId, '评'.repeat(281)), seeded.id)
    expect(oversized).toMatchObject({ ok: false, code: 'INVALID' })
    const liked = await page.evaluate((momentId) => window.electronAPI.companion.toggleMomentLike(momentId), seeded.id)
    expect(liked).toMatchObject({ ok: true, social: { liked: true, likeCount: 1 } })
    const commented = await page.evaluate((momentId) => window.electronAPI.companion.addMomentComment(momentId, '  先把窗帘拉开  '), seeded.id)
    expect(commented).toMatchObject({ ok: true })
    if (!commented.ok) return
    expect(commented.social.comments.map((item) => item.text)).toEqual(['先把窗帘拉开'])
    await page.reload()
    await expect(page.locator('#startup-splash')).toBeHidden()
    if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
    const persisted = await page.evaluate(() => window.electronAPI.companion.getMoments({ limit: 80 }))
    const social = persisted.socialByMomentId[seeded.id]
    expect(social).toMatchObject({ liked: true, likeCount: 1 })
    expect(social.comments.map((item) => item.text)).toEqual(['先把窗帘拉开'])
    expect(persisted.items.find((item) => item.id === seeded.id)?.text).toBe('今天把书桌收拾出来了。')
    expect(persisted.items.find((item) => item.id === seeded.id)?.meta.interactions).toEqual([
      { kind: 'comment', castId: 'chen', castName: '陈晨', text: '这桌面终于能看见了' },
      { kind: 'coframe', castId: 'ayu', castName: '阿雨' },
    ])
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    const post = page.getByTestId('moment-post').filter({ hasText: '今天把书桌收拾出来了。' }).first()
    await expect(post.getByTestId('moment-like-button')).toHaveAttribute('aria-label', '取消赞')
    await expect(post.getByTestId('moment-comment')).toHaveText(['陈晨：这桌面终于能看见了', '我：先把窗帘拉开'])
  } finally {
    const back = page.getByTestId('world-hub').getByRole('button', { name: '返回聊天', exact: true })
    if (await back.isVisible().catch(() => false)) await back.click()
  }
})

test('正式人物世界六面从正式入口读取真实伙伴数据', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.evaluate(() => window.electronAPI.settings.set('llmApiKey', 'local-test-key'))
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const seeded = await electronApp.evaluate(async () => {
    const store = (globalThis as { __lifeStore?: { insertMoment: Function } }).__lifeStore
    if (!store) throw new Error('__lifeStore missing')
    const moment = await store.insertMoment({
      roleId: 'lin',
      eventId: `e2e-world-surfaces-${Date.now()}`,
      publishedAt: Date.now(),
      text: '六面入口验收：今天把书桌收拾出来了。',
      meta: { location: '家中' },
    })
    if (!moment) throw new Error('seed moment failed')
    return moment
  })
  try {
    const listed = await page.evaluate(() => window.electronAPI.companion.getMoments({ limit: 80 }))
    expect(listed.roleId).toBe('lin')
    expect(listed.items.some((item) => item.id === seeded.id && item.text === '六面入口验收：今天把书桌收拾出来了。')).toBe(true)

    await page.getByTestId('primary-sidebar').getByRole('button', { name: '人物世界', exact: true }).click()
    const world = page.getByTestId('world-hub')
    await expect(world).toBeVisible()

    await expect(page.getByTestId('moments-panel')).toBeVisible()
    const post = page.getByTestId('moment-post').filter({ hasText: '六面入口验收：今天把书桌收拾出来了。' }).first()
    await expect(post).toBeVisible()
    await expect(post.getByTestId('moment-location')).toContainText('家中')

    await page.getByTestId('world-tab-wardrobe').click()
    const wardrobe = page.getByTestId('world-assets-panel')
    await expect(wardrobe).toBeVisible()
    for (const name of ['藏青衬衫', '米色针织开衫', '棕色乐福鞋']) {
      await expect(wardrobe.getByText(name, { exact: true })).toBeVisible()
    }

    await page.getByTestId('world-tab-culture').click()
    const culture = page.locator('[data-world-content="culture"]')
    for (const label of ['读书', '音乐', '电影', '摄影']) await expect(culture).toContainText(label)
    await expect(culture.getByRole('article', { name: '《瓦尔登湖》', exact: true })).toContainText('正在读')
    await expect(culture.getByRole('article', { name: '《海街日记》', exact: true })).toContainText('喜欢的电影')
    await expect(culture).not.toContainText('3 条笔记')
    await expect(culture).not.toContainText('看过两次')

    await page.getByTestId('world-tab-home').click()
    const home = page.locator('[data-world-content="home"]')
    await expect(home.getByRole('region', { name: '当前空间' })).toContainText('还没有记录居住空间。')
    await expect(home).not.toContainText('城西小公寓')

    await page.getByTestId('world-tab-cast').click()
    const contacts = page.getByTestId('world-cast-panel')
    await expect(contacts.getByTestId('world-cast-card-chen')).toContainText('陈姐')
    await expect(contacts.getByTestId('world-cast-card-ayu')).toContainText('阿雨')
    await expect(contacts.getByTestId('world-cast-presence-chen')).toHaveText(/方便开聊|现在忙碌|状态未读到|正在查看忙闲/)
    await expect(contacts.getByTestId('world-cast-presence-ayu')).toHaveText(/方便开聊|现在忙碌|状态未读到|正在查看忙闲/)

    await page.getByTestId('world-tab-footprints').click()
    const footprints = page.locator('[data-world-content="footprints"]')
    await expect(footprints.getByRole('region', { name: '生活足迹' })).toContainText('家中')
    await expect(footprints.getByRole('region', { name: '生活足迹' })).toContainText('六面入口验收：今天把书桌收拾出来了。')
    await expect(footprints.getByRole('region', { name: '常去地点' })).toHaveCount(0)
    await expect(footprints).not.toContainText('城西小公寓')
  } finally {
    const back = page.getByTestId('world-hub').getByRole('button', { name: '返回聊天', exact: true })
    if (await back.isVisible().catch(() => false)) await back.click()
  }
})

test('正式关于页开发者模式经真实 IPC 开关、隐藏入口并完整重启恢复', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  const debugBack = page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: '返回', exact: true })
  if (await debugBack.isVisible().catch(() => false)) await debugBack.click()
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  await expect(page.getByTestId('sidebar-developer-nav')).toHaveCount(0)
  if (!(await page.getByTestId('settings-panel').isVisible())) await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-about').click()
  const modeSwitch = page.getByTestId('settings-developer-mode')
  await expect(modeSwitch).toHaveAttribute('aria-checked', 'false')
  await modeSwitch.click()
  await expect.poll(async () => (await page.evaluate(() => window.electronAPI.settings.get())).developerMode).toBe('true')
  await page.getByTestId('settings-back').click()
  await expect(page.getByTestId('sidebar-developer-nav')).toBeVisible()
  await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Debug', exact: true }).click()
  await expect(page.locator('[data-testid="dev-panel"]')).toBeVisible()
  await page.locator('[data-testid="dev-panel"] button[title="返回聊天"]').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const listedBeforeClose = await page.evaluate(() => window.electronAPI.settings.get())
  expect(listedBeforeClose.developerMode).toBe('true')
  await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-about').click()
  await expect(page.getByTestId('settings-developer-mode')).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('settings-developer-mode').click()
  await expect.poll(async () => (await page.evaluate(() => window.electronAPI.settings.get())).developerMode).toBe('false')
  for (const shortcut of ['Control+Shift+D', 'Control+Shift+P']) {
    await page.keyboard.press(shortcut)
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await expect(page.getByTestId('settings-developer-mode')).toHaveAttribute('aria-checked', 'false')
  }
  await page.getByTestId('settings-back').click()
  await expect(page.getByTestId('sidebar-developer-nav')).toHaveCount(0)
  expect((await page.evaluate(() => window.electronAPI.settings.get())).developerMode).toBe('false')
  for (const shortcut of ['Control+Shift+D', 'Control+Shift+P']) {
    await page.keyboard.press(shortcut)
    await expect(page.getByTestId('chat-messages')).toBeVisible()
    await expect(page.getByTestId('dev-panel')).toHaveCount(0)
    await expect(page.getByTestId('playground-page')).toHaveCount(0)
  }
  await electronApp.close()
  electronApp = await electron.launch({ args: [path.join(__dirname, '../../dist-electron/index.js'), '--user-data-dir=' + userDataDir, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('#startup-splash')).toBeHidden()
  expect((await page.evaluate(() => window.electronAPI.settings.get())).developerMode).toBe('false')
  await expect(page.getByTestId('sidebar-developer-nav')).toHaveCount(0)
  if (!(await page.getByTestId('settings-panel').isVisible())) await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-about').click()
  await page.getByTestId('settings-developer-mode').click()
  await expect.poll(async () => (await page.evaluate(() => window.electronAPI.settings.get())).developerMode).toBe('true')
  await page.getByTestId('settings-back').click()
  await expect(page.getByTestId('sidebar-developer-nav')).toBeVisible()
  await electronApp.close()
  electronApp = await electron.launch({ args: [path.join(__dirname, '../../dist-electron/index.js'), '--user-data-dir=' + userDataDir, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('#startup-splash')).toBeHidden()
  expect((await page.evaluate(() => window.electronAPI.settings.get())).developerMode).toBe('true')
  // 无 API Key 时启动会打开设置全屏，产品壳被隐藏；先回到 Chat 再验侧栏入口。
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  await expect(page.getByTestId('sidebar-developer-nav')).toBeVisible()
  await page.keyboard.press('Control+Shift+D')
  await expect(page.getByTestId('dev-panel')).toBeVisible()
  await page.keyboard.press('Control+Shift+D')
  await expect(page.getByTestId('chat-messages')).toBeVisible()
  await page.keyboard.press('Control+Shift+P')
  await expect(page.getByTestId('playground-page')).toBeVisible()
  await page.keyboard.press('Control+Shift+P')
  await expect(page.getByTestId('chat-messages')).toBeVisible()
})

test('Debug 质量 Eval 可保存并重新载入真人格人工审阅', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.evaluate(() => window.electronAPI.settings.set('developerMode', 'true'))
  await page.reload()
  await expect(page.locator('#startup-splash')).toBeHidden()

  const debugBack = page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: '返回', exact: true })
  if (await debugBack.isVisible().catch(() => false)) await debugBack.click()
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  await page.locator('[data-testid="primary-sidebar"]').getByRole('button', { name: 'Debug', exact: true }).click()
  const debugNav = page.locator('[data-testid="dev-panel"] nav')
  await debugNav.getByRole('button', { name: '质量 / Eval', exact: true }).click()
  await expect(page.locator('[data-testid="persona-eval-report"]')).toBeVisible()
  await expect(page.locator('[data-testid="persona-eval-scenario-B02"]')).toBeVisible()

  await page.locator('[data-testid="persona-eval-scenario-B02"] > summary').click()
  await page.locator('[data-testid="persona-eval-trial-B02-trial-1"] > summary').click()
  const review = page.locator('[data-testid="persona-human-review"]')
  await review.locator('summary').click()
  await review.getByRole('button', { name: '活人感 / 自然度：5' }).click()
  await review.getByRole('button', { name: '角色一致性：4' }).click()
  await review.getByRole('button', { name: '情绪承接：5' }).click()
  await review.getByRole('button', { name: '强行乐观：无' }).click()
  await review.getByRole('button', { name: '立即推进计划：无' }).click()
  await review.getByRole('button', { name: '擅自心理诊断：无' }).click()
  await review.getByRole('button', { name: '模板化：无' }).click()
  await review.getByRole('button', { name: '总体结论：通过' }).click()
  await review.locator('textarea').fill('先承接疲惫，语气自然。')
  await review.getByRole('button', { name: '保存审阅' }).click()
  await expect(review.getByText('已审阅 · 通过', { exact: true })).toBeVisible()

  await page.locator('[data-testid="dev-panel"] button[title="刷新当前调试分区"]').click()
  await expect(page.locator('[data-testid="persona-human-review"] textarea')).toHaveValue('先承接疲惫，语气自然。')
})

test('真实 Electron workspace 会话创建、隔离与清理', async () => {
  const result = await page.evaluate(async () => {
    const created = await window.electronAPI.session.createWorkspace()
    const loaded = await window.electronAPI.session.get(created.id)
    const listed = await window.electronAPI.session.list()
    await window.electronAPI.session.delete(created.id)
    const afterDelete = await window.electronAPI.session.get(created.id)
    return { created, loaded, listed, afterDelete }
  })

  expect(result.created.sessionKind).toBe('workspace')
  expect(result.loaded?.sessionKind).toBe('workspace')
  expect(result.listed.some((session) => session.id === result.created.id)).toBe(false)
  expect(result.afterDelete).toBeNull()
})

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const rendererState = await page.evaluate(() => {
      const terminal = (window as unknown as { __terminalObserved?: { output: string; errors: string; exits: string[] } }).__terminalObserved
      return {
        chat: Boolean(document.querySelector('[data-testid="chat-messages"]')),
        playground: Boolean(document.querySelector('[data-testid="playground-page"]')),
        terminal: terminal ? { outputLength: terminal.output.length, errorLength: terminal.errors.length, exitCount: terminal.exits.length } : null,
      }
    }).catch(() => ({ unavailable: true }))
    await testInfo.attach('renderer-failure-state', { body: JSON.stringify(rendererState), contentType: 'application/json' })
    const logPath = testInfo.outputPath('electron-main.log')
    await writeFile(logPath, mainOutput, 'utf8')
    await testInfo.attach('electron-main-log', { path: logPath, contentType: 'text/plain' })
  }
})

test('正式工作区读取真实文件，流式生成中关闭侧聊终止请求并删除会话', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  const debugBack = page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: '返回', exact: true })
  if (await debugBack.isVisible().catch(() => false)) await debugBack.click()
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const projectPath = path.join(userDataDir, 'workspace-fixture')
  await mkdir(projectPath)
  await writeFile(path.join(projectPath, 'workspace.txt'), 'real workspace file content', 'utf8')
  // 仅替换操作系统目录选择器；正式 project IPC 仍执行授权、设置与文件读取。
  await electronApp.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] })
  }, projectPath)
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1280, 850))
  await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
  await page.getByRole('button', { name: '未选择项目', exact: true }).click()
  await page.getByRole('button', { name: '添加新项目', exact: true }).click()
  await page.getByRole('button', { name: '打开工作区', exact: true }).click()
  const dock = page.getByTestId('chat-right-dock')
  await dock.getByText('workspace.txt', { exact: true }).click()
  await expect(dock.getByText('real workspace file content', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const observed = { sessionId: '', events: [] as string[] }
    const unsubscribe = window.electronAPI.chat.onEvent((event) => {
      if ('sessionId' in event) observed.sessionId = String(event.sessionId)
      observed.events.push(event.type)
    })
    Object.assign(window, { __workspaceObserved: observed, __workspaceUnsubscribe: unsubscribe })
  })
  await dock.getByRole('button', { name: '添加工作区内容' }).click()
  await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
  const sidechat = dock.getByTestId('workspace-sidechat-panel')
  await sidechat.getByRole('textbox', { name: '侧边聊天消息' }).fill('workspace-close-regression')
  await sidechat.getByRole('button', { name: '发送消息', exact: true }).click()
  await expect(sidechat.getByText('正在等待关闭验证', { exact: true }).or(sidechat.getByRole('alert'))).toBeVisible({ timeout: 30_000 })
  await expect(sidechat.getByRole('alert')).toHaveCount(0)
  const sessionId = await page.evaluate(() => (window as any).__workspaceObserved.sessionId as string)
  expect(sessionId).not.toBe('')
  expect(await page.evaluate((id) => window.electronAPI.session.get(id), sessionId)).toMatchObject({ sessionKind: 'workspace' })
  await page.screenshot({ path: 'test-results/workspace-electron-streaming.png', fullPage: true })
  await dock.getByRole('button', { name: '关闭侧边聊天', exact: true }).click()
  await expect(sidechat).toHaveCount(0)
  await expect.poll(() => heldStreamClosed).toBe(true)
  await expect.poll(() => page.evaluate((id) => window.electronAPI.session.get(id), sessionId)).toBeNull()
  expect(await page.evaluate(() => (window as any).__workspaceObserved.events)).toContain('done')
  expect((await page.evaluate(() => window.electronAPI.session.list())).some((session) => session.id === sessionId)).toBe(false)
  await expect(dock.getByText('real workspace file content', { exact: true })).toBeVisible()

  await dock.getByRole('button', { name: '添加工作区内容' }).click()
  await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
  await expect(sidechat.getByRole('textbox', { name: '侧边聊天消息' })).toBeEnabled()
  await sidechat.getByRole('textbox', { name: '侧边聊天消息' }).fill('重新打开后继续')
  await sidechat.getByRole('button', { name: '发送消息', exact: true }).click()
  await expect(sidechat.getByText('连接成功', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(sidechat.getByRole('button', { name: '停止生成' })).toHaveCount(0)
  await expect(sidechat.getByText('workspace-close-regression', { exact: true })).toHaveCount(0)
  await dock.getByRole('button', { name: '关闭侧边聊天', exact: true }).click()
  await page.evaluate(() => (window as any).__workspaceUnsubscribe())
})

test('正式终端保留大块输出，停止与关闭回收真实进程树', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  const debugBack = page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: '返回', exact: true })
  if (await debugBack.isVisible().catch(() => false)) await debugBack.click()
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  test.skip(process.platform !== 'win32', '此用例验证 Windows taskkill 进程树')
  const projectPath = path.join(userDataDir, 'workspace-fixture')
  await mkdir(projectPath, { recursive: true })
  await writeFile(path.join(projectPath, 'terminal-output.cjs'), "process.stdout.write('x'.repeat(20000) + '\\n'); process.stderr.write('stderr-marker\\n')", 'utf8')
  // 仅运行本测试创建的进程；兜底自行退出，断言仍要求关闭后 5 秒内退出而非等兜底。
  await writeFile(path.join(projectPath, 'terminal-tree.cjs'), `
const { spawn } = require('node:child_process')
if (process.argv[2] === 'child') {
  console.log('child:' + process.pid)
} else {
  console.log('parent:' + process.pid)
  spawn(process.execPath, [__filename, 'child'], { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true })
}
setTimeout(() => process.exit(0), 15000)
`, 'utf8')
  const previousRules = await page.evaluate(async () => (await window.electronAPI.settings.get()).permissionRules)
  await page.evaluate(() => {
    const state = { output: '', errors: '', exits: [] as string[] }
    const off = [
      window.electronAPI.terminal.onStdout((event) => { state.output += event.chunk }),
      window.electronAPI.terminal.onStderr((event) => { state.errors += event.chunk }),
      window.electronAPI.terminal.onExit((event) => { state.exits.push(event.runId) }),
    ]
    Object.assign(window, { __terminalObserved: state, __terminalUnsubscribe: () => off.forEach((cleanup) => cleanup()) })
  })
  const dock = page.getByTestId('chat-right-dock')
  const panel = dock.getByRole('tabpanel', { name: '终端', exact: true })
  const input = panel.getByPlaceholder('输入命令…')
  const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
  const pids: number[] = []
  try {
    await dock.getByRole('button', { name: '添加工作区内容' }).click()
    await dock.getByRole('menuitem', { name: '终端', exact: true }).click()
    await input.fill('node terminal-output.cjs')
    await panel.getByRole('button', { name: '运行', exact: true }).click()
    await expect(panel.getByText(/SANDBOX BLOCKED/)).toBeVisible()
    await expect(input).toHaveValue('node terminal-output.cjs')
    // 独立测试设置中仅授权两条固定命令，权限引擎、工作区路径限制与正式 IPC 不替换。
    await page.evaluate(async (original) => {
      await window.electronAPI.settings.set('permissionRules', JSON.stringify([
        ...JSON.parse(original || '[]'),
        { id: 'electron-terminal-fixture', type: 'command', pattern: '^node terminal-(output|tree)\\.cjs$', action: 'allow', enabled: true },
      ]))
    }, previousRules)
    await panel.getByRole('button', { name: '运行', exact: true }).click()
    await expect(panel.getByText('[命令已完成]', { exact: true })).toBeVisible()
    const output = await page.evaluate(() => (window as any).__terminalObserved)
    expect(output.output).toBe('x'.repeat(20_000) + '\n')
    expect(output.errors).toContain('stderr-marker')
    expect(output.exits).toHaveLength(1)

    for (const action of ['终止', '关闭终端']) {
      await page.evaluate(() => { (window as any).__terminalObserved.output = '' })
      await input.fill('node terminal-tree.cjs')
      await panel.getByRole('button', { name: '运行', exact: true }).click()
      await expect.poll(() => page.evaluate(() => (window as any).__terminalObserved.output)).toMatch(/child:\d+/)
      const text = await page.evaluate(() => (window as any).__terminalObserved.output as string)
      const parent = Number(text.match(/parent:(\d+)/)?.[1])
      const child = Number(text.match(/child:(\d+)/)?.[1])
      expect(parent).toBeGreaterThan(0)
      expect(child).toBeGreaterThan(0)
      pids.push(parent, child)
      expect([alive(parent), alive(child)]).toEqual([true, true])
      if (action === '终止') await panel.getByRole('button', { name: action, exact: true }).click()
      else await dock.getByRole('button', { name: action, exact: true }).click()
      await expect.poll(() => [alive(parent), alive(child)], { timeout: 5_000 }).toEqual([false, false])
      if (action === '终止') await expect(input).toBeEnabled()
      else await expect(panel).toHaveCount(0)
    }
    await expect.poll(() => page.evaluate(() => (window as any).__terminalObserved.exits.length)).toBe(3)
    await page.screenshot({ path: 'test-results/workspace-electron-terminal-closed.png', fullPage: true })
  } finally {
    await page.evaluate(async (original) => {
      (window as any).__terminalUnsubscribe()
      await window.electronAPI.settings.set('permissionRules', original || '[]')
    }, previousRules)
    // 失败也等待自有测试进程的退出兜底，不按模糊进程名结束用户的 Node 进程。
    await expect.poll(() => pids.every((pid) => !alive(pid)), { timeout: 16_000 }).toBe(true)
  }
})

test('切换主会话清理真实侧聊流与存储，新侧聊独立发送', async () => {
  await expect(page.locator('#startup-splash')).toBeHidden()
  const debugBack = page.getByRole('navigation', { name: '调试分区' }).getByRole('button', { name: '返回', exact: true })
  if (await debugBack.isVisible().catch(() => false)) await debugBack.click()
  if (await page.getByTestId('settings-back').isVisible().catch(() => false)) await page.getByTestId('settings-back').click()
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible()
  const dock = page.getByTestId('chat-right-dock')
  await page.evaluate(() => {
    const observed = { sessionId: '' }
    const off = window.electronAPI.chat.onEvent((event) => {
      if ('sessionId' in event) observed.sessionId = String(event.sessionId)
    })
    Object.assign(window, { __parentSwitchObserved: observed, __parentSwitchUnsubscribe: off })
  })
  try {
    await dock.getByRole('button', { name: '添加工作区内容' }).click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const panel = dock.getByTestId('workspace-sidechat-panel')
    const input = panel.getByRole('textbox', { name: '侧边聊天消息' })
    await input.fill('workspace-close-regression')
    await panel.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(panel.getByText('正在等待关闭验证', { exact: true })).toBeVisible({ timeout: 30_000 })
    const oldId = await page.evaluate(() => (window as any).__parentSwitchObserved.sessionId as string)
    expect(oldId).not.toBe('')
    await input.fill('旧会话未发送草稿')
    await page.getByTestId('primary-sidebar').getByRole('button', { name: '新对话', exact: true }).click()
    await expect(input).toBeEnabled()
    await expect(input).toBeEmpty()
    await expect(panel.getByTestId('workspace-sidechat-messages')).not.toContainText('workspace-close-regression')
    await expect.poll(() => heldStreamClosed).toBe(true)
    await expect.poll(() => page.evaluate((id) => window.electronAPI.session.get(id), oldId)).toBeNull()
    await input.fill('新主会话的侧聊')
    await panel.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(panel.getByText('连接成功', { exact: true })).toBeVisible({ timeout: 30_000 })
    const newId = await page.evaluate(() => (window as any).__parentSwitchObserved.sessionId as string)
    expect(newId).not.toBe(oldId)
    expect(await page.evaluate((id) => window.electronAPI.session.get(id), newId)).toMatchObject({ sessionKind: 'workspace' })
    await page.screenshot({ path: 'test-results/workspace-electron-parent-switch.png', fullPage: true })
    await dock.getByRole('button', { name: '关闭侧边聊天', exact: true }).click()
    await expect.poll(() => page.evaluate((id) => window.electronAPI.session.get(id), newId)).toBeNull()
  } finally {
    await page.evaluate(() => (window as any).__parentSwitchUnsubscribe())
  }
})

test('文件规则经真实设置 IPC 热更新、确认、重启恢复并阻止文件副作用', async () => {
  const root = path.join(userDataDir, 'permission-files')
  await mkdir(root, { recursive: true })
  await writeFile(path.join(root, 'notes.txt'), 'original', 'utf8')
  await electronApp.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] })
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  }, root)
  await page.evaluate(async () => {
    const directory = await window.electronAPI.project.browse()
    if (!directory) throw Error('未选择测试目录')
    const selected = await window.electronAPI.project.set(directory.path)
    if (!selected.success) throw Error('测试目录未设置')
  })
  const originalRules = await page.evaluate(async () => (await window.electronAPI.settings.get()).permissionRules)
  const saveRule = async (action: string, type = 'file-write') => page.evaluate(async ({ action, type }) => {
    await window.electronAPI.settings.set('permissionRules', JSON.stringify([{ id: 'electron-file-rule', type, pattern: 'notes[.]txt$', action, enabled: true }]))
  }, { action, type })
  const write = (confirmRisk = false) => page.evaluate(confirmRisk => window.electronAPI.debug.toolRun({
    name: 'file_write', args: { path: 'notes.txt', content: 'changed' }, confirmRisk,
  }), confirmRisk)
  try {
    await saveRule('deny')
    expect((await write(true)).ok).toBe(false)
    expect(await readFile(path.join(root, 'notes.txt'), 'utf8')).toBe('original')
    await saveRule('ask')
    const awaiting = await write()
    expect(awaiting.ok).toBe(false)
    if (!awaiting.ok) expect(awaiting.needsConfirmation).toBe(true)
    const saved = await write(true)
    expect(saved.ok).toBe(true)
    if (saved.ok) expect(saved.isError).not.toBe(true)
    expect(await readFile(path.join(root, 'notes.txt'), 'utf8')).toBe('changed')
    await saveRule('deny', 'file-delete')
    await electronApp.close()
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/index.js'), '--user-data-dir=' + userDataDir, '--no-sandbox'],
      env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' },
    })
    page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#startup-splash')).toBeHidden()
    expect(JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).permissionRules)[0].type).toBe('file-delete')
    const deleted = await page.evaluate(() => window.electronAPI.debug.toolRun({ name: 'file_delete', args: { path: 'notes.txt' }, confirmRisk: true }))
    expect(deleted.ok).toBe(false)
    expect(await readFile(path.join(root, 'notes.txt'), 'utf8')).toBe('changed')
    await saveRule('allow')
    const allowed = await write()
    expect(allowed.ok).toBe(true)
    if (allowed.ok) expect(allowed.isError).not.toBe(true)
  } finally {
    await page.evaluate(value => window.electronAPI.settings.set('permissionRules', value || '[]'), originalRules)
  }
})

test('正式记忆经真实 IPC 增改、完整重启恢复和删除', async () => {
  await page.evaluate(async (url) => {
    await window.electronAPI.settings.set('llmApiKey', 'local-test-key')
    await window.electronAPI.settings.set('llmBaseUrl', url)
    await window.electronAPI.settings.set('llmModel', 'local-test-model')
  }, baseUrl)
  await page.reload()
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-memory').click()
  await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
  const original = '真实重启验收：讨论产品前需要确认目标与边界。'.repeat(12)
  await page.getByLabel('新记忆内容', { exact: true }).fill(original)
  await page.getByRole('button', { name: '保存新记忆', exact: true }).click()
  await expect.poll(async () => (await page.evaluate(() => window.electronAPI.memory.list())).filter((memory) => memory.content === original).length).toBe(1)
  const entry = (await page.evaluate(() => window.electronAPI.memory.list())).find((memory) => memory.content === original)!
  const item = page.getByTestId(`memory-item-${entry.id}`)
  await item.hover()
  await item.getByRole('button', { name: /^编辑记忆 / }).click()
  const updated = '真实重启后仍应保留这条记忆。\n并且保留第二行。'
  await item.locator('textarea').fill(updated)
  await item.getByRole('button', { name: /^保存记忆 / }).click()
  await expect(item.locator('textarea')).toHaveCount(0)
  await expect.poll(async () => (await page.evaluate(() => window.electronAPI.memory.list())).find((memory) => memory.id === entry.id)?.content).toBe(updated)

  const groupedEntries: { id: string; group: string; content: string; category: string; roleId?: string }[] = []
  const activeRoleId = (await page.evaluate(() => window.electronAPI.companion.getActive()))?.id
  for (const [group, category, content] of [
    ['collaboration', 'workflow', '复杂工作先整理已知事实，再检查验收标准。'],
    ['communication', 'voice', '沟通中先讲结论，给出必要依据，避免重复说明。'],
    ['relationship', 'feedback', '我们约定保留共同确认的决定，不擅自改变边界。'],
  ]) {
    await page.getByTestId(`memory-group-${group}`).click()
    await page.getByRole('button', { name: '添加一条记忆', exact: true }).click()
    await page.getByLabel('新记忆内容', { exact: true }).fill(content)
    await page.getByRole('button', { name: '保存新记忆', exact: true }).click()
    await expect(page.getByLabel('新记忆内容', { exact: true })).toHaveCount(0)
    const saved = (await page.evaluate(() => window.electronAPI.memory.list())).find((memory) => memory.content === content)!
    expect(saved).toMatchObject({ category, content })
    if (group === 'relationship') expect(saved.roleId).toBe(activeRoleId)
    groupedEntries.push({ id: saved.id, group, category, content, ...(group === 'relationship' ? { roleId: activeRoleId } : {}) })
  }

  // 此处完整退出进程后复用隔离目录，不能以 page.reload 代替磁盘恢复证据。
  await electronApp.close()
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../dist-electron/index.js'), `--user-data-dir=${userDataDir}`, '--no-sandbox'],
    env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' },
  })
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('#startup-splash')).toBeHidden()
  await page.locator('button[title="设置"]').click()
  await page.getByTestId('settings-nav-memory').click()
  const restored = page.getByTestId(`memory-item-${entry.id}`)
  await expect(restored).toContainText('并且保留第二行。')
  expect((await page.evaluate(() => window.electronAPI.memory.list())).find((memory) => memory.id === entry.id)?.content).toBe(updated)
  await restored.hover()
  await restored.getByRole('button', { name: /^删除记忆 / }).click()
  await restored.getByRole('button', { name: /^确认删除记忆 / }).click()
  await expect(restored).toHaveCount(0)
  expect((await page.evaluate(() => window.electronAPI.memory.list())).some((memory) => memory.id === entry.id)).toBe(false)
  for (const saved of groupedEntries) {
    await page.getByTestId(`memory-group-${saved.group}`).click()
    const card = page.getByTestId(`memory-item-${saved.id}`)
    await expect(card).toContainText(saved.content)
    const persisted = (await page.evaluate(() => window.electronAPI.memory.list())).find((memory) => memory.id === saved.id)
    expect(persisted).toMatchObject({ content: saved.content, category: saved.category, ...(saved.roleId ? { roleId: saved.roleId } : {}) })
    await card.hover()
    await card.getByRole('button', { name: /^删除记忆 / }).click()
    await card.getByRole('button', { name: /^确认删除记忆 / }).click()
    await expect(card).toHaveCount(0)
  }
})


/**
 * MCP 使用临时随机凭据和独立数据目录，验证密文落盘、Renderer 脱敏及完整重启后真实认证。
 * 本地 Bearer 服务不等于第三方 OAuth；安全存储不可用时必须失败，不能跳过认证断言。
 */
test('正式 MCP 凭据加密脱敏并在完整重启后恢复认证', async () => {
  const bearerToken = randomUUID()
  let authenticatedRequests = 0
  const mcp = new McpServer({ name: 'electron-mcp-fixture', version: '1.0.0' })
  mcp.registerTool('search_docs', { description: '搜索文档', inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'ok' }] }))
  const mcpHttp = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${bearerToken}`) { response.writeHead(401).end(); return }
    authenticatedRequests++
    if (request.method !== 'POST') { response.writeHead(405).end(); return }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    response.on('close', () => { void mcp.close() })
    await mcp.connect(transport)
    await transport.handleRequest(request, response)
  })
  await new Promise<void>((resolve) => mcpHttp.listen(0, '127.0.0.1', resolve))
  const address = mcpHttp.address() as AddressInfo
  const url = 'http://127.0.0.1:' + address.port + '/mcp'
  const original = await page.evaluate(() => window.electronAPI.settings.get())
  try {
    expect(await electronApp.evaluate(({ safeStorage }) => safeStorage.isEncryptionAvailable())).toBe(true)
    expect((await fetch(url, { method: 'POST' })).status).toBe(401)
    await electronApp.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }) })
    const result = await page.evaluate(async ({ url, bearerToken }) => {
      const requestId = 'electron-mcp-test'
      const tested = await window.electronAPI.mcp.testConnection(requestId, { name: '本地 MCP 验收', transport: 'streamable-http', command: '', args: [], url, bearerToken })
      if (!tested.ok) return { tested }
      const saved = await window.electronAPI.mcp.saveTested(requestId, tested.tools.map((tool) => tool.name))
      return { tested, saved }
    }, { url, bearerToken })
    expect(result.tested.ok).toBe(true)
    expect(result.saved?.ok).toBe(true)
    const savedConfig = JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers) as Array<{ name: string; url: string; enabled: boolean }>
    expect(savedConfig).toEqual(expect.arrayContaining([expect.objectContaining({ name: '本地 MCP 验收', url, enabled: true })]))
    expect(JSON.stringify(savedConfig)).not.toContain(bearerToken)
    expect(savedConfig).toEqual(expect.arrayContaining([expect.objectContaining({ bearerToken: '__MY_AGENT_REDACTED__' })]))
    await electronApp.close()
    const authenticatedBeforeRestart = authenticatedRequests
    const databaseBytes = await readFile(path.join(userDataDir, 'my-agent.db'))
    expect(databaseBytes.includes(Buffer.from(bearerToken))).toBe(false)
    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs({ locateFile: () => createRequire(import.meta.url).resolve('sql.js/dist/sql-wasm.wasm') })
    const database = new SQL.Database(databaseBytes)
    try {
      const statement = database.prepare('SELECT value FROM settings WHERE key = ?')
      try {
        statement.bind(['mcpServers'])
        expect(statement.step()).toBe(true)
        expect(statement.getAsObject().value).toMatch(/^enc:v1:/)
      } finally { statement.free() }
    } finally { database.close() }
    electronApp = await electron.launch({ args: [path.join(__dirname, '../../dist-electron/index.js'), '--user-data-dir=' + userDataDir, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
    page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#startup-splash')).toBeHidden()
    const restored = JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers) as Array<{ name: string; url: string }>
    expect(restored).toEqual(expect.arrayContaining([expect.objectContaining({ name: '本地 MCP 验收', url })]))
    expect(JSON.stringify(restored)).not.toContain(bearerToken)
    expect(restored).toEqual(expect.arrayContaining([expect.objectContaining({ bearerToken: '__MY_AGENT_REDACTED__' })]))
    await expect.poll(() => authenticatedRequests).toBeGreaterThan(authenticatedBeforeRestart)
    await expect.poll(async () => (await page.evaluate(() => window.electronAPI.mcp.status())).find((entry) => entry.name === '本地 MCP 验收')).toMatchObject({ status: 'connected', toolCount: 1 })
  } finally {
    await page.evaluate((value) => window.electronAPI.settings.set('mcpServers', value || '[]'), original.mcpServers || '[]').catch(() => undefined)
    mcpHttp.closeAllConnections()
    await new Promise<void>((resolve) => mcpHttp.close(() => resolve()))
  }
})

test('正式 MCP 异常断开后设置页显示可恢复失败', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-reconnect-e2e-'))
  const pidFile = path.join(dir, 'pid')
  const resolveModule = (name: string) => JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve(name)).href)
  const script = `
    import { writeFileSync } from 'node:fs';
    import { McpServer } from ${resolveModule('@modelcontextprotocol/sdk/server/mcp.js')};
    import { StdioServerTransport } from ${resolveModule('@modelcontextprotocol/sdk/server/stdio.js')};
    if (process.env.MCP_PID_FILE) writeFileSync(process.env.MCP_PID_FILE, String(process.pid));
    const server = new McpServer({name:'reconnect-electron',version:'1.0.0'});
    server.registerTool('pid', {inputSchema:{}}, async () => ({content:[{type:'text',text:String(process.pid)}]}));
    await server.connect(new StdioServerTransport());
  `
  const original = await page.evaluate(() => window.electronAPI.settings.get())
  try {
    await electronApp.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }) })
    const result = await page.evaluate(async ({ command, script, pidFile }) => {
      const requestId = 'electron-mcp-reconnect'
      const tested = await window.electronAPI.mcp.testConnection(requestId, {
        name: 'reconnect-electron', transport: 'stdio', command, args: ['--input-type=module', '-e', script],
        env: { MCP_PID_FILE: pidFile },
      })
      if (!tested.ok) return { tested }
      const saved = await window.electronAPI.mcp.saveTested(requestId, tested.tools.map((tool) => tool.name))
      return { tested, saved }
    }, { command: process.execPath, script, pidFile })
    expect(result.tested, '本地 stdio 测试连接结果').toMatchObject({ ok: true })
    expect(result.saved?.ok).toBe(true)
    const servers = JSON.parse((await page.evaluate(() => window.electronAPI.settings.get())).mcpServers) as Array<{ id: string; name: string }>
    const saved = servers.find((item) => item.name === 'reconnect-electron')
    expect(saved).toBeTruthy()
    await expect.poll(async () => (await readFile(pidFile, 'utf8')).trim(), { timeout: 10000 }).not.toBe('')
    await page.reload()
    await expect(page.locator('#startup-splash')).toBeHidden()
    if (!(await page.getByTestId('settings-panel').isVisible())) await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-mcp').click()
    const card = page.getByTestId(`settings-mcp-server-${saved!.id}`)
    await expect(card.getByRole('status')).toHaveText('已连接')
    const pid = Number((await readFile(pidFile, 'utf8')).trim())
    process.kill(pid)
    await expect(card.getByRole('status')).toHaveText('连接失败', { timeout: 15000 })
    await expect(card).toContainText('服务意外断开，正在尝试重新连接。')
    await expect(card.getByRole('button', { name: '重试', exact: true })).toBeVisible()
    await expect(card.getByRole('status')).toHaveText('已连接', { timeout: 20000 })
  } finally {
    await page.evaluate((value) => window.electronAPI.settings.set('mcpServers', value || '[]'), original.mcpServers || '[]').catch(() => undefined)
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
})
