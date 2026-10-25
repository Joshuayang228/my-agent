import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { snapshotTime } from './NowStateReading'

export const PROFILE_SECTIONS = [
  { id: 'identity', label: '身份', categories: ['identity', 'fact'] },
  { id: 'workflow', label: '协作方式', categories: ['workflow', 'feedback'] },
  { id: 'voice', label: '表达偏好', categories: ['voice', 'preference'] },
] as const
export function profileSourceScope(record: DebugEvidenceRecord): string {
  return record.kind === 'feedback' ? `当前人物反馈 · ${record.roleId}` : `全局查询 · 保存桶 ${record.roleId || '共享'}`
}

/** 背景：画像是有界记忆来源，不是独立生成的完整用户设定。
 * 意图：正式与候选共用三组短摘要、其他类别和单条正文；原文按需展开。
 * 约束：不生成摘要、不补缺失来源，保存桶与查询范围分别解释；同 ID 刷新保留展开。
 */
export function ProfileReading({ records, selectedId, onSelect, timezone, afterList, renderActions }: {
  records: readonly DebugEvidenceRecord[]; selectedId?: string; onSelect: (id: string | undefined) => void; timezone: string; afterList?: ReactNode; renderActions: (record: DebugEvidenceRecord) => ReactNode
}) {
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = records.find(record => record.id === selectedId)
  const other = records.filter(record => !PROFILE_SECTIONS.some(section => (section.categories as readonly string[]).includes(record.kind)))
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  const row = (record: DebugEvidenceRecord) => <div className="debug-profile-row" key={record.id} data-record-id={record.id}><ActionButton ref={node => { if (node) rows.current.set(record.id, node); else rows.current.delete(record.id) }} variant="plain" className="debug-profile-text" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedId === record.id} onClick={() => onSelect(record.id)}>{record.body.length > 160 ? `${record.body.slice(0, 160)}…` : record.body || '已读记录未返回正文'}<ChevronRight size={13} /></ActionButton>{record.truncated && <p className="debug-profile-caption">此来源读取已截断，不保证正文完整。</p>}</div>
  return <>
    {records.length > 0 && <><p className="debug-profile-caption">以下仅整理已读来源，不是全量画像，也不证明某次请求已注入。</p><div className="debug-profile-sections">{PROFILE_SECTIONS.map(section => { const group = records.filter(record => (section.categories as readonly string[]).includes(record.kind)); return <section key={section.id} aria-label={section.label}><h3>{section.label}</h3>{group.length ? group.map(row) : <p className="debug-profile-caption">当前已读来源未含此类资料。</p>}</section> })}</div>{other.length > 0 && <details className="debug-profile-other"><summary>其他类别来源 · {other.length} 条已读记录</summary><p className="debug-profile-caption">这些来源未归入三块摘要，原始类别保留。</p>{other.map(row)}</details>}</>}
    {afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-profile-detail" aria-label="画像来源详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => rows.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回摘要</ActionButton><h3>来源记忆</h3><p className="debug-profile-body">{selected.body || '已读记录未返回正文'}</p><p className="debug-profile-caption">{profileSourceScope(selected)}{selected.truncated ? ' · 返回内容有截断' : ''}</p>{renderActions(selected)}<details className="debug-profile-source"><summary>来源与完整记录</summary><dl><dt>记忆标识</dt><dd><code>{selected.id}</code></dd><dt>原类别</dt><dd>{selected.kind}</dd><dt>更新时间</dt><dd>{snapshotTime(selected.time, timezone)}</dd></dl><p>保存桶与画像查询范围不同：非反馈资料沿全局范围读取；反馈只属于当前人物。凭据已由读取层排除。当前有界摘要不同于运行时全量聚合，存储不作为召回或实发证明。</p><pre>{JSON.stringify(selected.data, null, 2)}</pre></details></article>}
  </>
}
