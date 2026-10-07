import { useState, type ChangeEvent, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Check, Copy, RotateCcw } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { TabStrip } from '../foundation/TabStrip'
import { TextField } from '../foundation/TextField'
import { CONTENT_LAYOUT, LAYOUT_CLASSES, LAYOUT_DENSITIES, layoutDensityStyle, readingContentStyle, type LayoutDensityId } from '../../shared/content-layout'
import canal from '../../assets/playground/travel-canal.png'

const controls = [
  { key: 'gutter', label: '页面边距', min: 0, max: 48 },
  { key: 'width', label: '内容宽度', min: 240, max: 1200 },
  { key: 'section', label: '区块间距', min: 0, max: 48 },
  { key: 'card', label: '卡片内边距', min: 0, max: 48 },
] as const
type ParameterKey = typeof controls[number]['key']
const presetValues = (id: LayoutDensityId): Record<ParameterKey, number> => ({ gutter: LAYOUT_DENSITIES[id].gutter, section: LAYOUT_DENSITIES[id].section, card: LAYOUT_DENSITIES[id].card, width: CONTENT_LAYOUT.readingWidth })

/**
 * 背景：单个详情和检查说明无法直观比较基础布局。
 * 设计意图：五组实际内容同时展示，共同继承密度变量。
 * 关键约束：自然展开、不绑定产品场景；操作按钮始终保留占位。
 */
