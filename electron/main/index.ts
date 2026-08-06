import { app, BrowserWindow, shell, Tray, Menu, globalShortcut, nativeImage, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config } from 'dotenv'
import { ToolRegistry } from './tools/registry'
import { builtinTools } from './tools/builtins/index'
import { createLogger } from './utils/logger'
import { mark } from './utils/tracer'
import { closeDatabase } from './storage/database'
import { registerAllIPC } from './ipc/index'
import { mcpManager } from './mcp/client'
import type { McpServerConfig } from './mcp/client'
import { syncMcpToolsToRegistry } from './mcp/bridge'
import { initSkillSystem } from './skills/registry'
import { runtime } from './agent/runtime'
import * as settings from './storage/settings-store'
import { initScheduler, shutdownScheduler } from './scheduler/index'

const log = createLogger('Main')
mark('imports_done')

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
let tray: Tray | null = null
let windowReady = false
const preload = path.join(__dirname, 'index.cjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')
const STARTUP_BACKGROUND_COLOR = '#f7f6f2'

async function createWindow() {
  windowReady = false
  win = new BrowserWindow({
    title: 'My Agent',
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    autoHideMenuBar: true,
    // 首帧完成前隐藏窗口，避免 Chromium/Electron 默认白底闪现。
    show: false,
    backgroundColor: STARTUP_BACKGROUND_COLOR,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      // 默认 sandbox=true；preload 已打成 CJS，与沙箱兼容
    },
  })

  const currentWindow = win
  currentWindow.once('ready-to-show', () => {
    if (currentWindow.isDestroyed() || win !== currentWindow) return
    windowReady = true
    currentWindow.show()
    mark('window_shown')
    if (VITE_DEV_SERVER_URL) currentWindow.webContents.openDevTools()
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
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
mark('tools_ready')

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

// ── System Tray ──

function createTrayIcon(): nativeImage {
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size)
    const inset = x >= 2 && x < 14 && y >= 2 && y < 14
    canvas[i * 4] = inset ? 0x06 : 0x00     // R
    canvas[i * 4 + 1] = inset ? 0xb6 : 0x00 // G
    canvas[i * 4 + 2] = inset ? 0xd4 : 0x00 // B
    canvas[i * 4 + 3] = inset ? 0xff : 0x00  // A
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

function createTray() {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('My Agent')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => showWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => showWindow())
}

function showWindow() {
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }
  if (!windowReady) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

let isQuitting = false

// ── Auto Update ──

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    log.info('Update available', { version: info.version })
    win?.webContents.send('updater:available', { version: info.version, releaseNotes: info.releaseNotes })
  })

  autoUpdater.on('update-not-available', () => {
    log.debug('No update available')
  })

  autoUpdater.on('download-progress', (progress) => {
    win?.webContents.send('updater:progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded', { version: info.version })
    win?.webContents.send('updater:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    log.warn('Auto-update error', { error: err.message })
  })

  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { available: !!result?.updateInfo, version: result?.updateInfo?.version }
    } catch {
      return { available: false }
    }
  })

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    isQuitting = true
    autoUpdater.quitAndInstall()
  })
}

// ── App 生命周期 ──

app.whenReady().then(async () => {
  await createWindow()
  createTray()
  setupAutoUpdater()

  globalShortcut.register('CommandOrControl+Shift+A', () => showWindow())
  log.info('Global shortcut registered: Ctrl+Shift+A')

  win!.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  initSkillSystem(toolRegistry).catch(err => log.warn('Skill init failed', { error: String(err) }))
  restoreMcpConnections().then(() => mark('mcp_ready'))
  initScheduler().catch(err => log.warn('Scheduler init failed', { error: String(err) }))

  // 加载持久审批记录（sandbox approval-store）
  const { loadPersistentApprovals } = await import('./sandbox/approval-store')
  loadPersistentApprovals().catch(err => log.warn('Persistent approvals load failed', { error: String(err) }))

  // 自定义权限规则 → permission-engine 第一层（settings.permissionRules JSON）
  try {
    const { loadRules } = await import('./sandbox/permission-engine')
    const rulesJson = await settings.getSetting('permissionRules')
    loadRules(rulesJson || '[]')
  } catch (err) {
    log.warn('Permission rules load failed', { error: String(err) })
  }

  // M11：恢复上次崩溃中断的后台任务（从 SQLite background_tasks 表重载 pending 状态）
  const { taskQueue } = await import('./services/task-queue')
  taskQueue.recoverPendingTasks().catch(err => log.warn('Task recovery failed', { error: String(err) }))

  // W2：活跃主角生活世界 tick（非活跃不推进）
  const { startLifeTicker } = await import('./companion/life/ticker')
  startLifeTicker()

  if (!VITE_DEV_SERVER_URL) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000)
  }
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', async () => {
  globalShortcut.unregisterAll()
  shutdownScheduler()
  const { stopLifeTicker } = await import('./companion/life/ticker')
  stopLifeTicker()
  await runtime.shutdown()
  await mcpManager.disconnectAll().catch(() => {})
  closeDatabase()
})

app.on('window-all-closed', () => {
  // 有 Tray 时不退出，只在 macOS 以外 + 真正退出时 quit
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})

app.on('second-instance', () => {
  showWindow()
})

app.on('activate', () => {
  showWindow()
})
