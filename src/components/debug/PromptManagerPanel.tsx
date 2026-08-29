/**
 * Debug 提示词管理器。
 *
 * 背景：生产 Prompt、伙伴资产、记忆策略、权限策略、Tool schema、Skill 与 Eval 资产属于代码 / Role Pack / 运行时真相，Debug 不应绕过 Git 直接覆盖源文件。
 * 设计意图：保留生产资产只读查看，同时提供实验副本和现有 L3 自定义补充指令的受控编辑入口。
 * 关键约束：实验副本不影响真实会话；只有用户二次确认后，L3 草稿才写入现有 settings.systemPrompt。
 */

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, RotateCcw, Save, Search } from 'lucide-react'
import type { AgentAssetUsageEvidence, DebugPromptSnapshot, ModelContextAsset, PromptAsset, PromptAssetTrace } from '../../shared/types'

export type DebugPromptInfo = DebugPromptSnapshot

type CategoryFilter = 'all' | ModelContextAsset['category']
type PromptLayer = 'full' | 'l1' | 'l2' | 'l3' | 'l4'

const RUNTIME_ID = '__runtime-current__'
const MAX_L3_CHARS = 4000

const CATEGORY_OPTIONS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'system', label: '主对话' },
  { id: 'context', label: '上下文' },
  { id: 'memory', label: '记忆策略' },
  { id: 'permission', label: '权限与沙箱' },
  { id: 'provider', label: '模型 Provider' },
  { id: 'companion', label: '伙伴世界' },
  { id: 'subagent', label: '子 Agent' },
  { id: 'ui', label: '模型测试' },
  { id: 'tool', label: '内置工具' },
  { id: 'skill', label: 'Skills' },
  { id: 'eval', label: 'Eval Judge' },
  { id: 'external', label: '外部 / MCP' },
]

const CATEGORY_LABELS: Record<ModelContextAsset['category'], string> = {
  system: '主对话',
  context: '上下文',
  memory: '记忆策略',
  permission: '权限与沙箱',
  provider: '模型 Provider',
  companion: '伙伴世界',
  subagent: '子 Agent',
  ui: '模型测试',
  tool: '内置工具',
  skill: 'Skills',
  eval: 'Eval Judge',
  external: '外部 / MCP',
}


const ASSET_TYPE_LABELS: Record<ModelContextAsset['assetType'], string> = {
  prompt: '提示词',
  'tool-schema': '工具 Schema',
  skill: 'Skill',
  'eval-judge': 'Eval Judge',
  'eval-case': 'Eval Case',
  'eval-grader': 'Eval Grader',
  'companion-manifest': '伙伴清单',
  'companion-profile': '人物档案',
  'companion-world': '默认世界',
  'companion-scene': '伙伴场景',
  'companion-life': '生活资产',
  'memory-strategy': '记忆策略',
  'permission-policy': '权限策略',
  'sandbox-policy': '沙箱策略',
  'provider-capability': 'Provider 能力',
  'provider-policy': 'Provider 策略',
  'provider-preset': '模型 Provider',
  'subagent-role': 'SubAgent 角色',
}

const OWNERSHIP_LABELS: Record<ModelContextAsset['ownership'], string> = {
  builtin: '内置',
  'role-pack': 'Role Pack',
  user: '用户',
  external: '外部',
}

const CONTENT_KIND_LABELS: Record<ModelContextAsset['contentKind'], string> = {
  static: '静态正文',
  template: '模板骨架',
  schema: 'Schema',
  data: '结构化数据',
  runtime: '运行时',
}