export function LayoutLanguageSamples() {
  const [densityId, setDensityId] = useState<LayoutDensityId | 'custom'>('standard')
  const [density, setDensity] = useState(presetValues('standard'))
  const [drafts, setDrafts] = useState<Partial<Record<ParameterKey, string>>>({})
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const selectPreset = (id: LayoutDensityId) => { setDensityId(id); setDensity(presetValues(id)); setDrafts({}) }
  const update = (key: ParameterKey, value: number) => {
    const control = controls.find(item => item.key === key)!
    if (!Number.isFinite(value)) return
    setDensity(previous => ({ ...previous, [key]: Math.max(control.min, Math.min(control.max, Math.round(value))) }))
    setDensityId('custom')
  }
  const localStyle = {
    ...layoutDensityStyle('standard'),
    '--layout-gutter-small': `${density.gutter}px`, '--layout-gutter-large': `${density.gutter}px`,
    '--layout-block': `${density.gutter}px`, '--layout-section': `${density.section}px`,
    '--layout-card-small': `${density.card}px`, '--layout-card-large': `${density.card}px`,
  } as CSSProperties
  const paragraph = '午后的光映在水面上。沿着河边走，遇见喜欢的地方就停下来，记下路上看到的光影。'
  const longParagraph = `${paragraph}远处的桥、近处的树影和偶尔经过的人，让同一段路在不同时间有了不同的模样。没有急着赶路，反而注意到了平时忽略的细节。`
  const surface = { borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }
  const section = (id: string, title: string, children: ReactNode) => <section aria-label={title} data-testid={`layout-section-${id}`} className={`min-w-0 ${LAYOUT_CLASSES.section}`}><h3 className="text-sm font-bold">{title}</h3>{children}</section>
  const caption = (text: string) => <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{text}</p>
  const content = (long = false) => <div className={`min-w-0 ${LAYOUT_CLASSES.section}`}><h4 className="text-base font-semibold">沿着运河慢慢走</h4><p className="text-sm leading-7">{long ? longParagraph : paragraph}</p><p className="text-xs leading-5" style={{ color: 'var(--text-muted)' }}>午后 · 河畔</p></div>
  const sampleClass = `min-w-0 border ${LAYOUT_CLASSES.card} ${LAYOUT_CLASSES.section}`
  return <div className={`min-w-0 ${LAYOUT_CLASSES.section}`} data-testid="layout-language-samples" style={localStyle}>
    <div className="flex flex-wrap items-center gap-3">
      <TabStrip label="布局密度" items={Object.entries(LAYOUT_DENSITIES).map(([id, value]) => ({ id, label: value.label }))} activeId={densityId} onSelect={value => selectPreset(value as LayoutDensityId)} />
      <span className="w-12 text-xs" data-testid="layout-custom-label" style={{ color: 'var(--text-muted)' }}>{densityId === 'custom' ? '自定义' : ''}</span>
      <IconButton label="重置布局参数" size={28} onClick={() => selectPreset('standard')}><RotateCcw size={14} /></IconButton>
    </div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2" data-testid="layout-profile-values">
      {controls.map(({ key, label, min, max }) => <div key={key} className="grid min-w-0 grid-cols-[1fr_5rem_1.5rem] items-center gap-2">
        <label htmlFor={`layout-${key}`} className="col-span-3 text-xs font-medium">{label}</label>
        <input id={`layout-${key}`} aria-label={label} type="range" min={min} max={max} step={1} value={density[key]} className="min-w-0 w-full accent-[var(--accent-emphasis)]" onChange={event => { update(key, Number(event.target.value)); setDrafts(previous => ({ ...previous, [key]: undefined })) }} />
        <TextField aria-label={`${label}数值`} type="number" min={min} max={max} step={1} value={drafts[key] ?? density[key]} className="w-full rounded border px-2 py-1 tabular-nums" style={{ borderColor: 'var(--border-color)' }} onChange={(event: ChangeEvent<HTMLInputElement>) => { const value = event.target.value; setDrafts(previous => ({ ...previous, [key]: value })); if (value.trim() && Number(value) >= min && Number(value) <= max) update(key, Number(value)) }} onBlur={(event: FocusEvent<HTMLInputElement>) => { if (event.target.value.trim()) update(key, Number(event.target.value)); setDrafts(previous => ({ ...previous, [key]: undefined })) }} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>px</span>
      </div>)}
    </div>
    <div className={`${LAYOUT_CLASSES.gutter} ${LAYOUT_CLASSES.block}`} data-testid="layout-preview-gutter">
    <div className={LAYOUT_CLASSES.section} style={{ width: '100%', maxWidth: density.width }} data-testid="layout-preview-width">
    {section('text', '文字', <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]" style={{ gap: density.section }}>{[false, true].map(long => <div key={String(long)} className={sampleClass} style={surface}>{caption(long ? '长正文' : '短正文')}{content(long)}</div>)}</div>)}
    {section('images', '图片', <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] items-start" style={{ gap: density.section }}>{[{ label: '横图', ratio: '3 / 2' }, { label: '竖图', ratio: '2 / 3' }, { label: '方图', ratio: '1 / 1' }].map(({ label, ratio }) => <figure key={label} className={sampleClass} style={surface}><img data-testid="layout-ratio-image" src={canal} alt={`古镇运河 · ${label}`} className="block w-full object-cover" style={{ aspectRatio: ratio }} /><figcaption className="text-xs" style={{ color: 'var(--text-muted)' }}>{label} · {ratio}</figcaption></figure>)}</div>)}
    {section('combinations', '图文组合', <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]" style={{ gap: density.section }}>
      <div className={sampleClass} style={surface}>{caption('上图下文')}<img src={canal} alt="运河与石桥" className="block aspect-[3/2] w-full object-cover" />{content()}</div>
      <div className={sampleClass} style={surface}>{caption('左图右文')}<div className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start" style={{ gap: density.section }}><img src={canal} alt="河畔树影" className="block aspect-[2/3] w-full object-cover" />{content()}</div></div>
    </div>)}
    {section('modules', '模块', <div className={LAYOUT_CLASSES.section}>
      <article className={`group rounded-lg border ${LAYOUT_CLASSES.card}`} data-testid="layout-module-single" style={surface}>
        <div className="flex items-center gap-3" data-testid="layout-module-action-row"><h4 className="min-w-0 flex-1 text-sm font-medium">在河边记下一个想法。</h4><IconButton label="复制样张文字" size={28} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" data-testid="layout-module-action" onClick={async () => { try { await navigator.clipboard.writeText(paragraph); setCopied(true); setCopyError(false) } catch { setCopyError(true) } }}>{copied ? <Check size={14} /> : <Copy size={14} />}</IconButton></div>
        <p className="mt-2 text-sm leading-7">{paragraph}</p>
      </article>
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))]" data-testid="layout-module-grid" style={{ gap: density.section }}>{['水面上的光', '桥下的倒影', '一段不赶时间的散步与随手记下的见闻'].map((title, index) => <article key={title} className={`min-w-0 rounded-lg border ${LAYOUT_CLASSES.card}`} data-testid="layout-module-card" style={surface}><h4 className="break-words text-sm font-medium">{title}</h4><p className="mt-2 text-sm leading-7">{index === 2 ? longParagraph : paragraph}</p></article>)}</div>
      <p role="status" className="min-h-5 text-xs" style={{ color: 'var(--text-muted)' }}>{copyError ? '复制未成功，请重试。' : copied ? '已复制' : ''}</p>
    </div>)}
    {section('alignment', '边界与对齐', <div className={LAYOUT_CLASSES.section}>{[false, true].map(centered => <div key={String(centered)} className={`min-w-0 border ${LAYOUT_CLASSES.gutter} ${LAYOUT_CLASSES.block}`} data-testid={centered ? 'layout-align-center' : 'layout-align-left'} style={{ borderColor: 'var(--border-color)' }}><div className={LAYOUT_CLASSES.section} data-testid={centered ? 'layout-reading-center' : 'layout-reading-left'} style={{ ...readingContentStyle(), maxWidth: density.width, ...(centered ? { marginInline: 'auto', textAlign: 'center' as const } : {}) }}>{caption(centered ? '居中 · 限宽' : '左对齐 · 限宽')}{content()}</div></div>)}</div>)}
    </div>
    </div>
  </div>
}

export function OpacityLanguageSamples() {
  const [alpha, setAlpha] = useState(40)
  return <section className="space-y-4" data-testid="opacity-language-samples">
    <label className="flex items-center gap-4 text-xs">透明度
      <input aria-label="表面透明度" type="range" min={0} max={100} step={5} value={alpha} onChange={event => setAlpha(Number(event.target.value))} className="min-w-0 flex-1" />
      <output className="w-12 text-right tabular-nums">{alpha}%</output>
    </label>
    <div className="relative h-64 overflow-hidden" style={{ backgroundImage: `url(${canal})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div data-testid="opacity-surface" className="absolute inset-6 flex items-center justify-center border text-sm" style={{ borderColor: 'var(--border-color)', background: `color-mix(in srgb, var(--card-bg) ${alpha}%, transparent)` }}>
        <span data-testid="opacity-text-surface" className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>运河边的午后</span>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">{[15, 40, 80].map(value => <ActionButton key={value} aria-pressed={alpha === value} onClick={() => setAlpha(value)}>{value}%</ActionButton>)}</div>
  </section>
}
