/**
 * Foundation Design Language v2 Playground：用可判断的样张研究颜色、主题、圆角和动效。
 *
 * 设计意图：成熟设计系统把 token 和使用场景绑定，而不是只展示一堆变量名；
 *       这里的候选主题是显式隔离 fixture，不写入正式 design-asset-registry。
 * 关键约束：圆角、动效和候选主题只影响本组件内部样张，不能污染 documentElement 或正式页面。
 */

import { useState, type CSSProperties } from 'react'
import { AdoptionMark } from './AdoptionMark'
import { StoryBlock } from './StoryBlock'
import { DESIGN_THEME_ASSETS } from '../../shared/design-asset-registry'

const COLORS = [
  ['--bg-primary', '结构 · 主底', '应用画布和页面背景'],
  ['--bg-secondary', '结构 · 次底', '侧栏、分组和辅助面'],
  ['--bg-tertiary', '结构 · 三级', '控件、代码块和弱强调底'],
  ['--bg-inset', '结构 · 内凹', '输入区和嵌套内容'],
  ['--text-primary', '文本 · 主', '标题和主要内容'],
  ['--text-secondary', '文本 · 次', '说明和辅助内容'],
  ['--text-muted', '文本 · 弱', '低频信息和占位'],
  ['--accent-emphasis', '交互 · 默认', '主要按钮和选中状态'],
  ['--accent-subtle', '交互 · 浅底', 'hover、选中和提示背景'],
  ['--border-color', '交互 · 边框', '卡片和控件边界'],
  ['--success', '语义 · 成功', '完成、可用和确认'],
  ['--danger', '语义 · 危险', '失败、拒绝和破坏性操作'],
  ['--warning', '语义 · 警告', '需要留意但可继续'],
] as const

const COLOR_ROLES = [
  { id: 'surface', label: '背景层级', items: ['主底', '次底', '三级底', '内凹'] },
  { id: 'interaction', label: '交互状态', items: ['默认', 'hover', 'pressed', 'focus / disabled'] },
  { id: 'semantic', label: '语义反馈', items: ['成功', '警告', '危险', '信息'] },
] as const

const RADII = [
  { name: '--radius-sm', label: '控件', usage: '按钮、输入、标签' },
  { name: '--radius-md', label: '卡片', usage: '内容卡、选择器' },
  { name: '--radius-lg', label: '面板', usage: '大段组合内容' },
  { name: '--radius-xl', label: '弹层', usage: '欢迎区、对话框' },
  { name: '--radius-full', label: '胶囊', usage: '状态、筛选和提示' },
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

/** Playground-only 候选主题：统一微型界面让开发者比较层级，而不是比较孤立色块。 */
const THEME_STUDIES = [
  {
    id: 'xuan-paper', label: '宣纸', description: '暖白、墨色、暖石', mode: '浅色',
    colors: { app: '#f7f4ed', panel: '#ece7dc', card: '#fbfaf6', text: '#28241f', muted: '#756e64', accent: '#8a6a45', accentHover: '#6f5236', border: '#d8d0c2', success: '#347a59', warning: '#a66b2d', danger: '#b94a42' },
  },
  {
    id: 'yao-stone', label: '曜石', description: '深墨、灰蓝、低饱和金', mode: '深色',
    colors: { app: '#111318', panel: '#1a1d24', card: '#222631', text: '#f1eee8', muted: '#9b9da5', accent: '#c6a878', accentHover: '#dfc18a', border: '#343946', success: '#67b58a', warning: '#d39a57', danger: '#e27d76' },
  },
  {
    id: 'song-smoke', label: '松烟', description: '灰绿、青灰、自然感', mode: '浅色',
    colors: { app: '#f2f5f1', panel: '#e5ece6', card: '#fafcf9', text: '#24332d', muted: '#6e7d74', accent: '#317b66', accentHover: '#256653', border: '#cbd9cf', success: '#2e8061', warning: '#a87539', danger: '#b94e48' },
  },
  {
    id: 'bronze-print', label: '铜版', description: '象牙纸、铜棕、深褐', mode: '浅色',
    colors: { app: '#f8f3e9', panel: '#eee5d6', card: '#fffaf0', text: '#3a2b20', muted: '#847365', accent: '#a6531d', accentHover: '#823f16', border: '#ddcdb9', success: '#587c55', warning: '#b5752c', danger: '#b94a3b' },
  },
] as const

const PRODUCTION_THEMES = DESIGN_THEME_ASSETS.map((asset) => ({ id: asset.id, label: asset.labelZh }))

type Sub = 'colors' | 'themes' | 'radius'
type MotionEasing = keyof typeof MOTION_EASINGS

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  )
}

