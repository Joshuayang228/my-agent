import { createServer } from 'node:http'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

for (const apiKey of ['fixture-key', '']) {
test('正式备份提交后强退，向量服务失败后重启补齐真实索引且不重复' + (apiKey ? '（有 Key）' : '（无 Key）'), async ({}, testInfo) => {
  let fail = true
  const requests: string[] = []
  const authorization: Array<string | undefined> = []
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
    if (request.url === '/v1/embeddings') {
      requests.push(body.input)
      authorization.push(request.headers.authorization)
      response.writeHead(fail ? 503 : 200, { 'Content-Type': 'application/json' }).end(JSON.stringify(fail
        ? { error: { message: 'temporary failure' } }
        : { data: [{ embedding: [1, 0, 0], index: 0 }], model: 'fixture', usage: { total_tokens: 1 } }))
    } else if (request.url === '/v1/models') {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ id: 'fixture' }] }))
    } else response.writeHead(404).end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture address')
  const baseUrl = `http://127.0.0.1:${address.port}/v1`
  const root = await mkdtemp(path.join(os.tmpdir(), 'my-agent-memory-recovery-'))
  const backup = path.join(root, 'backup.json')
  const content = '恢复测试：我喜欢在清晨独自散步'
  await writeFile(backup, JSON.stringify({ version: 1, exportedAt: 1, sessions: [], settings: {}, memories: [
    { id: 'source-one', category: 'preference', content, createdAt: 1, updatedAt: 1 },
    { id: 'source-two', category: 'feedback', roleId: 'lin', content: '请先给结论再解释依据', createdAt: 1, updatedAt: 1 },
  ] }))
  let app: ElectronApplication | undefined
  let closed = false
  const launch = async () => {
    app = await electron.launch({ args: [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url)), `--user-data-dir=${root}`, '--no-sandbox'], env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' } })
    closed = false
    app.on('close', () => { closed = true })
    return app.firstWindow()
  }
  const mirrors = async () => {
    try { return JSON.parse(await readFile(path.join(root, 'vector-index/index.json'), 'utf8')).items as Array<{ metadata: Record<string, unknown> }> }
    catch { return [] }
  }
  try {
    let page = await launch()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    await page.getByRole('button', { name: '添加连接', exact: true }).click()
    const form = page.getByTestId('model-connection-form')
    await form.getByRole('radio', { name: '本地模型', exact: true }).click()
    await form.getByLabel('连接名称', { exact: true }).fill('索引恢复验收')
    await form.getByLabel('Base URL', { exact: true }).fill(baseUrl)
    await form.getByLabel('API Key', { exact: true }).fill(apiKey)
    await form.getByRole('button', { name: '保存连接', exact: true }).click()
    const profile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: '索引恢复验收' })
    await profile.getByRole('button', { name: '获取 索引恢复验收 已有模型', exact: true }).click()
    await profile.getByRole('button', { name: 'fixture', exact: true }).click()
    await page.getByLabel('添加主对话模型').selectOption({ label: '索引恢复验收 · fixture' })
    await expect.poll(() => page.evaluate(async () => (await window.electronAPI.settings.get()).llmConnectionReady)).toBe('true')
    // 本例验证已配置连接下的索引恢复；首次加密状态强退丢失另归 S4，不能以本例掩盖。
    await app!.close()
    page = await launch()
    await expect(page.getByTestId('chat-messages')).toBeVisible()
    expect(await page.evaluate(async () => JSON.parse((await window.electronAPI.settings.get()).modelConnections))).toEqual([
      expect.objectContaining({ name: '索引恢复验收', hasApiKey: Boolean(apiKey) }),
    ])
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-data').click()
    await app!.evaluate(async ({ dialog }, args) => {
      const fs = process.getBuiltinModule('fs')
      const rename = fs.renameSync
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [args.backup] })
      fs.renameSync = (source, target) => {
        rename(source, target)
        if (String(target).endsWith('my-agent.db') && fs.readFileSync(target).includes(Buffer.from(args.content))) {
          fs.writeFileSync(args.root + '/forced-exit.json', JSON.stringify({ phase: 'committed-before-index', signal: 'SIGKILL' }))
          process.kill(process.pid, 'SIGKILL')
        }
      }
    }, { root, backup, content })
    await page.getByTestId('section-data').getByTestId('import').click().catch(error => { if (!String(error).includes('closed')) throw error })
    await expect.poll(() => closed).toBe(true)
    expect(requests).toEqual([])
    expect(JSON.parse(await readFile(path.join(root, 'forced-exit.json'), 'utf8')).phase).toBe('committed-before-index')

    page = await launch()
    await expect.poll(() => requests.length).toBe(1)
    expect(await mirrors()).toHaveLength(0)
    await expect.poll(() => page.evaluate(() => window.electronAPI.memory.list())).toEqual(expect.arrayContaining([expect.objectContaining({ content })]))
    await app!.close()
    fail = false
    page = await launch()
    await expect.poll(async () => (await mirrors()).length).toBe(2)
    const rows = await mirrors()
    expect(rows.map(item => item.metadata)).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: content, category: 'preference' }),
      expect.objectContaining({ category: 'feedback', roleId: 'lin' }),
    ]))
    const hits = await app!.evaluate(async ({ app }, directory) => {
      const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')
      const { LocalIndex } = require('vectra')
      return (await new LocalIndex(directory + '/vector-index').queryItems([1, 0, 0], '散步', 10)).map((item: { item: { metadata: unknown } }) => item.item.metadata)
    }, root)
    expect(hits).toEqual(expect.arrayContaining([expect.objectContaining({ text: content })]))
    await app!.close()
    const count = requests.length
    page = await launch()
    await expect(page.getByTestId('chat-messages')).toBeVisible()
    expect(await mirrors()).toHaveLength(2)
    expect(requests).toHaveLength(count)
    expect(authorization).toEqual(Array(count).fill(apiKey ? 'Bearer fixture-key' : undefined))
    await testInfo.attach('memory-index-recovery', { contentType: 'application/json', body: JSON.stringify({ mirrors: 2, sourceRetainedOnFailure: true, phase: 'committed-before-index', requests: count }) })
  } finally {
    if (app && !closed) await app.close()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await rm(root, { recursive: true, force: true })
  }
})
}
