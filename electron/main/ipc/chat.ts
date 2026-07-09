import { ipcMain } from 'electron'
import { runtime } from '../agent/runtime'
import { ToolRegistry } from '../tools/registry'
import { createLogger } from '../utils/logger'
import { toAgentError } from '../errs'
import type { ChatMessage } from '../../../src/shared/types'
import { toAgentError } from '../errs'

const log = createLogger('ChatIPC')

export function registerChatIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('chat:abort', (_event, sessionId?: string) => {
    runtime.abort(sessionId)
  })

  ipcMain.handle('chat:send', async (event, sessionId: string, messages: ChatMessage[]) => {
    const emit = (ev: Record<string, unknown>) => {
      event.sender.send('chat:event', { ...ev, sessionId })
    }

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

    try {
      const stream = runtime.chat(sessionId, messages, toolRegistry, confirmTool)

      for await (const ev of stream) {
        emit(ev)
      }
    } catch (err) {
      const agentErr = toAgentError(err)
      log.error('chat:send top-level error', { error: agentErr.chain() })
      const payload = agentErr.toEventPayload()
      emit({ type: 'error', message: payload.message, code: payload.code })
      emit({ type: 'done', reason: 'model_error' })
    }
  })
}
