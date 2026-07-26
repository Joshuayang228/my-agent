/**
 * MCP Client Manager
 *
 * 管理多个 MCP Server 的连接生命周期：
 *   - 按配置启动 stdio / SSE 连接
 *   - 从远端发现工具与资源
 *   - 代理 callTool / readResource
 *   - transport close 后指数退避重连（M13）
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { createLogger } from '../utils/logger'

const log = createLogger('MCP')

export type McpTransportType = 'stdio' | 'sse'

export interface McpServerConfig {
  /** 唯一标识（自动生成或用户指定） */
  id: string
  /** 显示名称 */
  name: string
  /** 传输类型（默认 stdio） */
  transport?: McpTransportType
  /** stdio: 启动命令（如 npx, node, python3） */
  command: string
  /** stdio: 命令参数 */
  args: string[]
  /** stdio: 环境变量（可选，会合并到 process.env） */
  env?: Record<string, string>
  /** sse: 服务器 URL（如 http://localhost:3000/sse） */
  url?: string
  /** 是否启用 */
  enabled: boolean
}

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

interface McpConnection {
  config: McpServerConfig
  client: Client
  transport: StdioClientTransport | SSEClientTransport
  tools: McpTool[]
  resources: McpResource[]
  status: 'connecting' | 'connected' | 'error' | 'disconnected'
  error?: string
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

class McpClientManager {
  private connections = new Map<string, McpConnection>()
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

  async connect(config: McpServerConfig): Promise<void> {
    if (this.connections.has(config.id)) {
      await this.disconnect(config.id)
    }

    log.info(`Connecting to MCP server: ${config.name}`, {
      command: config.command,
      args: config.args,
      transport: config.transport || 'stdio',
    })

    const client = new Client(
      { name: 'my-agent', version: '0.1.0' },
      {
        capabilities: {
          // M13 Elicitation：声明支持 form 模式，服务端可向用户要补充信息
          elicitation: {},
        },
      },
    )

    // 注册 elicitation 请求处理（SDK 用 setRequestHandler；失败则仅日志）
    try {
      const { ElicitRequestSchema } = await import('@modelcontextprotocol/sdk/types.js')
      client.setRequestHandler(ElicitRequestSchema, async (request) => {
        const params = request.params as {
          message?: string
          requestedSchema?: Record<string, unknown>
        }
        const message = params.message ?? 'MCP server requests input'
        const schema = params.requestedSchema ?? { type: 'object', properties: {} }
        if (!this.elicitationHandler) {
          log.warn('Elicitation requested but no handler registered', { serverId: config.id })
          return { action: 'cancel' as const }
        }
        const values = await this.elicitationHandler(config.id, message, schema)
        if (!values) return { action: 'cancel' as const }
        return { action: 'accept' as const, content: values }
      })
    } catch (err) {
      log.debug('Elicitation handler setup skipped', { error: String(err) })
    }

    const transportType = config.transport || 'stdio'
    let transport: StdioClientTransport | SSEClientTransport

    if (transportType === 'sse' && config.url) {
      log.info(`Using SSE transport: ${config.url}`)
      transport = new SSEClientTransport(new URL(config.url))
    } else {
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
      })
    }

    const connection: McpConnection = {
      config,
      client,
      transport,
      tools: [],
      resources: [],
      status: 'connecting',
      reconnectAttempts: 0,
      allowReconnect: true,
    }
    this.connections.set(config.id, connection)

    this.wireTransportClose(connection)

    try {
      await client.connect(transport)
      connection.status = 'connected'
      connection.reconnectAttempts = 0
      await this.refreshInventory(connection)
      log.info(`MCP server connected: ${config.name}`, {
        toolCount: connection.tools.length,
        resourceCount: connection.resources.length,
        tools: connection.tools.map(t => t.name),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      connection.status = 'error'
      connection.error = message
      log.error(`MCP server connection failed: ${config.name}`, { error: message })
      throw err
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
      if (!connection.allowReconnect) return
      if (connection.status === 'disconnected') return
      log.warn(`MCP transport closed: ${connection.config.name}`)
      connection.status = 'disconnected'
      this.scheduleReconnect(connection.config.id)
    }
    const prevErr = transport.onerror
    transport.onerror = (err: Error) => {
      try { prevErr?.(err) } catch { /* ignore */ }
      log.warn(`MCP transport error: ${connection.config.name}`, { error: String(err) })
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
    const attempts = conn.reconnectAttempts
    conn.allowReconnect = false
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = undefined
    }
    try { await conn.client.close() } catch { /* ignore */ }
    this.connections.delete(serverId)

    try {
      await this.connect(config)
    } catch (err) {
      log.warn(`MCP reconnect failed: ${config.name}`, { error: String(err) })
      const fresh = this.connections.get(serverId)
      if (fresh) {
        fresh.reconnectAttempts = attempts
        fresh.allowReconnect = true
        this.scheduleReconnect(serverId)
      }
    }
  }

  private async refreshInventory(connection: McpConnection): Promise<void> {
    const toolsResult = await connection.client.listTools()
    connection.tools = toolsResult.tools.map(t => ({
      serverId: connection.config.id,
      serverName: connection.config.name,
      name: t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema as Record<string, unknown>,
    }))

    try {
      const res = await connection.client.listResources()
      connection.resources = (res.resources ?? []).map(r => ({
        serverId: connection.config.id,
        serverName: connection.config.name,
        uri: r.uri,
        name: r.name ?? r.uri,
        description: r.description,
        mimeType: r.mimeType,
      }))
    } catch (err) {
      // 服务端可不支持 resources
      connection.resources = []
      log.debug(`MCP listResources unavailable: ${connection.config.name}`, { error: String(err) })
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return

    conn.allowReconnect = false
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer)
      conn.reconnectTimer = undefined
    }

    try {
      await conn.client.close()
    } catch (err) {
      log.warn(`Error closing MCP client: ${conn.config.name}`, { error: String(err) })
    }

    conn.status = 'disconnected'
    this.connections.delete(serverId)
    log.info(`MCP server disconnected: ${conn.config.name}`)
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys())
    await Promise.allSettled(ids.map(id => this.disconnect(id)))
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    if (conn.status !== 'connected') throw new Error(`MCP server not ready: ${conn.config.name} (${conn.status})`)

    log.info(`MCP callTool: ${conn.config.name}/${toolName}`, { args })

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
          conn.status = 'disconnected'
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

  getStatus(): Array<{
    id: string
    name: string
    status: string
    toolCount: number
    resourceCount: number
    error?: string
  }> {
    return Array.from(this.connections.values()).map(c => ({
      id: c.config.id,
      name: c.config.name,
      status: c.status,
      toolCount: c.tools.length,
      resourceCount: c.resources.length,
      error: c.error,
    }))
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.status === 'connected'
  }
}

export const mcpManager = new McpClientManager()
