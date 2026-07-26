import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { runtime } from '../agent/runtime'
import { ToolRegistry } from '../tools/registry'
import { createLogger } from '../utils/logger'
import { toAgentError } from '../errs'
import type { ChatMessage } from '../../../src/shared/types'

const log = createLogger('ChatIPC')

const CONFIRM_TIMEOUT_MS = 60_000

export function registerChatIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('chat:abort', (_event, sessionId?: string) => {
    runtime.abort(sessionId)
  })

  ipcMain.handle('chat:send', async (event, sessionId: string, userMessage: ChatMessage) => {
    const emit = (ev: Record<string, unknown>) => {
      event.sender.send('chat:event', { ...ev, sessionId })
    }

    const confirmTool = (name: string, args: Record<string, unknown>): Promise<boolean> => {
      return new Promise((resolve) => {
        // UUID 避免 Date.now() 同毫秒碰撞；动态频道靠 requestId 配对
        const requestId = `confirm-${randomUUID()}`
        const channel = `tool:confirm-response:${requestId}`
        let settled = false
        let timer: ReturnType<typeof setTimeout> | undefined

        const finish = (approved: boolean) => {
          if (settled) return
          settled = true
          if (timer !== undefined) clearTimeout(timer)
          ipcMain.removeListener(channel, onResponse)
          resolve(approved)
        }

        function onResponse(_e: Electron.IpcMainEvent, approved: boolean) {
          finish(approved)
        }

        ipcMain.once(channel, onResponse)
        event.sender.send('tool:confirm-request', { requestId, name, args })

        timer = setTimeout(() => {
          log.warn('tool confirm timed out', { requestId, name })
          finish(false)
        }, CONFIRM_TIMEOUT_MS)
      })
    }

    try {
      // 会话 Runtime 中心化：只传本轮用户消息，历史由 runtime 从 store 加载
      const stream = runtime.chat(sessionId, userMessage, toolRegistry, confirmTool)

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

/** 纯函数：confirm 超时默认拒绝（供单测，M17 G4） */
export function resolveConfirmOnTimeout(): boolean {
  return false
}

export { CONFIRM_TIMEOUT_MS }
