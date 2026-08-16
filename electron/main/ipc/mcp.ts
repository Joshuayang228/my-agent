import { ipcMain, BrowserWindow, dialog } from 'electron'
import { randomUUID } from 'node:crypto'
import { ToolRegistry } from '../tools/registry'
import { mcpManager } from '../mcp/client'
import type { McpServerConfig } from '../mcp/client'
import { hydrateMcpConfigSecrets, parseStoredMcpConfigs } from '../mcp/config-security'
import * as settings from '../storage/settings-store'
import { syncMcpToolsToRegistry, removeMcpToolsFromRegistry } from '../mcp/bridge'
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('McpIPC')

const ELICIT_TIMEOUT_MS = 120_000
const MAX_MCP_ID_LENGTH = 200
const MAX_ELICIT_MESSAGE_LENGTH = 20_000
const MAX_ELICIT_SCHEMA_BYTES = 1024 * 1024
const MAX_ELICIT_RESPONSE_BYTES = 1024 * 1024

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

export { isValidMcpConfig } from '../mcp/config-security'

async function confirmMcpConnection(config: McpServerConfig): Promise<boolean> {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (!win) return false
  const target = (config.transport ?? 'stdio') === 'sse'
    ? `远程地址：${config.url}`
    : `启动命令：${config.command} ${config.args.join(' ')}`
  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    title: '确认连接 MCP 服务',
    message: `是否连接 MCP 服务“${config.name}”？`,
    detail: `${target}

MCP 服务可能访问网络、文件或启动本地进程。仅连接你信任的配置。`,
    buttons: ['取消', '连接'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  return result.response === 1
}

export function registerMcpIPC(toolRegistry: ToolRegistry): void {
  // Elicitation：服务端要输入 → 推到渲染进程，等用户填表
  mcpManager.setElicitationHandler(async (serverId, message, schema) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return null
    let schemaBytes = 0
    try { schemaBytes = Buffer.byteLength(JSON.stringify(schema), 'utf-8') } catch { return null }
    if (message.length > MAX_ELICIT_MESSAGE_LENGTH || schemaBytes > MAX_ELICIT_SCHEMA_BYTES) {
      log.warn('MCP elicitation payload rejected', { serverId, messageLength: message.length, schemaBytes })
      return null
    }
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
      function onResponse(event: Electron.IpcMainEvent, values: Record<string, unknown> | null) {
        if (event.sender !== win.webContents) return
        if (values !== null && (!values || typeof values !== 'object' || Array.isArray(values))) return finish(null)
        if (values !== null) {
          try {
            if (Buffer.byteLength(JSON.stringify(values), 'utf-8') > MAX_ELICIT_RESPONSE_BYTES) return finish(null)
          } catch { return finish(null) }
        }
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
    const storedConfigs = parseStoredMcpConfigs(await settings.getSetting('mcpServers'))
    const hydratedConfig = hydrateMcpConfigSecrets(config, storedConfigs)
    if (!hydratedConfig) return { success: false, error: 'MCP 配置无效或凭据已失效' }
    if (!await confirmMcpConnection(hydratedConfig)) return { success: false, error: '用户取消连接' }
    try {
      await mcpManager.connect(hydratedConfig)
      const count = syncMcpToolsToRegistry(toolRegistry, hydratedConfig.id)
      log.info('MCP server connected and tools registered', { nameHash: hashForLog(hydratedConfig.name), nameLength: hydratedConfig.name.length, toolCount: count })
      return { success: true, toolCount: count }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('MCP connect failed', { nameHash: hashForLog(hydratedConfig.name), nameLength: hydratedConfig.name.length, errorType: err instanceof Error ? err.name : 'unknown', errorLength: message.length })
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
