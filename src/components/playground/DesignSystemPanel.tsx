/**
 * 设计系统实验室：读取生产 token，同时容纳尚未回流产品的组合候选。
 */

import { useState, type CSSProperties } from 'react'
import { AdoptionMark } from './AdoptionMark'
import { StoryBlock } from './StoryBlock'
import { DESIGN_THEME_ASSETS } from '../../shared/design-asset-registry'

const COLORS = [
  ['--bg-primary', '结构 · 主底'],
  ['--bg-secondary', '结构 · 次底'],
  ['--bg-tertiary', '结构 · 三级'],
  ['--bg-inset', '结构 · 内凹'],
  ['--text-primary', '文本 · 主'],
  ['--text-secondary', '文本 · 次'],
  ['--text-muted', '文本 · 弱'],
  ['--accent-emphasis', '强调 · 实色'],
  ['--accent-fg', '强调 · 前景'],
  ['--accent-subtle', '强调 · 浅底'],
  ['--border-color', '边框'],
  ['--success', '语义 · 成功'],
  ['--danger', '语义 · 危险'],
  ['--warning', '语义 · 警告'],
] as const

const RADII = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'] as const
const MOTIONS = ['--motion-fast', '--motion-normal', '--motion-slow'] as const
const THEMES = DESIGN_THEME_ASSETS.map((asset) => ({ id: asset.id, label: asset.labelZh }))

function MotionTokenSample({ name, value }: { name: string; value: string }) {
  const [playing, setPlaying] = useState(false)

  return (
    <button
      type="button"
      className="min-w-[11rem] rounded-md border px-2.5 py-2 text-left"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      onClick={() => setPlaying((current) => !current)}
      aria-label={`${name} 动画示例`}
    >
      <span className="mb-2 block h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
        <span
          className="block h-full w-1/3 rounded-full"
          style={{
            background: 'var(--accent-emphasis)',
            transform: playing ? 'translateX(200%)' : 'translateX(0)',
            transition: `transform ${value || '220ms'} var(--motion-ease)`,
          }}
        />
      </span>
      <span className="block font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>{name}</span>
      <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>
        {value || '—'} <AdoptionMark />
      </span>
      <span className="mt-1 block text-[9px]" style={{ color: 'var(--text-muted)' }}>点击播放</span>
    </button>
  )
}

const DARK_THEME_STYLE: CSSProperties = {
  '--bg-primary': '#0d1117',
  '--bg-secondary': '#161b22',
  '--bg-tertiary': '#21262d',
  '--text-primary': '#e6edf3',
  '--text-secondary': '#8b949e',
  '--text-muted': '#484f58',
  '--border-color': '#30363d',
  '--border-subtle': '#21262d',
  '--accent': '#58a6ff',
  '--accent-emphasis': '#1f6feb',
  '--accent-fg': '#58a6ff',
  '--accent-subtle': 'rgba(56, 139, 253, 0.1)',
  '--success': '#3fb950',
  '--warning': '#d29922',
  '--danger': '#f85149',
} as CSSProperties

type Sub = 'colors' | 'themes' | 'radius'

export function DesignSystemPanel() {
  const [sub, setSub] = useState<Sub>('colors')
  const [tick, setTick] = useState(0)

  const read = (name: string) => {
    void tick
    if (typeof document === 'undefined') return ''
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  const subs: { id: Sub; label: string }[] = [
    { id: 'colors', label: '颜色' },
    { id: 'themes', label: '主题对照' },
    { id: 'radius', label: '圆角 / 动效' },
  ]

  return (
    <div className="w-full space-y-5" data-testid="design-system-panel">

      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {subs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSub(item.id)}
            className="px-3 py-1.5 text-xs transition"
            style={{
              color: sub === item.id ? 'var(--accent-fg)' : 'var(--text-muted)',
              borderBottom: sub === item.id ? '2px solid var(--accent-fg)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto settings-option mb-1 px-2 py-1 text-[10px]"
          onClick={() => setTick((value) => value + 1)}
        >
          重新读取
        </button>
      </div>

      {sub === 'colors' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLORS.map(([name, label]) => {
            const value = read(name)
            return (
              <div key={name} className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
                <div className="h-10" style={{ background: `var(${name})` }} />
                <div className="space-y-0.5 px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 truncate font-mono text-[10px]" style={{ color: 'var(--text-primary)' }}>{name}</div>
                    <AdoptionMark />
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
                  <div className="truncate font-mono text-[9px]" style={{ color: 'var(--text-secondary)' }}>{value || '—'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sub === 'themes' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              data-theme={theme.id}
              className="overflow-hidden rounded-lg border"
              style={{
                ...(theme.id === 'dark' ? DARK_THEME_STYLE : {}),
                borderColor: 'var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-xs font-medium">{theme.label}</span>
                <AdoptionMark />
              </div>
              <div className="space-y-3 p-3">
                <div className="grid grid-cols-4 gap-1">
                  {['--bg-secondary', '--bg-tertiary', '--accent', '--danger'].map((token) => (
                    <div key={token} className="h-7 rounded" style={{ background: `var(${token})` }} title={token} />
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-[12px] font-medium">主要文本</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>次级说明用于检视层级和对比度。</div>
                </div>
                <button type="button" className="h-7 rounded-md px-2 text-[10px] text-white" style={{ background: 'var(--accent-emphasis)' }}>主要操作</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === 'radius' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {RADII.map((name) => (
              <div key={name} className="text-center">
                <div className="mx-auto mb-1 h-12 w-12 border" style={{ borderColor: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderRadius: `var(${name})` }} />
                <div className="flex items-center justify-center gap-1 font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {name}<AdoptionMark />
                </div>
                <div className="font-mono text-[9px]" style={{ color: 'var(--text-secondary)' }}>{read(name) || '—'}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" data-testid="motion-samples">
            {MOTIONS.map((name) => (
              <MotionTokenSample key={name} name={name} value={read(name)} />
            ))}
          </div>
        </div>
      )}


    </div>
  )
}
