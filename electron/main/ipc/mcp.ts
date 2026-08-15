import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { ToolRegistry } from '../tools/registry'
import { mcpManager } from '../mcp/client'
import type { McpServerConfig } from '../mcp/client'
import { syncMcpToolsToRegistry, removeMcpToolsFromRegistry } from '../mcp/bridge'
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('McpIPC')

const ELICIT_TIMEOUT_MS = 120_000
const MAX_MCP_ID_LENGTH = 200
const MAX_MCP_NAME_LENGTH = 200
const MAX_MCP_COMMAND_LENGTH = 4_096
const MAX_MCP_ARG_LENGTH = 8_192
const MAX_MCP_ENV_ENTRIES = 100
const MAX_MCP_ENV_VALUE_LENGTH = 16_384

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isValidMcpConfig(value: unknown): value is McpServerConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Record<string, unknown>
  const transport = config.transport ?? 'stdio'
  if (!isBoundedString(config.id, MAX_MCP_ID_LENGTH)
    || !isBoundedString(config.name, MAX_MCP_NAME_LENGTH)
    || !Array.isArray(config.args)
    || config.args.length > 128
    || config.args.some((arg) => typeof arg !== 'string' || arg.length > MAX_MCP_ARG_LENGTH)
    || typeof config.enabled !== 'boolean'
    || (transport !== 'stdio' && transport !== 'sse')) return false
  if (transport === 'stdio' && !isBoundedString(config.command, MAX_MCP_COMMAND_LENGTH)) return false
  if (transport === 'sse') {
    if (!isBoundedString(config.url, 4_096)) return false
    try {
      const url = new URL(config.url)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    } catch {
      return false
    }
  }
  if (config.env !== undefined) {
    if (!config.env || typeof config.env !== 'object' || Array.isArray(config.env)) return false
    const entries = Object.entries(config.env)
    if (entries.length > MAX_MCP_ENV_ENTRIES) return false
    if (entries.some(([key, envValue]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
      || typeof envValue !== 'string' || envValue.length > MAX_MCP_ENV_VALUE_LENGTH)) return false
  }
  return true
}

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
    if (!isValidMcpConfig(config)) return { success: false, error: 'MCP 配置无效' }
    try {
      await mcpManager.connect(config)
      const count = syncMcpToolsToRegistry(toolRegistry, config.id)
      log.info('MCP server connected and tools registered', { nameHash: hashForLog(config.name), nameLength: config.name.length, toolCount: count })
      return { success: true, toolCount: count }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('MCP connect failed', { nameHash: hashForLog(config.name), nameLength: config.name.length, errorType: err instanceof Error ? err.name : 'unknown', errorLength: message.length })
      return { success: false, error: 'MCP 连接失败，请检查命令、参数或服务地址' }
    }
  })

  ipcMain.handle('mcp:disconnect', async (_event, serverId: string) => {
    if (!isBoundedString(serverId, MAX_MCP_ID_LENGTH)) return { success: false, error: 'MCP 服务 ID 无效' }
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
    if (!isBoundedString(serverId, MAX_MCP_ID_LENGTH) || !isBoundedString(uri, 16_384)) {
      return { success: false, error: 'MCP 资源参数无效' }
    }
    try {
      const content = await mcpManager.readResource(serverId, uri)
      return { success: true, content }
    } catch (err) {
      return { success: false, error: '读取 MCP 资源失败' }
    }
  })
}
