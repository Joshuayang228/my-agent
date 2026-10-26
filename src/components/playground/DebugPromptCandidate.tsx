import { useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, Copy, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { SelectField } from '../foundation/SelectField'
import { debugAssetGroup } from './debug-asset-fixtures'
import { DEBUG_ROLES, type DebugRecordFixture } from './debug-experience-fixtures'
import { filterReviewAssets, PROMPT_REVIEW_ASSETS, reviewBody, reviewShape, REVIEW_TYPE_LABELS, uniqueReviewAssets, type ReviewScope } from './debug-prompt-review'
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

/** 背景：统一资产数无法回答提示词数，动态定义也不能当作固定正文。
 * 意图：以定义计数、用途与正文为阅读起点，证据渐进展开；替换旧候选的混合目录呈现。
 * 关键约束：仅用隔离样张；按 key 去重，人物筛选含明确平台共用项；不生成历史输入或调用模型。
 */
export function DebugPromptCandidate({ empty, selectedKey, onSelect, records, onRecord, previewState = 'ready', onRetry }: Props) {
  const entryButtons = useRef(new Map<string, HTMLButtonElement>())
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [scope, setScope] = useState<ReviewScope>('prompts')
  const [shape, setShape] = useState('all')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(PROMPT_REVIEW_ASSETS.filter(asset => asset.key === selectedKey).map(asset => debugAssetGroup(asset, 'all'))))
  const [detailOpen, setDetailOpen] = useState(Boolean(selectedKey))
  const [copyStatus, setCopyStatus] = useState('')
  const available = !['unread', 'unavailable', 'loading', 'error'].includes(previewState)
  const assets = uniqueReviewAssets(empty ? [] : PROMPT_REVIEW_ASSETS.map((asset, index) => previewState === 'long' && index === 0 ? {
    ...asset, label: '主对话语义编译：长名称、自然语言正文与多段规则的隔离阅读示例',
    preview: Array.from({ length: 12 }, (_, paragraph) => `【隔离长正文演示 ${paragraph + 1}】\n与用户共同整理虚构旅行计划，先说明安排的依据，再提供可调整的选项。保持段落清楚，保留 {{role_voice}} 与 {{life_context}} 插槽，不把当前模板当作历史实发输入。`).join('\n\n'),
  } : asset))
  const filtered = available ? filterReviewAssets(assets, scope, role, shape, query) : []
  const groups = [...new Set(filtered.map(asset => debugAssetGroup(asset, role)))]
  const requestedKey = previewState === 'missing' ? 'demo.missing-asset' : selectedKey
  // 来自调用的明确引用允许打开非默认范围，不能拿另一条提示词代替；目录仍按用户筛选展示。
  const selected = available ? assets.find(asset => asset.key === requestedKey) : undefined
  const body = selected ? reviewBody(selected) : null
  const promptCount = assets.filter(asset => asset.assetType === 'prompt').length
  const clearSelection = () => { onSelect(null); setDetailOpen(false); setCopyStatus('') }
  const reset = () => { setQuery(''); setRole('all'); setShape('all'); clearSelection() }
  const toggle = (group: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(group)) next.delete(group); else next.add(group); return next })
  const copy = async () => {
    if (body === null) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable')
      await navigator.clipboard.writeText(body)
      setCopyStatus('已复制完整正文')
    } catch { setCopyStatus('复制失败，请手动选择正文复制') }
  }
  return <section className="debug-prompt-workbench debug-prompt-review" data-testid="debug-prompt-workbench">
    {!available && <div className="debug-prompt-state" role={previewState === 'error' ? 'alert' : 'status'}><strong>{({ unread: '目录尚未读取', unavailable: '诊断接口不可用', loading: '正在读取目录', error: '目录读取失败' } as Record<string, string>)[previewState]}</strong><p>{previewState === 'unavailable' ? '此页面需要桌面诊断接口。目录数量未知，不表示没有资产。' : '尚未取得目录，数量未知。'}</p>{previewState !== 'loading' && onRetry && <ActionButton variant="plain" onClick={onRetry}>读取目录样张</ActionButton>}</div>}
    {previewState === 'refresh-error' && <div className="debug-prompt-state" role="alert"><strong>刷新失败，保留上次目录</strong><p>当前目录与选中正文是刷新前的样张。</p>{onRetry && <ActionButton variant="plain" onClick={onRetry}>重试读取样张</ActionButton>}</div>}
    <div className="debug-review-top">{available && <div className="debug-review-counts" aria-label="目录计数"><span>提示词定义 <strong>{promptCount}</strong> 项</span><span>其他资产 {assets.length - promptCount} 项</span><details><summary>计数范围</summary><p>按注册类型为提示词的唯一 key 统计；组合模板可引用其他定义，不代表互不重叠的规则数。其他资产仍可能包含模型指令，均可通过目录范围查看。本页为隔离样张。</p></details></div>}
    <div className="debug-candidate-role-filter" role="group" aria-label="资产人物筛选">{[{ id: 'all', label: '全部人物' }, ...DEBUG_ROLES].map(entry => <ActionButton key={entry.id} variant="plain" disabled={!available} aria-pressed={role === entry.id} onClick={() => { setRole(entry.id); clearSelection() }}>{entry.label}</ActionButton>)}</div>
    </div><div className="debug-candidate-toolbar"><label className="debug-candidate-search"><Search size={14} /><TextField disabled={!available} appearance="outlined" className="h-8 px-3" aria-label="搜索提示词与资产" value={query} placeholder="搜索名称、用途、正文、变量或来源" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); clearSelection() }} /></label><label className="debug-review-scope">目录范围<SelectField aria-label="目录范围" disabled={!available} value={scope} onChange={event => { setScope(event.target.value as ReviewScope); clearSelection() }}><option value="prompts">提示词</option><option value="other">其他资产</option><option value="all">全部资产</option></SelectField></label>
    <div className="debug-review-result"><span aria-label="当前筛选结果">{available ? `当前筛选 ${filtered.length} 项` : '数量未知'}</span><details className="debug-focused-filter"><summary>{shape === 'all' ? '形态筛选' : shape}</summary><div className="debug-candidate-detail-tabs" role="group" aria-label="资产形态筛选">{['all', '静态正文', '模板', '动态组装', '结构内容'].map(value => <ActionButton key={value} variant="plain" disabled={!available} aria-pressed={shape === value} onClick={() => { setShape(value); clearSelection() }}>{value === 'all' ? '全部形态' : value}</ActionButton>)}</div></details></div></div>
    {!available ? null : !filtered.length && previewState !== 'missing' && !selected ? <EmptyState title={empty ? '此范围没有资产' : '没有匹配的资产'} description={empty ? '目录已读取，未返回记录。' : '可调整搜索、人物、形态或目录范围。'} action={empty ? undefined : <ActionButton onClick={reset}>清除筛选</ActionButton>} /> : <div className="debug-candidate-split debug-prompt-split" data-detail-open={previewState === 'missing' || detailOpen && Boolean(selected)}>
      <div className="debug-prompt-directory scrollbar-hover" aria-label="提示词分组目录">{groups.map(group => {
        const entries = filtered.filter(asset => debugAssetGroup(asset, role) === group)
        const open = expanded.has(group) || Boolean(query.trim())
        const Icon = open ? ChevronDown : ChevronRight
        return <section key={group}><ActionButton variant="plain" className="debug-prompt-group" aria-expanded={open} aria-label={`${group}，${entries.length} 项`} onClick={() => toggle(group)}><span><Icon size={14} />{group}</span><span className="debug-prompt-counts">{entries.length} 项</span></ActionButton>{open && entries.map(asset => <ActionButton ref={node => { if (node) entryButtons.current.set(asset.key, node); else entryButtons.current.delete(asset.key) }} key={asset.key} variant="plain" className="debug-prompt-entry" aria-pressed={requestedKey === asset.key} onClick={() => { onSelect(asset.key); setDetailOpen(true); setCopyStatus('') }}><span className="debug-prompt-entry-meta"><span data-kind={asset.kind}>{REVIEW_TYPE_LABELS[asset.assetType]} · {reviewShape(asset)}</span></span><strong>{asset.label}</strong><span className="debug-prompt-excerpt">{asset.purpose ?? asset.preview}</span></ActionButton>)}</section>
      })}</div>
      <article className="debug-candidate-detail debug-prompt-detail scrollbar-hover" aria-label="资产详情">{selected ? <>
        <ActionButton variant="plain" className="debug-candidate-mobile-back" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => entryButtons.current.get(selected.key)?.focus()) }}><ArrowLeft size={14} /> 返回目录</ActionButton>
        <div className="debug-candidate-detail-heading"><h3>{selected.label}</h3>{body !== null && <ActionButton variant="plain" aria-label="复制正文" title="复制正文" onClick={() => void copy()}><Copy size={14} /></ActionButton>}</div>
        {!filtered.some(asset => asset.key === selected.key) && <p className="debug-review-caption">此明确引用不在当前筛选范围，保留其详情供核对。</p>}
        <section className="debug-candidate-section" aria-label="提示词正文">{body === null ? <p>此项没有固定正文。内容由组装器生成，本次插槽值与历史输入请查看对应调用的保存记录。</p> : <pre className="debug-candidate-body" data-content-kind={selected.kind === '结构' ? 'structured' : 'prose'}>{body}</pre>}{copyStatus && <p role="status" className="debug-review-caption">{copyStatus}</p>}</section>
        {previewState === 'usage-error' && <p role="alert" className="debug-prompt-local-error">相关调用读取失败；资产正文仍可阅读，调用数量未知。</p>}
        <details key={selected.key} className="debug-prompt-provenance debug-review-information"><summary>审阅信息</summary>
        {selected.purpose && <p className="debug-review-purpose">{selected.purpose}</p>}
        <p className="debug-review-caption">{REVIEW_TYPE_LABELS[selected.assetType]} · {selected.kind === '模板' && body !== null ? '模板正文' : reviewShape(selected)} · {selected.roles.length ? `人物专属：${selected.roles.map(id => DEBUG_ROLES.find(role => role.id === id)?.label ?? id).join('、')}` : '平台共用'} · 关联不等于实际注入{body !== null ? ` · ${Array.from(body).length} 字符` : ''}</p>
        {selected.slots.length > 0 && <details className="debug-prompt-provenance debug-prompt-variables"><summary>变量说明 · {selected.slots.length}</summary><div>{selected.slots.map(slot => <span key={slot}><code>{`{{${slot}}}`}</code><small>{selected.slotSources?.[slot] ?? '来源未登记'}</small></span>)}</div><p>由来源组装器注入；目录没有本次取值。变量来源：{selected.source}。</p></details>}
        {selected.behavior && <details className="debug-prompt-provenance"><summary>行为约束</summary><dl className="debug-candidate-facts">{[['触发条件', selected.behavior.trigger], ['人物输入', selected.behavior.characterInputs.join('、')], ['事实输入', selected.behavior.runtimeInputs.join('、')], ['输出约束', selected.behavior.outputContract], ['校验', selected.behavior.validation], ['失败回退', selected.behavior.fallback], ['副作用', selected.behavior.sideEffects.join('、')]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}
        <details className="debug-prompt-provenance"><summary>版本与来源 · {selected.version}</summary><dl className="debug-candidate-facts">{[['标识', selected.key], ['来源', selected.source], ...(selected.definitions ? [['定义符号', selected.definitions.join('\n')]] : []), ['资产类型', REVIEW_TYPE_LABELS[selected.assetType]], ['版本', selected.version], ['自动指纹', selected.fingerprint], ['归属', selected.ownership], ['状态', '隔离样张 · 非生产目录']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        <details className="debug-prompt-provenance"><summary>相关调用 · {previewState === 'usage-error' ? '未读取' : records.filter(record => record.assetKeys.includes(selected.key)).length}</summary><p>仅关联当前样张范围内明确保存的 key。当前定义不等于历史版本；没有保存的完整输入不能重建。</p>{previewState !== 'usage-error' && <>{records.filter(record => record.assetKeys.includes(selected.key)).map(record => <ActionButton key={record.id} variant="plain" className="debug-candidate-asset-link" onClick={() => onRecord(record.id)}><span><strong>{record.title}</strong><code>{record.id}</code></span><ArrowUpRight size={14} /></ActionButton>)}{!records.some(record => record.assetKeys.includes(selected.key)) && <p>此范围内没有关联调用。</p>}</>}</details>
        </details>
      </> : previewState === 'missing' ? <div className="debug-prompt-state" role="status"><strong>引用的资产未在目录中找到</strong><p>不使用其他资产代替这个引用。</p><ActionButton onClick={() => { clearSelection(); onRetry?.() }}>返回目录</ActionButton></div> : <EmptyState title="选择左侧条目查看详情" description="" centerWithoutAction />}</article>
    </div>}
  </section>
}
