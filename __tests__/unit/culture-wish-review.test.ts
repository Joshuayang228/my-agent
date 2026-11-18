import { runLocalTransaction } from '../helpers/local-transaction'
/**
 * 文化心愿体验闭环与主动反馈（Culture Progression & Review Loop）门禁测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

const sendMock = vi.fn()
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: {
    getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: sendMock } }],
  },
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

vi.mock('../../electron/main/storage/database', () => ({
  withDatabaseTransaction: async (work: (db: typeof memDb) => Promise<unknown>) => runLocalTransaction(memDb, work),
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

const llmState = vi.hoisted(() => ({
  response: JSON.stringify({
    reviewText: '哈哈！终于把《空岛见闻录》看完了！里面的云贝太神气了！',
    chatOpener: '喂！你之前跟我推荐的《空岛见闻录》，我已经全部看完了！快跟我聊聊！',
    shouldPostMoment: true,
    momentText: '把《空岛见闻录》全看完了！下次出海还要去空岛！',
  }),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => llmState.response),
}))

const {
  ensureResonanceTable,
  completeCultureResonance,
  getPendingResonanceFeedback,
  markResonanceFeedbackDelivered,
  checkAndProgressAbsorbedResonances,
} = await import('../../electron/main/companion/life/chat-resonance')
const { createAsset, getAsset, ASSET_KIND_CULTURE } = await import('../../electron/main/companion/life/assets')
const { setSetting } = await import('../../electron/main/storage/settings-store')
const { formatConversationImpulseForPrompt } = await import('../../electron/main/companion/orchestrator')

describe('文化心愿体验闭环与主动反馈（Culture Progression & Review Loop）', () => {
  beforeEach(async () => {
    memDb = new SQL.Database()
    sendMock.mockClear()
    await ensureResonanceTable()
  })

  it('动态写入失败时文化资产、心愿、感悟与事件一起回滚', async () => {
    const asset = await createAsset({ roleId: 'luffy', kind: ASSET_KIND_CULTURE, name: '事务验证读物', payload: { type: 'reading', readingStatus: 'reading' } })
    expect(asset.ok).toBe(true)
    memDb.run(`INSERT INTO companion_life_resonances (id, role_id, session_id, kind, title, target_name, user_quote, reason, culture_type, status, created_at, absorbed_at, asset_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['rollback-culture', 'luffy', 'session', 'culture_wish', '读物', '事务验证读物', '推荐', '理由', 'reading', 'absorbed_in_script', 1, 1, asset.asset.id])
    const { listMoments } = await import('../../electron/main/companion/core/persistence/life-repository')
    await listMoments('luffy')
    memDb.run("CREATE TRIGGER reject_culture_moment BEFORE INSERT ON companion_moments BEGIN SELECT RAISE(ABORT, 'fixture-moment-failure'); END")
    const result = await completeCultureResonance('rollback-culture', 'luffy', { mockResponse: { reviewText: '感悟', chatOpener: '聊聊', shouldPostMoment: true, momentText: '体验完成' } })
    expect(result.ok).toBe(false)
    expect((await getAsset(asset.asset.id))?.payload.readingStatus).toBe('reading')
    expect((await getAsset(asset.asset.id))?.payload.readingNotes ?? []).toEqual([])
    expect(memDb.exec("SELECT status FROM companion_life_resonances WHERE id = 'rollback-culture'")[0]?.values[0][0]).toBe('absorbed_in_script')
    expect(memDb.exec('SELECT COUNT(*) FROM companion_domain_events')[0]?.values[0][0]).toBe(0)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('完成文化心愿时更新资产状态为 completed、追加感悟笔记并生成主动交流引子', async () => {
    const assetRes = await createAsset({
      roleId: 'luffy',
      kind: ASSET_KIND_CULTURE,
      name: '空岛见闻录',
      payload: {
        type: 'reading',
        readingStatus: 'reading',
        summary: '用户推荐的空岛探险记录',
      },
    })
    expect(assetRes.ok).toBe(true)
    const assetId = assetRes.asset.id

    const resonanceId = 'res-test-1'
    memDb.run(
      `INSERT INTO companion_life_resonances
       (id, role_id, session_id, kind, title, target_name, user_quote, reason, culture_type, status, created_at, absorbed_at, asset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resonanceId,
        'luffy',
        'sess-1',
        'culture_wish',
        '想读《空岛见闻录》',
        '空岛见闻录',
        '推荐你看空岛见闻录',
        '里面有空岛和神器的详细记录',
        'reading',
        'absorbed_in_script',
        Date.now() - 5 * 3600 * 1000,
        Date.now() - 5 * 3600 * 1000,
        assetId,
      ],
    )

    const res = await completeCultureResonance(resonanceId, 'luffy', {
      mockResponse: {
        reviewText: '哈哈！终于把《空岛见闻录》看完了！太好玩了！',
        chatOpener: '喂！你之前跟我推荐的《空岛见闻录》，我已经看完了！快跟我聊聊！',
        shouldPostMoment: true,
        momentText: '空岛见闻录看完了！真是一场大冒险！',
      },
    })

    expect(res.ok).toBe(true)
    expect(res.resonance?.status).toBe('completed')
    expect(res.resonance?.feedbackText).toContain('快跟我聊聊')

    const reward = memDb.exec(`SELECT jobs.status, event.type, event.source_id
      FROM companion_outbox jobs JOIN companion_domain_events event ON jobs.event_id = event.id
      WHERE jobs.kind = 'followup:culture-keepsake'`)[0]?.values
    expect(reward).toEqual([['pending', 'culture_experience_completed', resonanceId]])

    // 验证文化资产已更新为 finished 且包含评语笔记
    const updatedAsset = await getAsset(assetId)
    expect(updatedAsset?.payload.readingStatus).toBe('finished')
    expect(updatedAsset?.payload.note).toBe('哈哈！终于把《空岛见闻录》看完了！太好玩了！')
    const notes = updatedAsset?.payload.readingNotes as Array<{ text: string }>
    expect(notes.length).toBeGreaterThan(0)
    expect(notes[0].text).toContain('空岛见闻录')

    // 验证广播消息已触发
    expect(sendMock).toHaveBeenCalledWith('companion:resonance-completed', expect.objectContaining({
      roleId: 'luffy',
      message: expect.stringContaining('空岛见闻录'),
    }))

    const { recoverCompanionFollowups } = await import('../../electron/main/companion/application/companion-followups')
    const { listKeepsakes } = await import('../../electron/main/companion/growth/relationship-keepsake')
    const snapshot = memDb.export()
    memDb.close()
    memDb = new SQL.Database(snapshot)
    await setSetting('universeId', 'unrelated-world')
    await recoverCompanionFollowups()
    expect((await listKeepsakes('luffy')).some(item => item.id === 'luffy-merry-bell')).toBe(false)
    expect(memDb.exec("SELECT status, attempt FROM companion_outbox WHERE kind = 'followup:culture-keepsake'")[0]?.values).toEqual([['pending', 0]])

    await setSetting('universeId', 'default')
    await recoverCompanionFollowups()
    const first = (await listKeepsakes('luffy')).filter(item => item.id === 'luffy-merry-bell')
    expect(first).toEqual([expect.objectContaining({ giftReason: expect.stringContaining('空岛见闻录') })])
    expect(memDb.exec("SELECT status FROM companion_outbox WHERE kind = 'followup:culture-keepsake'")[0]?.values).toEqual([['delivered']])
    memDb.run("UPDATE companion_outbox SET status = 'processing', lease_until = 0 WHERE kind = 'followup:culture-keepsake'")
    await recoverCompanionFollowups()
    expect((await listKeepsakes('luffy')).filter(item => item.id === 'luffy-merry-bell')).toEqual(first)
    expect(memDb.exec("SELECT status FROM companion_outbox WHERE kind = 'followup:culture-keepsake'")[0]?.values).toEqual([['delivered']])
  })

  it('待反馈心愿可通过 getPendingResonanceFeedback 查询并在送达后标记已投递', async () => {
    const resonanceId = 'res-test-pending'
    memDb.run(
      `INSERT INTO companion_life_resonances
       (id, role_id, session_id, kind, title, target_name, user_quote, reason, culture_type, status, created_at, completed_at, feedback_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resonanceId,
        'luffy',
        'sess-1',
        'culture_wish',
        '心愿反馈',
        '海兽图谱',
        '用户推荐',
        '理由',
        'reading',
        'completed',
        Date.now() - 1000,
        Date.now(),
        '那本海兽图谱画得太棒了！',
      ],
    )

    const pending = await getPendingResonanceFeedback('luffy')
    expect(pending).not.toBeNull()
    expect(pending?.feedbackText).toBe('那本海兽图谱画得太棒了！')

    // 送达后标记
    await markResonanceFeedbackDelivered(resonanceId)

    const pendingAfter = await getPendingResonanceFeedback('luffy')
    expect(pendingAfter).toBeNull()
  })

  it('formatConversationImpulseForPrompt 在有待反馈感悟时生成专属回访提示', () => {
    const impulse = formatConversationImpulseForPrompt({
      socialNeed: 80,
      currentActivity: '甲板看海',
      resonanceFeedback: '你之前推荐的书我已经读完了，非常震撼！',
    })

    expect(impulse).toBeDefined()
    expect(impulse).toContain('【重要回访心愿反馈】')
    expect(impulse).toContain('你之前推荐的书我已经读完了')
  })

  it('自动推进超时心愿，静音时仍完成体验但不产生提醒', async () => {
    await setSetting('companionMomentTipsMuted', 'true')
    const now = Date.now()
    const fiveHoursAgo = now - 5 * 3600 * 1000

    memDb.run(
      `INSERT INTO companion_life_resonances
       (id, role_id, session_id, kind, title, target_name, user_quote, reason, culture_type, status, created_at, absorbed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'res-auto-1',
        'luffy',
        'sess-auto',
        'culture_wish',
        '待体验电影',
        '空岛狂想曲',
        '推荐你看',
        '理由',
        'film',
        'absorbed_in_script',
        fiveHoursAgo,
        fiveHoursAgo,
      ],
    )

    const progressed = await checkAndProgressAbsorbedResonances('luffy', now)
    expect(progressed).toBe(1)

    const stmt = memDb.prepare("SELECT status, feedback_text FROM companion_life_resonances WHERE id = 'res-auto-1'")
    let row: Record<string, unknown> | null = null
    if (stmt.step()) row = stmt.getAsObject()
    stmt.free()

    expect(row?.status).toBe('completed')
    expect(typeof row?.feedback_text).toBe('string')
    expect(memDb.exec("SELECT COUNT(*) FROM companion_outbox WHERE kind = 'resonance-completed'")[0]?.values[0][0]).toBe(0)
    expect(sendMock).not.toHaveBeenCalledWith('companion:resonance-completed', expect.anything())
  })
})
