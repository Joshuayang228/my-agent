import { useState, type ChangeEvent } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { CultureReading, CULTURE_CATEGORIES } from './CultureReading'
import { TabStrip } from '../foundation/TabStrip'
import { projectCultureRecords, cultureFields } from './culture-projection'

/** 背景：正式文化资料曾按通用卡阅读，四类状态与多条笔记的含义被混在一起。
 * 意图：真实资产投影到已确认的分类 / 单条正文阅读，完整字段与来源按需展开。
 * 约束：归档保留，筛选仅覆盖已读页；空 / 坏数组不回退旧笔记，不写进度、笔记或模型输入。
 */
export function CultureEvidenceContent({ result, loading, error, query, roleId, scope, targetId, onRoleChange, onQueryChange, onRetry, onNext, onEvidence }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; query: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string
  onRoleChange?: (id: string) => void; onQueryChange: (value: string) => void; onRetry: () => void; onNext: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void
}) {
  const [category, setCategory] = useState('all')
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const items = projectCultureRecords(result?.records ?? [], result?.timezone ?? 'Asia/Shanghai')
  const matches = items.filter(item => (category === 'all' || item.type === category) && `${item.id} ${item.title} ${item.body} ${JSON.stringify(item.record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const missing = Boolean(selectedId && !items.some(item => item.id === selectedId))
  return <section className="debug-culture-workbench" data-testid="debug-evidence-items">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('items', '')}>返回当前领域列表</ActionButton>}
    <div className="debug-culture-toolbar">{scope && onRoleChange && <label className="debug-focused-scope">人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}<label className="debug-culture-search"><Search size={14} /><TextField appearance="outlined" aria-label="搜索当前页证据" placeholder="搜索已读作品、感受或笔记" value={query} disabled={result?.state !== 'ready'} onChange={(event: ChangeEvent<HTMLInputElement>) => { onQueryChange(event.target.value); setSelectedId(undefined) }} /></label></div>
    {error && <div className="debug-culture-state" role="alert"><p>{result ? '刷新失败，保留上次资产与已加载页；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-culture-state" role="status">正在读取文化资料…</p>}
    {result?.issues.map((issue, index) => <p className="debug-culture-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? <>
      <TabStrip label="文化分类" variant="underline" items={CULTURE_CATEGORIES} activeId={category} onSelect={id => { setCategory(id); setSelectedId(undefined) }} />
      {missing && <p className="debug-culture-state" role="status">引用文化未在当前已读人物范围找到，未选择替代记录。{!items.length && '当前范围没有已读取文化资产；不推断没有兴趣或从未体验。'}</p>}
      {items.length > 0 && <p className="debug-culture-range">{query || category !== 'all' ? `${matches.length} 项匹配 · ` : ''}{items.length} 项已读作品 · 总数未知</p>}
      {!matches.length && !(missing && !items.length) && <div className="debug-culture-state" role="status"><p>{items.length ? '没有匹配的文化资料' : '该人物范围没有已读取文化资产；不推断没有兴趣或从未体验。'}</p>{Boolean(query || category !== 'all') && <ActionButton onClick={() => { onQueryChange(''); setCategory('all') }}>清除筛选</ActionButton>}</div>}
      <CultureReading items={matches} allItems={items} selectedId={selectedId} onSelect={setSelectedId} category={category}
        afterList={result.hasMore && result.nextCursor && <ActionButton disabled={loading || Boolean(error)} onClick={onNext}>读取下一页</ActionButton>}
        renderDetail={item => {
          return <>
            <details className="debug-prompt-provenance"><summary>完整字段</summary><dl className="debug-candidate-facts">{cultureFields(item, result.timezone).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
            <div className="debug-culture-related">{item.record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
            <details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>收录时间不是阅读、观看、聆听或拍摄时间；归档保留为已读资料。笔记数组优先，无效数组不回退旧 note，时间仅按保存字段显示。原始记录不是历史模型输入。</p><p>{item.record.source} · {item.id} · {item.record.roleId}</p><pre>{JSON.stringify(item.record.data, null, 2)}</pre></details>
          </>
        }} />
    </> : result && <p className="debug-culture-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}
