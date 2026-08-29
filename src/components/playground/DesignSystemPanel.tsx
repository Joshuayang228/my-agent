/**
 * Foundation Design Language Playground：把“高级感”拆成可判断的视觉变量。
 *
 * 设计意图：高级不是堆颜色、阴影或玻璃效果，而是让材质、层级、比例和动效
 * 在同一套真实样张中形成稳定秩序。所有候选仍是 Playground-only fixture。
 * 关键约束：不写入正式主题、不修改 documentElement、不复制生产设计资产。
 */

import { useState, type CSSProperties } from 'react'
import { AdoptionMark } from './AdoptionMark'
import { DESIGN_THEME_ASSETS } from '../../shared/design-asset-registry'

const COLORS = [
  ['--bg-primary', '主底', '画布与页面背景'],
  ['--bg-secondary', '次底', '侧栏与辅助面'],
  ['--bg-tertiary', '三级底', '控件与代码块'],
  ['--bg-inset', '内凹底', '输入区与嵌套内容'],
  ['--text-primary', '主文本', '标题与正文'],
  ['--text-secondary', '次文本', '说明与辅助内容'],
  ['--text-muted', '弱文本', '低频信息与占位'],
  ['--accent-emphasis', '强调色', '主要操作与选中'],
  ['--accent-subtle', '强调浅底', 'hover 与轻提示'],
  ['--border-color', '边界色', '卡片与控件边界'],
  ['--success', '成功', '完成与可用'],
  ['--danger', '危险', '失败与拒绝'],
  ['--warning', '警告', '需要留意'],
] as const

const COLOR_ROLES = [
  { id: 'surface', label: '表面', note: '先分层，再谈装饰', items: ['主底', '次底', '三级底', '内凹'] },
  { id: 'interaction', label: '状态', note: '用明度和边界表达变化', items: ['默认', 'hover', 'pressed', 'focus / disabled'] },
  { id: 'semantic', label: '语义', note: '颜色只承担必要的提示', items: ['成功', '警告', '危险', '信息'] },
] as const

const RADII = [
  { name: '--radius-sm', label: '控件', usage: '按钮 / 输入 / 标签' },
  { name: '--radius-md', label: '卡片', usage: '内容卡 / 选择器' },
  { name: '--radius-lg', label: '面板', usage: '组合内容 / 侧栏' },
  { name: '--radius-xl', label: '浮层', usage: '欢迎区 / 对话框' },
  { name: '--radius-full', label: '胶囊', usage: '状态 / 筛选' },
] as const

const MOTIONS = [
  { name: '--motion-fast', label: '微交互', usage: 'hover、按钮、开关', easing: 'standard' },
  { name: '--motion-normal', label: '内容变化', usage: '展开、筛选、切换', easing: 'entrance' },
  { name: '--motion-slow', label: '大范围变化', usage: '面板、重要提示', easing: 'exit' },
] as const

const MOTION_EASINGS = {
  standard: { label: '标准', value: 'cubic-bezier(0.2, 0, 0.38, 0.9)' },
  entrance: { label: '进入', value: 'cubic-bezier(0, 0, 0.38, 0.9)' },
  exit: { label: '退出', value: 'cubic-bezier(0.2, 0, 1, 0.9)' },
} as const

