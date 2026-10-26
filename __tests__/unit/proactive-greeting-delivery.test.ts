import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import type { BrowserWindow } from 'electron'

const { preferences, latest } = vi.hoisted(() => ({ preferences: new Map<string, string>(), latest: { id: 'moment-a', text: '不应进入证据的动态正文', publishedAt: 0 } }))
vi.mock('../../electron/main/storage/settings-store', () => ({ getSetting: async (key: string) => preferences.get(key) ?? '' }))
vi.mock('../../electron/main/companion/life/moments', () => ({ listMomentsForRole: async () => [latest] }))
vi.mock('../../electron/main/companion/identity/loader', () => ({ loadRolePack: () => ({ name: '测试伙伴' }) }))

import { maybeProactiveGreeting } from '../../electron/main/companion/life/proactive-greeting'
import { startProactiveEvidence, stopProactiveEvidence, registerProactiveGreetingWindow, queryProactiveEvidence } from '../../electron/main/companion/life/proactive-evidence'
import { createProactiveEvidenceSchema } from '../../electron/main/storage/proactive-evidence-schema'
import { MOMENT_TIPS_QUIET_START_KEY, MOMENT_TIPS_QUIET_END_KEY } from '../../electron/main/companion/life/moment-tips'

let db: Database
let sender: EventEmitter & { send: ReturnType<typeof vi.fn>; id: number }
const NOW = new Date(2027, 0, 15, 14).getTime()
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(NOW)
  db = new (await initSqlJs()).Database()
  createProactiveEvidenceSchema(db)
  startProactiveEvidence(db, vi.fn())
  preferences.clear()
  for (const [key, value] of Object.entries({ companionProactiveGreetingEnabled: 'true', companionMomentTipsMuted: 'false', [MOMENT_TIPS_QUIET_START_KEY]: '0', [MOMENT_TIPS_QUIET_END_KEY]: '0', activeRoleId: 'role-a' })) preferences.set(key, value)
  latest.publishedAt = NOW - 1000
  sender = Object.assign(new EventEmitter(), { id: 888, send: vi.fn(), isDestroyed: () => false, isLoadingMainFrame: () => false })
  registerProactiveGreetingWindow({ webContents: sender, isDestroyed: () => false, isVisible: () => true, isMinimized: () => false } as unknown as BrowserWindow)
})
afterEach(() => { stopProactiveEvidence(); sender.emit('destroyed'); db.close(); vi.useRealTimers() })

it('并发真实决策只产生一次发送，旧全局日标记不阻止其他人物', async () => {
  preferences.set('companionProactiveGreetingLastDay', '2027-01-15')
  const results = await Promise.all(Array.from({ length: 20 }, () => maybeProactiveGreeting('role-a', NOW)))
  expect(results.filter(result => result.greeted)).toHaveLength(1)
  expect(sender.send).toHaveBeenCalledTimes(1)
  const records = queryProactiveEvidence({ roleId: 'role-a' }).records
  expect(records.filter(row => row.status === 'dispatched')).toHaveLength(1)
  expect(records.find(row => row.reason === 'already-today')?.checks).toBe(19)
  expect(JSON.stringify(records)).not.toContain(latest.text)
})

it('关闭与勿扰原因进入证据，不发送提示', async () => {
  preferences.set('companionProactiveGreetingEnabled', 'false')
  expect((await maybeProactiveGreeting('role-a', NOW)).reason).toBe('disabled')
  preferences.set('companionProactiveGreetingEnabled', 'true')
  preferences.set(MOMENT_TIPS_QUIET_START_KEY, '13')
  preferences.set(MOMENT_TIPS_QUIET_END_KEY, '15')
  expect((await maybeProactiveGreeting('role-a', NOW)).reason).toBe('quiet-hours')
  expect(sender.send).not.toHaveBeenCalled()
  expect(queryProactiveEvidence({ roleId: 'role-a' }).records.map(row => row.reason).sort()).toEqual(['disabled', 'quiet-hours'])
})

it('未来动态、过期动态与已经切走的人物都不触发提醒', async () => {
  latest.publishedAt = NOW + 1000
  expect((await maybeProactiveGreeting('role-a', NOW)).reason).toBe('no-fresh-moment')
  latest.publishedAt = NOW - 24 * 60 * 60 * 1000 - 1
  expect((await maybeProactiveGreeting('role-a', NOW)).reason).toBe('no-fresh-moment')
  latest.publishedAt = NOW - 1000
  preferences.set('activeRoleId', 'role-b')
  expect((await maybeProactiveGreeting('role-a', NOW)).reason).toBe('role-inactive')
  expect(sender.send).not.toHaveBeenCalled()
})
