import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config } from 'dotenv'
import { agentLoop } from './agent/loop'
import { ToolRegistry } from './tools/registry'
import { builtinTools } from './tools/builtins/index'
import { createLogger } from './utils/logger'
import { closeDatabase } from './storage/database'
import * as store from './storage/session-store'
import * as settings from './storage/settings-store'
import * as memory from './storage/memory-store'
import { buildSystemPrompt, BUILTIN_PERSONAS } from './agent/prompt-builder'
import { maybeExtractProfile } from './agent/profile-extractor'
import type { ChatMessage, LLMConfig } from '../../src/shared/types'

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

async function getLLMConfig(): Promise<LLMConfig> {
  const s = await settings.getAllSettings()
  return {
    apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
    baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
  }
}

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

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
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

// ── 工具注册 ──

const toolRegistry = new ToolRegistry()
for (const tool of builtinTools) {
  toolRegistry.register(tool)
  log.info(`Tool registered: ${tool.name}`)
}

// ── IPC：会话管理 ──

ipcMain.handle('session:list', async () => store.listSessions())

ipcMain.handle('session:create', async () => store.createSession())

ipcMain.handle('session:get', async (_event, sessionId: string) =>
  store.getSession(sessionId))

ipcMain.handle('session:delete', async (_event, sessionId: string) =>
  store.deleteSession(sessionId))

ipcMain.handle('session:rename', async (_event, sessionId: string, title: string) =>
  store.updateSessionTitle(sessionId, title))

// ── IPC：记忆 ──

ipcMain.handle('memory:list', async (_event, category?: string) =>
  memory.listMemories(category as memory.MemoryCategory | undefined))

ipcMain.handle('memory:add', async (_event, category: string, content: string) =>
  memory.addMemory(category as memory.MemoryCategory, content))

ipcMain.handle('memory:delete', async (_event, id: string) =>
  memory.deleteMemory(id))

ipcMain.handle('memory:update', async (_event, id: string, content: string) =>
  memory.updateMemory(id, content))

// ── IPC：设置 ──

ipcMain.handle('settings:get', async () => settings.getAllSettings())

ipcMain.handle('settings:set', async (_event, key: string, value: string) =>
  settings.setSetting(key as keyof settings.AppSettings, value))

// ── IPC：人格 ──

ipcMain.handle('persona:list', () =>
  BUILTIN_PERSONAS.map(p => ({ id: p.id, name: p.name, description: p.description })))

ipcMain.handle('persona:get-current', async () => {
  const id = await settings.getSetting('personaId')
  return BUILTIN_PERSONAS.find(p => p.id === id) ?? BUILTIN_PERSONAS[0]
})

// ── IPC：聊天 ──

ipcMain.handle('ping', () => 'pong')

let activeAbortController: AbortController | null = null

ipcMain.handle('chat:abort', () => {
  if (activeAbortController) {
    log.info('Chat aborted by user')
    activeAbortController.abort()
    activeAbortController = null
  }
})

ipcMain.handle('chat:send', async (event, sessionId: string, messages: ChatMessage[]) => {
  const llmConfig = await getLLMConfig()
  const personaId = await settings.getSetting('personaId')
  const customPrompt = await settings.getSetting('systemPrompt')
  const memoryContext = await memory.buildMemoryContext()
  const userProfile = await memory.buildUserProfile()

  const persona = BUILTIN_PERSONAS.find(p => p.id === personaId) ?? BUILTIN_PERSONAS[0]
  log.info('chat:send received', { sessionId, messageCount: messages.length, model: llmConfig.model, persona: persona.id })

  if (!llmConfig.apiKey) {
    log.error('No API key configured')
    event.sender.send('chat:event', { type: 'error', message: '请先在设置中配置 API Key' })
    event.sender.send('chat:event', { type: 'done' })
    return
  }

  const abortController = new AbortController()
  activeAbortController = abortController

  // 保存用户消息（最后一条）
  const lastUserMsg = messages[messages.length - 1]
  if (lastUserMsg?.role === 'user') {
    await store.saveMessage(sessionId, lastUserMsg)
  }

  // 自动标题（第一条用户消息时）
  await store.autoTitle(sessionId)

  let assistantContent = ''
  let assistantSaved = false

  try {
    const confirmTool = (name: string, args: Record<string, unknown>): Promise<boolean> => {
      return new Promise((resolve) => {
        const requestId = `confirm-${Date.now()}`
        event.sender.send('tool:confirm-request', { requestId, name, args })
        ipcMain.once(`tool:confirm-response:${requestId}`, (_e, approved: boolean) => {
          resolve(approved)
        })
        setTimeout(() => resolve(false), 60_000)
      })
    }

    // 分层组装 System Prompt（L1 人格 → L2 能力 → L3 上下文 → L4 动态）
    const systemPrompt = buildSystemPrompt({
      persona,
      toolNames: toolRegistry.getAll().map(t => t.name),
      userProfile: userProfile ?? undefined,
      memories: memoryContext || undefined,
      sessionInfo: customPrompt || undefined,
    })

    const stream = agentLoop(
      {
        config: llmConfig,
        messages,
        tools: toolRegistry.getAll(),
        confirmTool,
        systemPrompt,
        signal: abortController.signal,
      },
      toolRegistry,
    )

    for await (const ev of stream) {
      event.sender.send('chat:event', ev)

      if (ev.type === 'text') {
        assistantContent += ev.content
      }
      if (ev.type === 'done' && assistantContent && !assistantSaved) {
        assistantSaved = true
        await store.saveMessage(sessionId, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        })

        maybeExtractProfile(messages, llmConfig).catch((e) =>
          log.warn('Profile extraction failed', { error: String(e) }))
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (abortController.signal.aborted) {
      log.info('Chat send aborted', { assistantContentLength: assistantContent.length })
    } else {
      log.error('chat:send unhandled error', { error: message })
      event.sender.send('chat:event', { type: 'error', message })
    }
  } finally {
    activeAbortController = null

    // 兜底保存（被中断时正常流程未触发 done 保存）
    if (assistantContent && !assistantSaved) {
      assistantSaved = true
      await store.saveMessage(sessionId, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      }).catch(() => {})
    }
    // 兜底：确保 UI 总能收到 done 事件恢复输入状态
    event.sender.send('chat:event', { type: 'done' })
  }
})