/** 仅用于比较气质的隔离候选，不是生产主题注册表。 */
const THEME_STUDIES = [
  {
    id: 'porcelain-blue', label: '瓷青', description: '冷白、青瓷、靛蓝', mode: '浅色', material: '清亮的瓷面',
    colors: { app: '#edf3f6', panel: '#dfe9ee', card: '#fbfcfd', text: '#182a33', muted: '#657881', accent: '#216f8b', accentHover: '#17586f', border: '#c7d8df', success: '#2b806f', warning: '#9a6b2e', danger: '#b34e58' },
  },
  {
    id: 'yao-stone', label: '曜石', description: '深墨、灰蓝、低饱和金', mode: '深色', material: '安静的哑光石面',
    colors: { app: '#111318', panel: '#1a1d24', card: '#222631', text: '#f1eee8', muted: '#9b9da5', accent: '#c6a878', accentHover: '#dfc18a', border: '#343946', success: '#67b58a', warning: '#d39a57', danger: '#e27d76' },
  },
  {
    id: 'song-smoke', label: '松烟', description: '灰绿、青灰、自然感', mode: '浅色', material: '有呼吸的纤维纸面',
    colors: { app: '#f2f5f1', panel: '#e5ece6', card: '#fafcf9', text: '#24332d', muted: '#6e7d74', accent: '#317b66', accentHover: '#256653', border: '#cbd9cf', success: '#2e8061', warning: '#a87539', danger: '#b94e48' },
  },
  {
    id: 'deep-plum', label: '绛紫', description: '深莓、烟紫、玫瑰铜', mode: '深色', material: '柔软的夜色绒面',
    colors: { app: '#201922', panel: '#2b2130', card: '#382839', text: '#f4edf4', muted: '#bca8bc', accent: '#c26b8e', accentHover: '#dc7fa4', border: '#50384f', success: '#79b89d', warning: '#d3a163', danger: '#e4888d' },
  },
] as const

const PRODUCTION_THEMES = DESIGN_THEME_ASSETS.map((asset) => ({ id: asset.id, label: asset.labelZh }))
type Sub = 'colors' | 'themes' | 'radius'
type MotionEasing = keyof typeof MOTION_EASINGS

type ThemeStyle = CSSProperties & Record<`--study-${string}`, string>

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  )
}

function ThemeStudyCard({ study, selected, onSelect }: { study: typeof THEME_STUDIES[number]; selected: boolean; onSelect: () => void }) {
  const { colors } = study
  const style: ThemeStyle = {
    '--study-app': colors.app,
    '--study-panel': colors.panel,
    '--study-card': colors.card,
    '--study-text': colors.text,
    '--study-muted': colors.muted,
    '--study-accent': colors.accent,
    '--study-accent-hover': colors.accentHover,
    '--study-border': colors.border,
    '--study-success': colors.success,
    '--study-warning': colors.warning,
    '--study-danger': colors.danger,
  }

  return (
    <article
      className="group overflow-hidden rounded-2xl border transition-all"
      data-testid={`theme-study-${study.id}`}
      style={{
        ...style,
        borderColor: selected ? 'var(--study-accent)' : 'var(--border-subtle)',
        background: 'var(--study-app)',
        color: 'var(--study-text)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--study-accent) 22%, transparent), 0 1rem 2.5rem color-mix(in srgb, var(--study-text) 10%, transparent)' : '0 0.75rem 2rem color-mix(in srgb, var(--study-text) 6%, transparent)',
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-[17px] leading-none tracking-tight">{study.label}</h4>
            <span className="rounded-full border px-1.5 py-0.5 text-[9px]" style={{ borderColor: 'var(--study-border)', color: 'var(--study-muted)' }}>{study.mode}</span>
          </div>
          <p className="mt-1 truncate text-[10px]" style={{ color: 'var(--study-muted)' }}>{study.description}</p>
        </div>
        {selected ? (
          <span className="shrink-0 rounded-full border px-2.5 py-1 text-[10px]" title="当前正在比较这套主题" style={{ borderColor: 'var(--study-accent)', color: 'var(--study-accent)', background: 'color-mix(in srgb, var(--study-accent) 12%, transparent)' }}>
            当前比较
          </span>
        ) : (
          <button
            type="button"
            aria-pressed={false}
            onClick={onSelect}
            className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition"
            style={{ borderColor: 'var(--study-border)', color: 'var(--study-muted)' }}
          >
            设为比较
          </button>
        )}
      </div>

      <div className="flex h-1.5" aria-hidden="true">
        <span className="flex-1" style={{ background: 'var(--study-app)' }} />
        <span className="flex-1" style={{ background: 'var(--study-panel)' }} />
        <span className="flex-1" style={{ background: 'var(--study-card)' }} />
        <span className="flex-1" style={{ background: 'var(--study-accent)' }} />
      </div>

      <div className="grid min-h-[14rem] grid-cols-[4.5rem_1fr]" style={{ background: 'var(--study-card)' }}>
        <div className="space-y-3 border-r px-3 py-4" style={{ background: 'var(--study-panel)', borderColor: 'var(--study-border)' }}>
          <div className="h-1.5 w-8 rounded-full" style={{ background: 'var(--study-accent)' }} />
          {['Chat', '世界', '设置'].map((label, index) => (
            <div key={label} className="truncate text-[9px]" style={{ color: index === 0 ? 'var(--study-text)' : 'var(--study-muted)', fontWeight: index === 0 ? 600 : 400 }}>{label}</div>
          ))}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="h-2 w-24 rounded-full" style={{ background: 'var(--study-text)', opacity: 0.82 }} />
            <span className="rounded-full px-2 py-0.5 text-[8px]" style={{ background: 'color-mix(in srgb, var(--study-success) 15%, transparent)', color: 'var(--study-success)' }}>在线</span>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--study-border)', background: 'var(--study-app)' }}>
            <div className="h-1.5 w-32 max-w-full rounded-full" style={{ background: 'var(--study-text)', opacity: 0.7 }} />
            <div className="mt-2 h-1.5 w-44 max-w-full rounded-full" style={{ background: 'var(--study-muted)', opacity: 0.42 }} />
            <div className="mt-3 flex items-center gap-2">
              <button type="button" className="rounded-lg px-2.5 py-1.5 text-[9px]" style={{ background: 'var(--study-accent)', color: study.mode === '深色' ? '#1b1b1b' : '#fff' }}>继续</button>
              <span className="rounded-lg border px-2.5 py-1.5 text-[9px]" style={{ borderColor: 'var(--study-border)', color: 'var(--study-muted)' }}>稍后</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--study-accent)' }} />
            <span className="h-1.5 w-7 rounded-full" style={{ background: 'var(--study-warning)' }} />
            <span className="h-1.5 w-7 rounded-full" style={{ background: 'var(--study-danger)' }} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-4 py-2" style={{ borderColor: 'var(--study-border)', color: 'var(--study-muted)' }}>
        <span className="truncate text-[9px]">{study.material}</span>
        <span className="font-mono text-[9px] opacity-70">底 · 面 · 卡 · 强调</span>
      </div>
    </article>
  )
}

