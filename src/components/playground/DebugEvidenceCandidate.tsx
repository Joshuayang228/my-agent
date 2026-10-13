import { useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { DEBUG_ROLES, type DebugRecordFixture } from './debug-experience-fixtures'
import { getDebugEvidencePage, type DebugEvidencePageId } from './debug-evidence-fixtures'

interface Props {
  id: DebugEvidencePageId
  records: readonly DebugRecordFixture[]
  empty: boolean
  initialSelectedId?: string
  onAsset: (key: string) => void
  onRecord: (id: string) => void
  onEvidence: (page: DebugEvidencePageId, id: string) => void
}

/**
 * 背景：生活、用户与运行证据需要独立入口，但不能为每个领域维护一套筛选与证据选择行为。
 * 设计意图：共享主从浏览，领域内容来自各自字段和来源；窄屏选择后进入详情，返回保留筛选。
 * 关键约束：只读隔离样张；按人物过滤只纳入该人物与显式共享记录，不推断归属或跨页关联。
 */
export function DebugEvidenceCandidate({ id, records, empty, initialSelectedId, onAsset, onRecord, onEvidence }: Props) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [date, setDate] = useState('2026-10-13')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [detailOpen, setDetailOpen] = useState(Boolean(initialSelectedId))
  const page = getDebugEvidencePage(id, records)
  const items = empty ? [] : page.items
  const filtered = items.filter(entry =>
    (role === 'all' || entry.role === role || entry.role === 'shared') &&
    (!page.dateFilter || !date || entry.date === date) &&
    `${entry.title} ${entry.subtitle} ${entry.id} ${entry.status} ${entry.body ?? ''} ${entry.fields.flat().join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const selected = filtered.find(entry => entry.id === selectedId) ?? filtered[0]
  const reset = () => { setQuery(''); setRole('all'); setDate('2026-10-13'); setDetailOpen(false) }

  return <section className="debug-evidence-workbench" data-testid={`debug-evidence-${id}`}>
    <div className="debug-candidate-toolbar">
      <label className="debug-candidate-search"><Search size={14} /><TextField aria-label="搜索当前页证据" value={query} placeholder="搜索名称、正文或字段" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setDetailOpen(false) }} /></label>
      {page.dateFilter && <label className="debug-evidence-date">样张日期<TextField type="date" aria-label="证据日期" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => { setDate(event.target.value); setDetailOpen(false) }} /></label>}
    </div>
    <div className="debug-candidate-role-filter" role="group" aria-label="证据人物筛选">
      {[{ id: 'all', label: '全部人物' }, ...DEBUG_ROLES].map(entry => <ActionButton key={entry.id} variant="plain" aria-pressed={role === entry.id} onClick={() => { setRole(entry.id); setDetailOpen(false) }}>{entry.label}</ActionButton>)}
      <span>{filtered.length} / {items.length} {page.unit} · 样张范围{role !== 'all' && ' · 含显式共享'}</span>
    </div>
    <p className="debug-candidate-notice debug-evidence-boundary">{page.boundary}</p>
    {!filtered.length ? <EmptyState title={items.length ? '没有匹配的证据' : '此范围没有记录'} description={items.length ? '调整搜索、人物或日期；没有匹配不等于能力未实现。' : '真实读取为空时保留来源与范围，不生成默认人物事实。'} action={items.length ? <ActionButton onClick={reset}>清除筛选</ActionButton> : undefined} /> :
      <div className="debug-candidate-split debug-evidence-split" data-detail-open={detailOpen}>
        <div className="debug-candidate-list" aria-label="领域证据列表">
          {filtered.map(entry => <ActionButton key={entry.id} variant="plain" className="debug-candidate-record" aria-pressed={selected?.id === entry.id} onClick={() => { setSelectedId(entry.id); setDetailOpen(true) }}>
            <span className="debug-candidate-record-top"><span>{entry.role === 'shared' ? '显式共享' : DEBUG_ROLES.find(value => value.id === entry.role)?.label}</span><Badge tone={entry.status.includes('失败') ? 'danger' : 'neutral'}>{entry.status}</Badge></span>
            <strong>{entry.title}</strong><span>{entry.subtitle}</span><code>{entry.id}</code>
          </ActionButton>)}
        </div>
        {selected && <article className="debug-candidate-detail" aria-label="领域证据详情">
          <ActionButton variant="plain" className="debug-candidate-mobile-back" onClick={() => setDetailOpen(false)}><ArrowLeft size={14} /> 返回列表</ActionButton>
          <div className="debug-candidate-detail-heading"><div><h3>{selected.title}</h3><code>{selected.id}</code></div><Badge>{selected.status}</Badge></div>
          <section className="debug-candidate-section"><h3>记录详情</h3><dl className="debug-candidate-facts">{selected.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
          {selected.body && <section className="debug-candidate-section"><h3>正文与结果 · 隔离样张</h3><pre className="debug-candidate-body">{selected.body}</pre></section>}
          {(selected.assets?.length || selected.callId || selected.links?.length) ? <section className="debug-candidate-section"><h3>明确关联的来源与证据</h3>
            {selected.assets?.map(key => <ActionButton key={key} variant="plain" className="debug-candidate-asset-link" onClick={() => onAsset(key)}><div><strong>查看注册定义</strong><code>{key}</code></div><ArrowUpRight size={14} /></ActionButton>)}
            {selected.callId && <ActionButton variant="plain" className="debug-candidate-asset-link" onClick={() => onRecord(selected.callId!)}><div><strong>查看关联调用</strong><code>{selected.callId}</code></div><ArrowUpRight size={14} /></ActionButton>}
            {selected.links?.map(link => <ActionButton key={`${link.page}:${link.id}`} variant="plain" className="debug-candidate-asset-link" onClick={() => onEvidence(link.page, link.id)}><div><strong>{link.label}</strong><code>{link.id}</code></div><ArrowUpRight size={14} /></ActionButton>)}
          </section> : <p className="debug-candidate-muted mt-4">此记录没有保存更多关联标识，不按时间或名称补猜。</p>}
        </article>}
      </div>}
  </section>
}
