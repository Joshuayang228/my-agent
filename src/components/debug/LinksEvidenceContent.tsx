import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { LinksReading, LINK_TARGET_TYPES } from './LinksReading'
import { projectLinkRecords, linkFields } from './links-projection'

/** 背景：正式关联页曾由通用卡解释，无法区分保存名、当前目标与单边身份。
 * 意图：真实只读查询使用候选分组 / 单边详情，创建日由服务按人物时区过滤。
 * 约束：类型和搜索只覆盖已读范围，定位只消费实际返回链接；无目标补取、图片预览或关联写入。
 */
export function LinksEvidenceContent({ result, loading, error, query, date, roleId, scope, targetId, onRoleChange, onQueryChange, onDateChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; date: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onDateChange: (value: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [type, setType] = useState('all')
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const items = projectLinkRecords(result?.records ?? [])
  const matches = items.filter(item => (type === 'all' || type === 'unknown' ? type === 'all' || !['asset', 'image', 'cast', 'person'].includes(item.targetType) : item.targetType === type) && `${item.id} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = Boolean(selectedId && !items.some(item => item.id === selectedId))
  return <section className="debug-links-workbench" data-testid="debug-evidence-links">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('links', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-links-toolbar">{scope && onRoleChange && <label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label className="debug-links-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读事件、目标或元数据" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></label><details className="debug-links-filter"><summary>{date || type !== 'all' ? '筛选 · 已启用' : '筛选'}</summary><label>关联创建日<TextField appearance="outlined" type="date" aria-label="关联创建日" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => { onDateChange(event.target.value); setSelectedId(undefined) }} /></label><label className="debug-focused-scope">目标类型<SelectField aria-label="关联目标类型" value={type} disabled={result?.state !== 'ready'} onChange={event => { setType(event.target.value); setSelectedId(undefined) }}>{LINK_TARGET_TYPES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></details></div>
    {error && <div className="debug-links-state" role="alert"><p>{result ? '刷新失败，保留原人物、日期、筛选、选中及已加载边；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-links-state" role="status">正在读取关联记录…</p>}
    {result?.issues.map((issue, index) => <p className="debug-links-state" role="status" key={index}>{issue}；其余已读边保留。</p>)}
    {result?.state === 'ready' ? <>
      {missing && <p className="debug-links-state" role="status">引用关联边未在当前已读人物范围找到，未选择替代记录。</p>}
      {items.length > 0 && <p className="debug-links-range">{Boolean(query || type !== 'all') && `${matches.length} 项匹配 · `}{items.length} 条已读关联 · 总数未知</p>}
      {!matches.length && <p className="debug-links-state" role="status">{items.length ? '当前已读范围没有匹配的关联。' : '当前查询未返回关联记录，不推断事件从未有关联。'}{Boolean(query || date || type !== 'all') && <ActionButton variant="plain" onClick={() => { onQueryChange(''); onDateChange(''); setType('all'); setSelectedId(undefined) }}>清除筛选</ActionButton>}</p>}
      <LinksReading items={matches} allItems={items} selectedId={selectedId} onSelect={setSelectedId}
        afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页关联</ActionButton>}
        renderDetail={item => <>
          <div className="debug-links-actions">{item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
          {!item.record.links.some(link => link.view === 'recent') && <p className="debug-links-meta">当前响应未提供事件定位，保留来源标识。</p>}
          {!item.record.links.some(link => link.view !== 'recent') && <p className="debug-links-meta">当前响应未提供目标定位，不推断目标已删除。</p>}
          <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{linkFields(item, result.timezone).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
          <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>{item.record.source} · {item.id} · {item.record.roleId}</p><p>名称来自保存元数据，不代表当前目标名；关联创建时间不当作事件发生、发布、购买或穿上时间。分组仅表示同来源 ID 的已读边，不证明完整顺序；图片和卡司标识不生成预览。</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
        </>} />
    </> : result && <p className="debug-links-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}
