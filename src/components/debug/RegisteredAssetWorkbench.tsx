import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, Copy, Search } from 'lucide-react'
import type { AgentAssetUsageEvidence, DebugEvidenceScope, ModelContextAsset } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { SelectField } from '../foundation/SelectField'
import { reviewSpacingStyle } from './asset-review-layout'
import { filterRegisteredAssets, inReviewScope, registeredAssetBody, registeredAssetGroup, registeredAssetKind, uniqueRegisteredAssets, type AssetReviewScope } from './registered-asset-review'
import './prompt-review.css'

/** 背景：开发者需数清定义并优先阅读人物，候选不能成为正式资产来源。
 * 意图：消费真实注册目录，共用已验收阅读样式；调用证据按需独立读取。
 * 约束：只读、不试跑模型、不回填历史；异步响应绑定资产，刷新失败保留最后成功目录。
 */
export function RegisteredAssetWorkbench({ scope, revision, focusKey, onUsage }: { scope: DebugEvidenceScope | null; revision: number; focusKey: string; onUsage: (item: AgentAssetUsageEvidence) => void }) {
  const [assets, setAssets] = useState<ModelContextAsset[] | null>(null)
  const [query, setQuery] = useState('')
  const [roleId, setRoleId] = useState('')
  const [catalog, setCatalog] = useState<AssetReviewScope>('prompts')
  const [selectedKey, setSelectedKey] = useState(focusKey)
  const [detailOpen, setDetailOpen] = useState(Boolean(focusKey))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [copyStatus, setCopyStatus] = useState<{ key: string; text: string } | null>(null)
  const [usageRequested, setUsageRequested] = useState('')
  const [usageReload, setUsageReload] = useState(0)
  const [usageSnapshot, setUsageSnapshot] = useState<{ key: string; records: AgentAssetUsageEvidence[]; total: number } | null>(null)
  const [usageError, setUsageError] = useState('')
  const [usageLoading, setUsageLoading] = useState(false)
  const usage = usageSnapshot?.key === selectedKey ? usageSnapshot : null
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  useEffect(() => {
    let current = true
    setError(''); setLoading(true)
    if (!window.electronAPI?.debug?.modelContextAssets) { setLoading(false); setError('此页面需要桌面应用的诊断接口'); return }
    window.electronAPI.debug.modelContextAssets().then(data => { if (current) setAssets(uniqueRegisteredAssets(data)) }).catch(() => { if (current) setError('目录读取失败；已有定义保持为上次成功结果') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [revision, reload])
  useEffect(() => { if (focusKey) { setSelectedKey(focusKey); setDetailOpen(true); setRoleId(''); setCatalog('all'); setQuery('') } }, [focusKey])
  const selected = assets?.find(asset => asset.key === selectedKey)
  useEffect(() => {
    if (selected) setExpanded(previous => new Set(previous).add(registeredAssetGroup(selected)))
  }, [selected])
  useEffect(() => {
    let current = true
    setUsageError(''); setUsageLoading(false)
    if (!selectedKey || usageRequested !== selectedKey) return
    if (!window.electronAPI?.debug?.assetUsageQuery) { setUsageError('调用诊断接口不可用；调用数量未知'); return }
    setUsageLoading(true)
    window.electronAPI.debug.assetUsageQuery({ assetKey: selectedKey, limit: 50 }).then(data => { if (current) setUsageSnapshot({ ...data, key: selectedKey }) }).catch(() => { if (current) setUsageError('实际调用读取失败；不代表没有调用') }).finally(() => { if (current) setUsageLoading(false) })
    return () => { current = false }
  }, [selectedKey, usageRequested, revision, usageReload])
  const filtered = filterRegisteredAssets(assets ?? [], catalog, roleId, query)
  const total = assets?.filter(asset => inReviewScope(asset, catalog)).length
  const groups = [...new Set(filtered.map(registeredAssetGroup))]
  const clearSelection = () => { setSelectedKey(''); setDetailOpen(false); setUsageRequested(''); setCopyStatus(null) }
  const reset = () => { setQuery(''); setRoleId(''); clearSelection() }
  const missing = Boolean(assets && selectedKey && !selected)
  const body = selected ? registeredAssetBody(selected) : null
  const copy = async () => {
    if (body === null || !selected) return
    const key = selected.key
    try { await navigator.clipboard.writeText(body); setCopyStatus({ key, text: '已复制完整正文' }) }
    catch { setCopyStatus({ key, text: '复制失败，请手动选择正文复制' }) }
  }
  return <section className="debug-prompt-workbench debug-prompt-review" style={reviewSpacingStyle} data-testid="registered-asset-workbench">
    {(error || loading) && <div className="debug-prompt-state" role={error ? 'alert' : 'status'}><strong>{error ? assets ? '刷新失败，保留上次目录' : '目录读取失败' : assets ? '正在刷新目录…' : '正在读取目录…'}</strong>{error && <><p>{error}</p><ActionButton variant="plain" onClick={() => setReload(value => value + 1)}>重试读取目录</ActionButton></>}</div>}
    <div className="debug-review-top">{assets && <div className="debug-review-counts" aria-label="目录计数" title="按当前范围内唯一注册 key 统计定义；不等于调用次数或不重叠的指令数。">{catalog === 'prompts' ? '提示词' : catalog === 'other' ? '其他资产' : '全部资产'} {total} 项</div>}
      <div className="debug-candidate-role-filter" role="group" aria-label="资产人物筛选">{[{ id: '', name: '全部人物' }, ...(scope?.roles ?? [])].map(role => <ActionButton key={role.id} variant="plain" disabled={!assets} aria-pressed={roleId === role.id} onClick={() => { setRoleId(role.id); clearSelection() }}>{role.name}</ActionButton>)}</div></div>
    <div className="debug-candidate-toolbar"><label className="debug-candidate-search"><Search size={14} /><TextField disabled={!assets} appearance="outlined" className="h-8 px-3" aria-label="搜索提示词与资产" value={query} placeholder="搜索提示词" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); clearSelection() }} /></label><SelectField disabled={!assets} aria-label="目录范围" className="debug-review-scope" value={catalog} onChange={event => { setCatalog(event.target.value as AssetReviewScope); clearSelection() }}><option value="prompts">提示词</option><option value="other">其他资产</option><option value="all">全部资产</option></SelectField>{assets && (roleId || query.trim()) && <span className="debug-review-caption" aria-label="当前筛选结果">{filtered.length} / {total}</span>}</div>
    {!assets ? <div className="debug-prompt-awaiting" aria-label="目录未读取">读取成功后显示真实分组与定义；当前数量未知。</div> : !filtered.length && !missing && !selected ? <EmptyState title={total ? '没有匹配的资产' : '此范围没有资产'} description="可调整搜索、人物或目录范围。" action={roleId || query ? <ActionButton onClick={reset}>清除筛选</ActionButton> : undefined} /> : <div className="debug-candidate-split debug-prompt-split" data-detail-open={missing || detailOpen && Boolean(selected)}>
      <div className="debug-prompt-directory scrollbar-hover" aria-label="提示词分组目录">{groups.map(group => {
        const entries = filtered.filter(asset => registeredAssetGroup(asset) === group)
        const open = expanded.has(group) || Boolean(query.trim()); const Icon = open ? ChevronDown : ChevronRight
        return <section key={group}><ActionButton variant="plain" className="debug-prompt-group" aria-label={`${group}，${entries.length} 项`} aria-expanded={open} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(group)) next.delete(group); else next.add(group); return next })}><span><Icon size={14} />{group}</span><span className="debug-prompt-counts">{entries.length} 项</span></ActionButton>{open && entries.map(asset => <ActionButton data-asset-key={asset.key} key={asset.key} ref={node => { if (node) buttons.current.set(asset.key, node); else buttons.current.delete(asset.key) }} variant="plain" className="debug-prompt-entry" aria-pressed={selectedKey === asset.key} onClick={() => { setSelectedKey(asset.key); setDetailOpen(true); setUsageRequested(''); setCopyStatus(null) }}><strong>{asset.name}</strong>{registeredAssetKind(asset) !== '静态正文' && <span className="debug-prompt-entry-meta"><span data-kind={registeredAssetKind(asset)}>{registeredAssetKind(asset)}</span></span>}</ActionButton>)}</section>
      })}</div>
      <article className="debug-candidate-detail debug-prompt-detail scrollbar-hover" aria-label="资产详情">{selected ? <>
        <ActionButton variant="plain" className="debug-candidate-mobile-back" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => buttons.current.get(selected.key)?.focus()) }}><ArrowLeft size={14} /> 返回目录</ActionButton>
        <div className="debug-candidate-detail-heading"><h3 title={selected.purpose}>{selected.name}</h3>{body !== null && <ActionButton variant="plain" aria-label="复制正文" title="复制正文" onClick={() => void copy()}><Copy size={14} /></ActionButton>}</div>
        {!filtered.some(asset => asset.key === selected.key) && <p className="debug-review-caption">此明确引用不在当前筛选范围，保留其详情供核对。</p>}
        <section className="debug-candidate-section" aria-label="提示词正文">{body === null ? <p>此项没有固定正文。内容由组装器生成，本次插槽值与历史输入请查看对应调用的保存记录。</p> : <pre className="debug-candidate-body" data-content-kind={['schema', 'data'].includes(selected.contentKind) ? 'structured' : 'prose'}>{body}</pre>}{copyStatus?.key === selected.key && <p role="status" className="debug-review-caption">{copyStatus.text}</p>}</section>
        {selected.status && selected.status !== 'active' && <p className="debug-review-caption">资产状态：{selected.status}</p>}
        {selected.slots.length > 0 && <details key={`variables:${selected.key}`} className="debug-prompt-provenance debug-prompt-variables"><summary>变量 · {selected.slots.length}</summary><div>{selected.slots.map(slot => <dl key={slot.name} className="debug-review-variable"><dt><code>{`{{${slot.name}}}`}</code></dt><dd>来源：{slot.source || '未登记'}</dd><dd>更新时机：{slot.lifecycle || '未登记'}</dd></dl>)}</div></details>}
        <details key={`source:${selected.key}`} className="debug-prompt-provenance"><summary>来源</summary><dl className="debug-candidate-facts">{[['源文件', selected.source], ...(selected.definitions?.length ? [['定义符号', selected.definitions.join('\n')]] : []), ['标识', selected.key]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><details><summary>版本信息</summary><dl className="debug-candidate-facts">{[['版本', selected.version], ['自动指纹', selected.fingerprint]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details></details>
        <details key={`calls:${selected.key}`} className="debug-prompt-provenance" onToggle={event => { if (event.currentTarget.open) setUsageRequested(selected.key) }}><summary>查看实际调用</summary><p>按保存的 key 关联；当前版本不等于历史版本。最多显示 50 条，未保存的完整输入不能重建。</p>{usageLoading && <p role="status">{usage ? '正在刷新，以下为上次保存结果。' : '正在读取调用…'}</p>}{usageError && <p role="alert">{usageError}{usage && '；以下保留上次成功结果。'}</p>}{usageError && <ActionButton variant="plain" onClick={() => setUsageReload(value => value + 1)}>重试读取调用</ActionButton>}{usage?.records.map(item => <ActionButton key={item.id} variant="plain" className="debug-candidate-asset-link" onClick={() => onUsage(item)}><span>{item.usageKind} · {item.status} · {new Date(item.occurredAt).toLocaleString()}</span><ArrowUpRight size={14} /></ActionButton>)}{usage && !usageLoading && !usageError && <p>{usage.total === 0 ? '当前范围没有保存的调用。' : `已显示 ${usage.records.length} / ${usage.total} 条保存关联。`}</p>}</details>
      </> : missing ? <div className="debug-prompt-state" role="status"><strong>引用的资产未在目录中找到</strong><p>不使用其他资产代替这个引用。</p><ActionButton onClick={clearSelection}>返回目录</ActionButton></div> : <EmptyState title="选择左侧条目查看详情" description="" centerWithoutAction />}</article>
    </div>}
  </section>
}
