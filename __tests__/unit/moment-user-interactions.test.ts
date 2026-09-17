/**
 * 朋友圈用户赞 / 评论：独立用户态，不改动态正文或卡司投影。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import {
  MOMENT_COMMENT_MAX_LENGTH,
  MOMENT_USER_ACTOR_NAME,
  describeMomentSocial,
  mergeMomentComments,
  normalizeMomentCommentText,
  parseCastInteractions,
} from '../../src/shared/moment-user-interactions'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
let activeRoleId = 'lin'

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return activeRoleId
    return ''
  }),
  setSetting: vi.fn(async (key: string, value: string) => {
    if (key === 'activeRoleId') activeRoleId = value
  }),
}))

const {
  addMomentCommentForRole,
  listMomentUserInteractionsForRole,
  toggleMomentLikeForRole,
} = await import('../../electron/main/companion/life/moments')
const store = await import('../../electron/main/companion/life/store')

async function seedMoment(roleId: string, eventId: string, text = '今天把书桌收拾出来了。') {
  const moment = await store.insertMoment({
    roleId,
    eventId,
    publishedAt: 1_720_000_000_000,
    text,
    meta: {
      location: '家中',
      interactions: [
        { kind: 'comment', castId: 'chen', castName: '陈晨', text: '这桌面终于能看见了' },
        { kind: 'coframe', castId: 'ayu', castName: '阿雨' },
      ],
    },
  })
  if (!moment) throw new Error('seed moment failed')
  return moment
}

describe('moment user interactions', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    activeRoleId = 'lin'
  })

  afterEach(() => {
    memDb.close()
  })

  it('normalizeMomentCommentText 去掉空白并拒绝空值和超长', () => {
    expect(normalizeMomentCommentText('  先把今天最重要的事做完  \n')).toEqual({
      ok: true,
      text: '先把今天最重要的事做完',
    })
    expect(normalizeMomentCommentText('   \n')).toMatchObject({ ok: false, code: 'INVALID' })
    expect(normalizeMomentCommentText('字'.repeat(MOMENT_COMMENT_MAX_LENGTH + 1))).toMatchObject({
      ok: false,
      code: 'INVALID',
    })
  })

  it('mergeMomentComments 卡司评论在前、用户评论在后', () => {
    const merged = mergeMomentComments(
      parseCastInteractions({
        interactions: [
          { kind: 'coframe', castName: '阿雨' },
          { kind: 'comment', castId: 'chen', castName: '陈晨', text: '这桌面终于能看见了' },
        ],
      }),
      [{ id: 'u1', actorName: MOMENT_USER_ACTOR_NAME, text: '我也觉得', createdAt: 2 }],
    )
    expect(merged.map((item) => [item.source, item.actorName, item.text])).toEqual([
      ['cast', '陈晨', '这桌面终于能看见了'],
      ['user', '我', '我也觉得'],
    ])
  })

  it('赞可切换且不改动态正文或卡司投影', async () => {
    const moment = await seedMoment('lin', 'event-like')
    const first = await toggleMomentLikeForRole('lin', moment.id)
    expect(first).toMatchObject({ ok: true, social: { liked: true, likeCount: 1 } })
    const second = await toggleMomentLikeForRole('lin', moment.id)
    expect(second).toMatchObject({ ok: true, social: { liked: false, likeCount: 0 } })
    const third = await toggleMomentLikeForRole('lin', moment.id)
    expect(third).toMatchObject({ ok: true, social: { liked: true, likeCount: 1 } })

    const persisted = await store.getMomentById(moment.id)
    expect(persisted?.text).toBe('今天把书桌收拾出来了。')
    expect(persisted?.meta).toEqual({
      location: '家中',
      interactions: [
        { kind: 'comment', castId: 'chen', castName: '陈晨', text: '这桌面终于能看见了' },
        { kind: 'coframe', castId: 'ayu', castName: '阿雨' },
      ],
    })
    const likes = (await listMomentUserInteractionsForRole('lin')).filter((row) => row.kind === 'like')
    expect(likes).toHaveLength(1)
    expect(likes[0]).toMatchObject({ momentId: moment.id, actorId: 'user' })
  })

  it('评论追加、空值和超长拒绝，且不改动态正文', async () => {
    const moment = await seedMoment('lin', 'event-comment')
    const empty = await addMomentCommentForRole('lin', moment.id, '   ')
    expect(empty).toMatchObject({ ok: false, code: 'INVALID' })
    const oversized = await addMomentCommentForRole('lin', moment.id, '评'.repeat(MOMENT_COMMENT_MAX_LENGTH + 1))
    expect(oversized).toMatchObject({ ok: false, code: 'INVALID' })
    const saved = await addMomentCommentForRole('lin', moment.id, '  先把窗帘拉开  ')
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.social.comments.map((item) => item.text)).toEqual(['先把窗帘拉开'])
    expect(describeMomentSocial(moment.id, await listMomentUserInteractionsForRole('lin')).commentCount).toBe(1)
    expect((await store.getMomentById(moment.id))?.text).toBe('今天把书桌收拾出来了。')
    expect((await store.getMomentById(moment.id))?.meta.interactions).toEqual([
      { kind: 'comment', castId: 'chen', castName: '陈晨', text: '这桌面终于能看见了' },
      { kind: 'coframe', castId: 'ayu', castName: '阿雨' },
    ])
  })

  it('跨角色互动被拒绝，且不会写进对方动态', async () => {
    const lin = await seedMoment('lin', 'event-lin')
    const other = await seedMoment('other', 'event-other', '另一位主角的动态')
    expect(await toggleMomentLikeForRole('other', lin.id)).toMatchObject({ ok: false, code: 'ROLE_MISMATCH' })
    expect(await addMomentCommentForRole('other', lin.id, '串味评论')).toMatchObject({ ok: false, code: 'ROLE_MISMATCH' })
    expect(await listMomentUserInteractionsForRole('lin')).toEqual([])
    expect(await listMomentUserInteractionsForRole('other')).toEqual([])
    expect((await store.getMomentById(other.id))?.text).toBe('另一位主角的动态')
  })
})
