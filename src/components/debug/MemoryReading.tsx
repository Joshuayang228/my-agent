import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { snapshotTime } from './NowStateReading'
import { PROFILE_SECTIONS } from './ProfileReading'

export const MEMORY_GROUPS = PROFILE_SECTIONS.map(section => ({ ...section, label: section.id === 'identity' ? '身份与事实' : section.label }))
export const memoryGroup = (kind: string) => MEMORY_GROUPS.find(section => (section.categories as readonly string[]).includes(kind))
const memoryDate = (time: number | null, timezone: string) => snapshotTime(time, timezone) === '未记录' ? '时间未记录' : new Date(time!).toLocaleDateString('zh-CN', { timeZone: timezone })
export const memoryScope = (record: DebugEvidenceRecord) => record.roleId ? `人物分桶 · ${record.roleId}` : '显式共享'
export function filterMemories(records: readonly DebugEvidenceRecord[], category: string, query: string): DebugEvidenceRecord[] {
  return records.filter(record => (category === 'all' || memoryGroup(record.kind)?.id === category) && `${record.id} ${record.kind} ${record.body}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
}

/** 背景：记忆存储与画像聚合范围不同，通用卡把原文、类别和诊断元信息挤在一起。
 * 意图：正式与候选共用分组短清单与独立全文，完整结构按需核对。
 * 约束：只展示已返回行，不复制共享记录、不补正文或时间；选中身份与刷新展开稳定。
 */
export function MemoryReading({ records, allRecords, selectedId, onSelect, timezone, scopeLabel = memoryScope, afterList, renderActions }: {
  records: readonly DebugEvidenceRecord[]; allRecords: readonly DebugEvidenceRecord[]; selectedId?: string; onSelect: (id: string | undefined) => void; timezone: string; scopeLabel?: (record: DebugEvidenceRecord) => string; afterList?: ReactNode; renderActions?: (record: DebugEvidenceRecord) => ReactNode
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const detail = useRef<HTMLElement>(null)
  const selected = allRecords.find(record => record.id === selectedId)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  const row = (record: DebugEvidenceRecord) => <div className="debug-memory-row" data-record-id={record.id} key={record.id}><ActionButton ref={node => { if (node) buttons.current.set(record.id, node); else buttons.current.delete(record.id) }} variant="plain" className="debug-memory-text" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedId === record.id} onClick={() => onSelect(record.id)}>{record.body.length > 180 ? `${record.body.slice(0, 180)}…` : record.body || '已读记录未返回正文'}<ChevronRight size={13} /></ActionButton><p className="debug-memory-caption">{memoryGroup(record.kind)?.label ?? (record.kind || '类别未记录')} · {scopeLabel(record)} · {memoryDate(record.time, timezone)}</p>{record.truncated && <p className="debug-memory-caption">此记忆读取已截断，不保证正文完整。</p>}</div>
  return <><div className="debug-memory-list">{[...MEMORY_GROUPS.map(group => group.label), '其他类别'].map(group => { const entries = records.filter(record => (memoryGroup(record.kind)?.label ?? '其他类别') === group); return entries.length ? <section key={group} aria-label={group}><h3>{group}</h3>{entries.map(row)}</section> : null })}</div>{afterList}
    {selected && <article key={selected.id} ref={detail} className="debug-memory-detail" aria-label="记忆详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => buttons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回记忆列表</ActionButton><h3>{memoryGroup(selected.kind)?.label ?? (selected.kind || '类别未记录')}</h3><p className="debug-memory-body">{selected.body || '已读记录未返回正文'}</p><p className="debug-memory-caption">{scopeLabel(selected)} · {selected.time ? snapshotTime(selected.time, timezone) : '更新时间未记录'}{selected.truncated ? ' · 返回内容有截断' : ''}</p>{renderActions?.(selected)}<details className="debug-memory-source"><summary>来源与完整结构</summary><p>来源：{selected.source} · {selected.id}。含凭据内容由生产读取层排除；存储记录不证明此次已经被模型召回或注入。</p><pre>{JSON.stringify(selected.data, null, 2)}</pre></details></article>}
  </>
}
