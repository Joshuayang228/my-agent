/**
 * Persona Eval 人工审阅本地存储。
 *
 * 背景：自动 Judge 不能覆盖活人感与审美，Debug 需要允许用户对真实 Trial 留下可复查判断。
 * 设计意图：审阅记录独立于 `eval-reports/*.json`，只用复合主键关联，不复制或改写原始报告。
 * 关键约束：所有值通过参数化 SQL 写入；主进程校验报告文件名和枚举；写入后立即持久化。
 */

import path from 'node:path'
import { getDatabase, persist } from './database'
import type {
  HumanReviewIssueLevel,
  HumanReviewRating,
  HumanReviewVerdict,
  PersonaEvalHumanReview,
  PersonaEvalHumanReviewInput,
} from '../../../src/shared/types'

const REPORT_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-persona-b02-b07-pass-\d+\.json$/
const VALID_RATINGS = new Set<number>([1, 2, 3, 4, 5])
const VALID_ISSUE_LEVELS = new Set<HumanReviewIssueLevel>(['none', 'minor', 'major'])
const VALID_VERDICTS = new Set<HumanReviewVerdict>(['pass', 'revise', 'uncertain'])
const MAX_KEY_LENGTH = 256
const MAX_NOTES_LENGTH = 10_000

type ReviewInput = PersonaEvalHumanReviewInput

function validateKey(value: unknown, field: string, pattern?: RegExp): string {
  if (typeof value !== 'string') throw new Error(`人工审阅${field}无效`)
  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_KEY_LENGTH || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`人工审阅${field}无效`)
  }
  if (pattern && !pattern.test(normalized)) throw new Error(`人工审阅报告文件名无效`)
  return normalized
}

function validateRating(value: unknown, field: string): HumanReviewRating | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'number' || !Number.isInteger(value) || !VALID_RATINGS.has(value)) {
    throw new Error(`人工审阅${field}无效`)
  }
  return value as HumanReviewRating
}

function validateIssueLevel(value: unknown, field: string): HumanReviewIssueLevel | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !VALID_ISSUE_LEVELS.has(value as HumanReviewIssueLevel)) {
    throw new Error(`人工审阅${field}无效`)
  }
  return value as HumanReviewIssueLevel
}

function validateVerdict(value: unknown): HumanReviewVerdict | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !VALID_VERDICTS.has(value as HumanReviewVerdict)) {
    throw new Error('人工审阅结论无效')
  }
  return value as HumanReviewVerdict
}

function normalizeReview(input: ReviewInput): Omit<PersonaEvalHumanReview, 'updatedAt'> {
  if (!input || typeof input !== 'object') throw new Error('人工审阅记录无效')
  const reportFileName = validateKey(input.reportFileName, '报告文件名', REPORT_FILE_PATTERN)
  if (path.basename(reportFileName) !== reportFileName) throw new Error('人工审阅报告文件名无效')
  const scenarioId = validateKey(input.scenarioId, '场景 ID')
  const trialId = validateKey(input.trialId, 'Trial ID')
  if (typeof input.notes !== 'string' || input.notes.length > MAX_NOTES_LENGTH || /[\u0000]/.test(input.notes)) {
    throw new Error('人工审阅备注无效')
  }
  return {
    reportFileName,
    scenarioId,
    trialId,
    naturalness: validateRating(input.naturalness, '活人感 / 自然度'),
    roleConsistency: validateRating(input.roleConsistency, '角色一致性'),
    emotionalAttunement: validateRating(input.emotionalAttunement, '情绪承接'),
    forcedOptimism: validateIssueLevel(input.forcedOptimism, '强行乐观'),
    planPushing: validateIssueLevel(input.planPushing, '立即推进计划'),
    psychologicalDiagnosis: validateIssueLevel(input.psychologicalDiagnosis, '擅自心理诊断'),
    templatedness: validateIssueLevel(input.templatedness, '模板化'),
    verdict: validateVerdict(input.verdict),
    notes: input.notes,
  }
}

