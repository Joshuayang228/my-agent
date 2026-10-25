import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { parseCastInteractions } from '../../shared/moment-user-interactions'
import { evidenceObject } from './EvidenceSummary'
import { snapshotTime } from './NowStateReading'
import type { MomentsReadingItem } from './MomentsReading'

export interface ProjectedMoment extends MomentsReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''

/** 背景：动态有明确 published_at，通用时间和事件正文不代表发布；旧互动可能格式异常。
 * 意图：只投影保存正文、发布字段和独立用户互动，复用生产卡司解析器。
 * 约束：不补发布时间 / 事件正文，坏行原文保留，未知互动不能伪装成无互动或点赞。
 */
export function projectMomentRecords(records: readonly DebugEvidenceRecord[], timezone: string): ProjectedMoment[] {
  return records.map(record => {
    const meta = evidenceObject(record.data.meta), cast = parseCastInteractions(meta), rawCast = meta.interactions
    const body = text(record.data.text), publishedAt = snapshotTime(record.data.published_at, timezone)
    const users = record.data.userInteractions
    const badUsers = users !== undefined && (!Array.isArray(users) || users.some(value => { const row = evidenceObject(value); return typeof row.actor_id !== 'string' || !['like', 'comment'].includes(text(row.kind)) || typeof row.created_at !== 'number' || row.kind === 'comment' && typeof row.text !== 'string' }))
    return { id: record.id, text: body, preview: body ? `${body.slice(0, 140)}${body.length > 140 ? '…' : ''}` : '动态正文为空', publishedAt, sortTime: publishedAt === '未记录' ? 0 : Number(record.data.published_at), location: text(meta.location), truncated: record.truncated, cast,
      castIssue: rawCast !== undefined && (!Array.isArray(rawCast) || cast.length < rawCast.length) ? '部分卡司互动无法识别，原始记录保留在来源区。' : undefined,
      userIssue: badUsers ? '部分用户互动格式异常，原始记录保留在来源区；不确认全量互动数。' : undefined,
      userInteractions: Array.isArray(users) ? users.map(value => { const row = evidenceObject(value); return { actor: row.actor_id === 'user' ? '我' : text(row.actor_id) || '参与者未记录', kind: row.kind === 'like' ? '点赞' : row.kind === 'comment' ? '评论' : '未识别的互动', at: snapshotTime(row.created_at, timezone), text: text(row.text) } }) : undefined, record }
  })
}

export function momentFields(item: ProjectedMoment): Array<[string, string]> {
  return [['动态', item.id], ['发布时间', item.publishedAt], ['地点', item.location || '未提供'], ['来源', item.record.source], ['用户互动范围', item.userInteractions === undefined ? '本次查询未提供' : '本次已读范围，非全量统计']]
}
