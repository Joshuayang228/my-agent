import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/my-agent-moment-media' } }))
let db: InstanceType<typeof import('sql.js').Database>
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: vi.fn() }))

const SQL = await initSqlJs()
const { recordMomentMediaAttempt, storeMomentMedia, listMomentMediaAttempts, getLatestMomentMediaAttempt } = await import('../../electron/main/companion/life/moment-media-store')
const { shouldSkipAutomaticMomentImage, buildAutomaticMomentImageDescription } = await import('../../electron/main/companion/life/automatic-moment-media')

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
    expect(await getLatestMomentMediaAttempt('luffy', 'event-1')).toMatchObject({ eventId: 'event-1', status: 'failed' })
    expect(await getLatestMomentMediaAttempt('other', 'event-1')).toBeNull()
  })

  it('图片预算按本地日历日计算', () => {
    const now = Date.parse('2026-11-06T12:00:00+08:00')
    expect(shouldSkipAutomaticMomentImage({ attemptedAt: now, maxPerDay: 1, priorAttempts: [] })).toBe(false)
    expect(shouldSkipAutomaticMomentImage({ attemptedAt: now, maxPerDay: 1, priorAttempts: [{ attemptedAt: now - 1, status: 'stored' }, { attemptedAt: now - 2, status: 'started' }] })).toBe(true)
    expect(shouldSkipAutomaticMomentImage({ attemptedAt: now, maxPerDay: 1, priorAttempts: [{ attemptedAt: now - 1, status: 'failed' }, { attemptedAt: now - 86_400_000, status: 'stored' }] })).toBe(false)
  })

  it('自动配图描述复用当前世界态的地点、活动和叙事心情，不暴露数值', () => {
    const description = buildAutomaticMomentImageDescription({
      momentText: '甲板上的风把航线图吹得哗啦响。',
      world: { currentLocation: '千里阳光号甲板', locationDetail: '共享甲板', currentActivity: '确认下一段航线', mood: 82 },
      appearance: '草帽、黑发、轻便航海服',
    })
    expect(description).toContain('当前地点：千里阳光号甲板（共享甲板）')
    expect(description).toContain('当前活动：确认下一段航线')
    expect(description).toContain('当前心情：明亮有劲')
    expect(description).not.toContain('82/100')
    expect(description).toContain('人物外观锚点')
  })
})