function MotionTokenSample({ name, label, usage, value, easing, playing }: { name: string; label: string; usage: string; value: string; easing: MotionEasing; playing: boolean }) {
  const easingValue = MOTION_EASINGS[easing].value
  const tokenDuration = Number.parseInt(value, 10)
  const demoDuration = Number.isFinite(tokenDuration) ? `${Math.max(tokenDuration * 5, 700)}ms` : '1100ms'
  return (
    <div className="min-w-[13rem] flex-1 rounded-xl border p-3" data-testid={`motion-sample-${name.replaceAll('--', '')}`} style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-primary)' }}>{name}</span>
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{value || '—'}</span>
      </div>
      <div className="mt-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label} · {usage}</div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="absolute left-0 top-0 block h-full w-1/3 rounded-full" data-testid="motion-sample-bar" style={{ background: 'var(--accent-emphasis)', animation: playing ? `playground-motion-sweep ${demoDuration} ${easingValue} infinite alternate` : 'none' }} />
      </div>
    </div>
  )
}

function MaterialPreview({ kind, title, note, children }: { kind: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-3" data-testid={`material-${kind}`} style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h4>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{note}</span>
      </div>
      <div className="relative mt-3 flex min-h-[7.5rem] items-center justify-center overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        {children}
      </div>
    </div>
  )
}

