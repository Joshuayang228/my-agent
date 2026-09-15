import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { mcpManager } from '../../electron/main/mcp/client'
import type { McpServerConfig } from '../../src/shared/types'

const servers: Server[] = []

/**
 * 背景：不能以 transport 构造器替身证明正式连接支持新协议。
 * 设计意图：在回环地址运行真实 SDK 服务，记录认证、发现和执行请求。
 * 关键约束：只用测试令牌，不访问外部网络；每次请求的 SDK 实例和监听端口均清理。
 */
async function fixture(mode: 'normal' | 'unauthorized' | 'redirect' | 'empty' | 'broken-tools' = 'normal') {
  const authorization: Array<string | undefined> = []
  let calls = 0
  let redirects = 0
  const server = createServer(async (req, res) => {
    authorization.push(req.headers.authorization)
    if (req.url === '/redirected') { redirects++; res.writeHead(500).end(); return }
    if (mode === 'redirect') { res.writeHead(307, { Location: '/redirected' }).end(); return }
    if (mode === 'unauthorized') { res.writeHead(401).end(); return }
    if (req.method !== 'POST') { res.writeHead(405).end(); return }
    const mcp = new McpServer({ name: 'local-protocol-fixture', version: '1.0.0' })
    if (mode !== 'empty') {
      mcp.registerTool('ping', { description: '本地协议验证', inputSchema: {} }, async () => {
        calls++
        return { content: [{ type: 'text', text: 'pong' }] }
      })
    }
    mcp.registerResource('note', 'test://note', {}, async () => ({ contents: [{ uri: 'test://note', text: 'fixture note' }] }))
    if (mode === 'broken-tools') mcp.server.setRequestHandler(ListToolsRequestSchema, async () => { throw new Error('fixture inventory failure') })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => { void mcp.close() })
    try {
      await mcp.connect(transport)
      await transport.handleRequest(req, res)
    } catch {
      if (!res.headersSent) res.writeHead(500)
      res.end()
    }
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const config: McpServerConfig = {
    id: `http-${(server.address() as AddressInfo).port}`, name: '本地协议验证', enabled: true,
    transport: 'streamable-http', command: '', args: [],
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`, bearerToken: 'fixture-only-token',
  }
  return { config, authorization, calls: () => calls, redirects: () => redirects }
}

afterEach(async () => {
  await mcpManager.disconnectAll()
  vi.unstubAllEnvs()
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
    server.closeAllConnections()
  })))
})

describe('正式 MCP Manager 的 Streamable HTTP 协议', () => {
  it('旧 stdio 通过真实子进程继续可用，继承凭据过滤与显式 env 保留', async () => {
    vi.stubEnv('MY_AGENT_TEST_API_KEY', 'fixture-parent-only')
    const script = `
      import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
      import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
      const server = new McpServer({name:'stdio-fixture',version:'1.0.0'});
      server.registerTool('environment', {inputSchema:{}}, async () => ({content:[{type:'text',text:JSON.stringify({inherited:!!process.env.MY_AGENT_TEST_API_KEY, explicit:process.env.EXPLICIT_FIXTURE_TOKEN})}]}));
      await server.connect(new StdioServerTransport());
    `
    await mcpManager.connect({ id: 'stdio-fixture', name: '本地协议验证', enabled: true,
      command: process.execPath, args: ['--input-type=module', '-e', script], env: { EXPLICIT_FIXTURE_TOKEN: 'fixture-explicit' } })
    expect(JSON.parse(await mcpManager.callTool('stdio-fixture', 'environment', {}))).toEqual({ inherited: false, explicit: 'fixture-explicit' })
  })

  it('真实初始化、发现、调用和资源读取均携带 Bearer；工具禁用阻止执行', async () => {
    const service = await fixture()
    await mcpManager.connect(service.config)
    expect(mcpManager.isConnected(service.config.id)).toBe(true)
    expect(mcpManager.getAllTools()).toMatchObject([{ name: 'ping', serverId: service.config.id }])
    expect(await mcpManager.callTool(service.config.id, 'ping', {})).toBe('pong')
    expect(await mcpManager.readResource(service.config.id, 'test://note')).toBe('fixture note')
    mcpManager.setAllowedTools(service.config.id, [])
    await expect(mcpManager.callTool(service.config.id, 'ping', {})).rejects.toThrow('disabled')
    expect(service.calls()).toBe(1)
    expect(service.authorization.length).toBeGreaterThanOrEqual(5)
    expect(service.authorization.every((value) => value === 'Bearer fixture-only-token')).toBe(true)
    await mcpManager.disconnect(service.config.id)
    expect(mcpManager.getAllTools()).toEqual([])
    expect(mcpManager.isConnected(service.config.id)).toBe(false)
  })

  it('无需认证的服务不附加 Authorization', async () => {
    const service = await fixture()
    await mcpManager.connect({ ...service.config, bearerToken: undefined })
    expect(service.authorization.length).toBeGreaterThan(0)
    expect(service.authorization.every((value) => value === undefined)).toBe(true)
  })

  it('只提供资源而不声明工具能力的服务正常连接，工具数为零', async () => {
    const service = await fixture('empty')
    await mcpManager.connect(service.config)
    expect(mcpManager.getStatus()).toMatchObject([{ id: service.config.id, status: 'connected', toolCount: 0, resourceCount: 1 }])
    expect(await mcpManager.readResource(service.config.id, 'test://note')).toBe('fixture note')
  })

  it('已声明工具但清单读取失败时仍报错，不伪装成零工具成功', async () => {
    const service = await fixture('broken-tools')
    await expect(mcpManager.connect(service.config)).rejects.toThrow()
    expect(mcpManager.getStatus()).toMatchObject([{ id: service.config.id, status: 'error' }])
    expect(mcpManager.isConnected(service.config.id)).toBe(false)
  })

  it('401 返回失败且不报告连接成功或暴露令牌', async () => {
    const service = await fixture('unauthorized')
    await expect(mcpManager.connect(service.config)).rejects.toThrow()
    expect(mcpManager.isConnected(service.config.id)).toBe(false)
    expect(mcpManager.getAllTools()).toEqual([])
    expect(JSON.stringify(mcpManager.getStatus())).not.toContain('fixture-only-token')
  })

  it('真实 307 响应不会跟随重定向，即使目标同源', async () => {
    const service = await fixture('redirect')
    await expect(mcpManager.connect(service.config)).rejects.toThrow()
    expect(service.redirects()).toBe(0)
    expect(mcpManager.isConnected(service.config.id)).toBe(false)
  })
})
