import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Camera, Clapperboard, Music } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import { ImagePreviewImage } from '../foundation/ImagePreviewImage'
import { TabStrip } from '../foundation/TabStrip'
import { Badge } from '../foundation/Badge'
import type { LivingAsset } from './WorldLivingContent'

const categories = [
  { id: 'reading', label: '书籍', icon: BookOpen },
  { id: 'film', label: '影视', icon: Clapperboard },
  { id: 'music', label: '音乐', icon: Music },
  { id: 'photography', label: '摄影', icon: Camera },
] as const
const text = (asset: LivingAsset, key: string) => typeof asset.payload[key] === 'string' ? asset.payload[key] as string : ''
const typeFor = (asset: LivingAsset) => asset.kind === 'bookshelf' ? 'reading' : text(asset, 'type')
const states: Record<string, string> = { planned: '想读', reading: '正在读', paused: '暂时放下', finished: '已完成', abandoned: '未继续', watching: '正在看', queued: '想听', listening: '正在听', revisiting: '最近常听', published: '作品' }

export interface CultureReadingNote {
  id: string
  assetId: string
  text: string
  occurredAt?: number
  createdAt?: number
  page?: number
  chapter?: string
}

const noteDate = (note: CultureReadingNote) => note.occurredAt !== undefined && Number.isFinite(note.occurredAt)
  ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric' }).format(note.occurredAt) : ''

function Artwork({ asset }: { asset: LivingAsset }) {
  const type = typeFor(asset)
  const photography = type === 'photography'
  const ratio = photography && typeof asset.payload.imageWidth === 'number' && typeof asset.payload.imageHeight === 'number'
    && asset.payload.imageWidth > 0 && asset.payload.imageHeight > 0
    ? asset.payload.imageWidth / asset.payload.imageHeight : type === 'music' ? 1 : photography ? 4 / 3 : 2 / 3
  const src = text(asset, 'playgroundImageSrc')
  const Icon = categories.find((item) => item.id === type)?.icon ?? BookOpen
  return <div className="w-full overflow-hidden rounded-md" data-testid="culture-artwork" style={{ aspectRatio: ratio, background: 'var(--bg-secondary)' }}>
    {src && !['pending', 'failed'].includes(text(asset, 'imageState'))
      ? <ImagePreviewImage src={src} alt={`${asset.name}${photography ? '，虚构摄影作品' : '，示意配图'}`} className="block h-full w-full object-contain" buttonClassName="h-full w-full" />
      : <div role="status" className="flex h-full flex-col items-center justify-center gap-3 px-3 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
        <Icon size={20} /><span>{text(asset, 'imageState') === 'pending' ? '配图生成中' : text(asset, 'imageState') === 'failed' ? '配图生成失败，记录已保留' : '暂无配图'}</span>
      </div>}
  </div>
}

/**
 * 背景：四类文化生活需要先验收独立浏览，旧生产页仍保留混排与维护能力。
 * 设计意图：通过显式候选分支复用基础标签、动作与图片预览，详情原位替换列表而不自造模态框。
 * 关键约束：只读传入夹具，不读取 IPC；详情关闭恢复分类滚动及触发点，正式默认分支不能调用本组件。
 */