export function DesignSystemPanel() {
  const [sub, setSub] = useState<Sub>('colors')
  const [customRadius, setCustomRadius] = useState(16)
  const [motionPlaying, setMotionPlaying] = useState(true)
  const [motionEasing, setMotionEasing] = useState<MotionEasing>('standard')
  const [selectedStudy, setSelectedStudy] = useState('porcelain-blue')

  const read = (name: string) => {
    if (typeof document === 'undefined') return ''
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  const subs: { id: Sub; label: string }[] = [
    { id: 'colors', label: '颜色' },
    { id: 'themes', label: '主题对照' },
    { id: 'radius', label: '形态与动效' },
  ]

  return (
    <div className="playground-panel w-full space-y-6" data-testid="design-system-panel">
      <div className="flex min-w-0 items-center gap-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {subs.map((item) => {
          const active = sub === item.id
          return (
            <button key={item.id} type="button" onClick={() => setSub(item.id)} className="relative py-2.5 text-[11px] transition" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
              {item.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: 'var(--accent-emphasis)' }} />}
            </button>
          )
        })}
      </div>

      {sub === 'colors' && (
        <div className="space-y-5">
          <SectionHeading title="颜色角色" hint="先分层，再决定颜色是否有必要" />
          <div className="grid gap-3 md:grid-cols-3" data-testid="color-role-groups">
            {COLOR_ROLES.map((group) => (
              <section key={group.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{group.label}</h4>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{group.note}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {group.items.map((item, index) => <div key={item} className="rounded-lg px-2.5 py-2 text-[10px]" style={{ background: index === 0 ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', color: index === 0 ? 'var(--accent-fg)' : 'var(--text-secondary)' }}>{item}</div>)}
                </div>
              </section>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="production-color-tokens">
            {COLORS.map(([name, label, usage]) => {
              const value = read(name)
              return (
                <div key={name} className="playground-token-card group overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }} title={`${name} · ${usage}`}>
                  <div className="playground-token-swatch h-8 group-hover:scale-[1.02]" style={{ background: `var(${name})` }} />
                  <div className="space-y-1 px-3 py-2">
                    <div className="flex items-center gap-1.5"><span className="min-w-0 truncate font-mono text-[10px]" style={{ color: 'var(--text-primary)' }}>{name}</span><AdoptionMark /></div>
                    <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</div>
                    <div className="truncate font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{value || '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>状态如何借颜色表达</h4>
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>颜色之外还要有边界、字重和位置</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="color-interaction-matrix">
              {[['默认', 'var(--accent-subtle)', '--accent-subtle'], ['hover', 'color-mix(in srgb, var(--accent) 18%, var(--bg-secondary))', '--accent-hover'], ['pressed', 'var(--accent-emphasis)', '--accent-emphasis'], ['focus / disabled', 'var(--bg-tertiary)', '--bg-tertiary']].map(([label, background, token]) => (
                <div key={label} className="rounded-xl border px-3 py-2.5 text-[10px]" style={{ borderColor: label.startsWith('focus') ? 'var(--accent-fg)' : 'var(--border-subtle)', background, color: label === 'pressed' ? 'var(--accent-fg)' : 'var(--text-secondary)' }}>
                  <span>{label}</span><span className="mt-1 block font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{token}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {sub === 'themes' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeading title="主题候选" hint="四个方向，共用同一套产品样张" />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>只影响本页</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3" data-testid="theme-study-selection" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
            <span className="shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>正在比较</span>
            <span className="truncate text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{THEME_STUDIES.find((study) => study.id === selectedStudy)?.label} · {THEME_STUDIES.find((study) => study.id === selectedStudy)?.material}</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2" data-testid="theme-study-grid">
            {THEME_STUDIES.map((study) => <ThemeStudyCard key={study.id} study={study} selected={study.id === selectedStudy} onSelect={() => setSelectedStudy(study.id)} />)}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3" data-testid="production-theme-strip" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
            <span className="mr-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>正式主题</span>
            {PRODUCTION_THEMES.map((theme) => <span key={theme.id} className="rounded-full border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{theme.label}</span>)}
          </div>
        </div>
      )}

      {sub === 'radius' && (
        <div className="space-y-5">
          <SectionHeading title="形态、材质与动效" hint="高级感来自比例和节奏，不来自效果叠加" />
          <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
            <div className="flex flex-wrap items-center gap-3" data-testid="radius-controls">
              <span className="shrink-0 text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>圆角样张</span>
              <input type="range" min="0" max="32" step="1" value={customRadius} aria-label="自定义圆角" onChange={(event) => setCustomRadius(Number(event.target.value))} className="min-w-[10rem] flex-1 accent-[var(--accent-emphasis)]" />
              <span className="w-10 shrink-0 text-right font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{customRadius}px</span>
              <div className="flex h-9 w-24 items-center justify-center border text-[9px]" style={{ borderColor: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderRadius: `${customRadius}px`, color: 'var(--text-secondary)' }}>实时样张</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5" data-testid="radius-role-grid">
              {RADII.map((item) => <div key={item.name} className="text-center"><div className="mx-auto mb-2 h-14 w-14 border" style={{ borderColor: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderRadius: `var(${item.name})` }} /><div className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</div><div className="mt-0.5 font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{read(item.name) || '—'}</div><div className="mt-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>{item.usage}</div></div>)}
            </div>
          </section>

          <section className="space-y-3" data-testid="material-studies">
            <div className="flex items-baseline justify-between gap-3"><h4 className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>材质与蒙版</h4><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>蒙版只服务浮层，不给普通卡片加戏</span></div>
            <div className="grid gap-3 md:grid-cols-3">
              <MaterialPreview kind="solid" title="纯面" note="默认" >
                <div className="h-16 w-40 rounded-xl border" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)', boxShadow: '0 1rem 2rem color-mix(in srgb, var(--text-primary) 7%, transparent)' }} />
              </MaterialPreview>
              <MaterialPreview kind="soft" title="柔面" note="轻微层次">
                <div className="h-16 w-40 rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'linear-gradient(135deg, var(--card-bg), var(--bg-secondary))', boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 55%, transparent), 0 1rem 2rem color-mix(in srgb, var(--text-primary) 7%, transparent)' }} />
              </MaterialPreview>
              <MaterialPreview kind="mask" title="蒙版" note="仅浮层">
                <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--accent-subtle) 35%, transparent)' }} />
                <div className="relative h-16 w-40 rounded-xl border p-2 backdrop-blur-md" style={{ borderColor: 'color-mix(in srgb, var(--border-color) 65%, white 35%)', background: 'color-mix(in srgb, var(--card-bg) 70%, transparent)', boxShadow: '0 1rem 2rem color-mix(in srgb, var(--text-primary) 12%, transparent)' }}><div className="h-1.5 w-20 rounded-full" style={{ background: 'var(--text-primary)', opacity: 0.45 }} /><div className="mt-2 h-1.5 w-28 rounded-full" style={{ background: 'var(--text-muted)', opacity: 0.35 }} /></div>
              </MaterialPreview>
            </div>
          </section>

          <section className="space-y-3" data-testid="motion-samples">
            <div className="flex flex-wrap items-center gap-2"><h4 className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>动效节奏</h4>{(Object.keys(MOTION_EASINGS) as MotionEasing[]).map((easing) => <button key={easing} type="button" onClick={() => setMotionEasing(easing)} className="rounded-full border px-2.5 py-1 text-[10px] transition" style={{ borderColor: motionEasing === easing ? 'var(--accent-fg)' : 'var(--border-subtle)', color: motionEasing === easing ? 'var(--accent-fg)' : 'var(--text-muted)', background: motionEasing === easing ? 'var(--accent-subtle)' : undefined }}>{MOTION_EASINGS[easing].label}</button>)}<button type="button" role="switch" aria-checked={motionPlaying} aria-label="动效播放" onClick={() => setMotionPlaying((playing) => !playing)} className="ml-auto flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}><span className="relative h-4 w-7 rounded-full" style={{ background: motionPlaying ? 'var(--accent-emphasis)' : 'var(--bg-tertiary)' }}><span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition" style={{ left: motionPlaying ? 'calc(100% - 0.875rem)' : '0.125rem' }} /></span>动效 {motionPlaying ? '开' : '关'}</button></div>
            <div className="flex flex-wrap gap-3">{MOTIONS.map((item) => <MotionTokenSample key={item.name} {...item} value={read(item.name)} easing={motionEasing} playing={motionPlaying} />)}</div>
          </section>
        </div>
      )}
    </div>
  )
}
