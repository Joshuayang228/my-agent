/** Persona Eval 人工审阅 store 单元测试；使用内存 sql.js，不启动 Electron。 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

let db: import('sql.js').Database

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: async () => db,
  persist: vi.fn(),
}))

const { _reviewValidation, deletePersonaEvalHumanReview, listPersonaEvalHumanReviews, upsertPersonaEvalHumanReview } =
  await import('../../electron/main/storage/persona-eval-review-store')

const reportFileName = '2026-08-13T10-00-00-000Z-persona-b02-b07-pass-3.json'

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  db.run(`
    CREATE TABLE persona_eval_human_reviews (
      report_file_name TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      trial_id TEXT NOT NULL,
      naturalness INTEGER,
      role_consistency INTEGER,
      emotional_attunement INTEGER,
      forced_optimism TEXT,
      plan_pushing TEXT,
      psychological_diagnosis TEXT,
      templatedness TEXT,
      verdict TEXT,
      notes TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (report_file_name, scenario_id, trial_id)
    )
  `)
})

describe('persona eval human review store', () => {
  const baseReview = {
    reportFileName,
    scenarioId: 'B04',
    trialId: 'B04-trial-1',
    naturalness: 4 as const,
    roleConsistency: 5 as const,
    emotionalAttunement: 3 as const,
    forcedOptimism: 'none' as const,
    planPushing: 'minor' as const,
    psychologicalDiagnosis: 'none' as const,
    templatedness: 'none' as const,
    verdict: 'pass' as const,
    notes: '这条回复先承接了疲惫，再给了一个可选方向。',
  }

  it('支持新建、读取和中文备注', async () => {
    const saved = await upsertPersonaEvalHumanReview(baseReview)
    expect(saved).toMatchObject(baseReview)
    expect(saved.updatedAt).toBeGreaterThan(0)
    expect(await listPersonaEvalHumanReviews(reportFileName)).toEqual([saved])
  })

  it('同一复合键 upsert 不产生重复，并可删除', async () => {
    const first = await upsertPersonaEvalHumanReview(baseReview)
    const second = await upsertPersonaEvalHumanReview({ ...baseReview, notes: '更新后的人工判断' })
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt)
    expect((await listPersonaEvalHumanReviews(reportFileName))).toHaveLength(1)
    await deletePersonaEvalHumanReview(baseReview)
    expect(await listPersonaEvalHumanReviews(reportFileName)).toEqual([])
  })

  it('拒绝非法枚举、评分和目录穿越', () => {
    expect(() => _reviewValidation.normalizeReview({ ...baseReview, naturalness: 6 as never })).toThrow()
    expect(() => _reviewValidation.normalizeReview({ ...baseReview, forcedOptimism: 'bad' as never })).toThrow()
    expect(() => _reviewValidation.normalizeReview({ ...baseReview, verdict: 'bad' as never })).toThrow()
    expect(() => _reviewValidation.normalizeReview({ ...baseReview, reportFileName: '../secret.json' })).toThrow()
  })

  it('只列出指定报告，不泄露其他报告记录', async () => {
    await upsertPersonaEvalHumanReview(baseReview)
    await upsertPersonaEvalHumanReview({ ...baseReview, reportFileName: '2026-08-13T11-00-00-000Z-persona-b02-b07-pass-3.json', trialId: 'B04-trial-2' })
    expect(await listPersonaEvalHumanReviews(reportFileName)).toHaveLength(1)
  })
})