export function WorldCultureGallery({ assets, readingNotes = [], readError = '', onRetry }: { assets: readonly LivingAsset[]; readingNotes?: readonly CultureReadingNote[]; readError?: string; onRetry?: () => void }) {
  const [category, setCategory] = useState('reading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const triggers = useRef(new Map<string, HTMLButtonElement>())
  const positions = useRef<Record<string, number>>({})
  const returnId = useRef<string | null>(null)
  const items = assets.filter((asset) => ['culture', 'bookshelf'].includes(asset.kind) && typeFor(asset) === category && asset.payload.visibility !== 'archived')
  const selected = items.find((asset) => asset.id === selectedId)
  useLayoutEffect(() => {
    if (selected) heading.current?.focus()
    else {
      if (scroll.current) scroll.current.scrollTop = positions.current[category] ?? 0
      if (returnId.current) triggers.current.get(returnId.current)?.focus({ preventScroll: true })
      returnId.current = null
    }
  }, [category, selected])
  const close = () => { returnId.current = selectedId; setSelectedId(null) }
  const status = (asset: LivingAsset) => {
    const key = text(asset, 'readingStatus') || text(asset, 'watchStatus') || text(asset, 'listeningStatus') || text(asset, 'workStatus')
    return Object.hasOwn(states, key) ? states[key] : ''
  }
  const notesFor = (asset: LivingAsset) => readingNotes.filter((note) => note.assetId === asset.id && note.text.trim()).slice().sort((a, b) => ((b.occurredAt ?? b.createdAt) ?? 0) - ((a.occurredAt ?? a.createdAt) ?? 0) || a.id.localeCompare(b.id))
  return <div className="flex h-full min-h-0 flex-col px-4 py-4" data-testid="culture-gallery">
    <div className="mb-4 shrink-0"><TabStrip label="文化分类" activeId={category} onSelect={(id) => {
      if (!selected && scroll.current) positions.current[category] = scroll.current.scrollTop
      returnId.current = null; setSelectedId(null); setCategory(id)
    }} items={categories.map(({ id, label, icon: Icon }) => ({ id, label, icon: <Icon size={14} /> }))} /></div>
    <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" data-testid="culture-content-scroll">
      {readError ? <ErrorState title="文化记录未能读取" description={readError} action={onRetry && <ActionButton onClick={onRetry}>重新读取</ActionButton>} />
        : selected ? <section data-testid="culture-detail" className="min-w-0 space-y-4" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
          <ActionButton variant="plain" onClick={close}><ArrowLeft size={14} className="mr-2" />返回列表</ActionButton>
          {category === 'reading' ? <div className="flex items-start gap-4" data-testid="reading-book-header">
            <div className="w-24 shrink-0"><Artwork asset={selected} /></div>
            <div className="min-w-0 flex-1 space-y-2">
              <h3 ref={heading} tabIndex={-1} className="break-words text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h3>
              {text(selected, 'author') && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{text(selected, 'author')}</p>}
              {status(selected) && <Badge tone={text(selected, 'readingStatus') === 'reading' ? 'accent' : 'neutral'}>{status(selected)}</Badge>}
              {typeof selected.payload.currentPage === 'number' && <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>读到第 {selected.payload.currentPage} 页{typeof selected.payload.totalPages === 'number' ? ` / 共 ${selected.payload.totalPages} 页` : ''}</p>}
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>示意配图 · 非官方封面</p>
            </div>
          </div> : <>
          <h3 ref={heading} tabIndex={-1} className="break-words text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h3>
          <div className="max-w-60"><Artwork asset={selected} /></div>
          <div className="flex flex-wrap gap-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>
            <span>{text(selected, 'author') || text(selected, 'artist')}</span><span>{status(selected)}</span>
            <span>{text(selected, 'locationName')}</span><span>{text(selected, 'depictedAt')}</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{category === 'photography' ? '虚构摄影作品 · AI 生成' : '示意配图 · 非官方封面'}</p>
          </>}
          <div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap break-words pr-2 text-[13px] leading-6 scrollbar-thin" data-testid="culture-detail-text" tabIndex={0} style={{ color: 'var(--text-secondary)' }}>
            {text(selected, 'detail') && <section className="mb-5"><h4 className="mb-2 font-medium">{category === 'reading' ? '整体感受' : '感受'}</h4><p>{text(selected, 'detail')}</p></section>}
            {category === 'reading' ? <section data-testid="reading-notes"><h4 className="mb-3 font-medium">读书笔记</h4>
              {notesFor(selected).length ? <ol className="space-y-3">{notesFor(selected).map((note) => <li key={note.id} className="rounded-md border p-3" data-testid="reading-note" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{[note.page !== undefined ? `第 ${note.page} 页` : '', note.chapter].filter(Boolean).join(' · ')}</span>
                  {noteDate(note) && <time dateTime={new Date(note.occurredAt!).toISOString()}>{noteDate(note)}</time>}
                </div><p>{note.text}</p>
              </li>)}</ol> : <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>还没有读书笔记。</p>}
            </section> : text(selected, 'note') && <section><h4 className="mb-2 font-medium">笔记</h4><p>{text(selected, 'note')}</p></section>}
          </div>
        </section>
        : items.length ? <div className="grid min-w-0 grid-cols-2 items-start gap-4 lg:grid-cols-3" data-testid="culture-grid">
          {items.map((asset) => <article key={asset.id} aria-label={asset.name} className="min-w-0 space-y-2">
            <Artwork asset={asset} />
            <ActionButton variant="plain" ref={(node) => { if (node) triggers.current.set(asset.id, node); else triggers.current.delete(asset.id) }}
              className="!block min-h-10 w-full !px-0 text-left" aria-label={`查看作品：${asset.name}`} title={asset.name}
              onClick={() => { if (scroll.current) positions.current[category] = scroll.current.scrollTop; setSelectedId(asset.id) }}>
              <span className="line-clamp-2 break-words text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{asset.name}</span>
            </ActionButton>
            <div className="min-h-5 truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>{text(asset, 'author') || text(asset, 'artist') || text(asset, 'locationName')}</div>
            {category === 'reading' ? <>
              {status(asset) && <Badge tone={text(asset, 'readingStatus') === 'reading' ? 'accent' : 'neutral'}>{status(asset)}</Badge>}
              {notesFor(asset)[0] && <div className="pt-3 text-[12px] leading-5" data-testid="reading-note-excerpt">
                <div className="mb-1 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}><BookOpen size={12} aria-hidden="true" />最新笔记</div>
                <p className="line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{notesFor(asset)[0].text}</p>
              </div>}
            </> : <>
              <div className="min-h-5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{status(asset)}</div>
              <p className="line-clamp-2 min-h-10 text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>{text(asset, 'summary')}</p>
            </>}
          </article>)}
        </div> : <EmptyState title={`还没有${categories.find((item) => item.id === category)?.label}记录`} description="可以在对话中聊聊你想一起读、看、听或创作的内容。" />}
    </div>
  </div>
}
