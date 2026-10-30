import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

/**
 * 背景：工具 Registry 单测只能证明 schema 和领域服务存在，不能证明正式 Chat 会把工具交给模型并保存结果。
 * 设计意图：用本地 OpenAI 兼容 SSE 夹具驱动一轮真实 tool call，再从正式 Companion IPC 读取动态；放弃只检查请求 JSON 的浅层验收。
 * 关键约束：夹具不访问外部模型、不产生费用；只验证路飞当前人物、工具可见性、两轮调用和生活存储，不能证明模型自主选择质量。
 */
test('正式 Chat 将路飞朋友圈工具暴露给模型并写入人物世界', async () => {
  const requests: Array<Record<string, unknown>> = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> : {}
    if (request.method === 'GET' && request.url?.endsWith('/models')) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ id: 'luffy-chat-fixture' }] }))
      return
    }
    if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
      response.writeHead(404).end()
      return
    }
    requests.push(body)
    const messages = Array.isArray(body.messages) ? body.messages as Array<{ role?: string; content?: unknown }> : []
    const userText = messages.filter(message => message.role === 'user').map(message => String(message.content ?? '')).join('\n')
    const lastUserIndex = messages.map(message => message.role).lastIndexOf('user')
    const lastUserText = lastUserIndex >= 0 ? String(messages[lastUserIndex]?.content ?? '') : ''
    const hasToolResultAfterLastUser = messages.slice(lastUserIndex + 1).some(message => message.role === 'tool')
    const postMoment = lastUserText.includes('luffy-chat-tool-fixture')
    const createAsset = lastUserText.includes('luffy-chat-asset-fixture')
    const shouldCall = (postMoment || createAsset) && !hasToolResultAfterLastUser
    response.writeHead(200, { 'Content-Type': 'text/event-stream' })
    const delta = shouldCall
      ? { tool_calls: [{ index: 0, id: createAsset ? 'luffy-asset-call' : 'luffy-moment-call', type: 'function', function: { name: createAsset ? 'companion_create_asset' : 'companion_post_moment', arguments: JSON.stringify(createAsset ? { kind: 'furniture', name: '甲板望远镜架', payload: { description: '固定在千里阳光号甲板边，方便观察远处航线。' } } : { text: '千里阳光号甲板上的风把航线图吹得哗啦响。', activity: '整理下一段航线', location: '千里阳光号甲板' }) } }] }
      : { content: createAsset ? '路飞已经把甲板上的新家具记下来了。' : '路飞已经把这段航海生活记下来了。' }
    response.write(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\n`)
    response.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: shouldCall ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 3 } })}\n\n`)
    response.end('data: [DONE]\n\n')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('路飞 Chat 回环服务启动失败')
  const baseUrl = `http://127.0.0.1:${address.port}/v1`
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'my-agent-luffy-chat-tools-'))
  const entry = fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url))
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({ args: [entry, `--user-data-dir=${userDataDir}`, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
    const page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    await page.getByRole('button', { name: '添加连接', exact: true }).click()
    const form = page.getByTestId('model-connection-form')
    await form.getByRole('radio', { name: '本地模型', exact: true }).click()
    await form.getByLabel('连接名称', { exact: true }).fill('路飞 Chat 回环')
    await form.getByLabel('Base URL', { exact: true }).fill(baseUrl)
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    const profile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '路飞 Chat 回环' })
    await profile.getByRole('button', { name: '获取 路飞 Chat 回环 已有模型', exact: true }).click()
    await profile.getByRole('button', { name: 'luffy-chat-fixture', exact: true }).click()
    await profile.getByRole('button', { name: '测试连接 路飞 Chat 回环', exact: true }).click()
    await expect(profile).toContainText('连接测试通过')
    await page.getByLabel('添加主对话模型').selectOption({ label: '路飞 Chat 回环 · luffy-chat-fixture' })
    await page.evaluate(async () => { await window.electronAPI.settings.set('executionMode', 'auto') })
    await page.getByTestId('settings-back').click()
    await page.getByPlaceholder(/和.*说说/).fill('luffy-chat-tool-fixture')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByText('路飞已经把这段航海生活记下来了。', { exact: true })).toBeVisible({ timeout: 30_000 })
    expect(requests.some(body => Array.isArray(body.tools) && (body.tools as Array<{ function?: { name?: string } }>).some(tool => tool.function?.name === 'companion_post_moment'))).toBe(true)
    expect(requests.length).toBeGreaterThanOrEqual(2)
    const moments = await page.evaluate(() => window.electronAPI.companion.getMoments({ limit: 10 }))
    expect(moments.roleId).toBe('luffy')
    const published = moments.items.find(item => item.text === '整理下一段航线 · 千里阳光号甲板')
    expect(published).toBeDefined()
    const slice = await page.evaluate((eventId) => window.electronAPI.companion.getLifeSlice(eventId), published!.eventId)
    expect(slice?.event.payload.story).toBe('千里阳光号甲板上的风把航线图吹得哗啦响。')
    await page.getByPlaceholder(/和.*说说/).fill('luffy-chat-asset-fixture')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByText('路飞已经把甲板上的新家具记下来了。', { exact: true })).toBeVisible({ timeout: 30_000 })
    const assets = await page.evaluate(() => window.electronAPI.companion.getAssets({ kind: 'furniture' }))
    expect(assets.items.some(asset => asset.name === '甲板望远镜架')).toBe(true)
  } finally {
    await app?.close()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(userDataDir, { recursive: true, force: true })
  }
})