function ThemeStudyCard({ study, selected, onSelect }: { study: typeof THEME_STUDIES[number]; selected: boolean; onSelect: () => void }) {
  const { colors } = study
  const style = {
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
  } as CSSProperties

  return (
    <article className="overflow-hidden rounded-xl border transition" data-testid={`theme-study-${study.id}`} style={{ ...style, borderColor: selected ? 'var(--study-accent)' : 'var(--border-color)', boxShadow: selected ? '0 0 0 1px var(--study-accent)' : undefined, background: 'var(--study-app)', color: 'var(--study-text)' }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--study-border)' }}>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold">{study.label}</h4>
          <p className="truncate text-[10px]" style={{ color: 'var(--study-muted)' }}>{study.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5"><span className="rounded-full border px-1.5 py-0.5 text-[9px]" style={{ borderColor: 'var(--study-border)', color: 'var(--study-muted)' }}>{study.mode}</span><button type="button" aria-pressed={selected} onClick={onSelect} className="rounded-full border px-1.5 py-0.5 text-[9px] transition" style={{ borderColor: selected ? 'var(--study-accent)' : 'var(--study-border)', color: selected ? 'var(--study-accent)' : 'var(--study-muted)', background: selected ? 'color-mix(in srgb, var(--study-accent) 12%, transparent)' : undefined }}>{selected ? '当前' : '比较'}</button></div>
      </div>
      <div className="grid min-h-[10rem] grid-cols-[4.2rem_1fr]" style={{ background: 'var(--study-card)' }}>
        <div className="space-y-2 border-r p-2" style={{ background: 'var(--study-panel)', borderColor: 'var(--study-border)' }}>
          <div className="h-1.5 w-7 rounded-full" style={{ background: 'var(--study-accent)' }} />
          {['Chat', '人物世界', '设置'].map((label, index) => <div key={label} className="truncate text-[9px]" style={{ color: index === 0 ? 'var(--study-text)' : 'var(--study-muted)', fontWeight: index === 0 ? 600 : 400 }}>{label}</div>)}
        </div>
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="h-2 w-20 rounded-full" style={{ background: 'var(--study-text)', opacity: 0.85 }} />
            <span className="rounded-full px-1.5 py-0.5 text-[8px]" style={{ background: 'color-mix(in srgb, var(--study-success) 15%, transparent)', color: 'var(--study-success)' }}>在线</span>
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--study-border)', background: 'var(--study-app)' }}>
            <div className="h-1.5 w-28 rounded-full" style={{ background: 'var(--study-text)', opacity: 0.7 }} />
            <div className="mt-1.5 h-1.5 w-40 max-w-full rounded-full" style={{ background: 'var(--study-muted)', opacity: 0.45 }} />
            <div className="mt-2 flex items-center gap-1.5">
              <button type="button" className="rounded-md px-2 py-1 text-[9px]" style={{ background: 'var(--study-accent)', color: study.mode === '深色' ? '#1b1b1b' : '#fff' }}>主要操作</button>
              <span className="rounded-md border px-2 py-1 text-[9px]" style={{ borderColor: 'var(--study-border)', color: 'var(--study-muted)' }}>次要</span>
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--study-accent)' }} />
            <span className="h-1.5 w-8 rounded-full" style={{ background: 'var(--study-warning)' }} />
            <span className="h-1.5 w-8 rounded-full" style={{ background: 'var(--study-danger)' }} />
          </div>
        </div>
      </div>
    </article>
  )
}

