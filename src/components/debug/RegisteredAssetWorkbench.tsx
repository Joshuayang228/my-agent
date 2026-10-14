import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { AgentAssetUsageEvidence, DebugEvidenceScope, ModelContextAsset } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'

const SOURCE_LABELS: Record<string, string> = { system: '平台 / 行为', context: '平台 / 行为', companion: '人物与世界', subagent: '人物与世界', memory: '记忆策略', permission: '权限与沙箱', provider: '模型与调度', tool: '工具与技能', skill: '工具与技能', external: '工具与技能', eval: '验收定义', ui: '界面定义' }
export function registeredAssetKind(asset: ModelContextAsset): string { return asset.contentKind === 'template' || asset.slots.length ? '模板' : asset.contentKind === 'static' ? '常量' : '结构' }
export function registeredAssetGroup(asset: ModelContextAsset, roleId: string): string {
  if (!roleId) {
    if (['companion-world', 'companion-scene', 'companion-life'].includes(asset.assetType)) return '世界与生活'
    if (asset.category === 'companion') return asset.ownership === 'role-pack' ? asset.roleUses?.some(use => use.purpose === '生活情境') ? '世界与生活' : '人物定义' : '世界与生活'
    return SOURCE_LABELS[asset.category] ?? '其他登记来源'
  }
  if (!asset.roleIds?.length) return asset.ownership === 'role-pack' ? '未登记关联' : '平台共用'
  return asset.roleUses?.find(use => use.roleId === roleId)?.purpose ?? '未登记关联'
}

/** 背景：Debug 需要浏览生产目录，候选数据不能成为正式资产来源。
 * 意图：直接消费统一注册响应，使用候选分组目录/正文工作台；历史调用独立查询。
 * 约束：无编辑、模型调用或持久化；缺归属不猜注入，刷新失败保留上次目录，迟到响应不覆盖新选择。
 */
