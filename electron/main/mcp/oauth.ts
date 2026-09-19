import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { McpServerConfig } from '../../../src/shared/types'
import { createOAuthFetch, resolveOAuthTarget, withOAuthAbort } from './oauth-network'

export class McpLoginRequiredError extends Error {
  constructor() { super('请登录此 MCP 服务。'); this.name = 'McpLoginRequiredError' }
}
export class McpOAuthRegistrationError extends Error {
  constructor() { super('此服务不支持自动注册，请填写服务提供的公共客户端 ID。'); this.name = 'McpOAuthRegistrationError' }
}
interface Session { key: string; provider: OAuthClientProvider; fetch: FetchLike; clear: () => void }
interface Attempt { owner: number; controller: AbortController }
export interface McpOAuthHost {
  openBrowser: (url: string, owner: number) => Promise<void>
  returnToApp: (owner: number) => void
}
const identity = (config: McpServerConfig) => JSON.stringify([config.id, config.url, config.oauth?.clientId ?? ''])

/**
 * 背景：首次 OAuth 登录只需在本次应用运行中接管连接，不实现跨重启账户系统。
 * 意图：SDK 完成协议，应用绑定窗口 / 配置身份并持有短期回调与内存令牌。
 * 约束：取消不得复活连接；只有主动 authorize 可开浏览器；refresh token 从不保留。
 */
export class McpOAuthSessions {
  private sessions = new Map<string, Session>()
  private attempts = new Map<string, Attempt>()

  get(config: McpServerConfig): Session | undefined {
    const session = this.sessions.get(config.id)
    return session?.key === identity(config) ? session : undefined
  }

  clear(id: string): void {
    this.attempts.get(id)?.controller.abort()
    this.attempts.delete(id)
    this.sessions.get(id)?.clear()
    this.sessions.delete(id)
  }

  cancelOwner(owner: number): void {
    for (const [id, attempt] of this.attempts) if (attempt.owner === owner) this.clear(id)
  }

