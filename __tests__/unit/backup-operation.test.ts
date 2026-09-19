import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ fromWebContents: vi.fn() }))
vi.mock('electron', () => ({ BrowserWindow: { fromWebContents: mock.fromWebContents } }))

import { createBackupOperationGuard } from '../../electron/main/ipc/backup-operation'

function owner() {
  const sender = Object.assign(new EventEmitter(), { isDestroyed: () => false, mainFrame: {} })
  const win = { isDestroyed: () => false }
  mock.fromWebContents.mockImplementation((value: unknown) => value === sender ? win : null)
  return { event: { sender, senderFrame: sender.mainFrame } as any, sender, win }
}

describe('backup operation ownership', () => {
  beforeEach(() => mock.fromWebContents.mockReset())

  it('binds dialog owner and excludes concurrent operations until finish', () => {
    const guard = createBackupOperationGuard()
    const { event, win } = owner()
    const first = guard.begin(event)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.window).toBe(win)
    expect(guard.begin(event)).toEqual({ ok: false, error: 'busy' })
    first.finish()
    const next = guard.begin(event)
    expect(next.ok).toBe(true)
    if (next.ok) next.finish()
  })

  it.each(['destroyed', 'render-process-gone', 'navigation'])('invalidates preparing work on %s and old finally cannot unlock new owner', (kind) => {
    const guard = createBackupOperationGuard()
    const { event, sender } = owner()
    const first = guard.begin(event)
    if (!first.ok) throw new Error('lease missing')
    if (kind === 'navigation') sender.emit('did-start-navigation', {}, 'next', false, true)
    else sender.emit(kind)
    expect(first.isActive()).toBe(false)
    expect(first.beginCommit()).toBe(false)
    const next = guard.begin(event)
    expect(next.ok).toBe(true)
    first.finish()
    expect(guard.begin(event)).toEqual({ ok: false, error: 'busy' })
    if (next.ok) next.finish()
    expect(sender.eventNames()).toEqual([])
  })

  it('does not cancel for subframe or same-document navigation; commit keeps lock on owner loss', () => {
    const guard = createBackupOperationGuard()
    const { event, sender } = owner()
    const lease = guard.begin(event)
    if (!lease.ok) throw new Error('lease missing')
    sender.emit('did-start-navigation', {}, 'frame', false, false)
    sender.emit('did-start-navigation', {}, '#hash', true, true)
    expect(lease.isActive()).toBe(true)
    expect(lease.beginCommit()).toBe(true)
    sender.emit('render-process-gone')
    expect(guard.begin(event)).toEqual({ ok: false, error: 'busy' })
    lease.finish()
    expect(sender.eventNames()).toEqual([])
  })

  it('rejects absent, destroyed and subframe owners', () => {
    const guard = createBackupOperationGuard()
    const { event, win } = owner()
    expect(guard.begin({ ...event, senderFrame: {} })).toEqual({ ok: false, error: 'cancelled' })
    win.isDestroyed = () => true
    expect(guard.begin(event)).toEqual({ ok: false, error: 'cancelled' })
    mock.fromWebContents.mockReturnValue(null)
    expect(guard.begin(event)).toEqual({ ok: false, error: 'cancelled' })
  })
})