export function PromptManagerPanel({ info, onRefresh, onOpenUsage }: { info: DebugPromptInfo | null; onRefresh?: () => Promise<void> | void; onOpenUsage?: (item: AgentAssetUsageEvidence) => void }) {
  const [assets, setAssets] = useState<ModelContextAsset[]>([])
  const [selectedId, setSelectedId] = useState(RUNTIME_ID)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState<PromptLayer>('full')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [experimentDraft, setExperimentDraft] = useState('')
  const [experimentSource, setExperimentSource] = useState('')
  const [experimentInput, setExperimentInput] = useState('用一句话说明你会如何回应一个疲惫的用户。')
  const [experimentResult, setExperimentResult] = useState('')
  const [experimentMeta, setExperimentMeta] = useState('')
  const [experimentRunning, setExperimentRunning] = useState(false)
  const [l3Draft, setL3Draft] = useState('')
  const [savedL3, setSavedL3] = useState('')
  const [saveArmed, setSaveArmed] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!window.electronAPI?.debug?.modelContextAssets || !window.electronAPI.settings?.get) {
        if (active) {
          setError('需要 Electron 环境才能读取生产资产目录')
          setLoading(false)
        }
        return
      }
      try {
        const [nextAssets, settings] = await Promise.all([
          window.electronAPI.debug.modelContextAssets(),
          window.electronAPI.settings.get(),
        ])
        if (!active) return
        setAssets(nextAssets)
        const current = settings.systemPrompt || ''
        setL3Draft(current)
        setSavedL3(current)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredAssets = useMemo(() => assets.filter((asset) => {
    if (category !== 'all' && asset.category !== category) return false
    if (!normalizedQuery) return true
    return [asset.key, asset.name, asset.purpose, asset.role, asset.desc, asset.source, asset.sourcePath, asset.assetType, asset.ownership, asset.contentKind]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  }), [assets, category, normalizedQuery])

  const showRuntime = (category === 'all' || category === 'system') && (
    !normalizedQuery || ['当前装配预览', 'system prompt', info?.persona.name ?? '']
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  )
  const selectedAsset = assets.find((asset) => asset.key === selectedId) ?? null

  useEffect(() => {
    const selectedVisible = selectedId === RUNTIME_ID
      ? showRuntime
      : filteredAssets.some((asset) => asset.key === selectedId)
    if (selectedVisible) return
    setSelectedId(showRuntime ? RUNTIME_ID : filteredAssets[0]?.key ?? '')
  }, [filteredAssets, selectedId, showRuntime])

  const clearStatusSoon = () => window.setTimeout(() => setStatus(''), 1800)

  const loadExperiment = (label: string, content: string | undefined) => {
    if (!content?.trim()) {
      setStatus('这个 Prompt 是动态组装项，没有可编辑的固定正文。')
      clearStatusSoon()
      return
    }
    setExperimentDraft(content)
    setExperimentSource(label)
    setExperimentResult('')
    setExperimentMeta('')
    setStatus(`已载入「${label}」实验副本；不会影响真实会话。`)
    clearStatusSoon()
  }

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard?.writeText(value)
    setStatus(`${label}已复制`)
    clearStatusSoon()
  }

  /** 使用现有 Playground IPC 隔离试跑实验副本；不写设置或真实会话。 */
  const runExperiment = async () => {
    if (!window.electronAPI?.debug?.playgroundRun) {
      setError('需要 Electron 环境才能运行 Prompt 实验')
      return
    }
    const userPrompt = experimentInput.trim()
    if (!experimentDraft.trim() || !userPrompt) return
    setExperimentRunning(true)
    setExperimentResult('')
    setExperimentMeta('')
    setError('')
    try {
      const result = await window.electronAPI.debug.playgroundRun({
        systemPrompt: experimentDraft,
        userPrompt,
      })
      if (result.ok) {
        setExperimentResult(result.text)
        setExperimentMeta(`${result.model} · ${result.ms}ms · 隔离试跑`)
      } else {
        setError(result.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExperimentRunning(false)
    }
  }

  /** 二次确认后复用现有设置键保存 L3；生产 Prompt 资产始终不写。 */
  const saveL3 = async () => {
    if (!window.electronAPI?.settings?.set) {
      setError('需要 Electron 环境才能保存 L3 自定义补充指令')
      return
    }
    if (l3Draft.length > MAX_L3_CHARS) {
      setError(`L3 自定义补充指令最多 ${MAX_L3_CHARS} 字，请只保留需要追加的差异或行为约束。`)
      return
    }
    if (!saveArmed) {
      setSaveArmed(true)
      window.setTimeout(() => setSaveArmed(false), 4000)
      return
    }
    try {
      setError('')
      await window.electronAPI.settings.set('systemPrompt', l3Draft)
      setSavedL3(l3Draft)
      setSaveArmed(false)
      await onRefresh?.()
      setStatus('已保存到设置的 L3 自定义补充指令；后续真实对话会使用它。')
      clearStatusSoon()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const resetL3 = () => {
    setL3Draft(savedL3)
    setSaveArmed(false)
    setStatus('已恢复上次保存的 L3 内容。')
    clearStatusSoon()
  }

  return (
    <div className="space-y-4" data-testid="prompt-manager-panel">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>提示词管理器</h2>
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{assets.length + 1} 项</span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            统一查看生产 Prompt、伙伴与人格资产、记忆策略、权限与沙箱策略、模型 Provider、Tool schema、Skill、Eval Case / Grader、Eval Judge 与当前 MCP 工具。资产保持只读；只有显式载入的文本实验副本和 L3 自定义补充可以编辑。
          </p>
        </div>
      </header>

      <section className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }} data-testid="prompt-l3-editor">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>L3 自定义补充指令</h3>
            <p className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>
              这是现有设置项，会追加到 L3 并影响后续真实对话；不会替换或改写生产 Prompt 资产文件。
            </p>
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={resetL3} disabled={l3Draft === savedL3} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] disabled:opacity-40" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
              <RotateCcw size={11} />恢复
            </button>
            <button type="button" onClick={() => void saveL3()} disabled={l3Draft === savedL3} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] disabled:opacity-40" style={{ borderColor: saveArmed ? 'var(--warning)' : 'var(--border-color)', color: saveArmed ? 'var(--warning)' : 'var(--text-secondary)' }}>
              {saveArmed ? <Check size={11} /> : <Save size={11} />}
              {saveArmed ? '再次确认保存' : '保存到设置'}
            </button>
          </div>
        </div>
        <textarea
          value={l3Draft}
          onChange={(event) => { setL3Draft(event.target.value); setSaveArmed(false); setError('') }}
          maxLength={MAX_L3_CHARS}
          rows={4}
          className="theme-input mt-2 w-full resize-y rounded-lg border px-2.5 py-2 font-mono text-xs outline-none"
          placeholder="例如：回答时多用比喻，保持简洁…"
        />
        <div className="mt-1 text-right font-mono text-[10px]" style={{ color: l3Draft.length >= MAX_L3_CHARS ? 'var(--warning)' : 'var(--text-muted)' }}>{l3Draft.length}/{MAX_L3_CHARS}</div>
      </section>

      {(status || error) && <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: error ? 'var(--danger)' : 'var(--border-color)', color: error ? 'var(--danger)' : 'var(--text-secondary)' }}>{error || status}</p>}

      <div className="flex flex-wrap gap-1.5" aria-label="生产资产分类">
        {CATEGORY_OPTIONS.map((option) => {
          const active = category === option.id
          return (
            <button key={option.id} type="button" onClick={() => setCategory(option.id)} className="rounded-lg border px-3 py-1.5 text-xs transition" style={{ borderColor: active ? 'var(--accent)' : 'var(--border-color)', background: active ? 'var(--accent-subtle)' : 'transparent', color: active ? 'var(--accent-fg)' : 'var(--text-muted)' }}>
              {option.label}
            </button>
          )
        })}
      </div>

      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="theme-input h-10 w-full rounded-lg border pl-9 pr-3 text-xs outline-none" placeholder="搜索名称、用途或源文件…" />
      </label>

      <div className="grid min-h-[430px] gap-3 lg:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]">
        <div className="scrollbar-hover min-h-0 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          {showRuntime && <PromptListButton active={selectedId === RUNTIME_ID} name="当前装配预览" meta={info ? `${info.persona.name} · ~${info.estimatedTokens} tokens` : '加载中'} onClick={() => setSelectedId(RUNTIME_ID)} />}
          {filteredAssets.map((asset) => <PromptListButton key={asset.key} active={selectedId === asset.key} name={asset.name} meta={`${asset.key} · ${CATEGORY_LABELS[asset.category]} · ${OWNERSHIP_LABELS[asset.ownership]} · ${asset.mode === 'dynamic' ? '动态' : '静态'} · v${asset.version}`} onClick={() => setSelectedId(asset.key)} />)}
          {!loading && !showRuntime && filteredAssets.length === 0 && <p className="px-3 py-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>没有匹配项</p>}
          {loading && <p className="px-3 py-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>读取中…</p>}
        </div>

        <div className="min-w-0 rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          {selectedId === RUNTIME_ID
            ? <RuntimePromptDetail info={info} layer={layer} setLayer={setLayer} onLoadExperiment={loadExperiment} onCopy={(value) => void copyText(value, 'System Prompt ')} />
            : selectedAsset
              ? <AssetPromptDetail asset={selectedAsset} onLoadExperiment={loadExperiment} onCopy={(value) => void copyText(value, 'Prompt ')} onOpenUsage={onOpenUsage} />
              : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>从左侧选择一个生产资产查看详情。</p>}
        </div>
      </div>

      {experimentDraft && (
        <section className="rounded-lg border p-3" style={{ borderColor: 'var(--accent)', background: 'var(--accent-subtle)' }} data-testid="prompt-experiment-editor">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>实验副本{experimentSource ? ` · ${experimentSource}` : ''}</h3>
              <p className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>这里的修改只存在于当前页面，不会写入生产资产或真实会话。验证后，请把需要追加的差异手动整理到顶部 L3 编辑器。</p>
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => void copyText(experimentDraft, '实验 Prompt ')} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Copy size={11} />复制</button>
            </div>
          </div>
          <textarea value={experimentDraft} onChange={(event) => setExperimentDraft(event.target.value)} rows={10} className="theme-input mt-2 w-full resize-y rounded-lg border px-2.5 py-2 font-mono text-xs leading-5 outline-none" />
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <textarea value={experimentInput} onChange={(event) => setExperimentInput(event.target.value)} rows={2} className="theme-input w-full resize-y rounded-lg border px-2.5 py-2 text-xs outline-none" placeholder="输入一条测试消息…" />
            <button type="button" onClick={() => void runExperiment()} disabled={experimentRunning || !experimentDraft.trim() || !experimentInput.trim()} className="h-10 rounded-lg px-3 text-xs font-medium disabled:opacity-40" style={{ background: 'var(--accent-emphasis)', color: 'var(--bg-primary)' }}>{experimentRunning ? '运行中…' : '隔离试跑'}</button>
          </div>
          {(experimentResult || experimentMeta) && <div className="mt-2 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }} data-testid="prompt-experiment-result"><div className="mb-1 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{experimentMeta}</div><pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5" style={{ color: 'var(--text-primary)' }}>{experimentResult}</pre></div>}
        </section>
      )}
    </div>
  )
}

