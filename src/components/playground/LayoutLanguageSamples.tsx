import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { TabStrip } from '../foundation/TabStrip'
import { CONTENT_LAYOUT, contentGutterStyle, readingContentStyle } from '../../shared/content-layout'
import canal from '../../assets/playground/travel-canal.png'

/**
 * 背景：规范需要通过长内容和交互检查，不能只列数值。
 * 设计意图：同一来源演示对齐、限宽、滚动和常驻操作槽。
 * 关键约束：只操作本地样张；错误对照不输出给产品组件。
 */
export function LayoutLanguageSamples() {
  const [long, setLong] = useState(false)
  const [image, setImage] = useState('ready')
  const [detail, setDetail] = useState(true)
  return <div className="space-y-6" data-testid="layout-language-samples">
    <dl className="flex flex-wrap gap-6 text-xs">
      <div><dt>内容边距</dt><dd>{CONTENT_LAYOUT.gutter}px</dd></div>
      <div><dt>阅读宽度上限</dt><dd>{CONTENT_LAYOUT.readingWidth}px</dd></div>
      <div><dt>内容组间距</dt><dd>{CONTENT_LAYOUT.sectionGap}px</dd></div>
    </dl>
    <section className="space-y-3" aria-label="边距与内容宽度">
      <div className="flex flex-wrap items-center gap-3"><h3 className="text-sm font-medium">边距与内容宽度</h3>
        <ActionButton onClick={() => setLong(value => !value)} aria-pressed={long}>{long ? '短正文' : '长正文'}</ActionButton></div>
      <div className="h-80 overflow-y-auto border" data-testid="layout-scroll-sample" style={{ ...contentGutterStyle(), borderColor: 'var(--border-color)' }}>
        {!detail && <ActionButton onClick={() => setDetail(true)}>查看旅行</ActionButton>}
        {detail && <><ActionButton variant="plain" data-testid="layout-back" onClick={() => setDetail(false)}><ArrowLeft size={14} className="mr-2" />返回</ActionButton>
        <article data-testid="layout-reading" style={{ ...readingContentStyle(), display: 'grid', gap: CONTENT_LAYOUT.sectionGap, marginTop: CONTENT_LAYOUT.sectionGap }}>
          <h4 className="text-base font-semibold">沿着运河慢慢走</h4>
          <TabStrip label="配图状态" items={[{ id: 'ready', label: '有图' }, { id: 'pending', label: '加载中' }, { id: 'failed', label: '加载失败' }]} activeId={image} onSelect={setImage} />
          <div data-testid="layout-media" className="relative overflow-hidden" style={{ aspectRatio: '3 / 2', background: 'var(--bg-secondary)' }}>
            {image === 'ready' ? <img src={canal} alt="古镇运河" className="block h-full w-full object-cover" />
              : <div role="status" className="flex h-full items-center justify-center text-xs">{image === 'pending' ? '配图加载中' : '配图加载失败'}</div>}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7" data-testid="layout-body">{Array(long ? 12 : 1).fill('这次没有把行程排满。沿着河边走，遇见喜欢的地方就停下来，记下路上看到的光影。').join('\n\n')}</p>
        </article></>}
      </div>
    </section>
    <section className="space-y-3" aria-label="布局稳定性"><h3 className="text-sm font-medium">布局稳定性</h3>
      <div className="group flex items-center gap-4 border py-3" style={{ ...contentGutterStyle(), borderColor: 'var(--border-color)' }} data-testid="layout-hover-row">
        <p className="min-w-0 flex-1 text-sm">在河边记下一个想法。</p>
        <ActionButton className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" data-testid="layout-hover-action" onClick={() => { setLong(true); setDetail(true) }}>查看</ActionButton>
      </div>
    </section>
  </div>
}

export function OpacityLanguageSamples() {
  const [alpha, setAlpha] = useState(40)
  return <section className="space-y-4" data-testid="opacity-language-samples">
    <h3 className="text-sm font-medium">表面透明度</h3>
    <label className="flex items-center gap-4 text-xs">透明度
      <input aria-label="表面透明度" type="range" min={0} max={100} step={5} value={alpha} onChange={event => setAlpha(Number(event.target.value))} className="min-w-0 flex-1" />
      <output className="w-12 text-right tabular-nums">{alpha}%</output>
    </label>
    <div className="relative h-64 overflow-hidden" style={{ backgroundImage: `url(${canal})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div data-testid="opacity-surface" className="absolute inset-6 flex items-center justify-center border text-sm" style={{ borderColor: 'var(--border-color)', background: `color-mix(in srgb, var(--card-bg) ${alpha}%, transparent)` }}>
        <span className="bg-[var(--card-bg)] px-3 py-2" style={{ color: 'var(--text-primary)' }}>运河边的午后</span>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">{[15, 40, 80].map(value => <ActionButton key={value} aria-pressed={alpha === value} onClick={() => setAlpha(value)}>{value}%</ActionButton>)}</div>
  </section>
}
