import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import type { Database } from 'sql.js'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { PROACTIVE_DELIVERY_POLICY } from '../../../../src/shared/proactive-evidence'
import type { ProactiveEvidenceQuery, ProactiveEvidenceReason, ProactiveEvidenceResult, ProactiveGreetingPayload } from '../../../../src/shared/proactive-evidence'
import { ProactiveEvidenceStore, validateProactiveEvidenceQuery } from '../../storage/proactive-evidence-store'
import { DIAGNOSTIC_PROCESS_RUN_ID } from '../../utils/diagnostic-history'
import { createLogger } from '../../utils/logger'

const log = createLogger('ProactiveEvidence')
const RECEIPT_TIMEOUT_MS = PROACTIVE_DELIVERY_POLICY.receiptTimeoutMs
const windows = new Map<number, BrowserWindow>()
const pending = new Map<string, { tokens: Map<number, string>; timer: ReturnType<typeof setTimeout>; expiresAt: number }>()
let store: ProactiveEvidenceStore | undefined
const receiptSchema = z.object({ attemptId: z.string().uuid().or(z.string().regex(/^greeting-[0-9a-f-]{36}$/)), receiptToken: z.uuid() }).strict()

export function startProactiveEvidence(db: Database, persist: () => void): void {
  if (store) return
  try {
    const next = new ProactiveEvidenceStore(db, DIAGNOSTIC_PROCESS_RUN_ID, persist)
    next.recover(Date.now())
    store = next
  } catch { log.warn('Proactive evidence startup unavailable') }
}
export function stopProactiveEvidence(): void {
  for (const item of pending.values()) clearTimeout(item.timer)
  pending.clear()
  store = undefined
}

/** 背景：应用里的浏览器 / 辅助窗口不能自动成为提醒接收者。
 * 意图：只有主窗口创建流程显式登记的原生窗口可接收，导航时撤销旧凭据。
 * 约束：不从 URL 推断授权；窗口销毁移除登记，旧 token 不跨文档有效。
 */
export function registerProactiveGreetingWindow(window: BrowserWindow): void {
  const sender = window.webContents
  if (windows.has(sender.id)) return
  windows.set(sender.id, window)
  const revoke = () => { for (const item of pending.values()) item.tokens.delete(sender.id) }
  sender.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => { if (isMainFrame && !inPlace) revoke() })
  sender.once('destroyed', () => { windows.delete(sender.id); revoke() })
}

export function queryProactiveEvidence(input: ProactiveEvidenceQuery | unknown): ProactiveEvidenceResult {
  validateProactiveEvidenceQuery(input)
  if (store) return store.query(input, Date.now())
  return { state: 'unavailable', records: [], hasMore: false, boundary: '问候证据尚未由正式启动流程打开；查询不会建表或发送提醒。' }
}

export function hasProactiveReservation(roleId: string, localDay: string): boolean { return store?.hasReservation(roleId, localDay) ?? false }

export function recordProactiveSkip(roleId: string, localDay: string, reason: ProactiveEvidenceReason, now: number, momentId?: string): void {
  try { store?.recordSkipped(roleId, localDay, reason, now, momentId) }
  catch { log.warn('Proactive decision evidence could not be saved') }
}

/** 背景：设置一个全局日标记后广播既不能证明呈现，也会在并发 tick 重复打扰。
 * 意图：先可靠预留人物每日名额，再给登记且可见的窗口各发一次性凭据。
 * 约束：无窗口不消费；预留后失败 / 超时不释放名额、不自动重发；只存元数据。
 */
export function dispatchProactiveGreeting(input: { roleId: string; localDay: string; momentId: string; toast: string; now: number }): { greeted: boolean; reason: 'ok' | 'already-today' | 'no-window' | 'send-failed' | 'evidence-unavailable' } {
  if (!store || pending.size >= PROACTIVE_DELIVERY_POLICY.maxPending) return { greeted: false, reason: 'evidence-unavailable' }
  const recipients = [...windows.values()].filter(win => !win.isDestroyed() && win.isVisible() && !win.isMinimized() && !win.webContents.isDestroyed() && !win.webContents.isLoadingMainFrame()).slice(0, PROACTIVE_DELIVERY_POLICY.maxRecipients)
  if (!recipients.length) { recordProactiveSkip(input.roleId, input.localDay, 'no-window', input.now, input.momentId); return { greeted: false, reason: 'no-window' } }
  let attemptId: string | null
  try { attemptId = store.reserve(input.roleId, input.localDay, input.momentId, recipients.length, input.now) }
  catch { log.warn('Proactive send reservation unavailable'); return { greeted: false, reason: 'evidence-unavailable' } }
  if (!attemptId) { recordProactiveSkip(input.roleId, input.localDay, 'already-today', input.now, input.momentId); return { greeted: false, reason: 'already-today' } }
  const tokens = new Map<number, string>()
  const timer = setTimeout(() => {
    pending.delete(attemptId)
    try { store?.markUnconfirmed(attemptId, Date.now()) } catch { log.warn('Proactive receipt timeout evidence unavailable') }
  }, RECEIPT_TIMEOUT_MS)
  timer.unref?.()
  pending.set(attemptId, { tokens, timer, expiresAt: Date.now() + RECEIPT_TIMEOUT_MS })
  let sent = 0
  let failed = 0
  for (const win of recipients) {
    const token = randomUUID()
    tokens.set(win.webContents.id, token)
    const payload: ProactiveGreetingPayload = { roleId: input.roleId, momentId: input.momentId, toast: input.toast, attemptId, receiptToken: token }
    try { win.webContents.send('companion:proactive-greeting', payload); sent += 1 }
    catch { tokens.delete(win.webContents.id); failed += 1 }
  }
  try { store.markDispatch(attemptId, sent, failed, input.now) } catch { log.warn('Proactive dispatch evidence save pending') }
  if (!sent) { clearTimeout(timer); pending.delete(attemptId) }
  return { greeted: sent > 0, reason: sent ? 'ok' : 'send-failed' }
}

export function acknowledgeProactiveGreeting(event: IpcMainInvokeEvent, input: unknown): { accepted: boolean } {
  const parsed = receiptSchema.safeParse(input)
  const sender = event.sender
  if (!parsed.success || sender.isDestroyed() || !event.senderFrame || event.senderFrame !== sender.mainFrame || !windows.has(sender.id)) return { accepted: false }
  const item = pending.get(parsed.data.attemptId)
  if (!item || Date.now() >= item.expiresAt || item.tokens.get(sender.id) !== parsed.data.receiptToken || !store) return { accepted: false }
  clearTimeout(item.timer)
  pending.delete(parsed.data.attemptId)
  try { return { accepted: store.markPresented(parsed.data.attemptId, Date.now()) } }
  catch { log.warn('Proactive presented evidence save pending'); return { accepted: false } }
}
