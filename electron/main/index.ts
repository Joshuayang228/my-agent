import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config } from 'dotenv'
import { ToolRegistry } from './tools/registry'
import { builtinTools } from './tools/builtins/index'
import { createLogger } from './utils/logger'
import { closeDatabase } from './storage/database'
import { registerAllIPC } from './ipc/index'
import { mcpManager } from './mcp/client'
import type { McpServerConfig } from './mcp/client'
import { syncMcpToolsToRegistry } from './mcp/bridge'
import { initSkillSystem } from './skills/registry'
import { runtime } from './agent/runtime'
import * as settings from './storage/settings-store'

const log = createLogger('Main')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

config({ path: path.join(process.env.APP_ROOT, '.env') })

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (VITE_DEV_SERVER_URL) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
  log.info('Remote debugging enabled on port 9222')
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, 'index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'My Agent',
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── 工具注册 ──

const toolRegistry = new ToolRegistry()
for (const tool of builtinTools) {
  toolRegistry.register(tool)
  log.info(`Tool registered: ${tool.name}`)
}

// 注入 registry 给 delegate_task 工具（子 Agent 需要访问父注册表）
const delegateTool = toolRegistry.get('delegate_task')
if (delegateTool) {
  (delegateTool as unknown as Record<string, unknown>)._registry = toolRegistry
}

// ── IPC 注册 ──

registerAllIPC(toolRegistry)

// ── 启动时恢复 MCP 连接 ──

async function restoreMcpConnections() {
  try {
    const json = await settings.getSetting('mcpServers')
    const configs: McpServerConfig[] = JSON.parse(json || '[]')
    for (const config of configs) {
      if (!config.enabled) continue
      try {
        await mcpManager.connect(config)
        syncMcpToolsToRegistry(toolRegistry, config.id)
        log.info(`MCP server restored: ${config.name}`)
      } catch (err) {
        log.warn(`Failed to restore MCP server: ${config.name}`, { error: String(err) })
      }
    }
  } catch (err) {
    log.warn('Failed to restore MCP connections', { error: String(err) })
  }
}

// ── App 生命周期 ──

app.whenReady().then(async () => {
  await createWindow()
  initSkillSystem(toolRegistry).catch(err => log.warn('Skill init failed', { error: String(err) }))
  restoreMcpConnections()
})

app.on('window-all-closed', async () => {
  win = null
  await runtime.shutdown()
  await mcpManager.disconnectAll().catch(() => {})
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
