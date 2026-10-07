import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { TabStrip } from '../foundation/TabStrip'
import { CONTENT_LAYOUT, LAYOUT_CLASSES, LAYOUT_DENSITIES, layoutDensityStyle, readingContentStyle, type LayoutDensityId } from '../../shared/content-layout'
import canal from '../../assets/playground/travel-canal.png'

/**
 * 背景：单个详情和检查说明无法直观比较基础布局。
 * 设计意图：五组实际内容同时展示，共同继承密度变量。
 * 关键约束：自然展开、不绑定产品场景；操作按钮始终保留占位。
 */
export function LayoutLanguageSamples() {
  const [densityId, setDensityId] = useState<LayoutDensityId>('standard')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const density = LAYOUT_DENSITIES[densityId]
  const paragraph = '午后的光映在水面上。沿着河边走，遇见喜欢的地方就停下来，记下路上看到的光影。'
  const longParagraph = `${paragraph}远处的桥、近处的树影和偶尔经过的人，让同一段路在不同时间有了不同的模样。没有急着赶路，反而注意到了平时忽略的细节。`
  const surface = { borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }
  const section = (id: string, title: string, children: ReactNode) => <section aria-label={title} data-testid={`layout-section-${id}`} className={`min-w-0 ${LAYOUT_CLASSES.section}`}><h3 className="text-sm font-medium">{title}</h3>{children}</section>
  const caption = (text: string) => <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{text}</p>
  const content = (long = false) => <div className={`min-w-0 ${LAYOUT_CLASSES.section}`}><h4 className="text-base font-semibold">沿着运河慢慢走</h4><p className="text-sm leading-7">{long ? longParagraph : paragraph}</p><p className="text-xs leading-5" style={{ color: 'var(--text-muted)' }}>午后 · 河畔</p></div>
  return <div className={`min-w-0 ${LAYOUT_CLASSES.section}`} data-testid="layout-language-samples" style={layoutDensityStyle(densityId)}>
    <TabStrip label="布局密度" items={Object.entries(LAYOUT_DENSITIES).map(([id, value]) => ({ id, label: value.label }))} activeId={densityId} onSelect={value => setDensityId(value as LayoutDensityId)} />
    <dl className="flex flex-wrap gap-6 text-xs" data-testid="layout-profile-values">
      <div><dt>页面边距</dt><dd>{density.gutter}px</dd></div>
      <div><dt>内容宽度上限</dt><dd>{CONTENT_LAYOUT.readingWidth}px</dd></div>
      <div><dt>区块间距</dt><dd>{density.section}px</dd></div>
      <div><dt>卡片内边距</dt><dd>{density.card}px</dd></div>
    </dl>
    {section('text', '文字', <div className="grid min-w-0 sm:grid-cols-2" style={{ gap: density.section }}>{[false, true].map(long => <div key={String(long)} className={LAYOUT_CLASSES.section}>{caption(long ? '长正文' : '短正文')}{content(long)}</div>)}</div>)}
    {section('images', '图片', <div className="grid min-w-0 grid-cols-3 items-start" style={{ gap: density.section }}>{[{ label: '横图', ratio: '3 / 2' }, { label: '竖图', ratio: '2 / 3' }, { label: '方图', ratio: '1 / 1' }].map(({ label, ratio }) => <figure key={label} className={`min-w-0 ${LAYOUT_CLASSES.section}`}><img data-testid="layout-ratio-image" src={canal} alt={`古镇运河 · ${label}`} className="block w-full object-cover" style={{ aspectRatio: ratio }} /><figcaption className="text-xs" style={{ color: 'var(--text-muted)' }}>{label} · {ratio}</figcaption></figure>)}</div>)}
    {section('combinations', '图文组合', <div className="grid min-w-0 sm:grid-cols-2" style={{ gap: density.section }}>
      <div className={LAYOUT_CLASSES.section}>{caption('上图下文')}<img src={canal} alt="运河与石桥" className="block aspect-[3/2] w-full object-cover" />{content()}</div>
      <div className={LAYOUT_CLASSES.section}>{caption('左图右文')}<div className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start" style={{ gap: density.section }}><img src={canal} alt="河畔树影" className="block aspect-[2/3] w-full object-cover" />{content()}</div></div>
    </div>)}
    {section('modules', '模块', <div className={LAYOUT_CLASSES.section}>
      <article className={`group rounded-lg border ${LAYOUT_CLASSES.card}`} data-testid="layout-module-single" style={surface}>
        <div className="flex items-center gap-3" data-testid="layout-module-action-row"><h4 className="min-w-0 flex-1 text-sm font-medium">在河边记下一个想法。</h4><IconButton label="复制样张文字" size={28} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" data-testid="layout-module-action" onClick={async () => { try { await navigator.clipboard.writeText(paragraph); setCopied(true); setCopyError(false) } catch { setCopyError(true) } }}>{copied ? <Check size={14} /> : <Copy size={14} />}</IconButton></div>
        <p className="mt-2 text-sm leading-7">{paragraph}</p>
      </article>
      <div className="grid min-w-0 sm:grid-cols-3" data-testid="layout-module-grid" style={{ gap: density.section }}>{['水面上的光', '桥下的倒影', '一段不赶时间的散步与随手记下的见闻'].map((title, index) => <article key={title} className={`min-w-0 rounded-lg border ${LAYOUT_CLASSES.card}`} data-testid="layout-module-card" style={surface}><h4 className="break-words text-sm font-medium">{title}</h4><p className="mt-2 text-sm leading-7">{index === 2 ? longParagraph : paragraph}</p></article>)}</div>
      <p role="status" className="min-h-5 text-xs" style={{ color: 'var(--text-muted)' }}>{copyError ? '复制未成功，请重试。' : copied ? '已复制' : ''}</p>
    </div>)}
    {section('alignment', '边界与对齐', <div className={LAYOUT_CLASSES.section}>{[false, true].map(centered => <div key={String(centered)} className={`min-w-0 border ${LAYOUT_CLASSES.gutter} ${LAYOUT_CLASSES.block}`} data-testid={centered ? 'layout-align-center' : 'layout-align-left'} style={{ borderColor: 'var(--border-color)' }}><div className={LAYOUT_CLASSES.section} data-testid={centered ? 'layout-reading-center' : 'layout-reading-left'} style={{ ...readingContentStyle(), ...(centered ? { marginInline: 'auto', textAlign: 'center' as const } : {}) }}>{caption(centered ? '居中 · 限宽' : '左对齐 · 限宽')}{content()}</div></div>)}</div>)}
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