function MotionTokenSample({ name, label, usage, value, easing, playing }: { name: string; label: string; usage: string; value: string; easing: MotionEasing; playing: boolean }) {
  const easingValue = MOTION_EASINGS[easing].value
  return (
    <div className="min-w-[13rem] flex-1 rounded-md border px-2.5 py-2 text-left" data-testid={`motion-sample-${name.replaceAll('--', '')}`} style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>{name}</span>
        <span className="shrink-0 font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{value || '—'}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px]" style={{ color: 'var(--text-muted)' }}>
        <span>{label} · {usage}</span><span>{MOTION_EASINGS[easing].label}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="block h-full w-1/3 rounded-full" data-testid="motion-sample-bar" style={{ background: 'var(--accent-emphasis)', animation: playing ? `playground-motion-sweep ${value || '220ms'} ${easingValue} infinite alternate` : 'none' }} />
      </div>
    </div>
  )
}

export function DesignSystemPanel() {
  const [sub, setSub] = useState<Sub>('colors')
  const [customRadius, setCustomRadius] = useState(16)
  const [motionPlaying, setMotionPlaying] = useState(true)
  const [motionEasing, setMotionEasing] = useState<MotionEasing>('standard')
  const [selectedStudy, setSelectedStudy] = useState('xuan-paper')

  const read = (name: string) => {
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
          <button key={item.id} type="button" onClick={() => setSub(item.id)} className="px-3 py-1.5 text-xs transition" style={{ color: sub === item.id ? 'var(--accent-fg)' : 'var(--text-muted)', borderBottom: sub === item.id ? '2px solid var(--accent-fg)' : '2px solid transparent', marginBottom: -1 }}>{item.label}</button>
        ))}
      </div>

      {sub === 'colors' && (
        <div className="space-y-4">
          <SectionHeading title="颜色角色" hint="先看使用场景，再决定是否需要新 token" />
          <div className="grid gap-3 md:grid-cols-3" data-testid="color-role-groups">
            {COLOR_ROLES.map((group) => (
              <section key={group.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h4 className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{group.label}</h4>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {group.items.map((item, index) => <div key={item} className="rounded-md px-2 py-2 text-[10px]" style={{ background: index === 0 ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', color: index === 0 ? 'var(--accent-fg)' : 'var(--text-secondary)' }}>{item}</div>)}
                </div>
              </section>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-testid="production-color-tokens">
            {COLORS.map(([name, label, usage]) => {
              const value = read(name)
              return <div key={name} className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}><div className="h-8" style={{ background: `var(${name})` }} /><div className="space-y-0.5 px-2 py-1.5"><div className="flex items-center gap-1"><div className="min-w-0 truncate font-mono text-[10px]" style={{ color: 'var(--text-primary)' }}>{name}</div><AdoptionMark /></div><div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</div><div className="truncate text-[9px]" style={{ color: 'var(--text-muted)' }} title={usage}>{usage} · {value || '—'}</div></div></div>
            })}
          </div>
          <StoryBlock title="交互状态不是一套新颜色" source="Playground research fixture · Radix scale mapping" edge>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="color-interaction-matrix">
              {[['默认', 'var(--accent-subtle)'], ['hover', 'color-mix(in srgb, var(--accent) 18%, var(--bg-secondary))'], ['pressed', 'var(--accent-emphasis)'], ['focus / disabled', 'var(--bg-tertiary)']].map(([label, background]) => <div key={label} className="rounded-md border px-2 py-2 text-[10px]" style={{ borderColor: label.startsWith('focus') ? 'var(--accent-fg)' : 'var(--border-subtle)', background, color: label === 'pressed' ? 'var(--accent-fg)' : 'var(--text-secondary)' }}>{label}<span className="mt-1 block font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{label === 'pressed' ? '--accent-emphasis' : label === 'hover' ? '--accent-hover (候选)' : label === '默认' ? '--accent-subtle' : '--bg-tertiary'}</span></div>)}
            </div>
          </StoryBlock>
        </div>
      )}

      {sub === 'themes' && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3"><SectionHeading title="主题候选" hint="四个方向，共用同一套微型界面" /><span className="shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>只影响本页样张</span></div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2" data-testid="theme-study-selection" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>当前比较方向</span><span className="truncate text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{THEME_STUDIES.find((study) => study.id === selectedStudy)?.label} · {THEME_STUDIES.find((study) => study.id === selectedStudy)?.description}</span></div><div className="grid gap-3 lg:grid-cols-2" data-testid="theme-study-grid">{THEME_STUDIES.map((study) => <ThemeStudyCard key={study.id} study={study} selected={study.id === selectedStudy} onSelect={() => setSelectedStudy(study.id)} />)}</div>
          <StoryBlock title="当前正式主题" source="src/shared/design-asset-registry.ts" edge>
            <div className="flex flex-wrap gap-1.5" data-testid="production-theme-strip">{PRODUCTION_THEMES.map((theme) => <span key={theme.id} className="rounded-full border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{theme.label}</span>)}</div>
          </StoryBlock>
        </div>
      )}

      {sub === 'radius' && (
        <div className="space-y-4">
          <SectionHeading title="圆角角色" hint="数值服务于组件角色，不单独追求更圆" />
          <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2" data-testid="radius-controls" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}><span className="shrink-0 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>自定义样张</span><input type="range" min="0" max="32" step="1" value={customRadius} aria-label="自定义圆角" onChange={(event) => setCustomRadius(Number(event.target.value))} className="min-w-[10rem] flex-1 accent-[var(--accent-emphasis)]" /><span className="w-10 shrink-0 text-right font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{customRadius}px</span><div className="flex h-8 w-16 items-center justify-center border text-[9px]" style={{ borderColor: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderRadius: `${customRadius}px`, color: 'var(--text-secondary)' }}>样张</div></div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5" data-testid="radius-role-grid">{RADII.map((item) => <div key={item.name} className="text-center"><div className="mx-auto mb-1 h-12 w-12 border" style={{ borderColor: 'var(--accent-fg)', background: 'var(--accent-subtle)', borderRadius: `var(${item.name})` }} /><div className="font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{item.label}</div><div className="font-mono text-[9px]" style={{ color: 'var(--text-secondary)' }}>{item.name} · {read(item.name) || '—'}</div><div className="mt-0.5 text-[9px]" style={{ color: 'var(--text-muted)' }}>{item.usage}</div></div>)}</div>
          <div className="space-y-2" data-testid="motion-samples"><style>{'@keyframes playground-motion-sweep { from { transform: translateX(0); } to { transform: translateX(200%); } } @media (prefers-reduced-motion: reduce) { [data-testid^="motion-sample-"] span { animation: none !important; } }'}</style><div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>动效</span>{(Object.keys(MOTION_EASINGS) as MotionEasing[]).map((easing) => <button key={easing} type="button" onClick={() => setMotionEasing(easing)} className="rounded-md border px-2 py-1 text-[10px]" style={{ borderColor: motionEasing === easing ? 'var(--accent-fg)' : 'var(--border-subtle)', color: motionEasing === easing ? 'var(--accent-fg)' : 'var(--text-muted)', background: motionEasing === easing ? 'var(--accent-subtle)' : undefined }}>{MOTION_EASINGS[easing].label}</button>)}<button type="button" role="switch" aria-checked={motionPlaying} aria-label="动效播放" onClick={() => setMotionPlaying((playing) => !playing)} className="ml-auto flex items-center gap-2 rounded-md border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}><span className="relative h-4 w-7 rounded-full" style={{ background: motionPlaying ? 'var(--accent-emphasis)' : 'var(--bg-tertiary)' }}><span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition" style={{ left: motionPlaying ? 'calc(100% - 0.875rem)' : '0.125rem' }} /></span>动效 {motionPlaying ? '开' : '关'}</button></div><div className="flex flex-wrap gap-2">{MOTIONS.map((item) => <MotionTokenSample key={item.name} {...item} value={read(item.name)} easing={motionEasing} playing={motionPlaying} />)}</div></div>
        </div>
      )}
    </div>
  )
}
