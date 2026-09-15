import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpConnectionTests, type TestedMcpConnection } from '../../electron/main/mcp/connection-tests'
import type { McpConnectionInput, McpServerConfig } from '../../src/shared/types'

const servers: Server[] = []

async function startFixture() {
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST') { response.writeHead(405).end(); return }
    const mcp = new McpServer({ name: 'connection-test-fixture', version: '1.0.0' })
    mcp.registerTool('search_docs', { description: '搜索文档', inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'ok' }] }))
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
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  })))
})

function input(url: string): McpConnectionInput {
  return { name: '文档服务', transport: 'streamable-http', command: '', args: [], url }
}

describe('MCP 添加连接测试会话', () => {
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
    await expect(first).resolves.toEqual({ ok: false, error: '已取消连接测试。' })
  })
})
