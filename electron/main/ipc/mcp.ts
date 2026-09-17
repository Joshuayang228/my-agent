import { ipcMain, BrowserWindow, dialog } from 'electron'
import { randomUUID } from 'node:crypto'
import { ToolRegistry } from '../tools/registry'
import { mcpManager } from '../mcp/client'
import type { McpServerConfig } from '../mcp/client'
import { hydrateMcpConfigSecrets, parseStoredMcpConfigs, MAX_MCP_SERVERS } from '../mcp/config-security'
import * as settings from '../storage/settings-store'
import { syncMcpToolsToRegistry, removeMcpToolsFromRegistry } from '../mcp/bridge'
import { createLogger, hashForLog } from '../utils/logger'
import { McpConnectionTests } from '../mcp/connection-tests'
import { withMcpConfigLock } from '../mcp/config-lock'

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

async function confirmMcpConnection(config: McpServerConfig, owner?: number): Promise<boolean> {
  const win = owner === undefined ? BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    : BrowserWindow.getAllWindows().find((window) => window.webContents.id === owner)
  if (!win) return false
  const target = (config.transport ?? 'stdio') !== 'stdio'
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

function broadcastMcpStatus(snapshot: ReturnType<typeof mcpManager.getStatus>): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('mcp:status-changed', snapshot)
  }
}

export function registerMcpIPC(toolRegistry: ToolRegistry): void {
  mcpManager.setStatusListener((snapshot) => {
    for (const server of snapshot) {
      if (server.status === 'connected') syncMcpToolsToRegistry(toolRegistry, server.id)
      else if (server.status === 'error' || server.status === 'disconnected') removeMcpToolsFromRegistry(toolRegistry, server.id)
    }
    broadcastMcpStatus(snapshot)
  })
  const connectionTests = new McpConnectionTests({
    confirm: confirmMcpConnection,
    persist: async (config) => withMcpConfigLock(async () => {
      const current = parseStoredMcpConfigs(await settings.getSetting('mcpServers'))
      if (current.length >= MAX_MCP_SERVERS || current.some((item) => item.id === config.id)) throw new Error('MCP 服务数量超限或 ID 已存在')
      await settings.setSetting('mcpServers', JSON.stringify([...current, config]))
    }),
    adopt: (connection) => {
      mcpManager.adoptTestedConnection(connection)
      syncMcpToolsToRegistry(toolRegistry, connection.config.id)
    },
  })

  const observedOwners = new WeakSet<Electron.WebContents>()
  ipcMain.handle('mcp:test-connection', async (event, requestId: string, config: unknown) => {
    const owner = event.sender.id
    if (!observedOwners.has(event.sender)) {
      observedOwners.add(event.sender)
      event.sender.once('destroyed', () => { void connectionTests.cancelOwner(owner) })
      event.sender.on('render-process-gone', () => { void connectionTests.cancelOwner(owner) })
      event.sender.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => {
        if (isMainFrame && !inPlace) void connectionTests.cancelOwner(owner)
      })
    }
    return connectionTests.test(owner, requestId, config)
  })
  ipcMain.handle('mcp:cancel-test', async (event, requestId: string) =>
    connectionTests.cancel(event.sender.id, requestId))
  ipcMain.handle('mcp:save-tested', async (event, requestId: string, allowedTools: unknown) =>
    connectionTests.save(event.sender.id, requestId, allowedTools))
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
    const tools = mcpManager.getAllTools().map((tool) => ({ ...tool, allowed: mcpManager.isToolAllowed(tool.serverId, tool.name) }))
    if (serverId) return tools.filter(t => t.serverId === serverId)
    return tools
  })

  ipcMain.handle('mcp:set-tool-allowed', async (_event, serverId: string, toolName: string, allowed: boolean) => {
    if (!isBoundedString(serverId, MAX_MCP_ID_LENGTH) || !isBoundedString(toolName, MAX_MCP_ID_LENGTH) || typeof allowed !== 'boolean') {
      return { success: false, error: 'MCP 工具参数无效' }
    }
    return withMcpConfigLock(async () => {
      const configs = parseStoredMcpConfigs(await settings.getSetting('mcpServers'))
      const config = configs.find((item) => item.id === serverId)
      if (!config || !mcpManager.isConnected(serverId)) return { success: false, error: 'MCP 服务尚未连接' }
      const knownTools = mcpManager.getAllTools().filter((tool) => tool.serverId === serverId).map((tool) => tool.name)
      if (!knownTools.includes(toolName)) return { success: false, error: 'MCP 工具不存在' }
      const current = config.allowedTools ?? knownTools
      const next = allowed ? [...new Set([...current, toolName])] : current.filter((name) => name !== toolName)
      const updated = configs.map((item) => item.id === serverId ? { ...item, allowedTools: next } : item)
      try { await settings.setSetting('mcpServers', JSON.stringify(updated)) }
      catch { return { success: false, error: '工具许可未保存，请重试。' } }
      mcpManager.setAllowedTools(serverId, next)
      syncMcpToolsToRegistry(toolRegistry, serverId)
      return { success: true, allowed }
    })
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
