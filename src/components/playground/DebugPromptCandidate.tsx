import { useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, Copy, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_ROLES, type DebugRecordFixture } from './debug-experience-fixtures'
import { filterReviewAssets, PROMPT_REVIEW_ASSETS, reviewBody, reviewGroup, reviewShape, uniqueReviewAssets, type ReviewScope } from './debug-prompt-review'
import './debug-prompt-review.css'

export type PromptPreviewState = 'ready' | 'unread' | 'unavailable' | 'loading' | 'error' | 'refresh-error' | 'usage-error' | 'missing' | 'long'
interface Props {
  empty: boolean
  selectedKey: string | null
  onSelect: (key: string | null) => void
  records: readonly DebugRecordFixture[]
  onRecord: (id: string) => void
  previewState?: PromptPreviewState
  onRetry?: () => void
}

/** 背景：开发者需要先审人物与主要行为，重复标签和审计元数据会打断正文阅读。
 * 意图：用途排序的目录只服务查找、阅读、复制，变量解释、来源和真实调用各有明确入口。
 * 关键约束：仅用隔离样张；示例不冒充实际输入，排序不影响生产注入，失败状态不能因精简而隐藏。
 */
export function DebugPromptCandidate({ empty, selectedKey, onSelect, records, onRecord, previewState = 'ready', onRetry }: Props) {
  const entryButtons = useRef(new Map<string, HTMLButtonElement>())
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [scope, setScope] = useState<ReviewScope>('prompts')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(PROMPT_REVIEW_ASSETS.filter(asset => asset.key === selectedKey).map(reviewGroup)))
  const [detailOpen, setDetailOpen] = useState(Boolean(selectedKey))
  const [copyStatus, setCopyStatus] = useState('')
  const available = !['unread', 'unavailable', 'loading', 'error'].includes(previewState)
  const assets = uniqueReviewAssets(empty ? [] : PROMPT_REVIEW_ASSETS.map((asset, index) => previewState === 'long' && index === 0 ? {
    ...asset, label: '主对话语义编译：长名称、自然语言正文与多段规则的隔离阅读示例',
    preview: Array.from({ length: 12 }, (_, paragraph) => `【隔离长正文演示 ${paragraph + 1}】\n与用户共同整理虚构旅行计划，先说明安排的依据，再提供可调整的选项。保持段落清楚，保留 {{role_voice}} 与 {{life_context}} 插槽，不把当前模板当作历史实发输入。`).join('\n\n'),
  } : asset))
  const filtered = available ? filterReviewAssets(assets, scope, role, 'all', query) : []
  const groups = [...new Set(filtered.map(reviewGroup))]
  const requestedKey = previewState === 'missing' ? 'demo.missing-asset' : selectedKey
  const selected = available ? assets.find(asset => asset.key === requestedKey) : undefined
  const body = selected ? reviewBody(selected) : null
  const promptCount = assets.filter(asset => asset.assetType === 'prompt').length
  const total = scope === 'prompts' ? promptCount : scope === 'other' ? assets.length - promptCount : assets.length
  const hasFilter = role !== 'all' || Boolean(query.trim())
  const clearSelection = () => { onSelect(null); setDetailOpen(false); setCopyStatus('') }
  const reset = () => { setQuery(''); setRole('all'); clearSelection() }
  const toggle = (group: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(group)) next.delete(group); else next.add(group); return next })
  const copy = async () => {
    if (body === null) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable')
      await navigator.clipboard.writeText(body)
      setCopyStatus('已复制完整正文')
    } catch { setCopyStatus('复制失败，请手动选择正文复制') }
  }
  const related = selected ? records.filter(record => record.assetKeys.includes(selected.key)) : []
  return <section className="debug-prompt-workbench debug-prompt-review" data-testid="debug-prompt-workbench">
    {!available && <div className="debug-prompt-state" role={previewState === 'error' ? 'alert' : 'status'}><strong>{({ unread: '目录尚未读取', unavailable: '诊断接口不可用', loading: '正在读取目录', error: '目录读取失败' } as Record<string, string>)[previewState]}</strong><p>{previewState === 'unavailable' ? '此页面需要桌面诊断接口。目录数量未知，不表示没有资产。' : '尚未取得目录，数量未知。'}</p>{previewState !== 'loading' && onRetry && <ActionButton variant="plain" onClick={onRetry}>读取目录样张</ActionButton>}</div>}
    {previewState === 'refresh-error' && <div className="debug-prompt-state" role="alert"><strong>刷新失败，保留上次目录</strong><p>当前目录与选中正文是刷新前的样张。</p>{onRetry && <ActionButton variant="plain" onClick={onRetry}>重试读取样张</ActionButton>}</div>}
    <div className="debug-review-top">{available && <div className="debug-review-counts" aria-label="目录计数" title="按当前范围内唯一注册 key 统计定义；不等于调用次数或不重叠的指令数。">{scope === 'prompts' ? '提示词' : scope === 'other' ? '其他资产' : '全部资产'} {total} 项</div>}
    <div className="debug-candidate-role-filter" role="group" aria-label="资产人物筛选">{[{ id: 'all', label: '全部人物' }, ...DEBUG_ROLES].map(entry => <ActionButton key={entry.id} variant="plain" disabled={!available} aria-pressed={role === entry.id} onClick={() => { setRole(entry.id); clearSelection() }}>{entry.label}</ActionButton>)}</div></div>
    <div className="debug-candidate-toolbar"><label className="debug-candidate-search"><Search size={14} /><TextField disabled={!available} appearance="outlined" className="h-8 px-3" aria-label="搜索提示词与资产" value={query} placeholder="搜索提示词" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); clearSelection() }} /></label><SelectField aria-label="目录范围" disabled={!available} className="debug-review-scope" value={scope} onChange={event => { setScope(event.target.value as ReviewScope); clearSelection() }}><option value="prompts">提示词</option><option value="other">其他资产</option><option value="all">全部资产</option></SelectField>{available && hasFilter && <span className="debug-review-caption" aria-label="当前筛选结果">{filtered.length} / {total}</span>}</div>
    {!available ? null : !filtered.length && previewState !== 'missing' && !selected ? <EmptyState title={empty ? '此范围没有资产' : '没有匹配的资产'} description={empty ? '目录已读取，未返回记录。' : '可调整搜索、人物或目录范围。'} action={empty ? undefined : <ActionButton onClick={reset}>清除筛选</ActionButton>} /> : <div className="debug-candidate-split debug-prompt-split" data-detail-open={previewState === 'missing' || detailOpen && Boolean(selected)}>
      <div className="debug-prompt-directory scrollbar-hover" aria-label="提示词分组目录">{groups.map(group => {
        const entries = filtered.filter(asset => reviewGroup(asset) === group)
        const open = expanded.has(group) || Boolean(query.trim())
        const Icon = open ? ChevronDown : ChevronRight
        return <section key={group}><ActionButton variant="plain" className="debug-prompt-group" aria-expanded={open} aria-label={`${group}，${entries.length} 项`} onClick={() => toggle(group)}><span><Icon size={14} />{group}</span><span className="debug-prompt-counts">{entries.length} 项</span></ActionButton>{open && entries.map(asset => <ActionButton data-asset-key={asset.key} ref={node => { if (node) entryButtons.current.set(asset.key, node); else entryButtons.current.delete(asset.key) }} key={asset.key} variant="plain" className="debug-prompt-entry" aria-pressed={requestedKey === asset.key} onClick={() => { onSelect(asset.key); setDetailOpen(true); setCopyStatus('') }}><strong>{asset.label}</strong>{asset.kind !== '常量' && <span className="debug-prompt-entry-meta"><span data-kind={asset.kind}>{reviewShape(asset)}</span></span>}</ActionButton>)}</section>
      })}</div>
      <article className="debug-candidate-detail debug-prompt-detail scrollbar-hover" aria-label="资产详情">{selected ? <>
        <ActionButton variant="plain" className="debug-candidate-mobile-back" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => entryButtons.current.get(selected.key)?.focus()) }}><ArrowLeft size={14} /> 返回目录</ActionButton>
        <div className="debug-candidate-detail-heading"><h3 title={selected.purpose}>{selected.label}</h3>{body !== null && <ActionButton variant="plain" aria-label="复制正文" title="复制正文" onClick={() => void copy()}><Copy size={14} /></ActionButton>}</div>
        {!filtered.some(asset => asset.key === selected.key) && <p className="debug-review-caption">此明确引用不在当前筛选范围，保留其详情供核对。</p>}
        <section className="debug-candidate-section" aria-label="提示词正文">{body === null ? <p>此项没有固定正文。内容由组装器生成，本次插槽值与历史输入请查看对应调用的保存记录。</p> : <pre className="debug-candidate-body" data-content-kind={selected.kind === '结构' ? 'structured' : 'prose'}>{body}</pre>}{copyStatus && <p role="status" className="debug-review-caption">{copyStatus}</p>}</section>
        {previewState === 'usage-error' && <p role="alert" className="debug-prompt-local-error">实际调用读取失败；正文仍可阅读，调用数量未知。</p>}
        {selected.slots.length > 0 && <details key={`variables:${selected.key}`} className="debug-prompt-provenance debug-prompt-variables"><summary>变量 · {selected.slots.length}</summary><div>{selected.slots.map(slot => <dl key={slot} className="debug-review-variable"><dt><code>{`{{${slot}}}`}</code>{selected.slotLabels?.[slot] && <span>{selected.slotLabels[slot]}</span>}</dt><dd>来源：{selected.slotSources?.[slot] ?? '未登记'}</dd>{selected.slotExamples?.[slot] && <dd>示例（非实际值）：{selected.slotExamples[slot]}</dd>}</dl>)}</div></details>}
        <details key={`source:${selected.key}`} className="debug-prompt-provenance"><summary>来源</summary><dl className="debug-candidate-facts">{[['源文件', selected.source], ...(selected.definitions ? [['定义符号', selected.definitions.join('\n')]] : []), ['标识', selected.key]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><details><summary>版本信息</summary><dl className="debug-candidate-facts">{[['版本', selected.version], ['自动指纹', selected.fingerprint]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details></details>
        <details key={`calls:${selected.key}`} className="debug-prompt-provenance"><summary>{previewState === 'usage-error' ? '查看实际调用 · 未读取' : '查看实际调用'}</summary><p>仅含当前样张范围内保存的关联；未保存的完整输入不能重建。</p>{previewState !== 'usage-error' && <>{related.map(record => <ActionButton key={record.id} variant="plain" className="debug-candidate-asset-link" onClick={() => onRecord(record.id)}><span>{record.title}</span><ArrowUpRight size={14} /></ActionButton>)}{!related.length && <p>当前范围没有保存的调用。</p>}</>}</details>
      </> : previewState === 'missing' ? <div className="debug-prompt-state" role="status"><strong>引用的资产未在目录中找到</strong><p>不使用其他资产代替这个引用。</p><ActionButton onClick={() => { clearSelection(); onRetry?.() }}>返回目录</ActionButton></div> : <EmptyState title="选择左侧条目查看详情" description="" centerWithoutAction />}</article>
    </div>}
  </section>
}
