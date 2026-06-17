/**
 * MCP Client Manager
 *
 * 管理多个 MCP Server 的连接生命周期：
 *   - 按配置启动 stdio 子进程连接
 *   - 从远端发现工具列表
 *   - 代理 callTool 请求
 *   - 优雅断开和重连
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

interface McpConnection {
  config: McpServerConfig
  client: Client
  transport: StdioClientTransport | SSEClientTransport
  tools: McpTool[]
  status: 'connecting' | 'connected' | 'error' | 'disconnected'
  error?: string
}

class McpClientManager {
  private connections = new Map<string, McpConnection>()

  async connect(config: McpServerConfig): Promise<void> {
    if (this.connections.has(config.id)) {
      await this.disconnect(config.id)
    }

    log.info(`Connecting to MCP server: ${config.name}`, {
      command: config.command,
      args: config.args,
    })

    const client = new Client(
      { name: 'my-agent', version: '0.1.0' },
      { capabilities: {} },
    )

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
      status: 'connecting',
    }
    this.connections.set(config.id, connection)

    try {
      await client.connect(transport)
      connection.status = 'connected'

      const toolsResult = await client.listTools()
      connection.tools = toolsResult.tools.map(t => ({
        serverId: config.id,
        serverName: config.name,
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema as Record<string, unknown>,
      }))

      log.info(`MCP server connected: ${config.name}`, {
        toolCount: connection.tools.length,
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

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return

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

  getStatus(): Array<{
    id: string
    name: string
    status: string
    toolCount: number
    error?: string
  }> {
    return Array.from(this.connections.values()).map(c => ({
      id: c.config.id,
      name: c.config.name,
      status: c.status,
      toolCount: c.tools.length,
      error: c.error,
    }))
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.status === 'connected'
  }
}

export const mcpManager = new McpClientManager()
