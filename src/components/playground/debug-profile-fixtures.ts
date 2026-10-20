import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { DEBUG_EVIDENCE_PAGES } from './debug-evidence-fixtures'

function source(id: string, roleId: string, kind: string, content: string, minute: number): DebugEvidenceRecord {
  const updatedAt = Date.parse(`2026-10-13T14:${minute}:00+08:00`)
  return { id, roleId, kind, body: content, title: kind, time: updatedAt, source: 'memories', status: '', truncated: false, links: [], data: { id, role_id: roleId, category: kind, content, updatedAt } }
}

/** 背景：画像查询返回记忆行而非聚合对象；意图：已有记忆样张共源，再补虚构类别；约束：不复制真实用户数据或 Prompt，人物桶不等于画像查询范围。 */
export const DEBUG_PROFILE_SOURCES: readonly DebugEvidenceRecord[] = [
  ...DEBUG_EVIDENCE_PAGES.memories.items.map((entry, index) => source(entry.id, entry.role === 'shared' ? '' : entry.role, entry.fields.find(([key]) => key === '类别')?.[1] ?? 'unknown', entry.body ?? '', 50 - index)),
  source('demo-profile-identity', '', 'identity', '【身份来源样张】喜欢整理旅行资料，习惯把主题和线索放在一起。', 47),
  source('demo-profile-workflow', 'lin', 'workflow', '【协作来源样张】先列出可比较的选项，再由用户决定。', 46),
  source('demo-profile-voice', 'yu', 'voice', '【表达来源样张】日常说明使用短句，必要时保留技术术语。', 45),
  source('demo-profile-other', '', 'event', '【其他来源样张】一次资料整理记录；未归入三块摘要。', 44),
  source('demo-feedback-yu', 'yu', 'feedback', '【予反馈样张】讨论提纲时先确认读者是谁。', 43),
]

export const PROFILE_SECTIONS = [
  { id: 'identity', label: '身份', categories: ['identity', 'fact'] },
  { id: 'workflow', label: '协作方式', categories: ['workflow', 'feedback'] },
  { id: 'voice', label: '表达偏好', categories: ['voice', 'preference'] },
] as const

export function profileSourcesForRole(records: readonly DebugEvidenceRecord[], roleId: string): DebugEvidenceRecord[] {
  return records.filter(record => record.kind !== 'feedback' || record.roleId === roleId)
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0) || b.id.localeCompare(a.id))
}

export function profileSourceScope(record: DebugEvidenceRecord): string {
  return record.kind === 'feedback' ? `当前人物反馈 · ${record.roleId}` : `全局查询 · 保存桶 ${record.roleId || '共享'}`
}
