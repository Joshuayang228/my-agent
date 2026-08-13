/**
 * Debug Prompt 来源。
 *
 * 背景：Prompt 资产属于生产真相，按当前状态重组的 System Prompt 只能作为装配预览。
 * 设计意图：用同一主进程注册表展示资产，用 debug:system-prompt 帮助理解当前装配结构。
 * 关键约束：只读；不在渲染进程复制 Prompt 正文，也不提供写回生产配置的入口。
 */

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { PromptAsset } from '../../shared/prompt-assets'

export interface DebugPromptInfo {
  full: string
  layers: { l1: string; l2: string; l3: string; l4: string }
  persona: { id: string; name: string }
  charCount: number
  estimatedTokens: number
}

type CategoryFilter = 'all' | PromptAsset['category']
type PromptLayer = 'full' | 'l1' | 'l2' | 'l3' | 'l4'

const RUNTIME_ID = '__runtime-current__'

const CATEGORY_OPTIONS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'system', label: '主对话' },
  { id: 'context', label: '上下文' },
  { id: 'companion', label: '伙伴世界' },
  { id: 'subagent', label: '子 Agent' },
  { id: 'ui', label: '界面文案' },
]

const CATEGORY_LABELS: Record<PromptAsset['category'], string> = {
  system: '主对话',
  context: '上下文',
  companion: '伙伴世界',
  subagent: '子 Agent',
  ui: '界面文案',
}

export function PromptManagerPanel({ info }: { info: DebugPromptInfo | null }) {
  const [assets, setAssets] = useState<PromptAsset[]>([])
  const [selectedId, setSelectedId] = useState(RUNTIME_ID)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [layer, setLayer] = useState<PromptLayer>('full')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!window.electronAPI?.debug?.promptAssets) {
        if (active) {
          setError('需要 Electron 环境才能读取生产 Prompt 目录')
          setLoading(false)
        }
        return
      }
      try {
        const next = await window.electronAPI.debug.promptAssets()
        if (active) setAssets(next)
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredAssets = useMemo(() => assets.filter((asset) => {
    if (category !== 'all' && asset.category !== category) return false
    if (!normalizedQuery) return true
    return [asset.name, asset.desc, asset.sourcePath]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  }), [assets, category, normalizedQuery])

  const showRuntime = (category === 'all' || category === 'system') && (
    !normalizedQuery || ['当前装配预览', 'system prompt', info?.persona.name ?? '']
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  )
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? null

  useEffect(() => {
    const selectedVisible = selectedId === RUNTIME_ID
      ? showRuntime
      : filteredAssets.some((asset) => asset.id === selectedId)
    if (selectedVisible) return
    if (showRuntime) {
      setSelectedId(RUNTIME_ID)
    } else {
      setSelectedId(filteredAssets[0]?.id ?? '')
    }
  }, [filteredAssets, selectedId, showRuntime])

  return (
    <div className="space-y-4" data-testid="prompt-manager-panel">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Prompt 来源</h2>
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{assets.length + 1} 项</span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            生产 Prompt 资产只读展示；当前装配预览用于理解结构，真实实发内容请看「请求」。
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5" aria-label="Prompt 分类">
        {CATEGORY_OPTIONS.map((option) => {
          const active = category === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setCategory(option.id)}
              className="rounded-lg border px-3 py-1.5 text-xs transition"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                background: active ? 'var(--accent-subtle)' : 'transparent',
                color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <label className="relative block">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="theme-input h-10 w-full rounded-lg border pl-9 pr-3 text-xs outline-none"
          placeholder="搜索名称、用途或源文件…"
        />
      </label>

      {error && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="grid min-h-[430px] gap-3 lg:grid-cols-[minmax(220px,0.42fr)_minmax(0,1fr)]">
        <div className="scrollbar-hover min-h-0 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          {showRuntime && (
            <PromptListButton
              active={selectedId === RUNTIME_ID}
              name="当前装配预览"
              meta={info ? `${info.persona.name} · ~${info.estimatedTokens} tokens` : '加载中'}
              onClick={() => setSelectedId(RUNTIME_ID)}
            />
          )}
          {filteredAssets.map((asset) => (
            <PromptListButton
              key={asset.id}
              active={selectedId === asset.id}
              name={asset.name}
              meta={`${CATEGORY_LABELS[asset.category]}${asset.dynamic ? ' · 动态' : ''}`}
              onClick={() => setSelectedId(asset.id)}
            />
          ))}
          {!loading && !showRuntime && filteredAssets.length === 0 && (
            <p className="px-3 py-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>没有匹配项</p>
          )}
          {loading && <p className="px-3 py-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>读取中…</p>}
        </div>

        <div className="min-w-0 rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          {selectedId === RUNTIME_ID
            ? <RuntimePromptDetail info={info} layer={layer} setLayer={setLayer} />
            : selectedAsset
              ? <AssetPromptDetail asset={selectedAsset} />
              : <p className="text-sm" style={{ color: 'var(--text-muted)' }}>从左侧选择一个 Prompt 查看详情。</p>}
        </div>
      </div>
    </div>
  )
}

function PromptListButton({
  active,
  name,
  meta,
  onClick,
}: {
  active: boolean
  name: string
  meta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full border-b px-3 py-2.5 text-left transition last:border-b-0"
      style={{
        borderColor: 'var(--border-subtle)',
        background: active ? 'var(--sidebar-active)' : 'transparent',
      }}
    >
      <span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
      <span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-muted)' }}>{meta}</span>
    </button>
  )
}

function RuntimePromptDetail({
  info,
  layer,
  setLayer,
}: {
  info: DebugPromptInfo | null
  layer: PromptLayer
  setLayer: (layer: PromptLayer) => void
}) {
  if (!info) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>加载当前装配预览中…</p>

  const layers = [
    { id: 'full' as const, label: '完整' },
    { id: 'l1' as const, label: 'L1 人格' },
    { id: 'l2' as const, label: 'L2 能力' },
    { id: 'l3' as const, label: 'L3 上下文' },
    { id: 'l4' as const, label: 'L4 动态' },
  ]
  const content = layer === 'full' ? info.full : info.layers[layer]

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>当前装配预览</h3>
        <p className="mt-1 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {info.persona.name} · {info.charCount} chars · ~{info.estimatedTokens} tokens
        </p>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          按当前状态即时重组，不代表某次请求的精确实发内容。
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {layers.map((item) => {
          const active = layer === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setLayer(item.id)}
              className="rounded-lg border px-2.5 py-1 text-[11px]"
              style={{
                borderColor: active ? 'var(--accent)' : 'var(--border-color)',
                background: active ? 'var(--accent-subtle)' : 'transparent',
                color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <pre className="scrollbar-hover max-h-[52vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[11px] leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {content}
      </pre>
    </div>
  )
}

function AssetPromptDetail({ asset }: { asset: PromptAsset }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{asset.name}</h3>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{CATEGORY_LABELS[asset.category]}</span>
          {asset.dynamic && <span className="text-[10px]" style={{ color: 'var(--accent)' }}>动态组装</span>}
        </div>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{asset.desc}</p>
        <code className="mt-2 block break-all font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.sourcePath}</code>
      </div>
      {(asset.content || asset.preview) ? (
        <pre className="scrollbar-hover max-h-[52vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[11px] leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {asset.content || asset.preview}
        </pre>
      ) : (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
          该 Prompt 按运行状态动态组装，请在实际 LLM 调用记录中查看最终内容。
        </p>
      )}
    </div>
  )
}
