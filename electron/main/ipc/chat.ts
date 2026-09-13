import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { runtime } from '../agent/runtime'
import { ToolRegistry } from '../tools/registry'
import { createLogger } from '../utils/logger'
import { toAgentError } from '../errs'
import type { ChatMessage, WorkspaceChatContext } from '../../../src/shared/types'

const log = createLogger('ChatIPC')

const CONFIRM_TIMEOUT_MS = 60_000
const MAX_CHAT_ID_LENGTH = 200
const MAX_CHAT_CONTENT_LENGTH = 1_000_000

interface ActiveChat {
  senderId: number
  completed: Promise<void>
  cancel: () => void
}

const activeChatSenders = new Map<string, ActiveChat>()
const deletingSessions = new Map<string, { senderId: number; completed: Promise<void> }>()

/**
 * 关闭侧聊时仍可能存在 Runtime 写盘与待确认工具。由主进程串行取消、等待、删除，
 * 不把 abort 回执或 done 事件误作收尾完成；删除期间拒绝新发送，失败后释放门禁以便重试。
 */
export function deleteChatSession(sessionId: string, senderId: number, remove: () => Promise<void>): Promise<void> {
  const deletion = deletingSessions.get(sessionId)
  const active = activeChatSenders.get(sessionId)
  if ((deletion && deletion.senderId !== senderId) || (active && active.senderId !== senderId)) {
    return Promise.reject(new Error('该会话正在另一个窗口处理中'))
  }
  if (deletion) return deletion.completed
  const completed = Promise.resolve().then(async () => {
    active?.cancel()
    await active?.completed
    await remove()
  }).finally(() => { deletingSessions.delete(sessionId) })
  deletingSessions.set(sessionId, { senderId, completed })
  return completed
}

function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return typeof message.id === 'string'
    && message.id.length > 0 && message.id.length <= MAX_CHAT_ID_LENGTH
    && message.role === 'user'
    && typeof message.content === 'string' && message.content.length <= MAX_CHAT_CONTENT_LENGTH
    && typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)
}

function readWorkspaceChatContext(value: unknown): WorkspaceChatContext | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const context: WorkspaceChatContext = {}
  if (typeof raw.parentSessionId === 'string' && raw.parentSessionId.length > 0 && raw.parentSessionId.length <= MAX_CHAT_ID_LENGTH) context.parentSessionId = raw.parentSessionId
  if (typeof raw.projectPath === 'string' && raw.projectPath.length > 0 && raw.projectPath.length <= 2_000) context.projectPath = raw.projectPath
  if (raw.focus && typeof raw.focus === 'object') {
    const focus = raw.focus as Record<string, unknown>
    if ((focus.kind === 'file' || focus.kind === 'review') && typeof focus.path === 'string' && focus.path.length > 0 && focus.path.length <= 2_000 && typeof focus.content === 'string' && focus.content.length <= 12_000) {
      context.focus = { kind: focus.kind, path: focus.path, content: focus.content }
    }
  }
  return context.parentSessionId || context.projectPath || context.focus ? context : undefined
}

export function registerChatIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('chat:abort', (event, sessionId?: string) => {
    const normalizedSessionId = typeof sessionId === 'string' && sessionId.length <= MAX_CHAT_ID_LENGTH ? sessionId : undefined
    if (!normalizedSessionId || activeChatSenders.get(normalizedSessionId)?.senderId !== event.sender.id) return
    activeChatSenders.get(normalizedSessionId)?.cancel()
  })

  ipcMain.handle('chat:send', async (event, sessionId: string, userMessage: ChatMessage, rawContext?: unknown) => {
    if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > MAX_CHAT_ID_LENGTH) {
      throw new Error('会话 ID 无效')
    }
    if (!isValidChatMessage(userMessage)) {
      throw new Error('消息参数无效或内容过长')
    }
    if (deletingSessions.has(sessionId)) throw new Error('该会话正在关闭')
    if (activeChatSenders.has(sessionId)) throw new Error('该会话正在处理中，请等待完成或先中断')
    let finishRun!: () => void
    let cancelled = false
    const pendingConfirms = new Set<() => void>()
    const active: ActiveChat = {
      senderId: event.sender.id,
      completed: new Promise<void>((resolve) => { finishRun = resolve }),
      cancel: () => {
        cancelled = true
        runtime.abort(sessionId)
        for (const deny of pendingConfirms) deny()
      },
    }
    activeChatSenders.set(sessionId, active)
    event.sender.once('destroyed', active.cancel)
    const workspaceContext = readWorkspaceChatContext(rawContext)
    const emit = (ev: Record<string, unknown>) => {
      if (!event.sender.isDestroyed()) event.sender.send('chat:event', { ...ev, sessionId })
    }

    const confirmTool = (name: string, args: Record<string, unknown>): Promise<boolean> => {
      if (cancelled || event.sender.isDestroyed()) return Promise.resolve(false)
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
          pendingConfirms.delete(deny)
          resolve(approved)
        }

        const deny = () => finish(false)
        pendingConfirms.add(deny)

        function onResponse(responseEvent: Electron.IpcMainEvent, approved: boolean) {
          if (responseEvent.sender.id === event.sender.id) finish(approved === true)
        }

        ipcMain.on(channel, onResponse)
        event.sender.send('tool:confirm-request', { requestId, name, args, sessionId })

        timer = setTimeout(() => {
          log.warn('tool confirm timed out', { requestId, name })
          finish(false)
        }, CONFIRM_TIMEOUT_MS)
      })
    }

    try {
      // 会话 Runtime 中心化：只传本轮用户消息，历史由 runtime 从 store 加载
      const stream = runtime.chat(sessionId, userMessage, toolRegistry, confirmTool, workspaceContext)

      for await (const ev of stream) {
        emit(ev)
      }
    } catch (err) {
      const agentErr = toAgentError(err)
      log.error('chat:send top-level error', { error: agentErr.chain() })
      const payload = agentErr.toEventPayload()
      emit({ type: 'error', message: payload.message, code: payload.code })
      emit({ type: 'done', reason: 'model_error' })
    } finally {
      for (const deny of pendingConfirms) deny()
      event.sender.removeListener('destroyed', active.cancel)
      activeChatSenders.delete(sessionId)
      finishRun()
    }
  })
}

/** 纯函数：confirm 超时默认拒绝（供单测，M17 G4） */
export function resolveConfirmOnTimeout(): boolean {
  return false
}

export { CONFIRM_TIMEOUT_MS }
