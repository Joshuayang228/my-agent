import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, rm, unlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { test, expect, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

// 真实本地协议只证明客户端链路；固定测试图片不能证明外部模型生成质量。
test('正式生图设置、审批、真实文件、图片展示与重启恢复', async ({}, testInfo) => {
  const bytes = await sharp({ create: { width: 48, height: 32, channels: 3, background: '#31876d' } }).png().toBuffer()
  const requests: Array<{ url: string; authorization: string; body: Record<string, unknown> }> = []
  let cancelledImageRequestClosed = false
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    const text = Buffer.concat(chunks).toString('utf8')
    const body = text ? JSON.parse(text) : {}
    const url = request.url ?? ''
    requests.push({ url, authorization: request.headers.authorization ?? '', body })
    if (url.endsWith('/models')) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ id: url.startsWith('/image/') ? 'image-fixture' : 'chat-fixture' }] }))
    } else if (url === '/image/v1/images/generations') {
      if (body.prompt === '取消测试图片') {
        response.on('close', () => { cancelledImageRequestClosed = true })
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ b64_json: bytes.toString('base64') }] }))
    } else if (url === '/chat/v1/chat/completions') {
      const messages = body.messages as Array<{ role: string; content: unknown }>
      const last = messages?.at(-1)
      const generate = last?.role === 'user' && typeof last.content === 'string' && /(?:^|\n)image-fixture-generate(?:-side|-cancel)?$/.test(last.content)
      const side = generate && (last.content as string).endsWith('-side')
      const cancel = generate && (last.content as string).endsWith('-cancel')
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      const delta = generate
        ? { tool_calls: [{ index: 0, id: cancel ? 'image-call-cancel' : side ? 'image-call-side' : 'image-call-1', type: 'function', function: { name: 'image_generate', arguments: JSON.stringify({ prompt: cancel ? '取消测试图片' : '一张绿色测试图片', path: cancel ? 'images/generated-cancel.png' : side ? 'images/generated-side.png' : 'images/generated-test.png' }) } }] }
        : { content: '图片流程验证完成' }
      response.write(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\n`)
      response.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: generate ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 2 } })}\n\n`)
      response.end('data: [DONE]\n\n')
    } else response.writeHead(404).end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Image fixture server unavailable')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const directory = await mkdtemp(path.join(os.tmpdir(), 'my-agent-image-e2e-'))
  const project = path.join(directory, 'workspace')
  await mkdir(project)
  let app: ElectronApplication | undefined
  const packagedExecutable = process.env.TEST_PACKAGED_APP
  const launch = () => electron.launch({
    ...(packagedExecutable ? { executablePath: packagedExecutable } : {}),
    args: [...(packagedExecutable ? [] : [fileURLToPath(new URL('../../dist-electron/index.js', import.meta.url))]), `--user-data-dir=${directory}`, '--no-sandbox'],
    env: { ...process.env, NODE_ENV: 'production', LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' },
  })
  try {
    app = await launch()
    let page = await app.firstWindow()
    await expect(page.getByTestId('settings-panel')).toBeVisible()
    await page.getByTestId('settings-nav-model').click()
    for (const [kind, label, purpose] of [['chat', '聊天连接', '主对话'], ['image', '生图连接', '生图']]) {
      await page.getByRole('button', { name: '添加连接', exact: true }).click()
      const form = page.getByTestId('model-connection-form')
      await form.getByRole('radio', { name: '本地模型', exact: true }).click()
      await form.getByLabel('连接名称', { exact: true }).fill(label)
      await form.getByLabel('Base URL', { exact: true }).fill(`${baseUrl}/${kind}/v1`)
      await form.getByLabel('API Key', { exact: true }).fill(`${kind}-fixture-key`)
      await form.getByRole('button', { name: '保存连接', exact: true }).click()
      const profile = page.locator('[data-testid^="settings-model-profile-"]').filter({ hasText: label })
      await profile.getByRole('button', { name: `获取 ${label} 已有模型`, exact: true }).click()
      await profile.getByRole('button', { name: `${kind}-fixture`, exact: true }).click()
      await page.getByLabel(`添加${purpose}模型`).selectOption({ label: `${label} · ${kind}-fixture` })
    }
    await expect.poll(() => page.evaluate(async () => JSON.parse((await window.electronAPI.settings.get()).modelRoutes).length)).toBe(2)
    await page.evaluate(() => window.electronAPI.settings.set('executionMode', 'confirm-all'))
    await page.getByTestId('settings-back').click()
    await app.evaluate(({ dialog }, project) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [project] }) }, project)
    await page.getByRole('button', { name: '未选择项目', exact: true }).click()
    await page.getByRole('button', { name: '添加新项目', exact: true }).click()
    await page.getByPlaceholder(/和.*说说/).fill('image-fixture-generate')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page.getByRole('button', { name: '允许执行', exact: true })).toBeVisible()
    expect(requests.filter(request => request.url.endsWith('/images/generations'))).toHaveLength(0)
    await page.getByRole('button', { name: '允许执行', exact: true }).click()
    const image = page.getByTestId('generated-image-result')
    await expect(image.getByRole('button', { name: '查看原图' })).toBeEnabled()
    await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0)
    const generated = requests.filter(request => request.url.endsWith('/images/generations'))
    expect(generated).toHaveLength(1)
    expect(generated[0]).toMatchObject({ authorization: 'Bearer image-fixture-key', body: { model: 'image-fixture', prompt: '一张绿色测试图片', n: 1 } })
    const file = await readFile(path.join(project, 'images/generated-test.png'))
    expect(await sharp(file).metadata()).toMatchObject({ width: 48, height: 32, format: 'png' })
    const sessions = await page.evaluate(() => window.electronAPI.session.list())
    const sessionId = sessions[0].id
    const session = await page.evaluate(id => window.electronAPI.session.get(id), sessionId)
    const reference = session!.messages.find(message => message.generatedImages?.length)?.generatedImages![0]
    expect(reference).toMatchObject({ width: 48, height: 32, byteLength: file.length })
    const toolRequest = requests.find(request => Array.isArray(request.body.messages) && request.body.messages.some((message: { role: string }) => message.role === 'tool'))
    expect(toolRequest).toBeDefined()
    expect(JSON.stringify(toolRequest)).not.toContain('base64')
    await page.screenshot({ path: testInfo.outputPath('generated.png') })
    await app.close(); app = undefined
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('chat-messages')).toBeVisible()
    await page.getByTestId('primary-sidebar').getByText(sessions[0].title!, { exact: true }).click()
    await expect(page.getByTestId('generated-image-result').getByRole('button', { name: '查看原图' })).toBeEnabled()
    expect(requests.filter(request => request.url.endsWith('/images/generations'))).toHaveLength(1)
    await app.evaluate(({ shell }) => {
      ;(globalThis as any).__revealedImages = []
      shell.showItemInFolder = filePath => { (globalThis as any).__revealedImages.push(filePath) }
    })
    await page.getByTestId('generated-image-result').getByRole('button', { name: '在文件夹中定位' }).click()
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__revealedImages)).toEqual([path.join(project, 'images/generated-test.png')])
    await page.screenshot({ path: testInfo.outputPath('generated-restart.png') })
    await page.getByRole('button', { name: '打开工作区', exact: true }).click()
    const dock = page.getByTestId('chat-right-dock')
    await dock.getByTestId('right-dock-add-tab').click()
    await dock.getByRole('menuitem', { name: '侧边聊天', exact: true }).click()
    const sideChat = dock.getByTestId('workspace-sidechat-panel')
    await sideChat.getByRole('textbox', { name: '侧边聊天消息' }).fill('image-fixture-generate-side')
    await sideChat.getByRole('button', { name: '发送消息', exact: true }).click()
    await sideChat.getByRole('button', { name: '允许执行', exact: true }).click()
    const sideImage = sideChat.getByTestId('generated-image-result')
    await expect(sideImage.getByRole('button', { name: '查看原图' })).toBeEnabled()
    await expect(sideChat.getByRole('button', { name: '停止生成', exact: true })).toHaveCount(0)
    await expect(sideImage).toHaveCount(1)
    await sideImage.getByRole('button', { name: '在文件夹中定位' }).click()
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__revealedImages)).toEqual([path.join(project, 'images/generated-test.png'), path.join(project, 'images/generated-side.png')])
    expect(requests.filter(request => request.url.endsWith('/images/generations'))).toHaveLength(2)
    await page.screenshot({ path: testInfo.outputPath('generated-sidechat.png') })
    await dock.getByRole('button', { name: '关闭侧边聊天', exact: true }).click()
    await expect(sideChat).toHaveCount(0)
    expect(await sharp(await readFile(path.join(project, 'images/generated-side.png'))).metadata()).toMatchObject({ width: 48, height: 32, format: 'png' })
    const backupPath = path.join(directory, 'image-backup.json')
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }) }, backupPath)
    await page.locator('button[title="设置"]').click()
    await page.getByTestId('settings-nav-data').click()
    await page.getByTestId('section-data').getByTestId('export').click()
    await expect(page.getByTestId('section-data').getByRole('status')).toContainText('导出成功')
    const backup = JSON.parse(await readFile(backupPath, 'utf8'))
    expect(backup.generatedImageMedia).toHaveLength(1)
    expect(backup.sessions.find((value: { id: string }) => value.id === sessionId).messages.find((value: { generatedImages?: unknown[] }) => value.generatedImages?.length).generatedImages[0]).not.toHaveProperty('path')
    await page.evaluate(id => window.electronAPI.session.delete(id), sessionId)
    await unlink(path.join(project, 'images/generated-test.png'))
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }) }, backupPath)
    await page.getByTestId('section-data').getByTestId('import').click()
    await expect(page.getByTestId('section-data').getByRole('status')).toContainText('导入成功')
    const restored = await page.evaluate(id => window.electronAPI.session.get(id), sessionId)
    const restoredImage = restored!.messages.find(message => message.generatedImages?.length)!.generatedImages![0]
    expect(restoredImage.path).not.toBe(reference!.path)
    expect(path.relative(directory, restoredImage.path)).not.toMatch(/^\.\./)
    expect(await sharp(await readFile(restoredImage.path)).metadata()).toMatchObject({ width: 48, height: 32 })
    expect(await page.evaluate(() => window.electronAPI.data.import())).toMatchObject({ success: true, stats: { sessions: 0 } })
    await app.close(); app = undefined
    app = await launch()
    page = await app.firstWindow()
    await expect(page.getByTestId('chat-messages')).toBeVisible()
    await page.getByTestId('primary-sidebar').getByText(sessions[0].title!, { exact: true }).click()
    await expect(page.getByTestId('generated-image-result').getByRole('button', { name: '查看原图' })).toBeEnabled()
    await app.evaluate(({ shell }) => { shell.showItemInFolder = filePath => { (globalThis as any).__restoredPath = filePath } })
    await page.getByTestId('generated-image-result').getByRole('button', { name: '在文件夹中定位' }).click()
    await expect.poll(() => app!.evaluate(() => (globalThis as any).__restoredPath)).toBe(restoredImage.path)
    expect(requests.filter(request => request.url.endsWith('/images/generations'))).toHaveLength(2)
    await page.screenshot({ path: testInfo.outputPath('generated-backup-restored.png') })
    await page.getByPlaceholder(/和.*说说/).fill('image-fixture-generate-cancel')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await page.getByRole('button', { name: '允许执行', exact: true }).click()
    await expect.poll(() => requests.filter(request => request.url.endsWith('/images/generations')).length).toBe(3)
    await page.getByRole('button', { name: '停止', exact: true }).click()
    await expect.poll(() => cancelledImageRequestClosed).toBe(true)
    await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('generated-image-result')).toHaveCount(1)
    await expect(readFile(path.join(project, 'images/generated-cancel.png'))).rejects.toMatchObject({ code: 'ENOENT' })
    const cancelledSession = await page.evaluate(id => window.electronAPI.session.get(id), sessionId)
    expect(cancelledSession!.messages.filter(message => message.generatedImages?.length)).toHaveLength(1)
    expect(requests.filter(request => request.url.endsWith('/images/generations'))).toHaveLength(3)
  } finally {
    await testInfo.attach('local-protocol-summary', { contentType: 'application/json', body: JSON.stringify(requests.map(request => ({ url: request.url, model: request.body.model, messages: Array.isArray(request.body.messages) ? request.body.messages.map((message: { role: string; content: unknown }) => ({ role: message.role, content: message.role === 'user' ? message.content : typeof message.content })) : undefined }))) })
    await app?.close()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})
