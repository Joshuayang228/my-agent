import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpConnectionTests, type TestedMcpConnection } from '../../electron/main/mcp/connection-tests'
import { mcpManager } from '../../electron/main/mcp/client'
import type { McpConnectionInput, McpServerConfig } from '../../src/shared/types'
import { setTimeout as delay } from 'node:timers/promises'

const servers: Server[] = []

async function startFixture() {
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST') { response.writeHead(405).end(); return }
    const mcp = new McpServer({ name: 'connection-test-fixture', version: '1.0.0' })
    mcp.registerTool('search_docs', { description: '搜索文档', inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    mcp.registerResource('note', 'test://note', {}, async () => ({ contents: [{ uri: 'test://note', text: 'saved resource' }] }))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    response.on('close', () => { void mcp.close() })
    await mcp.connect(transport)
    await transport.handleRequest(request, response)
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`
}

afterEach(async () => {
  await mcpManager.disconnectAll()
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  })))
})

function input(url: string): McpConnectionInput {
  return { name: '文档服务', transport: 'streamable-http', command: '', args: [], url }
}

describe('MCP 添加连接测试会话', () => {
  it('stdio 测试阶段取消补充信息请求，保存后同一子进程转交正式处理器', async () => {
    const script = `
      import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
      import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
      import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
      const server = new McpServer({name:'elicitation-fixture',version:'1.0.0'});
      const ask = () => server.server.elicitInput({mode:'form',message:'请选择',requestedSchema:{type:'object',properties:{answer:{type:'string'}}}});
      server.registerTool('ask', {inputSchema:{}}, async () => ({content:[{type:'text',text:JSON.stringify({pid:process.pid,result:await ask()})}]}));
      server.server.setRequestHandler(ListToolsRequestSchema, async () => ({tools:[{name:'ask',inputSchema:{type:'object'},description:JSON.stringify({pid:process.pid,result:await ask(),capabilities:server.server.getClientCapabilities()})}]}));
      await server.connect(new StdioServerTransport());
    `
    const handler = vi.fn(async () => ({ answer: '用户选择' }))
    mcpManager.setElicitationHandler(handler)
    const tests = new McpConnectionTests({ confirm: async () => true, persist: async () => {}, adopt: (connection) => mcpManager.adoptTestedConnection(connection) })
    const tested = await tests.test(39, 'elicit', { name: '输入验证', command: process.execPath, args: ['--input-type=module', '-e', script], transport: 'stdio' })
    expect(tested.ok).toBe(true)
    if (!tested.ok) throw new Error(tested.error)
    const discovered = JSON.parse(tested.tools[0].description)
    expect(discovered.result.action).toBe('cancel')
    expect(discovered.capabilities.elicitation).toEqual({ form: {} })
    expect(handler).not.toHaveBeenCalled()
    const saved = await tests.save(39, 'elicit', ['ask'])
    if (!saved.ok) throw new Error(saved.error)
    const called = JSON.parse(await mcpManager.callTool(saved.serverId, 'ask', {}))
    expect(called).toEqual({ pid: discovered.pid, result: { action: 'accept', content: { answer: '用户选择' } } })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('等待确认时取消会立即结束原请求，迟到确认不启动网络；同 ID 新请求不受影响', async () => {
    let resolveConfirm!: (value: boolean) => void
    const confirm = vi.fn().mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveConfirm = resolve })).mockResolvedValue(true)
    const tests = new McpConnectionTests({ confirm, persist: async () => {}, adopt: (connection) => mcpManager.adoptTestedConnection(connection) })
    const first = tests.test(50, 'same', input('http://127.0.0.1:1/mcp'))
    await tests.cancel(50, 'same')
    expect(await Promise.race([first, delay(200).then(() => 'hung')])).toMatchObject({ ok: false })
    const next = await tests.test(50, 'same', input(await startFixture()))
    resolveConfirm(true)
    expect(next.ok).toBe(true)
    expect((await tests.save(50, 'same', [])).ok).toBe(true)
  })

  it('测试总超时和已测试结果过期均清理会话，不写配置', async () => {
    const persist = vi.fn()
    const held = createServer((_request, _response) => {})
    servers.push(held); held.listen(0, '127.0.0.1'); await once(held, 'listening')
    const timeoutTests = new McpConnectionTests({ confirm: async () => true, persist, adopt: vi.fn(), timeoutMs: 30, retentionMs: 500 })
    expect((await timeoutTests.test(51, 'timeout', input(`http://127.0.0.1:${(held.address() as AddressInfo).port}/mcp`))).ok).toBe(false)
const expireTests = new McpConnectionTests({ confirm: async () => true, persist, adopt: vi.fn(), timeoutMs: 5000, retentionMs: 100 })
    expect((await expireTests.test(51, 'expire', input(await startFixture()))).ok).toBe(true)
    await delay(150)
    expect((await expireTests.save(51, 'expire', [])).ok).toBe(false)
    expect(persist).not.toHaveBeenCalled()
  })

  it('保存中拒绝取消和重复提交，窗口销毁后保存失败会关闭测试连接', async () => {
    let rejectPersist!: (reason: Error) => void
    const tests = new McpConnectionTests({ confirm: async () => true, persist: () => new Promise<void>((_resolve, reject) => { rejectPersist = reject }), adopt: vi.fn() })
    expect((await tests.test(52, 'saving', input(await startFixture()))).ok).toBe(true)
    const saving = tests.save(52, 'saving', [])
    expect((await tests.cancel(52, 'saving')).ok).toBe(false)
    expect((await tests.save(52, 'saving', [])).ok).toBe(false)
    await tests.cancelOwner(52)
    rejectPersist(new Error('fixture failure'))
    expect(await saving).toMatchObject({ ok: false, error: '连接未保存，页面已关闭，测试连接已清理。' })
    expect((await tests.test(52, 'next', input(await startFixture()))).ok).toBe(true)
    await tests.cancelOwner(52)
  })

  it('持久化成功但接管失败重放同一已保存结果，不再次写盘', async () => {
    const persist = vi.fn(async () => {})
    const tests = new McpConnectionTests({ confirm: async () => true, persist, adopt: () => { throw new Error('fixture adoption failure') } })
    expect((await tests.test(53, 'adopt-failed', input(await startFixture()))).ok).toBe(true)
    const saved = await tests.save(53, 'adopt-failed', [])
    expect(saved).toMatchObject({ ok: false, savedServerId: expect.any(String) })
    expect(await tests.save(53, 'adopt-failed', [])).toEqual(saved)
    expect(persist).toHaveBeenCalledTimes(1)
  })
  it('保存响应重试返回原结果，不重复持久化或接管，跨窗口不能复用', async () => {
    const url = await startFixture()
    const persist = vi.fn(async () => {})
    const adopt = vi.fn((connection: TestedMcpConnection) => mcpManager.adoptTestedConnection(connection))
    const tests = new McpConnectionTests({ confirm: async () => true, persist, adopt })
    expect((await tests.test(40, 'replay', input(url))).ok).toBe(true)
    const saved = await tests.save(40, 'replay', [])
    expect(saved.ok).toBe(true)
    expect(await tests.save(40, 'replay', [])).toEqual(saved)
    expect((await tests.save(40, 'replay', ['search_docs'])).ok).toBe(false)
    expect((await tests.save(41, 'replay', [])).ok).toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(adopt).toHaveBeenCalledTimes(1)
  })

  it('接管成功后仍能列出并读取测试连接的真实资源', async () => {
    const url = await startFixture()
    const tests = new McpConnectionTests({ confirm: async () => true, persist: async () => {}, adopt: (connection) => mcpManager.adoptTestedConnection(connection) })
    expect((await tests.test(42, 'resources', input(url))).ok).toBe(true)
    const saved = await tests.save(42, 'resources', ['search_docs'])
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error('fixture save failed')
    expect(mcpManager.getAllResources()).toMatchObject([{ serverId: saved.serverId, uri: 'test://note' }])
    expect(await mcpManager.readResource(saved.serverId, 'test://note')).toBe('saved resource')
  })
  it('用户取消确认时不建立连接、不写配置、不接入生产', async () => {
    const persist = vi.fn()
    const adopt = vi.fn()
    const tests = new McpConnectionTests({ confirm: vi.fn(async () => false), persist, adopt, timeoutMs: 1000, retentionMs: 1000 })
    const result = await tests.test(11, 'cancel-before-connect', input('http://127.0.0.1:1/mcp'))
    expect(result).toEqual({ ok: false, error: '已取消连接测试。' })
    expect(persist).not.toHaveBeenCalled()
    expect(adopt).not.toHaveBeenCalled()
    expect(await tests.cancel(11, 'cancel-before-connect')).toEqual({ ok: true })
  })

  it('先真实发现工具，再校验白名单；保存失败保留结果，成功后接管同一连接', async () => {
    const url = await startFixture()
    let failPersist = true
    const persisted: McpServerConfig[] = []
    const adopted: TestedMcpConnection[] = []
    const tests = new McpConnectionTests({
      confirm: vi.fn(async () => true),
      persist: vi.fn(async (config) => { if (failPersist) { failPersist = false; throw new Error('fixture save failure') } persisted.push(config) }),
      adopt: (connection) => adopted.push(connection),
      timeoutMs: 3000,
      retentionMs: 5000,
    })
    const requestId = 'save-flow'
    const result = await tests.test(22, requestId, input(url))
    expect(result).toEqual({ ok: true, tools: [{ name: 'search_docs', description: '搜索文档' }] })
    expect(await tests.save(22, requestId, ['missing'])).toMatchObject({ ok: false, error: '工具选择无效，请重新选择。' })
    expect(await tests.save(22, requestId, [])).toMatchObject({ ok: false, error: '连接未保存，请重试；当前测试结果仍保留。' })
    expect(await tests.save(22, requestId, ['search_docs'])).toMatchObject({ ok: true })
    expect(persisted[0]).toMatchObject({ name: '文档服务', allowedTools: ['search_docs'] })
    expect(adopted).toHaveLength(1)
    expect(await adopted[0].client.callTool({ name: 'search_docs', arguments: {} })).toMatchObject({ content: [{ type: 'text', text: 'ok' }] })
    await adopted[0].client.close()
    await adopted[0].transport.close()
  })

  it('同一窗口不能并发第二个测试，会话归属取消只清理自己的连接', async () => {
    let resolveConfirm!: (value: boolean) => void
    const tests = new McpConnectionTests({ confirm: vi.fn(async () => new Promise<boolean>((resolve) => { resolveConfirm = resolve })), persist: vi.fn(), adopt: vi.fn(), timeoutMs: 1000, retentionMs: 1000 })
    const first = tests.test(31, 'first', input('http://127.0.0.1:1/mcp'))
    await expect(tests.test(31, 'second', input('http://127.0.0.1:1/mcp'))).resolves.toEqual({ ok: false, error: '请先取消当前连接测试。' })
    await tests.cancel(32, 'first')
    await expect(tests.test(31, 'second', input('http://127.0.0.1:1/mcp'))).resolves.toMatchObject({ ok: false, error: '请先取消当前连接测试。' })
    await tests.cancelOwner(31)
    resolveConfirm(false)
    await expect(first).resolves.toEqual({ ok: false, error: '连接测试已取消或超时，请重试。' })
  })
})
