/**
 * MCP → ToolRegistry 桥接层
 *
 * 将 MCP Server 发现的工具转换为 ToolDefinition 并注册到 ToolRegistry。
 * 使用 `mcp:server-id:tool-name` 命名空间避免冲突。
 */

import { ToolRegistry } from '../tools/registry'
import { mcpManager } from './client'
import type { McpTool } from './client'
import type { ToolDefinition } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'

const log = createLogger('MCPBridge')

const MCP_TOOL_PREFIX = 'mcp'

export function mcpToolFullName(serverId: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}:${serverId}:${toolName}`
}

export function isMcpTool(name: string): boolean {
  return name.startsWith(`${MCP_TOOL_PREFIX}:`)
}

export function parseMcpToolName(fullName: string): { serverId: string; toolName: string } | null {
  const parts = fullName.split(':')
  if (parts.length < 3 || parts[0] !== MCP_TOOL_PREFIX) return null
  return { serverId: parts[1], toolName: parts.slice(2).join(':') }
}

function mcpToolToDefinition(tool: McpTool): ToolDefinition {
  const fullName = mcpToolFullName(tool.serverId, tool.name)

  const schema = tool.inputSchema as {
    type?: string
    properties?: Record<string, any>
    required?: string[]
  }

  return {
    name: fullName,
    description: `[${tool.serverName}] ${tool.description}`,
    parameters: {
      type: 'object',
      properties: schema.properties ?? {},
      required: schema.required,
    },
    metadata: {
      isReadOnly: false,
      isDestructive: false,
      isConcurrencySafe: true,
    },
    execute: async (args: Record<string, unknown>) => {
      return mcpManager.callTool(tool.serverId, tool.name, args)
    },
  }
}

/**
 * 将某个 MCP Server 的全部工具同步到 ToolRegistry。
 * 已存在的 MCP 工具会先被移除再重新注册（处理工具列表变化的场景）。
 */
export function syncMcpToolsToRegistry(
  registry: ToolRegistry,
  serverId: string,
): number {
  const tools = mcpManager.getAllTools().filter(t => t.serverId === serverId)

  // 先移除该 server 的旧工具
  removeMcpToolsFromRegistry(registry, serverId)

  // 注册新工具
  let count = 0
  for (const tool of tools) {
    const def = mcpToolToDefinition(tool)
    try {
      registry.register(def)
      count++
      log.info(`MCP tool registered: ${def.name}`)
    } catch (err) {
      log.warn(`Failed to register MCP tool: ${def.name}`, { error: String(err) })
    }
  }

  return count
}

/**
 * 移除某个 MCP Server 注册的全部工具。
 */
export function removeMcpToolsFromRegistry(
  registry: ToolRegistry,
  serverId: string,
): void {
  const prefix = `${MCP_TOOL_PREFIX}:${serverId}:`
  const toRemove = registry.getAll().filter(t => t.name.startsWith(prefix))
  for (const tool of toRemove) {
    registry.unregister(tool.name)
  }
  if (toRemove.length > 0) {
    log.info(`Removed ${toRemove.length} MCP tools for server: ${serverId}`)
  }
}
