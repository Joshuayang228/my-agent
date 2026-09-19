import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

/** 本地真实 OAuth / MCP 协议服务，不冒充第三方账户互操作。 */
export async function startMcpOAuthFixture() {
  const clients = new Map<string, string[]>()
  const codes = new Map<string, { challenge: string; redirect: string; client: string }>()
  const consent = new Map<string, URLSearchParams>()
  const accessToken = randomBytes(24).toString('hex')
  const stats = { tokenRequests: 0, toolCalls: 0, rejectedTokens: false, tokenDelayMs: 0, maliciousMetadata: false, dcrUnsupported: false }
  let origin = ''
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', origin)
    const json = (status: number, body: unknown) => response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
    try {
      if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
        json(200, { resource: `${origin}/mcp`, authorization_servers: [stats.maliciousMetadata ? 'http://127.0.0.1:1' : origin], scopes_supported: ['tools'] }); return
      }
      if (url.pathname === '/.well-known/oauth-authorization-server') {
        json(200, { issuer: origin, authorization_endpoint: `${origin}/authorize`, token_endpoint: `${origin}/token`, registration_endpoint: stats.dcrUnsupported ? undefined : `${origin}/register`, response_types_supported: ['code'], grant_types_supported: ['authorization_code'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'] }); return
      }
      if (url.pathname === '/register' && request.method === 'POST') {
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = JSON.parse(Buffer.concat(chunks).toString())
        const clientId = randomBytes(12).toString('hex')
        clients.set(clientId, body.redirect_uris)
        json(201, { ...body, client_id: clientId }); return
      }
      if (url.pathname === '/authorize') {
        const params = url.searchParams
        const staticClient = params.get('client_id') === 'fixture-public' && /^http:\/\/127\.0\.0\.1:\d+\/oauth\/callback$/.test(params.get('redirect_uri') ?? '')
        if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !params.get('state')
          || !staticClient && !clients.get(params.get('client_id') ?? '')?.includes(params.get('redirect_uri') ?? '')) { json(400, { error: 'invalid_request' }); return }
        const id = randomBytes(12).toString('hex')
        consent.set(id, params)
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<form action="/approve"><input type="hidden" name="id" value="${id}"><button type="submit">授权</button><button name="deny" value="1">拒绝</button></form>`); return
      }
      if (url.pathname === '/approve') {
        const params = consent.get(url.searchParams.get('id') ?? '')
        consent.delete(url.searchParams.get('id') ?? '')
        if (!params) { json(400, { error: 'invalid_request' }); return }
        const redirect = params.get('redirect_uri')!
        const callback = new URL(redirect)
        callback.searchParams.set('state', params.get('state')!)
        if (url.searchParams.has('deny')) callback.searchParams.set('error', 'access_denied')
        else {
          const code = randomBytes(24).toString('hex')
          codes.set(code, { challenge: params.get('code_challenge')!, redirect, client: params.get('client_id')! })
          callback.searchParams.set('code', code)
        }
        response.writeHead(302, { Location: callback.href }).end(); return
      }
      if (url.pathname === '/token') {
        stats.tokenRequests++
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = new URLSearchParams(Buffer.concat(chunks).toString())
        const code = body.get('code') ?? ''
        const saved = codes.get(code)
        codes.delete(code)
        const challenge = createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url')
        if (!saved || body.get('grant_type') !== 'authorization_code' || body.get('redirect_uri') !== saved.redirect || body.get('client_id') !== saved.client || challenge !== saved.challenge) { json(400, { error: 'invalid_grant' }); return }
        if (stats.tokenDelayMs) await new Promise(resolve => setTimeout(resolve, stats.tokenDelayMs))
        json(200, { access_token: accessToken, token_type: 'Bearer', expires_in: 3600, refresh_token: 'fixture-refresh-must-not-be-kept' }); return
      }
      if (url.pathname === '/mcp') {
        if (stats.rejectedTokens || request.headers.authorization !== `Bearer ${accessToken}`) { response.writeHead(401, { 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"` }).end(); return }
        if (request.method !== 'POST') { response.writeHead(405).end(); return }
        const mcp = new McpServer({ name: 'oauth-fixture', version: '1.0.0' })
        mcp.registerTool('read_note', { description: '读取笔记', inputSchema: {} }, async () => { stats.toolCalls++; return { content: [{ type: 'text', text: 'OAuth note verified' }] } })
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
        response.on('close', () => { void mcp.close() })
        await mcp.connect(transport)
        await transport.handleRequest(request, response)
        return
      }
      if (url.pathname === '/redirect') { response.writeHead(302, { Location: `${origin}/token` }).end(); return }
      if (url.pathname === '/oversized') { response.writeHead(200).end('x'.repeat(1024 * 1024 + 1)); return }
      json(404, {})
    } catch { if (!response.headersSent) json(500, { error: 'fixture_error' }); else response.end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture unavailable')
  origin = `http://127.0.0.1:${address.port}`
  return {
    origin, url: `${origin}/mcp`, stats, accessToken,
    async consentCallback(url: string, deny = false) {
      const response = await fetch(url)
      const html = await response.text()
      const id = html.match(/name="id" value="([a-f0-9]+)"/)?.[1]
      if (!id) throw new Error('Fixture authorization rejected')
      const approved = await fetch(`${origin}/approve?id=${id}${deny ? '&deny=1' : ''}`, { redirect: 'manual' })
      return approved.headers.get('location')!
    },
    close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }),
  }
}
