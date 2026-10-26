import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import { createProactiveEvidenceSchema } from '../../electron/main/storage/proactive-evidence-schema'
import { ProactiveEvidenceStore } from '../../electron/main/storage/proactive-evidence-store'
import { startProactiveEvidence, stopProactiveEvidence, registerProactiveGreetingWindow, dispatchProactiveGreeting, acknowledgeProactiveGreeting, queryProactiveEvidence } from '../../electron/main/companion/life/proactive-evidence'
import type { ProactiveGreetingPayload } from '../../src/shared/proactive-evidence'

const NOW = 1_800_000_000_000
const DAY = '2027-01-15'
let db: Database
const persist = vi.fn()
const senders: EventEmitter[] = []
let nextId = 0
function windowFixture({ visible = true, throws = false } = {}) {
  const sender = Object.assign(new EventEmitter(), {
    id: ++nextId, mainFrame: {}, isDestroyed: () => false, isLoadingMainFrame: () => false,
    send: vi.fn((_channel: string, _payload: ProactiveGreetingPayload) => { if (throws) throw new Error('transport failure') }),
  })
  senders.push(sender)
  const win = { webContents: sender, isDestroyed: () => false, isVisible: () => visible, isMinimized: () => false } as unknown as BrowserWindow
  const event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent
  return { win, sender, event, payload: () => sender.send.mock.calls[0][1] }
}
function dispatch(roleId = 'role-a') { return dispatchProactiveGreeting({ roleId, localDay: DAY, momentId: 'moment-a', toast: '绝不持久化的提醒正文', now: NOW }) }
function query(roleId = 'role-a') { return queryProactiveEvidence({ roleId }) }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(NOW)
  persist.mockReset()
  db = new (await initSqlJs()).Database()
  createProactiveEvidenceSchema(db)
})
afterEach(() => {
  stopProactiveEvidence()
  for (const sender of senders.splice(0)) sender.emit('destroyed')
  db.close()
  vi.useRealTimers()
})

describe('问候名额与只读证据 SQL', () => {
  it('按人物原子预留，证据裁剪不释放当天名额，不同人物互不影响', () => {
    const store = new ProactiveEvidenceStore(db, 'process-a', persist)
    const attempt = store.reserve('role-a', DAY, 'moment-a', 1, NOW)
    expect(attempt).toBeTruthy()
    expect(store.reserve('role-a', DAY, 'moment-a', 1, NOW)).toBeNull()
    db.run('DELETE FROM companion_greeting_evidence')
    expect(store.reserve('role-a', DAY, 'moment-a', 1, NOW)).toBeNull()
    expect(store.reserve('role-b', DAY, 'moment-a', 1, NOW)).toBeTruthy()
  })

  it('未发送原因按人物 / 日期 / 原因合并，不每 tick 新增一条', () => {
    const store = new ProactiveEvidenceStore(db, 'process-a', persist)
    store.recordSkipped('role-a', DAY, 'quiet-hours', NOW)
    store.recordSkipped('role-a', DAY, 'quiet-hours', NOW + 100)
    store.recordSkipped('role-a', DAY, 'muted', NOW + 200)
    const result = store.query({ roleId: 'role-a' }, NOW + 200)
    expect(result.records).toHaveLength(2)
    expect(result.records.find(row => row.reason === 'quiet-hours')).toMatchObject({ checks: 2, occurredAt: NOW, updatedAt: NOW + 100 })
    expect(store.hasReservation('role-a', DAY)).toBe(false)
  })

  it('同时间分页稳定，游标与显式 ID 不跨人物，不写盘', () => {
    const store = new ProactiveEvidenceStore(db, 'process-a', persist)
    for (const reason of ['disabled', 'muted', 'no-window'] as const) store.recordSkipped('role-a', DAY, reason, NOW)
    const first = store.query({ roleId: 'role-a', limit: 2 }, NOW)
    const second = store.query({ roleId: 'role-a', cursor: first.nextCursor, limit: 2 }, NOW)
    expect(new Set([...first.records, ...second.records].map(row => row.id)).size).toBe(3)
    expect(() => store.query({ roleId: 'role-b', cursor: first.nextCursor }, NOW)).toThrow()
    expect(store.query({ roleId: 'role-b', recordId: first.records[0].id }, NOW).records).toEqual([])
    const calls = persist.mock.calls.length
    const before = db.export()
    store.query({ roleId: 'role-a', recordId: 'missing' }, NOW)
    expect(db.export()).toEqual(before)
    expect(persist).toHaveBeenCalledTimes(calls)
    expect(() => store.query({ roleId: "' OR 1=1--" }, NOW)).toThrow()
  })

  it('导出重开后保留名额，未确认发送转为未知，已呈现不回退', async () => {
    const old = new ProactiveEvidenceStore(db, 'old-process', persist)
    const unfinished = old.reserve('role-a', DAY, 'moment-a', 1, NOW)!
    old.markDispatch(unfinished, 1, 0, NOW)
    const finished = old.reserve('role-b', DAY, 'moment-b', 1, NOW)!
    old.markPresented(finished, NOW)
    const snapshot = db.export()
    db.close(); db = new (await initSqlJs()).Database(snapshot)
    const next = new ProactiveEvidenceStore(db, 'new-process', persist)
    next.recover(NOW + 1000)
    expect(next.hasReservation('role-a', DAY)).toBe(true)
    expect(next.query({ roleId: 'role-a' }, NOW + 1000).records[0]).toMatchObject({ status: 'unconfirmed', reason: 'process-restarted', updatedAt: NOW })
    expect(next.query({ roleId: 'role-b' }, NOW + 1000).records[0].status).toBe('presented')
  })
})

