/**
 * 设计系统 — 当前主题 CSS 变量（Alice design-system 轻量版）。
 */

import { useState } from 'react'

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

type Sub = 'colors' | 'radius' | 'samples'

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
    { id: 'radius', label: '圆角 / 动效' },
    { id: 'samples', label: '基础样例' },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="design-system-panel">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          设计系统 — 主题 Token
        </h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          当前主题 CSS 变量的<strong style={{ color: 'var(--text-secondary)' }}>唯一可信来源</strong>
          （读运行时计算值）。规范见 <code className="font-mono">agent-skills/frontend-guidelines.md</code>。
          不是 Storybook。
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {subs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className="px-3 py-1.5 text-xs transition"
            style={{
              color: sub === t.id ? 'var(--accent-fg)' : 'var(--text-muted)',
              borderBottom: sub === t.id ? '2px solid var(--accent-fg)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto settings-option mb-1 px-2 py-1 text-[10px]"
          onClick={() => setTick((n) => n + 1)}
        >
          重新读取
        </button>
      </div>

      {sub === 'colors' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COLORS.map(([name, label]) => {
            const val = read(name)
            return (
              <div
                key={name}
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="h-10" style={{ background: `var(${name})` }} />
                <div className="space-y-0.5 px-2 py-1.5">
                  <div className="font-mono text-[10px]" style={{ color: 'var(--text-primary)' }}>{name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
                  <div className="truncate font-mono text-[9px]" style={{ color: 'var(--text-secondary)' }}>{val || '—'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sub === 'radius' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {RADII.map((name) => (
              <div key={name} className="text-center">
                <div
                  className="mx-auto mb-1 h-12 w-12 border"
                  style={{
                    borderColor: 'var(--accent-fg)',
                    background: 'var(--accent-subtle)',
                    borderRadius: `var(${name})`,
                  }}
                />
                <div className="font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{name}</div>
                <div className="font-mono text-[9px]" style={{ color: 'var(--text-secondary)' }}>{read(name) || '—'}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {MOTIONS.map((name) => (
              <span key={name}>{name} = {read(name) || '—'}</span>
            ))}
          </div>
        </div>
      )}

      {sub === 'samples' && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="settings-option px-3 py-1.5 text-xs">主要按钮</button>
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            次要
          </button>
          <input
            className="theme-input w-40 rounded-lg border px-2 py-1.5 text-xs outline-none"
            placeholder="theme-input"
            defaultValue=""
          />
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px]"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
          >
            chip
          </span>
        </div>
      )}
    </div>
  )
}