function PromptListButton({ active, name, meta, onClick }: { active: boolean; name: string; meta: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="block w-full border-b px-3 py-2.5 text-left transition last:border-b-0" style={{ borderColor: 'var(--border-subtle)', background: active ? 'var(--sidebar-active)' : 'transparent' }}><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span><span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-muted)' }}>{meta}</span></button>
}

function RuntimePromptDetail({ info, layer, setLayer, onLoadExperiment, onCopy }: { info: DebugPromptInfo | null; layer: PromptLayer; setLayer: (layer: PromptLayer) => void; onLoadExperiment: (label: string, content: string | undefined) => void; onCopy: (value: string) => void }) {
  if (!info) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>加载当前装配预览中…</p>
  const layers = [
    { id: 'full' as const, label: '完整' },
    { id: 'l1' as const, label: 'L1 人格' },
    { id: 'l2' as const, label: 'L2 能力' },
    { id: 'l3' as const, label: 'L3 上下文' },
    { id: 'l4' as const, label: 'L4 动态' },
  ]
  const content = layer === 'full' ? info.full : info.layers[layer]
  return <div className="space-y-3"><div><h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>当前装配预览</h3><p className="mt-1 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{info.persona.name} · {info.charCount} chars · ~{info.estimatedTokens} tokens</p><p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>按当前状态即时重组，不代表某次请求的精确实发内容。</p></div><RuntimeTraceList assets={info.assets} /><div className="flex flex-wrap gap-1.5">{layers.map((item) => { const active = layer === item.id; return <button key={item.id} type="button" onClick={() => setLayer(item.id)} className="rounded-lg border px-2.5 py-1 text-[11px]" style={{ borderColor: active ? 'var(--accent)' : 'var(--border-color)', background: active ? 'var(--accent-subtle)' : 'transparent', color: active ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{item.label}</button> })}</div><div className="flex gap-1.5"><button type="button" onClick={() => onLoadExperiment(`当前装配 · ${layer}`, content)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>载入为实验副本</button><button type="button" onClick={() => onCopy(content)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Copy size={11} />复制</button></div><pre className="scrollbar-hover max-h-[52vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[11px] leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{content}</pre></div>
}

function RuntimeTraceList({ assets }: { assets: PromptAssetTrace[] }) {
  if (assets.length === 0) return <p className="rounded-lg border px-2.5 py-2 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>当前装配没有可追踪的注册表资产。</p>
  return <div className="rounded-lg border p-2.5" style={{ borderColor: 'var(--border-subtle)' }}><div className="mb-1.5 text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>本次装配引用的资产</div><div className="space-y-1.5">{assets.map((asset) => <div key={asset.key} className="rounded border px-2 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}><div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="font-mono text-[10px]" style={{ color: 'var(--text-primary)' }}>{asset.key}</span><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.purpose} · {asset.role} · {asset.locale} · v{asset.version} · {asset.fingerprint}</span></div><div className="mt-0.5 break-all font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{asset.source}</div>{asset.slots.length > 0 && <SlotList slots={asset.slots} />}</div>)}</div></div>
}

