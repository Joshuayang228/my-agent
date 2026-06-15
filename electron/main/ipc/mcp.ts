import { ipcMain } from 'electron'
import { ToolRegistry } from '../tools/registry'
import { mcpManager } from '../mcp/client'
import type { McpServerConfig } from '../mcp/client'
import { syncMcpToolsToRegistry, removeMcpToolsFromRegistry } from '../mcp/bridge'
import { createLogger } from '../utils/logger'

const log = createLogger('McpIPC')

export function registerMcpIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('mcp:connect', async (_event, config: McpServerConfig) => {
    try {
      await mcpManager.connect(config)
      const count = syncMcpToolsToRegistry(toolRegistry, config.id)
      log.info(`MCP server connected and ${count} tools registered: ${config.name}`)
      return { success: true, toolCount: count }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`MCP connect failed: ${config.name}`, { error: message })
      return { success: false, error: message }
    }
  })

  ipcMain.handle('mcp:disconnect', async (_event, serverId: string) => {
    removeMcpToolsFromRegistry(toolRegistry, serverId)
    await mcpManager.disconnect(serverId)
    return { success: true }
  })

  ipcMain.handle('mcp:status', () => {
    return mcpManager.getStatus()
  })

  ipcMain.handle('mcp:list-tools', (_event, serverId?: string) => {
    const tools = mcpManager.getAllTools()
    if (serverId) return tools.filter(t => t.serverId === serverId)
    return tools
  })
}
