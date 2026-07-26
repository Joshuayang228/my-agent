import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { ToolRegistry } from '../tools/registry'
import { mcpManager } from '../mcp/client'
import type { McpServerConfig } from '../mcp/client'
import { syncMcpToolsToRegistry, removeMcpToolsFromRegistry } from '../mcp/bridge'
import { createLogger } from '../utils/logger'

const log = createLogger('McpIPC')

const ELICIT_TIMEOUT_MS = 120_000

export function registerMcpIPC(toolRegistry: ToolRegistry): void {
  // Elicitation：服务端要输入 → 推到渲染进程，等用户填表
  mcpManager.setElicitationHandler(async (serverId, message, schema) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return null
    const requestId = `elicit-${randomUUID()}`
    const channel = `mcp:elicit-response:${requestId}`

    return new Promise((resolve) => {
      let settled = false
      const finish = (values: Record<string, unknown> | null) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        ipcMain.removeListener(channel, onResponse)
        resolve(values)
      }
      function onResponse(_e: Electron.IpcMainEvent, values: Record<string, unknown> | null) {
        finish(values)
      }
      ipcMain.once(channel, onResponse)
      win.webContents.send('mcp:elicit-request', { requestId, serverId, message, schema })
      const timer = setTimeout(() => {
        log.warn('MCP elicitation timed out', { requestId, serverId })
        finish(null)
      }, ELICIT_TIMEOUT_MS)
    })
  })

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

  ipcMain.handle('mcp:list-resources', (_event, serverId?: string) => {
    const resources = mcpManager.getAllResources()
    if (serverId) return resources.filter(r => r.serverId === serverId)
    return resources
  })

  ipcMain.handle('mcp:read-resource', async (_event, serverId: string, uri: string) => {
    try {
      const content = await mcpManager.readResource(serverId, uri)
      return { success: true, content }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
