import { ipcMain } from 'electron'
import * as store from '../storage/session-store'
import * as settings from '../storage/settings-store'
import { createLogger } from '../utils/logger'

const log = createLogger('SessionIPC')

export function registerSessionIPC(): void {
  ipcMain.handle('session:list', async () => store.listSessions())

  ipcMain.handle('session:create', async () => store.createSession())

  ipcMain.handle('session:get', async (_event, sessionId: string) =>
    store.getSession(sessionId))

  ipcMain.handle('session:delete', async (_event, sessionId: string) =>
    store.deleteSession(sessionId))

  ipcMain.handle('session:rename', async (_event, sessionId: string, title: string) =>
    store.updateSessionTitle(sessionId, title))

  ipcMain.handle('session:fork', async (_event, sessionId: string, upToMessageId: string) =>
    store.forkSession(sessionId, upToMessageId))

  ipcMain.handle('message:delete', async (_event, messageId: string) =>
    store.deleteMessage(messageId))

  ipcMain.handle('session:tokenUsage', async (_event, sessionId: string) =>
    store.getTokenUsage(sessionId))

  ipcMain.handle('session:regenerateTitle', async (_event, sessionId: string) => {
    try {
      const session = await store.getSession(sessionId)
      if (!session) return { success: false, error: 'Session not found' }
      const userMsg = session.messages.find(m => m.role === 'user')
      const assistantMsg = session.messages.find(m => m.role === 'assistant')
      if (!userMsg) return { success: false, error: 'No user message found' }

      const apiKey = await settings.getSetting('llmApiKey')
      const baseUrl = await settings.getSetting('llmBaseUrl') || 'https://api.openai.com/v1'
      const auxModel = await settings.getSetting('auxModel')
      const mainModel = await settings.getSetting('llmModel') || 'gpt-4o'
      const model = auxModel || mainModel

      if (!apiKey) return { success: false, error: 'API Key not configured' }

      await store.updateSessionTitle(sessionId, '新对话')
      await store.generateSmartTitle(sessionId, userMsg.content, assistantMsg?.content || '', { apiKey, baseUrl, model })
      log.info('Title regenerated', { sessionId })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