function rowToReview(row: Record<string, unknown>): PersonaEvalHumanReview {
  const review: PersonaEvalHumanReview = {
    reportFileName: String(row.report_file_name ?? ''),
    scenarioId: String(row.scenario_id ?? ''),
    trialId: String(row.trial_id ?? ''),
    notes: typeof row.notes === 'string' ? row.notes : '',
    updatedAt: typeof row.updated_at === 'number' ? row.updated_at : Number(row.updated_at ?? 0),
  }
  if (VALID_RATINGS.has(Number(row.naturalness))) review.naturalness = Number(row.naturalness) as HumanReviewRating
  if (VALID_RATINGS.has(Number(row.role_consistency))) review.roleConsistency = Number(row.role_consistency) as HumanReviewRating
  if (VALID_RATINGS.has(Number(row.emotional_attunement))) review.emotionalAttunement = Number(row.emotional_attunement) as HumanReviewRating
  if (VALID_ISSUE_LEVELS.has(row.forced_optimism as HumanReviewIssueLevel)) review.forcedOptimism = row.forced_optimism as HumanReviewIssueLevel
  if (VALID_ISSUE_LEVELS.has(row.plan_pushing as HumanReviewIssueLevel)) review.planPushing = row.plan_pushing as HumanReviewIssueLevel
  if (VALID_ISSUE_LEVELS.has(row.psychological_diagnosis as HumanReviewIssueLevel)) review.psychologicalDiagnosis = row.psychological_diagnosis as HumanReviewIssueLevel
  if (VALID_ISSUE_LEVELS.has(row.templatedness as HumanReviewIssueLevel)) review.templatedness = row.templatedness as HumanReviewIssueLevel
  if (VALID_VERDICTS.has(row.verdict as HumanReviewVerdict)) review.verdict = row.verdict as HumanReviewVerdict
  return review
}

/**
 * 读取某份报告的全部人工记录。
 *
 * 背景：报告页会同时展示多个 Trial，批量读取可避免 N+1 IPC。
 * 设计意图：只返回指定报告的标注，不把数据库中其他报告的信息带到 Renderer。
 * 关键约束：非法文件名直接返回空列表，不抛出内部 SQL 错误。
 */
export async function listPersonaEvalHumanReviews(reportFileName: string): Promise<PersonaEvalHumanReview[]> {
  let fileName: string
  try {
    fileName = validateKey(reportFileName, '报告文件名', REPORT_FILE_PATTERN)
    if (path.basename(fileName) !== fileName) return []
  } catch {
    return []
  }
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT * FROM persona_eval_human_reviews
     WHERE report_file_name = ? ORDER BY updated_at DESC, scenario_id, trial_id`,
  )
  stmt.bind([fileName])
  const reviews: PersonaEvalHumanReview[] = []
  try {
    while (stmt.step()) reviews.push(rowToReview(stmt.getAsObject() as Record<string, unknown>))
  } finally {
    stmt.free()
  }
  return reviews
}

/** 保存或更新一条人工审阅，时间戳由主进程生成，避免 Renderer 伪造审阅时间。 */
export async function upsertPersonaEvalHumanReview(input: ReviewInput): Promise<PersonaEvalHumanReview> {
  const review = normalizeReview(input)
  const updatedAt = Date.now()
  const db = await getDatabase()
  db.run(
    `INSERT INTO persona_eval_human_reviews (
       report_file_name, scenario_id, trial_id, naturalness, role_consistency,
       emotional_attunement, forced_optimism, plan_pushing, psychological_diagnosis,
       templatedness, verdict, notes, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(report_file_name, scenario_id, trial_id) DO UPDATE SET
       naturalness = excluded.naturalness,
       role_consistency = excluded.role_consistency,
       emotional_attunement = excluded.emotional_attunement,
       forced_optimism = excluded.forced_optimism,
       plan_pushing = excluded.plan_pushing,
       psychological_diagnosis = excluded.psychological_diagnosis,
       templatedness = excluded.templatedness,
       verdict = excluded.verdict,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
    [
      review.reportFileName,
      review.scenarioId,
      review.trialId,
      review.naturalness ?? null,
      review.roleConsistency ?? null,
      review.emotionalAttunement ?? null,
      review.forcedOptimism ?? null,
      review.planPushing ?? null,
      review.psychologicalDiagnosis ?? null,
      review.templatedness ?? null,
      review.verdict ?? null,
      review.notes,
      updatedAt,
    ],
  )
  persist()
  return { ...review, updatedAt }
}

/** 删除当前 Trial 的人工记录；原始 Eval 报告不会被删除。 */
export async function deletePersonaEvalHumanReview(input: Pick<PersonaEvalHumanReview, 'reportFileName' | 'scenarioId' | 'trialId'>): Promise<boolean> {
  const reportFileName = validateKey(input.reportFileName, '报告文件名', REPORT_FILE_PATTERN)
  if (path.basename(reportFileName) !== reportFileName) throw new Error('人工审阅报告文件名无效')
  const scenarioId = validateKey(input.scenarioId, '场景 ID')
  const trialId = validateKey(input.trialId, 'Trial ID')
  const db = await getDatabase()
  db.run(
    `DELETE FROM persona_eval_human_reviews
     WHERE report_file_name = ? AND scenario_id = ? AND trial_id = ?`,
    [reportFileName, scenarioId, trialId],
  )
  persist()
  return true
}

export const _reviewValidation = { normalizeReview, validateKey }