function AssetPromptDetail({ asset, onLoadExperiment, onCopy, onOpenUsage }: { asset: ModelContextAsset; onLoadExperiment: (label: string, content: string | undefined) => void; onCopy: (value: string) => void; onOpenUsage?: (item: AgentAssetUsageEvidence) => void }) {
  const content = asset.content || asset.locales[asset.locale]?.template || asset.preview
  const canLoadExperiment = asset.assetType !== 'companion-manifest'
    && asset.assetType !== 'companion-profile'
    && asset.assetType !== 'companion-world'
    && asset.assetType !== 'companion-life'
    && asset.assetType !== 'memory-strategy'
    && asset.assetType !== 'permission-policy'
    && asset.assetType !== 'sandbox-policy'
    && asset.assetType !== 'eval-case'
    && asset.assetType !== 'eval-grader'
    && asset.assetType !== 'provider-capability'
    && asset.assetType !== 'provider-policy'
    && asset.assetType !== 'provider-preset'
  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{asset.name}</h3>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{CATEGORY_LABELS[asset.category]}</span>
          <span className="text-[10px]" style={{ color: 'var(--accent)' }}>{asset.mode === 'dynamic' ? '动态 / 按需注入' : '静态资产'}</span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{ASSET_TYPE_LABELS[asset.assetType]}</span>
        </div>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{asset.desc}</p>
        <div className="mt-2 grid gap-x-4 gap-y-1 rounded-lg border p-2.5 text-[10px] sm:grid-cols-2" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
          <MetaLine label="稳定 key" value={asset.key} mono />
          <MetaLine label="版本" value={asset.version} mono />
          <MetaLine label="用途" value={asset.purpose} />
          <MetaLine label="角色" value={asset.role} />
          <MetaLine label="语言" value={asset.locale} mono />
          <MetaLine label="所有权" value={OWNERSHIP_LABELS[asset.ownership]} />
          <MetaLine label="内容形态" value={CONTENT_KIND_LABELS[asset.contentKind]} />
          <MetaLine label="来源" value={asset.source} mono />
          <MetaLine label="自动指纹" value={`${asset.fingerprint} · ${asset.fingerprintKind === 'content' ? '内容' : '结构'}`} mono />
          <MetaLine label="状态" value={asset.status === 'disabled' ? '已停用' : asset.status === 'deprecated' ? '已废弃' : asset.status === 'experimental' ? '实验中' : '生效中'} />
          {asset.derivedFrom && <MetaLine label="派生自" value={asset.derivedFrom} mono />}
          {asset.dependencies && asset.dependencies.length > 0 && <MetaLine label="依赖" value={asset.dependencies.join('、')} mono />}
        </div>
        {asset.slots.length > 0 && <SlotList slots={asset.slots} />}
      </div>
      {content ? (
        <>
          <div className="flex gap-1.5">
            {content && canLoadExperiment && <button type="button" onClick={() => onLoadExperiment(asset.name, content)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>载入为实验副本</button>}
            <button type="button" onClick={() => onCopy(content)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Copy size={11} />复制</button>
          </div>
          <pre className="scrollbar-hover max-h-[52vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[11px] leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{content}</pre>
        </>
      ) : (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
          该资产按运行状态动态组装；目录只展示来源和插槽，请在「请求与运行 → LLM 调用」中查看最终实发内容。
        </p>
      )}
      <AssetRecentUsage assetKey={asset.key} onOpenUsage={onOpenUsage} />
    </div>
  )
}

function AssetRecentUsage({ assetKey, onOpenUsage }: { assetKey: string; onOpenUsage?: (item: AgentAssetUsageEvidence) => void }) {
  const [items, setItems] = useState<AgentAssetUsageEvidence[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    const query = window.electronAPI?.debug?.assetUsageQuery
    if (!query) {
      setLoading(false)
      return () => { active = false }
    }
    void query({ assetKey, limit: 20 })
      .then((result) => { if (active) setItems(result.records) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [assetKey])
  return (
    <section className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }} data-testid="asset-recent-usage">
      <div className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>最近使用</div>
      {loading ? <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>加载中…</p>
        : items.length === 0 ? <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>尚无可证明的运行记录；这不等于从未使用。</p>
          : <div className="mt-2 space-y-1.5">{items.map((item) => <button key={item.id} type="button" onClick={() => onOpenUsage?.(item)} className="block w-full rounded border px-2 py-1.5 text-left" style={{ borderColor: 'var(--border-subtle)' }}><div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{new Date(item.occurredAt).toLocaleString()} · {item.relation} · {item.usageKind} · {item.status}</div><div className="mt-0.5 font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{item.spanId}</div></button>)}</div>}
    </section>
  )
}

function MetaLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><span>{label}：</span><span className={`break-all ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-secondary)' }}>{value}</span></div>
}

function SlotList({ slots }: { slots: PromptAsset['slots'] | PromptAssetTrace['slots'] }) {
  return <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: 'var(--border-subtle)' }}><div className="mb-1 text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>动态插槽</div><div className="flex flex-wrap gap-1.5">{slots.map((slot) => <span key={`${slot.name}-${slot.source}`} className="rounded border px-1.5 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}><span className="font-mono">{slot.name}</span> · {slot.source} · {slot.lifecycle}</span>)}</div></div>
}
