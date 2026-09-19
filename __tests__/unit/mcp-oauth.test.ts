import { afterEach, describe, expect, it, vi } from 'vitest'
import { startMcpOAuthFixture } from '../fixtures/mcp-oauth-server'
import { McpOAuthSessions, mcpOAuthSessions, McpLoginRequiredError, McpOAuthRegistrationError } from '../../electron/main/mcp/oauth'
import { createOAuthFetch, resolveOAuthTarget } from '../../electron/main/mcp/oauth-network'
import { createMcpClient, mcpManager } from '../../electron/main/mcp/client'
import { createMcpTransport } from '../../electron/main/mcp/transport'
import { McpConnectionTests } from '../../electron/main/mcp/connection-tests'
import type { McpServerConfig } from '../../src/shared/types'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { await mcpManager.disconnectAll(); mcpOAuthSessions.clear('oauth'); for (const cleanup of cleanups.splice(0)) await cleanup() })
const configFor = (url: string): McpServerConfig => ({ id: 'oauth', name: 'OAuth 笔记', command: '', args: [], transport: 'streamable-http', enabled: true, url, oauth: {}, allowedTools: ['read_note'] })
async function fixture() { const result = await startMcpOAuthFixture(); cleanups.push(result.close); return result }

describe('MCP 首次浏览器登录', () => {
  it('真实 PKCE 登录、一次回调、工具发现和调用；配置无凭据且不保留 refresh token', async () => {
    const server = await fixture()
    const config = configFor(server.url)
    let callback = ''
    server.stats.tokenDelayMs = 50
    const returnToApp = vi.fn()
    await mcpOAuthSessions.authorize(config, 1, { returnToApp, openBrowser: async url => {
      callback = await server.consentCallback(url)
      const wrong = new URL(callback); wrong.searchParams.set('state', 'wrong')
      expect((await fetch(wrong)).status).toBe(400)
      expect(server.stats.tokenRequests).toBe(0)
      const duplicate = new URL(callback); duplicate.searchParams.append('code', 'another')
      expect((await fetch(duplicate)).status).toBe(400)
      expect((await fetch(callback, { method: 'POST' })).status).toBe(400)
      expect((await fetch(callback)).status).toBe(200)
      expect((await fetch(callback)).status).toBe(400)
    } })
    expect(returnToApp).toHaveBeenCalledWith(1)
    expect(await mcpOAuthSessions.get(config)!.provider.tokens()).not.toHaveProperty('refresh_token')
    expect(JSON.stringify(config)).not.toContain(server.accessToken)
    const client = createMcpClient()
    await client.connect(createMcpTransport(config))
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['read_note'])
    expect(await client.callTool({ name: 'read_note', arguments: {} })).toMatchObject({ content: [{ text: 'OAuth note verified' }] })
    server.stats.rejectedTokens = true
    await expect(client.listTools()).rejects.toBeInstanceOf(McpLoginRequiredError)
    expect(server.stats.tokenRequests).toBe(1)
    await client.close()
    await expect(fetch(callback)).rejects.toThrow()
  })

  it('测试连接保存后才接管并按用户许可执行，取消未保存会话清理授权', async () => {
    const server = await fixture()
    const persisted: McpServerConfig[] = []
    const tests = new McpConnectionTests({ confirm: async () => true,
      authorize: (config, owner, signal) => mcpOAuthSessions.authorize(config, owner, { returnToApp: () => {}, openBrowser: async url => { await fetch(await server.consentCallback(url)) } }, signal),
      persist: async config => { persisted.push(config) }, adopt: connection => mcpManager.adoptTestedConnection(connection) })
    const input = configFor(server.url)
    expect(await tests.test(1, 'first', input)).toMatchObject({ ok: true, tools: [{ name: 'read_note' }] })
    expect(persisted).toHaveLength(0)
    const saved = await tests.save(1, 'first', [])
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error(saved.error)
    await expect(mcpManager.callTool(saved.serverId, 'read_note', {})).rejects.toThrow('disabled')
    expect(persisted[0].oauth).toEqual({})
    expect(JSON.stringify(persisted)).not.toContain(server.accessToken)
    mcpManager.setAllowedTools(saved.serverId, ['read_note'])
    expect(await mcpManager.callTool(saved.serverId, 'read_note', {})).toBe('OAuth note verified')
    await mcpManager.disconnect(saved.serverId)
    expect(mcpOAuthSessions.get(persisted[0])).toBeUndefined()
  })

  it.each(['cancel', 'owner', 'timeout', 'denied'] as const)('%s 不写入授权会话或保留回调监听', async mode => {
    const server = await fixture()
    const sessions = new McpOAuthSessions()
    const controller = new AbortController()
    let callback = ''
    const returned = vi.fn()
    await expect(sessions.authorize(configFor(server.url), 7, { returnToApp: returned, openBrowser: async url => {
      callback = await server.consentCallback(url, mode === 'denied')
      if (mode === 'cancel') controller.abort()
      if (mode === 'owner') sessions.cancelOwner(7)
      if (mode === 'denied') await fetch(callback)
    } }, controller.signal, mode === 'timeout' ? 150 : 5000)).rejects.toThrow()
    expect(sessions.get(configFor(server.url))).toBeUndefined()
    expect(returned).not.toHaveBeenCalled()
    expect(server.stats.tokenRequests).toBe(0)
    if (callback) await expect(fetch(callback)).rejects.toThrow()
  })

  it('授权元数据不能将本机同源许可扩展到其他端口；远程不能发现私网', async () => {
    const server = await fixture()
    server.stats.maliciousMetadata = true
    const openBrowser = vi.fn()
    await expect(new McpOAuthSessions().authorize(configFor(server.url), 1, { openBrowser, returnToApp: () => {} })).rejects.toThrow()
    expect(openBrowser).not.toHaveBeenCalled()
    for (const url of ['http://example.com', 'https://127.0.0.1', 'https://10.1.2.3', 'https://[::ffff:127.0.0.1]', 'https://[::1]', 'file:///test', 'https://user:pass@example.com']) {
      await expect(resolveOAuthTarget(url, 'https://example.com/mcp')).rejects.toThrow()
    }
    await expect(createOAuthFetch(server.url, AbortSignal.abort())(`${server.origin}/token`)).rejects.toThrow()
  })

  it('不支持自动注册时明确失败；可显式使用公共客户端 ID，过期后只要求登录', async () => {
    const server = await fixture()
    server.stats.dcrUnsupported = true
    const host = { openBrowser: vi.fn(async (url: string) => { await fetch(await server.consentCallback(url)) }), returnToApp: () => {} }
    await expect(mcpOAuthSessions.authorize(configFor(server.url), 1, host)).rejects.toBeInstanceOf(McpOAuthRegistrationError)
    expect(host.openBrowser).not.toHaveBeenCalled()
    const config = { ...configFor(server.url), oauth: { clientId: 'fixture-public' } }
    await mcpOAuthSessions.authorize(config, 1, host)
    expect(mcpOAuthSessions.get({ ...config, url: `${server.origin}/other` })).toBeUndefined()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_600_001)
    try { expect(() => mcpOAuthSessions.get(config)!.provider.tokens()).toThrow(McpLoginRequiredError) }
    finally { clock.mockRestore() }
    expect(host.openBrowser).toHaveBeenCalledTimes(1)
  })

  it('拒绝重定向和超限响应，localhost 经校验地址完成请求', async () => {
    const server = await fixture()
    const local = server.url.replace('127.0.0.1', 'localhost')
    const fetchFn = createOAuthFetch(local, new AbortController().signal)
    expect((await fetchFn(local.replace('/mcp', '/.well-known/oauth-authorization-server'))).status).toBe(200)
    for (const path of ['redirect', 'oversized']) await expect(fetchFn(local.replace('/mcp', `/${path}`))).rejects.toThrow()
  })

  it('浏览器启动器无响应时，取消仍能结束等待并清理监听', async () => {
    const server = await fixture()
    const controller = new AbortController()
    const sessions = new McpOAuthSessions()
    let callback = ''
    await expect(sessions.authorize(configFor(server.url), 1, { returnToApp: () => {}, openBrowser: async url => {
      callback = new URL(url).searchParams.get('redirect_uri')!
      controller.abort()
      await new Promise<void>(() => {})
    } }, controller.signal)).rejects.toThrow()
    await expect(fetch(callback)).rejects.toThrow()
    expect(sessions.get(configFor(server.url))).toBeUndefined()
  })
})
