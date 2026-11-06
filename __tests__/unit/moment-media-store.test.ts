import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/my-agent-moment-media' } }))
let db: InstanceType<typeof import('sql.js').Database>
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: vi.fn() }))

const SQL = await initSqlJs()
const { recordMomentMediaAttempt, storeMomentMedia, listMomentMediaAttempts } = await import('../../electron/main/companion/life/moment-media-store')

describe('moment media store', () => {
  beforeEach(() => { db = new SQL.Database() })
  it('stores content-addressed media and keeps failure evidence role scoped', async () => {
    const failed = await recordMomentMediaAttempt({ roleId: 'luffy', eventId: 'event-1', momentId: null, status: 'failed', reason: 'no-image-config', imageId: null, attemptedAt: 10, completedAt: 10 })
    const stored = await storeMomentMedia({ roleId: 'luffy', eventId: 'event-1', momentId: 'moment-1', mimeType: 'image/png', width: 1, height: 1, bytes: Buffer.from('png-bytes') })
    const attempts = await listMomentMediaAttempts('luffy')
    expect(failed.id).toBeTruthy()
    expect(stored.id).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.path).toContain(`${stored.id}.png`)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({ eventId: 'event-1', status: 'failed', reason: 'no-image-config' })
  })
})