export function RegisteredAssetWorkbench({ scope, revision, focusKey, onUsage, onTotal }: { scope: DebugEvidenceScope | null; revision: number; focusKey: string; onUsage: (item: AgentAssetUsageEvidence) => void; onTotal?: (total: number) => void }) {
  const [assets, setAssets] = useState<ModelContextAsset[] | null>(null)
  const [query, setQuery] = useState('')
  const [roleId, setRoleId] = useState('')
  const [kind, setKind] = useState('全部形态')
  const [selectedKey, setSelectedKey] = useState(focusKey)
  const [detailOpen, setDetailOpen] = useState(Boolean(focusKey))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [usage, setUsage] = useState<{ records: AgentAssetUsageEvidence[]; total: number } | null>(null)
  const [usageError, setUsageError] = useState('')
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  useEffect(() => {
    let current = true
    setError('')
    if (!window.electronAPI?.debug) { setError('此页面需要桌面应用的诊断接口'); return }
    window.electronAPI.debug.modelContextAssets().then(data => { if (current) { setAssets(data); onTotal?.(data.length) } }).catch(() => { if (current) setError('目录刷新失败，保留上次可用定义') })
    return () => { current = false }
  }, [revision, onTotal])
  useEffect(() => { if (focusKey) { setSelectedKey(focusKey); setDetailOpen(true); setRoleId(''); setKind('全部形态'); setQuery('') } }, [focusKey])
  const selected = assets?.find(asset => asset.key === selectedKey)
  useEffect(() => {
    if (!selected) return
    setExpanded(previous => new Set(previous).add(registeredAssetGroup(selected, roleId)))
  }, [selected, roleId])
  useEffect(() => {
    let current = true
    setUsage(null); setUsageError('')
    if (!selectedKey || !window.electronAPI?.debug) return
    window.electronAPI.debug.assetUsageQuery({ assetKey: selectedKey, limit: 50 }).then(data => { if (current) setUsage(data) }).catch(() => { if (current) setUsageError('关联调用读取失败；不代表没有调用') })
    return () => { current = false }
  }, [selectedKey, revision])
  const filtered = (assets ?? []).filter(asset => (!roleId || !asset.roleIds?.length || asset.roleIds.includes(roleId)) && (kind === '全部形态' || registeredAssetKind(asset) === kind) && `${asset.name} ${asset.key} ${asset.source} ${asset.content ?? ''} ${asset.preview ?? ''} ${asset.slots.map(slot => slot.name).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const groups = [...new Set(filtered.map(asset => registeredAssetGroup(asset, roleId)))]
  const clearSelection = () => { setSelectedKey(''); setDetailOpen(false) }
  return <section className="debug-prompt-workbench" data-testid="registered-asset-workbench">
    {error && <ErrorState title="目录读取异常" description={error} />}
    <div className="debug-candidate-role-filter" role="group" aria-label="资产人物筛选">{[{ id: '', name: '全部人物' }, ...(scope?.roles ?? [])].map(role => <ActionButton key={role.id} variant="plain" aria-pressed={roleId === role.id} onClick={() => { setRoleId(role.id); clearSelection() }}>{role.name}</ActionButton>)}<span>{assets ? `${filtered.length} / ${assets.length} 项生产资产` : '目录未读取'}</span></div>
    <div className="debug-candidate-toolbar"><label className="debug-candidate-search"><Search size={14} /><TextField aria-label="搜索提示词与资产" value={query} placeholder="搜索名称、正文、变量或来源" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); clearSelection() }} /></label></div>
    <div className="debug-prompt-kind-row"><span>形态计数：常量 / 模板 / 结构</span><div className="debug-candidate-detail-tabs" role="group" aria-label="资产形态筛选">{['全部形态', '常量', '模板', '结构'].map(value => <ActionButton key={value} variant="plain" aria-pressed={kind === value} onClick={() => { setKind(value); clearSelection() }}>{value}</ActionButton>)}</div></div>
    {!assets ? <EmptyState title="尚未读取生产目录" description="读取完成后显示真实定义，不生成默认资产。" /> : !filtered.length ? <EmptyState title={assets.length ? '没有匹配的资产' : '此范围没有资产'} description="目录数量与本次实际注入分别追踪。" action={<ActionButton onClick={() => { setQuery(''); setRoleId(''); setKind('全部形态'); clearSelection() }}>清除筛选</ActionButton>} /> : <div className="debug-candidate-split debug-prompt-split" data-detail-open={detailOpen && Boolean(selected)}>
      <div className="debug-prompt-directory" aria-label="提示词分组目录">{groups.map(group => {
        const entries = filtered.filter(asset => registeredAssetGroup(asset, roleId) === group)
        const open = expanded.has(group) || Boolean(query.trim()); const Icon = open ? ChevronDown : ChevronRight
        return <section key={group}><ActionButton variant="plain" className="debug-prompt-group" aria-expanded={open} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(group)) next.delete(group); else next.add(group); return next })}><span><Icon size={14} />{group}</span><span className="debug-prompt-counts">{['常量', '模板', '结构'].map(value => { const count = entries.filter(asset => registeredAssetKind(asset) === value).length; return count > 0 && <span key={value} data-kind={value} aria-label={`${value} ${count}`}>{count}</span> })}<b>{entries.length}</b></span></ActionButton>{open && entries.map(asset => <ActionButton key={asset.key} ref={node => { if (node) buttons.current.set(asset.key, node); else buttons.current.delete(asset.key) }} variant="plain" className="debug-prompt-entry" aria-pressed={selectedKey === asset.key} onClick={() => { setSelectedKey(asset.key); setDetailOpen(true) }}><span className="debug-prompt-entry-meta">{registeredAssetKind(asset)} · {asset.slots.length} 个变量</span><strong>{asset.name}</strong><span className="debug-prompt-excerpt">{asset.preview ?? asset.desc}</span></ActionButton>)}</section>
      })}</div>
      <article className="debug-candidate-detail debug-prompt-detail" aria-label="资产详情">{selected ? <>
        <ActionButton variant="plain" className="debug-candidate-mobile-back" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => buttons.current.get(selected.key)?.focus()) }}><ArrowLeft size={14} /> 返回目录</ActionButton>
        <p className="debug-prompt-category">{registeredAssetGroup(selected, roleId)} · {registeredAssetKind(selected)}</p><div className="debug-candidate-detail-heading"><div><h3>{selected.name}</h3><code>{selected.key}</code></div><Badge>只读</Badge></div>
        {selected.slots.length > 0 && <section className="debug-prompt-variables"><h3>动态变量 · {selected.slots.length}</h3><div>{selected.slots.map(slot => <span key={slot.name}><code>{`{{${slot.name}}}`}</code><small>{slot.source} · {slot.lifecycle}</small></span>)}</div></section>}
        <section className="debug-candidate-section"><h3>{selected.mode === 'dynamic' ? '模板 / 组装定义' : '正文与结构'}</h3>{selected.mode === 'dynamic' && <p>实际插槽值与历史实发输入以该次调用保存记录为准。</p>}<pre className="debug-candidate-body">{selected.content ?? selected.locales[selected.locale]?.template ?? '此定义没有可直接展示的正文，请查看来源。'}</pre></section>
        <details className="debug-prompt-provenance"><summary>来源与版本 · {selected.version}</summary><dl className="debug-candidate-facts">{[['类型', selected.assetType], ['来源', selected.source], ['版本', selected.version], ['自动指纹', selected.fingerprint], ['归属', selected.ownership], ['状态', selected.status ?? 'active'], ['依赖', selected.dependencies?.join('\n') || '未登记']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
        <details className="debug-prompt-provenance"><summary>相关调用 · {usage?.total ?? '未读取'}</summary><p>按保存的 key 关联；当前版本不等于历史版本。最多显示 50 条。</p>{usageError && <p role="alert">{usageError}</p>}{usage?.records.map(item => <ActionButton key={item.id} variant="plain" className="debug-candidate-asset-link" onClick={() => onUsage(item)}><span>{item.usageKind} · {item.status} · {new Date(item.occurredAt).toLocaleString()}</span><ArrowUpRight size={14} /></ActionButton>)}</details>
      </> : <EmptyState title="选择左侧条目查看详情" description="展开分组，查看正文、变量、来源和版本。" />}</article>
    </div>}
  </section>
}
