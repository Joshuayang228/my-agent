import { ipcMain } from 'electron'
import * as store from '../storage/session-store'
import { createLogger } from '../utils/logger'

const log = createLogger('SessionIPC')
const MAX_ID_LENGTH = 200
const MAX_TITLE_LENGTH = 20_000

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

export function registerSessionIPC(): void {
  ipcMain.handle('session:list', async () => store.listSessions())

  ipcMain.handle('session:create', async () => store.createSession())

  ipcMain.handle('session:get', async (_event, sessionId: unknown) =>
    validId(sessionId) ? store.getSession(sessionId) : null)

  ipcMain.handle('session:delete', async (_event, sessionId: unknown) => {
    if (!validId(sessionId)) throw new Error('会话 ID 无效')
    return store.deleteSession(sessionId)
  })

  ipcMain.handle('session:rename', async (_event, sessionId: unknown, title: unknown) => {
    if (!validId(sessionId) || typeof title !== 'string' || title.length === 0 || title.length > MAX_TITLE_LENGTH) throw new Error('会话标题参数无效')
    return store.updateSessionTitle(sessionId, title)
  })

  ipcMain.handle('session:fork', async (_event, sessionId: unknown, upToMessageId: unknown) => {
    if (!validId(sessionId) || !validId(upToMessageId)) throw new Error('会话分支参数无效')
    return store.forkSession(sessionId, upToMessageId)
  })

  ipcMain.handle('message:delete', async (_event, messageId: unknown) => {
    if (!validId(messageId)) throw new Error('消息 ID 无效')
    return store.deleteMessage(messageId)
  })

  ipcMain.handle('session:tokenUsage', async (_event, sessionId: unknown) =>
    validId(sessionId) ? store.getTokenUsage(sessionId) : { promptTokens: 0, completionTokens: 0 })

  ipcMain.handle('session:regenerateTitle', async (_event, sessionId: unknown) => {
    if (!validId(sessionId)) return { success: false, error: '会话 ID 无效' }
    try {
      const session = await store.getSession(sessionId)
      if (!session) return { success: false, error: 'Session not found' }
      const userMsg = session.messages.find(m => m.role === 'user')
      const assistantMsg = session.messages.find(m => m.role === 'assistant')
      if (!userMsg) return { success: false, error: 'No user message found' }

      const { loadAuxLLMConfig } = await import('../llm/aux-config')
      const llmConfig = await loadAuxLLMConfig()
      if (!llmConfig.apiKey) return { success: false, error: 'API Key not configured' }

      // force：显式重生成，绕过「仅默认标题才调用」门闸
      await store.generateSmartTitle(
        sessionId,
        userMsg.content,
        assistantMsg?.content || '',
        llmConfig,
        { force: true },
      )
      log.info('Title regenerated', { sessionId })
      return { success: true }
    } catch (err) {
      log.warn('Title regeneration failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { success: false, error: '标题生成失败，请稍后重试' }
    }
  })
}