describe('定向发送与回执', () => {
  it('未启动只返回不可用，无窗口不占名额，后来有窗口才第一次发出', () => {
    expect(query().state).toBe('unavailable')
    expect(dispatch().reason).toBe('evidence-unavailable')
    startProactiveEvidence(db, persist)
    expect(dispatch().reason).toBe('no-window')
    const hidden = windowFixture({ visible: false }); registerProactiveGreetingWindow(hidden.win)
    expect(dispatch().reason).toBe('no-window')
    const visible = windowFixture(); registerProactiveGreetingWindow(visible.win)
    expect(dispatch()).toEqual({ greeted: true, reason: 'ok' })
    expect(visible.sender.send).toHaveBeenCalledTimes(1)
    expect(hidden.sender.send).not.toHaveBeenCalled()
  })

  it('发出不等于呈现，凭据绑定接收窗口和主 frame，重复与伪造被拒绝', () => {
    startProactiveEvidence(db, persist)
    const first = windowFixture(); registerProactiveGreetingWindow(first.win)
    dispatch()
    const receipt = { attemptId: first.payload().attemptId, receiptToken: first.payload().receiptToken }
    expect(query().records[0].status).toBe('dispatched')
    const other = windowFixture(); registerProactiveGreetingWindow(other.win)
    expect(acknowledgeProactiveGreeting(other.event, receipt).accepted).toBe(false)
    expect(acknowledgeProactiveGreeting({ ...first.event, senderFrame: {} } as IpcMainInvokeEvent, receipt).accepted).toBe(false)
    expect(acknowledgeProactiveGreeting(first.event, { ...receipt, receiptToken: 'forged' }).accepted).toBe(false)
    expect(acknowledgeProactiveGreeting(first.event, receipt).accepted).toBe(true)
    expect(acknowledgeProactiveGreeting(first.event, receipt).accepted).toBe(false)
    expect(query().records[0].status).toBe('presented')
    const raw = JSON.stringify(db.exec('SELECT * FROM companion_greeting_evidence'))
    expect(raw).not.toContain('绝不持久化')
    expect(raw).not.toContain(receipt.receiptToken)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('多窗口凭据各自不同，任一合法呈现结束该 attempt，不能跨窗口代报', () => {
    startProactiveEvidence(db, persist)
    const first = windowFixture(); const second = windowFixture()
    registerProactiveGreetingWindow(first.win); registerProactiveGreetingWindow(second.win)
    dispatch()
    expect(first.payload().attemptId).toBe(second.payload().attemptId)
    expect(first.payload().receiptToken).not.toBe(second.payload().receiptToken)
    expect(acknowledgeProactiveGreeting(second.event, { attemptId: first.payload().attemptId, receiptToken: first.payload().receiptToken }).accepted).toBe(false)
    expect(acknowledgeProactiveGreeting(second.event, { attemptId: second.payload().attemptId, receiptToken: second.payload().receiptToken }).accepted).toBe(true)
    expect(query().records[0]).toMatchObject({ status: 'presented', recipientCount: 2, sentCount: 2 })
    expect(dispatch().reason).toBe('already-today')
  })

  it('超时、发送失败或导航撤销不自动重发；部分窗口失败仍记录真实计数', () => {
    startProactiveEvidence(db, persist)
    const failing = windowFixture({ throws: true }); const good = windowFixture()
    registerProactiveGreetingWindow(failing.win); registerProactiveGreetingWindow(good.win)
    expect(dispatch().greeted).toBe(true)
    expect(query().records[0]).toMatchObject({ sentCount: 1, failedCount: 1 })
    good.sender.emit('did-start-navigation', {}, 'new-page', false, true)
    expect(acknowledgeProactiveGreeting(good.event, { attemptId: good.payload().attemptId, receiptToken: good.payload().receiptToken }).accepted).toBe(false)
    vi.advanceTimersByTime(30_001)
    expect(query().records[0]).toMatchObject({ status: 'unconfirmed', reason: 'receipt-timeout' })
    expect(dispatch().reason).toBe('already-today')
    expect(good.sender.send).toHaveBeenCalledTimes(1)
  })

  it('所有窗口发送失败仍消费当天名额，预留落盘失败完全不发送', () => {
    startProactiveEvidence(db, persist)
    const bad = windowFixture({ throws: true }); registerProactiveGreetingWindow(bad.win)
    expect(dispatch().reason).toBe('send-failed')
    expect(query().records[0].status).toBe('failed')
    expect(dispatch().reason).toBe('already-today')
    persist.mockImplementationOnce(() => { throw new Error('disk full') })
    const good = windowFixture(); registerProactiveGreetingWindow(good.win)
    expect(dispatch('role-b').reason).toBe('evidence-unavailable')
    expect(good.sender.send).not.toHaveBeenCalled()
    expect(query('role-b').records[0]).toMatchObject({ status: 'failed', reason: 'reservation-save-failed' })
    expect(dispatch('role-b').reason).toBe('already-today')
  })
})