  async authorize(config: McpServerConfig, owner: number, host: McpOAuthHost, signal?: AbortSignal, timeoutMs = 180_000): Promise<void> {
    if (!config.oauth || !config.url || config.transport !== 'streamable-http') throw new Error('OAuth config rejected')
    if (this.attempts.size >= 8 || [...this.attempts.values()].some(value => value.owner === owner) || this.attempts.has(config.id)) throw new Error('OAuth already pending')
    this.clear(config.id)
    const attempt = { owner, controller: new AbortController() }
    this.attempts.set(config.id, attempt)
    const active = AbortSignal.any([attempt.controller.signal, AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])])
    const serverUrl = config.url
    const state = randomBytes(32).toString('hex')
    let verifier = ''
    let token: OAuthTokens | undefined
    let expiresAt = 0
    let client: OAuthClientInformationMixed | undefined = config.oauth.clientId ? { client_id: config.oauth.clientId } : undefined
    let redirectUrl = ''
    let consumed = false
    let callbackResolve!: (code: string) => void
    let callbackReject!: (error: Error) => void
    const callback = new Promise<string>((resolve, reject) => { callbackResolve = resolve; callbackReject = reject })
    // 拒绝可能早于 SDK 结束发现；提前附加处理，真正 await 仍会收到原始拒绝。
    void callback.catch(() => undefined)
    const server = createServer({ maxHeaderSize: 8192 }, (request, response) => {
      response.setHeader('Content-Type', 'text/plain; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Referrer-Policy', 'no-referrer')
      response.setHeader('Content-Security-Policy', "default-src 'none'")
      if (active.aborted || consumed || request.method !== 'GET' || (request.url?.length ?? 0) > 8192 || request.headers.host !== new URL(redirectUrl).host) { response.writeHead(400).end('无效的登录回调。'); return }
      let url: URL
      try { url = new URL(request.url ?? '/', redirectUrl) }
      catch { response.writeHead(400).end('无效的登录回调。'); return }
      const params = url.searchParams
      if (url.origin !== new URL(redirectUrl).origin || url.pathname !== '/oauth/callback' || params.getAll('state').length !== 1 || params.get('state') !== state
        || params.getAll('code').length > 1 || params.getAll('error').length > 1 || Boolean(params.get('code')) === Boolean(params.get('error'))) { response.writeHead(400).end('无效的登录回调。'); return }
      consumed = true
      if (params.has('error')) { response.writeHead(200).end('授权未完成，请返回应用重试。'); callbackReject(new Error('OAuth denied')); return }
      const code = params.get('code')!
      response.writeHead(200).end('已收到授权，请返回应用查看连接结果。')
      callbackResolve(code)
    })
    server.requestTimeout = 5000
    server.headersTimeout = 5000
    server.keepAliveTimeout = 1000
    server.maxConnections = 16
    const onAbort = () => callbackReject(new Error('OAuth cancelled'))
    active.addEventListener('abort', onAbort, { once: true })
    try {
      active.throwIfAborted()
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
      active.throwIfAborted()
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('OAuth listener unavailable')
      redirectUrl = `http://127.0.0.1:${address.port}/oauth/callback`
      const provider: OAuthClientProvider = {
        redirectUrl,
        clientMetadata: { client_name: 'My Agent', redirect_uris: [redirectUrl], grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none' },
        state: () => state,
        clientInformation: () => client,
        saveClientInformation: value => { active.throwIfAborted(); client = value },
        tokens: () => token,
        saveTokens: value => {
          active.throwIfAborted()
          if (!value.access_token || value.access_token.length > 16_384 || value.token_type.toLowerCase() !== 'bearer') throw new Error('OAuth token rejected')
          token = { access_token: value.access_token, token_type: value.token_type, expires_in: value.expires_in, scope: value.scope }
          expiresAt = value.expires_in === undefined ? Infinity : Date.now() + value.expires_in * 1000
        },
        saveCodeVerifier: value => { verifier = value },
        codeVerifier: () => verifier,
        redirectToAuthorization: async url => {
          await withOAuthAbort(resolveOAuthTarget(url, serverUrl), active)
          active.throwIfAborted()
          await withOAuthAbort(host.openBrowser(url.href, owner), active)
          active.throwIfAborted()
        },
        invalidateCredentials: () => { token = undefined },
      }
      const fetchFn = createOAuthFetch(config.url, active)
      const result = await auth(provider, { serverUrl: config.url, fetchFn })
      if (result === 'REDIRECT') {
        const code = await callback
        active.throwIfAborted()
        if (await auth(provider, { serverUrl: config.url, authorizationCode: code, fetchFn }) !== 'AUTHORIZED') throw new Error('OAuth not authorized')
      }
      active.throwIfAborted()
      if (!token || this.attempts.get(config.id) !== attempt) throw new Error('OAuth result expired')
      verifier = ''
      // 生产传输只消费现有令牌；401、过期或后台请求绝不触发 SDK 的交互 / 刷新流程。
      const requireToken = () => {
        if (!token || Date.now() >= expiresAt) { token = undefined; throw new McpLoginRequiredError() }
        return token
      }
      const runtimeProvider: OAuthClientProvider = {
        ...provider, tokens: requireToken, saveTokens: () => { throw new McpLoginRequiredError() },
        redirectToAuthorization: () => { throw new McpLoginRequiredError() },
        saveCodeVerifier: () => { throw new McpLoginRequiredError() }, codeVerifier: () => { throw new McpLoginRequiredError() },
      }
      const runtimeController = new AbortController()
      const runtimeFetch = createOAuthFetch(serverUrl, runtimeController.signal, true)
      this.sessions.set(config.id, {
        key: identity(config), provider: runtimeProvider, clear: () => { token = undefined; client = undefined; runtimeController.abort() },
        fetch: async (url, init) => {
          requireToken()
          if (new URL(url).href !== new URL(serverUrl).href) throw new McpLoginRequiredError()
          const response = await runtimeFetch(url, init)
          if (response.status === 401) { token = undefined; await response.body?.cancel(); throw new McpLoginRequiredError() }
          return response
        },
      })
      host.returnToApp(owner)
    } catch (error) {
      token = undefined
      client = undefined
      if (this.attempts.get(config.id) === attempt) this.sessions.delete(config.id)
      if (error instanceof Error && error.message === 'Incompatible auth server: does not support dynamic client registration') throw new McpOAuthRegistrationError()
      throw error
    } finally {
      verifier = ''
      active.removeEventListener('abort', onAbort)
      if (this.attempts.get(config.id) === attempt) this.attempts.delete(config.id)
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  }
}

export const mcpOAuthSessions = new McpOAuthSessions()
