/**
 * MCP Client Manager
 *
 * 管理多个 MCP Server 的连接生命周期：
 *   - 按配置启动 stdio / SSE / Streamable HTTP 连接
 *   - 从远端发现工具与资源
 *   - 代理 callTool / readResource
 *   - transport close 后指数退避重连（M13）
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { McpRuntimeStatus, McpServerConfig, McpServerStatus } from '../../../src/shared/types'
import { createMcpTransport } from './transport'
import { createLogger, hashForLog } from '../utils/logger'
import { McpLoginRequiredError, mcpOAuthSessions } from './oauth'

const log = createLogger('MCP')

export type { McpServerConfig, McpTransportType } from '../../../src/shared/types'

export interface McpTool {
  serverId: string
  serverName: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpResource {
  serverId: string
  serverName: string
  uri: string
  name: string
  description?: string
  mimeType?: string
}

/**
 * 背景：测试连接会原样移交生产，初始化后不能重新协商缺失能力。
 * 设计意图：测试和正式连接共用客户端能力，测试阶段明确取消补充信息请求。
 * 关键约束：只声明 form；只有保存接管后才绑定真实 UI，不支持 URL 登录请求。
 */
export function createMcpClient(): Client {
  const client = new Client({ name: 'my-agent', version: '0.1.0' }, { capabilities: { elicitation: { form: {} } } })
  client.setRequestHandler(ElicitRequestSchema, async () => ({ action: 'cancel' as const }))
  return client
}

interface McpConnection {
  config: McpServerConfig
  client: Client
  transport: Transport
  tools: McpTool[]
  resources: McpResource[]
  status: McpRuntimeStatus
  error?: string
  reconnecting: boolean
  reconnectAttempts: number
  reconnectTimer?: ReturnType<typeof setTimeout>
  /** 用户主动断开时禁止自动重连 */
  allowReconnect: boolean
}

/** 指数退避毫秒（可测）：attempt 从 0 起，上限 60s */
export function mcpReconnectDelayMs(attempt: number): number {
  const base = 1000 * Math.pow(2, Math.max(0, attempt))
  return Math.min(base, 60_000)
}

export const MCP_UNEXPECTED_DISCONNECT = '服务意外断开，正在尝试重新连接。'

class McpClientManager {
  private connections = new Map<string, McpConnection>()

  /** 已通过风险确认的隔离连接在持久化后接管；不重启服务，不允许覆盖现有连接。 */
  adoptTestedConnection(input: { config: McpServerConfig; client: Client; transport: Transport; tools: McpTool[]; resources: McpResource[] }): void {
    if (this.connections.has(input.config.id)) throw new Error('MCP connection already exists')
    this.bindElicitation(input.client, input.config.id)
    input.client.onclose = undefined
    const connection: McpConnection = { ...input, status: 'connected', reconnecting: false, reconnectAttempts: 0, allowReconnect: true }
    this.connections.set(input.config.id, connection)
    this.wireTransportClose(connection)
    this.emitStatus()
  }

  private statusListener?: (snapshot: McpServerStatus[]) => void

  setStatusListener(listener?: (snapshot: McpServerStatus[]) => void): void {
    this.statusListener = listener
  }

