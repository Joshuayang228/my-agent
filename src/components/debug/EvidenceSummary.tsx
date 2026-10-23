import type { DebugEvidenceRecord, DebugEvidenceView } from '../../shared/debug-evidence'

export const evidenceObject = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown) => typeof value === 'string' ? value : ''
const excerpt = (value: string) => value.length > 160 ? `${value.slice(0, 160)}…` : value
export function evidenceTime(value: unknown, timezone: string): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value).toLocaleString('zh-CN', { timeZone: timezone, hour12: false }) : '时间未记录'
}

/** 背景：正式查询返回多种来源的记录，通用字段卡让长正文和技术字段抢占列表。
 * 意图：只从真实响应提取各页最先需要阅读的事实，全文仍由原有详情呈现。
 * 约束：不按记录收录时间补业务日期，不以首条关系代替所有方向，不构造未保存的状态。
 */
export function EvidenceSummary({ record, view, timezone }: { record: DebugEvidenceRecord; view: DebugEvidenceView; timezone: string }) {
  const payload = evidenceObject(record.data.payload)
  const world = evidenceObject(record.data.world)
  const profile = evidenceObject(record.data.profile)
  const body = excerpt(record.body)
  const scheduleSlots = Array.isArray(payload.slots) ? payload.slots.map(slot => {
    const row = evidenceObject(slot)
    const minute = row.minute ?? 0
    const time = typeof row.hour === 'number' && Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23 && typeof minute === 'number' && Number.isInteger(minute) && minute >= 0 && minute <= 59 ? `${String(row.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : '时间未记录'
    return { time, activity: text(row.activity) || '活动未记录', location: text(row.location) }
  }) : []
  if (view === 'now' || view === 'location') return <span className="debug-production-summary">
    <span className="debug-production-fact"><span>{view === 'now' ? '当前活动' : '当前位置'}</span><strong>{text(view === 'now' ? world.currentActivity : world.currentLocation) || '未设定'}</strong></span>
    <span className="debug-production-fact"><span>{view === 'now' ? '当前位置' : '地点细节'}</span><strong>{text(view === 'now' ? world.currentLocation : world.locationDetail) || '未记录'}</strong></span>
    <span className="debug-production-meta">更新于 {evidenceTime(world.updatedAt, timezone)}</span>
  </span>
  if (view === 'character') return <span className="debug-production-summary"><strong>{record.title}</strong><span>{body || '简介未记录'}</span><span className="debug-production-meta">{[profile.occupation, profile.agePresentation, profile.origin].filter(value => typeof value === 'string' && value).join(' · ') || '稳定资料未提供'}</span></span>
  if (view === 'links') return <span className="debug-production-summary"><strong>{text(record.data.relation) || '关系未记录'} · {text(record.data.target_type) || '目标类型未记录'}</strong><span className="debug-production-meta">来源事件 {text(record.data.event_id) || '未记录'} · 目标 {text(record.data.target_id) || '未记录'}</span></span>
  if (view === 'schedule') return <span className="debug-production-schedule">{scheduleSlots.length ? scheduleSlots.map((slot, index) => <span className="debug-production-slot" key={`${slot.time}:${index}`}><time>{slot.time}</time><strong>{slot.activity}</strong>{slot.location && <span>{slot.location}</span>}</span>) : <span className="debug-production-meta">计划时段未记录</span>}</span>
  if (view === 'profile' || view === 'memories') return <span className="debug-production-summary"><span>{body || '已读记录未返回正文'}</span>{view === 'memories' && <span className="debug-production-meta">{record.kind} · {record.roleId ? '人物资料' : '显式共享'}</span>}</span>
  if (view === 'relations') return <span className="debug-production-summary"><strong>{record.title}</strong><span className="debug-production-meta">{Array.isArray(record.data.relations) ? `${record.data.relations.length} 条有方向的关系定义` : '关系定义未提供'}</span></span>
  if (view === 'footprints') return <span className="debug-production-summary"><strong>{record.title}</strong><span className="debug-production-meta">{[payload.start, payload.end].filter(value => typeof value === 'string' && value).join(' — ') || '旅行日期未记录'}</span>{payload.recordType !== 'trip' && <span>地点资料，未作为实际旅行。</span>}{payload.status === 'planned' && <span>尚未出发，不计入实际旅行。</span>}</span>
  if (view === 'recent' || view === 'activity' || view === 'moments') return <span className="debug-production-event"><time>{evidenceTime(view === 'moments' ? record.data.published_at : record.data.scheduled_at, timezone)}</time><span className="debug-production-summary"><strong>{view === 'moments' ? body || '正文未提供' : record.title}</strong>{text(payload.location) && <span className="debug-production-meta">{text(payload.location)}</span>}</span></span>
  if (view === 'growth') return <span className="debug-production-summary"><strong>{record.source === 'companion_mutable' ? '当前成长覆盖' : record.source === 'companion_reflection_state' ? '反思记录' : record.source === 'Role Pack mutable.default' ? '成长默认定义' : '历史成长版本'}</strong><span>{body || '正文未记录'}</span></span>
  return <span className="debug-production-summary"><strong>{record.title}</strong><span className="debug-production-meta">{[payload.author, payload.artist, payload.director, payload.readingStatus, payload.watchStatus, payload.listeningStatus].filter(value => typeof value === 'string' && value).join(' · ')}</span></span>
}

export const PROFILE_GROUPS = [
  { title: '身份', categories: ['identity', 'fact'] },
  { title: '协作方式', categories: ['workflow', 'feedback'] },
  { title: '表达偏好', categories: ['voice', 'preference'] },
] as const
