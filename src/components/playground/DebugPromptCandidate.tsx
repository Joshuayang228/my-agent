import { useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { DEBUG_ASSET_FIXTURES, debugAssetGroup } from './debug-asset-fixtures'
import { DEBUG_ROLES, type DebugRecordFixture } from './debug-experience-fixtures'

interface Props {
  empty: boolean
  selectedKey: string | null
  onSelect: (key: string | null) => void
  records: readonly DebugRecordFixture[]
  onRecord: (id: string) => void
}

/**
 * 背景：首版只给四项元数据，丢失 Alice 工作台的分组、人物、正文和变量浏览。
 * 设计意图：采用分组目录与独立详情，把本项目版本、指纹与调用证据融入，而不复制语言切换和生产编辑。
 * 关键约束：所有正文均标明隔离演示；人物过滤含平台通用定义；当前模板不等于历史实发输入。
 */
export function DebugPromptCandidate({ empty, selectedKey, onSelect, records, onRecord }: Props) {
  const entryButtons = useRef(new Map<string, HTMLButtonElement>())
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [kind, setKind] = useState('all')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(DEBUG_ASSET_FIXTURES.filter(asset => asset.key === selectedKey).map(asset => debugAssetGroup(asset, 'all'))))
  const [detailOpen, setDetailOpen] = useState(Boolean(selectedKey))
  const filtered = (empty ? [] : DEBUG_ASSET_FIXTURES).filter(asset =>
    (role === 'all' || !asset.roles.length || asset.roles.includes(role)) &&
    (kind === 'all' || asset.kind === kind) &&
    `${asset.label} ${asset.key} ${asset.group} ${asset.source} ${asset.preview} ${asset.slots.join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )
  const groups = [...new Set(filtered.map(asset => debugAssetGroup(asset, role)))]
  const selected = filtered.find(asset => asset.key === selectedKey)
  const reset = () => { setQuery(''); setRole('all'); setKind('all'); onSelect(null); setDetailOpen(false) }
  const toggle = (group: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(group)) next.delete(group); else next.add(group); return next })

  return <section className="debug-prompt-workbench" data-testid="debug-prompt-workbench">
    <div className="debug-candidate-role-filter" role="group" aria-label="资产人物筛选">
      {[{ id: 'all', label: '全部人物' }, ...DEBUG_ROLES].map(entry => <ActionButton key={entry.id} variant="plain" aria-pressed={role === entry.id} onClick={() => { setRole(entry.id); onSelect(null); setDetailOpen(false) }}>{entry.label}</ActionButton>)}
      <span>{filtered.length} 项{(role !== 'all' || query || kind !== 'all') && ` / ${empty ? 0 : DEBUG_ASSET_FIXTURES.length}`}</span>
    </div>
    <div className="debug-candidate-toolbar">
      <label className="debug-candidate-search"><Search size={14} /><TextField appearance="outlined" className="h-8 px-3" aria-label="搜索提示词与资产" value={query} placeholder="搜索名称、正文、变量或来源" onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); onSelect(null); setDetailOpen(false) }} /></label>
      <div className="debug-candidate-detail-tabs" role="group" aria-label="资产形态筛选" data-playground-switcher>{['all', '常量', '模板', '结构'].map(value => <ActionButton key={value} variant="plain" aria-pressed={kind === value} onClick={() => { setKind(value); onSelect(null); setDetailOpen(false) }}>{value === 'all' ? '全部形态' : value}</ActionButton>)}</div>
    </div>
    {!filtered.length ? <EmptyState title={empty ? '此范围没有资产' : '没有匹配的资产'} description={empty ? '目录已读取，未返回记录；不等于未读取或读取失败。' : '搜索会同时查找名称、正文和变量；当前筛选不修改生产定义。'} action={empty ? undefined : <ActionButton onClick={reset}>清除筛选</ActionButton>} /> : <div className="debug-candidate-split debug-prompt-split" data-detail-open={detailOpen && Boolean(selected)}>
      <div className="debug-prompt-directory scrollbar-hover" aria-label="提示词分组目录">
        {groups.map(group => {
          const entries = filtered.filter(asset => debugAssetGroup(asset, role) === group)
          const open = expanded.has(group) || Boolean(query.trim())
          const Icon = open ? ChevronDown : ChevronRight
          return <section key={group}>
            <ActionButton variant="plain" className="debug-prompt-group" aria-expanded={open} aria-label={`${group}，${entries.length} 项`} onClick={() => toggle(group)}><span><Icon size={14} />{group}</span><span className="debug-prompt-counts">{entries.length} 项</span></ActionButton>
            {open && entries.map(asset => <ActionButton ref={node => { if (node) entryButtons.current.set(asset.key, node); else entryButtons.current.delete(asset.key) }} key={asset.key} variant="plain" className="debug-prompt-entry" aria-pressed={selectedKey === asset.key} onClick={() => { onSelect(asset.key); setDetailOpen(true) }}><span className="debug-prompt-entry-meta"><span data-kind={asset.kind}>{asset.kind}</span>{asset.slots.length > 0 && <span>{asset.slots.length} 个变量</span>}</span><strong>{asset.label}</strong><span className="debug-prompt-excerpt">{asset.preview.replace('【隔离模板演示】', '').replace('【隔离正文演示】', '').replace('【隔离结构演示】', '').trim()}</span></ActionButton>)}
          </section>
        })}
      </div>
      <article className="debug-candidate-detail debug-prompt-detail scrollbar-hover" aria-label="资产详情">
        {selected ? <>
          <ActionButton variant="plain" className="debug-candidate-mobile-back" onClick={() => { setDetailOpen(false); requestAnimationFrame(() => entryButtons.current.get(selected.key)?.focus()) }}><ArrowLeft size={14} /> 返回目录</ActionButton>
          <div className="debug-candidate-detail-heading"><h3>{selected.label}</h3><Badge>{selected.kind}</Badge></div>
          {selected.slots.length > 0 && <section className="debug-prompt-variables"><h3>动态变量 · {selected.slots.length}</h3><div>{selected.slots.map(slot => <span key={slot}><code>{`{{${slot}}}`}</code></span>)}</div></section>}
          <section className="debug-candidate-section"><h3>{selected.kind === '模板' ? '模板正文' : selected.kind === '常量' ? '正文' : '结构内容'} · 隔离演示 <span className="debug-candidate-muted">{selected.preview.length} 字符</span></h3><pre className="debug-candidate-body">{selected.preview}</pre></section>
          <details className="debug-prompt-provenance"><summary>版本与来源 · {selected.version}</summary><dl className="debug-candidate-facts">{[['标识', selected.key], ['分组', selected.group], ['资产类型', selected.assetType], ['版本', selected.version], ['自动指纹', selected.fingerprint], ['归属', selected.ownership], ['来源', selected.source], ['状态', '隔离样张 · 非生产目录']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>变量由实际组装器独立注入，不隐式覆盖稳定身份。</p></details>
          <details className="debug-prompt-provenance"><summary>相关调用 · {records.filter(record => record.assetKeys.includes(selected.key)).length}</summary><p className="debug-candidate-muted mb-2">按明确保存的 key 关联；当前定义不等于历史版本或实发输入。</p>{records.filter(record => record.assetKeys.includes(selected.key)).map(record => <ActionButton key={record.id} variant="plain" className="debug-candidate-asset-link" onClick={() => onRecord(record.id)}><div><strong>{record.title}</strong><code>{record.id}</code></div><ArrowUpRight size={14} /></ActionButton>)}{!records.some(record => record.assetKeys.includes(selected.key)) && <p>此范围内没有关联调用。</p>}</details>
        </> : <EmptyState title="选择左侧条目查看详情" description="展开分组查看正文、变量、版本和来源。目录数量仅表示演示样张。" />}
      </article>
    </div>}
  </section>
}