  private emitStatus(): void {
    this.statusListener?.(this.getStatus())
  }
  /** Elicitation：服务端向客户端要输入时的回调（UI/IPC 注入） */
  private elicitationHandler?: (
    serverId: string,
    message: string,
    schema: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>

  setElicitationHandler(
    handler: (
      serverId: string,
      message: string,
      schema: Record<string, unknown>,
    ) => Promise<Record<string, unknown> | null>,
  ): void {
    this.elicitationHandler = handler
  }

  private bindElicitation(client: Client, serverId: string): void {
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      if (request.params.mode === 'url' || !this.elicitationHandler) return { action: 'cancel' as const }
      const values = await this.elicitationHandler(serverId, request.params.message, request.params.requestedSchema)
      return values ? { action: 'accept' as const, content: values } : { action: 'cancel' as const }
    })
  }

  /**
   * 连接或替换 MCP 服务时，不从状态快照中删除该服务。
   *
   * 背景：设置页把快照里缺失的服务映射成未连接；自动重连若先删除行，意外断开就会短暂显示成安静的未连接。
   * 设计意图：就地关闭旧客户端，再为同一 id 发布 connecting / error。放弃先删除再 connect 的做法。
   * 关键约束：只有 disconnect() 才允许移除快照行；preserveReconnect 必须保持可重试的意外断开错误。
   */
  async connect(config: McpServerConfig, options?: { preserveReconnect?: boolean; signal?: AbortSignal }): Promise<void> {
    const existing = this.connections.get(config.id)
    const preserveReconnect = Boolean(options?.preserveReconnect && existing)
    const preservedAttempts = preserveReconnect ? existing!.reconnectAttempts : 0

    log.info('Connecting to MCP server', {
      nameHash: hashForLog(config.name),
      nameLength: config.name.length,
      commandHash: hashForLog(config.command),
      commandLength: config.command.length,
      argCount: config.args.length,
      transport: config.transport || 'stdio',
    })

    const client = createMcpClient()
    this.bindElicitation(client, config.id)
    const transport = createMcpTransport(config)

    if (existing) {
      existing.allowReconnect = false
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer)
        existing.reconnectTimer = undefined
      }
    }

    const connection: McpConnection = {
      config,
      client,
      transport,
      tools: [],
      resources: [],
      status: preserveReconnect ? 'error' : 'connecting',
      error: preserveReconnect ? MCP_UNEXPECTED_DISCONNECT : undefined,
      reconnecting: preserveReconnect,
      reconnectAttempts: preservedAttempts,
      allowReconnect: true,
    }
    this.connections.set(config.id, connection)
    this.emitStatus()

    this.wireTransportClose(connection)

    try {
      // 背景：替换期间可能收到停止或另一次重试；先占有连接槽而非等 close 后占有，且每次异步返回必须核对身份，避免迟到流程复活连接。
      if (existing) await existing.client.close()
      options?.signal?.throwIfAborted()
      this.assertCurrentConnection(connection)
      await client.connect(transport, { signal: options?.signal })
      options?.signal?.throwIfAborted()
      this.assertCurrentConnection(connection)
      await this.refreshInventory(connection, options?.signal)
      options?.signal?.throwIfAborted()
      this.assertCurrentConnection(connection)
      if (connection.reconnectTimer) throw new Error('MCP connection closed during discovery')
      connection.status = 'connected'
      connection.error = undefined
      connection.reconnecting = false
      connection.reconnectAttempts = 0
      this.emitStatus()
      log.info('MCP server connected', {
        nameHash: hashForLog(config.name),
        nameLength: config.name.length,
        toolCount: connection.tools.length,
        resourceCount: connection.resources.length,
        tools: connection.tools.map(t => t.name),
      })
    } catch (err) {
      if (this.connections.get(config.id) !== connection || !connection.allowReconnect) {
        await client.close()
        throw err
      }
      const message = err instanceof Error ? err.message : String(err)
      const loginRequired = err instanceof McpLoginRequiredError
      connection.status = loginRequired ? 'auth' : 'error'
      connection.error = loginRequired ? '请重新登录此服务。' : preserveReconnect ? MCP_UNEXPECTED_DISCONNECT : '连接失败，请检查 MCP 配置或服务状态'
      connection.reconnecting = preserveReconnect && !loginRequired
      if (loginRequired || options?.signal?.aborted) {
        connection.allowReconnect = false
        if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer)
        connection.reconnectTimer = undefined
        await client.close()
      }
      this.emitStatus()
      if (connection.reconnecting) this.scheduleReconnect(config.id)
      log.error('MCP server connection failed', { nameHash: hashForLog(config.name), nameLength: config.name.length, errorType: err instanceof Error ? err.name : 'unknown', errorLength: message.length })
      throw err
    }
  }

  private assertCurrentConnection(connection: McpConnection): void {
    if (this.connections.get(connection.config.id) !== connection || !connection.allowReconnect) {
      throw new Error('MCP connection was cancelled or replaced')
    }
  }

  private wireTransportClose(connection: McpConnection): void {
    const transport = connection.transport as {
      onclose?: (() => void) | null
      onerror?: ((err: Error) => void) | null
    }
    const prevClose = transport.onclose
    transport.onclose = () => {
      try { prevClose?.() } catch { /* ignore */ }
      if (!connection.allowReconnect || this.connections.get(connection.config.id) !== connection) return
      if (connection.status === 'disconnected') return
      log.warn('MCP transport closed', { nameHash: hashForLog(connection.config.name), nameLength: connection.config.name.length })
      connection.status = 'error'
      connection.error = MCP_UNEXPECTED_DISCONNECT
      connection.reconnecting = true
      this.emitStatus()
      this.scheduleReconnect(connection.config.id)
    }
    const prevErr = transport.onerror
    transport.onerror = (err: Error) => {
      try { prevErr?.(err) } catch { /* ignore */ }
      log.warn('MCP transport error', { nameHash: hashForLog(connection.config.name), nameLength: connection.config.name.length, errorType: err.name, errorLength: err.message.length })
      if (err instanceof McpLoginRequiredError && this.connections.get(connection.config.id) === connection) {
        connection.status = 'auth'
        connection.error = '请重新登录此服务。'
        connection.allowReconnect = false
        connection.reconnecting = false
        if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer)
        connection.reconnectTimer = undefined
        this.emitStatus()
      }
    }
  }

  private scheduleReconnect(serverId: string): void {
    const conn = this.connections.get(serverId)
    if (!conn || !conn.allowReconnect) return
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer)

    const delay = mcpReconnectDelayMs(conn.reconnectAttempts)
    conn.reconnectAttempts += 1
    log.info(`MCP reconnect scheduled in ${delay}ms`, {
      serverId,
      attempt: conn.reconnectAttempts,
    })

    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = undefined
      void this.reconnect(serverId)
    }, delay)
  }

  private async reconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn || !conn.allowReconnect) return
    const config = { ...conn.config }
    conn.allowReconnect = false
    conn.reconnecting = true
    conn.status = 'error'
    conn.error = MCP_UNEXPECTED_DISCONNECT
    this.emitStatus()
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = undefined
    }
    try {
      await this.connect(config, { preserveReconnect: true })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      log.warn('MCP reconnect failed', { nameHash: hashForLog(config.name), nameLength: config.name.length, errorType: err instanceof Error ? err.name : 'unknown', errorLength: errorMessage.length })
    }
  }

  private async refreshInventory(connection: McpConnection, signal?: AbortSignal): Promise<void> {
    // 资源专用服务可以不声明 tools；仅在未声明时视为零工具，已声明后的发现失败仍上抛。
    const toolsResult = connection.client.getServerCapabilities()?.tools
      ? await connection.client.listTools(undefined, { signal })
      : { tools: [] }
    connection.tools = toolsResult.tools.map(t => ({
      serverId: connection.config.id,
      serverName: connection.config.name,
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema as Record<string, unknown>,
    }))

    try {
      const res = await connection.client.listResources(undefined, { signal })
      connection.resources = (res.resources ?? []).map(r => ({
        serverId: connection.config.id,
        serverName: connection.config.name,
        uri: r.uri,
        name: r.name ?? r.uri,
        description: r.description,
        mimeType: r.mimeType,
      }))
    } catch (err) {
      if (signal?.aborted || err instanceof McpLoginRequiredError) throw err
      // 服务端可不支持 resources
      connection.resources = []
      const errorMessage = err instanceof Error ? err.message : String(err)
      log.debug('MCP listResources unavailable', { nameHash: hashForLog(connection.config.name), nameLength: connection.config.name.length, errorType: err instanceof Error ? err.name : 'unknown', errorLength: errorMessage.length })
    }
  }

  async disconnect(serverId: string): Promise<void> {
    mcpOAuthSessions.clear(serverId)
    const conn = this.connections.get(serverId)
    if (!conn) return

    conn.allowReconnect = false
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = undefined
    }

    conn.status = 'disconnected'
    conn.reconnecting = false
    this.connections.delete(serverId)
    this.emitStatus()

    try {
      await conn.client.close()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      log.warn('Error closing MCP client', { nameHash: hashForLog(conn.config.name), nameLength: conn.config.name.length, errorType: err instanceof Error ? err.name : 'unknown', errorLength: errorMessage.length })
    }

    log.info('MCP server disconnected', { nameHash: hashForLog(conn.config.name), nameLength: conn.config.name.length })
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys())
    await Promise.allSettled(ids.map(id => this.disconnect(id)))
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    if (conn.status !== 'connected') throw new Error(`MCP server not ready: ${conn.config.name} (${conn.status})`)
    if (conn.config.allowedTools && !conn.config.allowedTools.includes(toolName)) {
      throw new Error('MCP tool is disabled by user')
    }

    log.info('MCP callTool', { serverId, toolName, argKeys: Object.keys(args).slice(0, 32) })

    try {
      const result = await conn.client.callTool({ name: toolName, arguments: args })

      if (result.isError) {
        const errorText = Array.isArray(result.content)
          ? result.content.map((c: any) => c.text ?? JSON.stringify(c)).join('\n')
          : String(result.content)
        throw new Error(errorText)
      }

      if (Array.isArray(result.content)) {
        return result.content
          .map((c: any) => {
            if (c.type === 'text') return c.text
            if (c.type === 'image') return `[image: ${c.mimeType}]`
            return JSON.stringify(c)
          })
          .join('\n')
      }

      return String(result.content ?? '')
    } catch (err) {
      // 调用失败且连接可能已断 → 触发重连
      if (conn.allowReconnect && conn.status === 'connected') {
        const msg = err instanceof Error ? err.message : String(err)
        if (/closed|disconnect|ECONNRESET|not connected/i.test(msg)) {
          conn.status = 'error'
          conn.error = MCP_UNEXPECTED_DISCONNECT
          conn.reconnecting = true
          this.emitStatus()
          this.scheduleReconnect(serverId)
        }
      }
      throw err
    }
  }

  getAllTools(): McpTool[] {
    const tools: McpTool[] = []
    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') {
        tools.push(...conn.tools)
      }
    }
    return tools
  }

  isToolAllowed(serverId: string, toolName: string): boolean {
    const config = this.connections.get(serverId)?.config
    return !config?.allowedTools || config.allowedTools.includes(toolName)
  }

  setAllowedTools(serverId: string, allowedTools: string[]): boolean {
    const connection = this.connections.get(serverId)
    if (!connection) return false
    connection.config = { ...connection.config, allowedTools: [...new Set(allowedTools)] }
    return true
  }

  getAllResources(): McpResource[] {
    const resources: McpResource[] = []
    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') {
        resources.push(...conn.resources)
      }
    }
    return resources
  }

  async readResource(serverId: string, uri: string): Promise<string> {
    const conn = this.connections.get(serverId)
    if (!conn || conn.status !== 'connected') {
      throw new Error(`MCP server not ready: ${serverId}`)
    }
    const result = await conn.client.readResource({ uri })
    const contents = result.contents ?? []
    return contents
      .map((c: { text?: string; blob?: string; uri?: string }) => c.text ?? c.blob ?? JSON.stringify(c))
      .join('\n')
  }

  getStatus(): McpServerStatus[] {
    return Array.from(this.connections.values()).map(c => ({
      id: c.config.id,
      name: c.config.name,
      status: c.status,
      toolCount: c.tools.length,
      resourceCount: c.resources.length,
      error: c.error,
      reconnecting: c.reconnecting,
    }))
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.status === 'connected'
  }
}

export const mcpManager = new McpClientManager()
