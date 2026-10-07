import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Home, LayoutGrid, Package } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import { ImagePreviewImage } from '../foundation/ImagePreviewImage'
import { TabStrip } from '../foundation/TabStrip'

export interface HomeSpacePreview { id: string; name: string; description?: string; image?: string; icon?: ReactNode }
export interface HomeObjectPreview {
  id: string; name: string; spaceId: string | null; image?: string; description?: string; originNote?: string;
  displayInHome?: boolean; displayReason?: string; displayEvidence?: readonly string[]
}
export type HomeImageState = 'ready' | 'missing' | 'pending' | 'failed'

export const homeObjectsForSpace = (objects: readonly HomeObjectPreview[], spaceId: string) =>
  objects.filter(object => object.displayInHome === true && !!object.displayReason?.trim()
    && !!object.displayEvidence?.some(evidence => evidence.trim())
    && (spaceId === 'unassigned' ? object.spaceId === null : object.spaceId === spaceId))

function HomePicture({ src, alt, state, variant }: { src?: string; alt: string; state: HomeImageState; variant: 'overview' | 'scene' | 'object' }) {
  const [failed, setFailed] = useState(false)
  const overview = variant === 'overview'
  return <div data-testid={`home-${variant}-picture`} onErrorCapture={() => setFailed(true)}
    className="w-full overflow-hidden rounded-md" style={{ aspectRatio: overview ? '4 / 3' : variant === 'scene' ? '16 / 9' : '1', maxWidth: variant === 'scene' ? 560 : undefined, background: 'var(--bg-secondary)' }}>
    {src && state === 'ready' && !failed
      ? <ImagePreviewImage src={src} alt={alt} buttonClassName="h-full w-full transition hover:brightness-95" className="block h-full w-full object-contain" />
      : <div role="status" className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
        {variant === 'object' ? <Package size={20} /> : <Home size={20} />}
        <span>{state === 'pending' ? '配图生成中' : state === 'failed' || failed ? '配图未能显示' : '暂无配图'}</span>
      </div>}
  </div>
}

/**
 * 背景：家居新方案需要先验收按空间浏览，旧正式页仍是住所与物件混排。
 * 设计意图：纯展示组合只接收隔离数据，复用基础标签、详情动作及图片预览，不另造装修工具。
 * 关键约束：仅候选显式调用；不读取 IPC、生成或写盘，详情返回恢复位置与焦点，空间图不是库存事实。
 */
export function WorldHomeGallery({ overviewImage, spaces, objects, imageState = 'ready', readError, onRetry }: {
  overviewImage?: string; spaces: readonly HomeSpacePreview[]; objects: readonly HomeObjectPreview[];
  imageState?: HomeImageState; readError?: string; onRetry?: () => void
}) {
  const [spaceId, setSpaceId] = useState('overview')
  const [selected, setSelected] = useState<HomeObjectPreview | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const triggers = useRef(new Map<string, HTMLButtonElement>())
  const positions = useRef(new Map<string, number>())
  const returnId = useRef<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    if (selected) { if (scroll.current) scroll.current.scrollTop = 0; heading.current?.focus(); return }
    if (scroll.current) scroll.current.scrollTop = positions.current.get(spaceId) ?? 0
    if (returnId.current) { triggers.current.get(returnId.current)?.focus({ preventScroll: true }); returnId.current = null }
  }, [selected, spaceId])
  const close = () => { returnId.current = selected?.id ?? null; setSelected(null) }
  const space = spaces.find(item => item.id === spaceId)
  const items = homeObjectsForSpace(objects, spaceId)
  const tabs = [{ id: 'overview', label: '总览', icon: <LayoutGrid size={14} /> }, ...spaces.map(item => ({ id: item.id, label: item.name, icon: item.icon ?? <Home size={14} /> })),
    ...(homeObjectsForSpace(objects, 'unassigned').length ? [{ id: 'unassigned', label: '未归置', icon: <Package size={14} /> }] : [])]
  const empty = spaces.length === 0 && objects.length === 0 && !overviewImage
  return <div className="flex min-h-0 flex-1 flex-col px-4 pb-4" data-testid="home-gallery">
    <div className="shrink-0 py-3"><TabStrip label="家居空间" activeId={spaceId} items={tabs} onSelect={id => {
      if (scroll.current && !selected) positions.current.set(spaceId, scroll.current.scrollTop)
      returnId.current = null; setSelected(null); setSpaceId(id)
    }} /></div>
    <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" data-testid="home-content-scroll">
      {readError ? <ErrorState title="家居记录未能读取" description={readError} action={onRetry && <ActionButton onClick={onRetry}>重新读取</ActionButton>} />
        : empty ? <EmptyState title="还没有记录居住空间" description="" />
        : selected ? <section className="space-y-4" data-testid="home-object-detail" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
          <ActionButton variant="plain" onClick={close}><ArrowLeft size={14} className="mr-2" />返回物件</ActionButton>
          <div className="flex items-start gap-4">
            <div className="w-28 shrink-0"><HomePicture key={selected.id} src={selected.image} alt={`${selected.name}，家居设计样张`} state={imageState} variant="object" /></div>
            <div className="min-w-0 space-y-2">
              <h3 ref={heading} tabIndex={-1} className="break-words text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{spaces.find(item => item.id === selected.spaceId)?.name ?? '未归置'}</p>
            </div>
          </div>
          <div tabIndex={0} data-testid="home-object-description" className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-6 scrollbar-thin" style={{ color: 'var(--text-secondary)' }}>
            {selected.description && <p>{selected.description}</p>}
            {selected.originNote && <section className="mt-4"><h4 className="mb-1 text-[12px] font-medium">来历</h4><p>{selected.originNote}</p></section>}
          </div>
        </section>
        : spaceId === 'overview' ? <HomePicture key={`overview-${imageState}`} src={overviewImage} alt="住所鸟瞰图，家居设计样张" state={imageState} variant="overview" />
        : <div className="space-y-4">
          {space && <HomePicture key={`${space.id}-${imageState}`} src={space.image} alt={`${space.name}场景，家居设计样张`} state={imageState} variant="scene" />}
          {space?.description && <p className="break-words text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>{space.description}</p>}
          {items.length ? <div className="grid grid-cols-2 items-start gap-4 lg:grid-cols-3" data-testid="home-object-grid">
            {items.map(item => <article key={item.id} aria-label={item.name} className="min-w-0 space-y-2" data-testid="home-object-card">
              <HomePicture key={`${item.id}-${imageState}`} src={item.image} alt={`${item.name}，家居设计样张`} state={imageState} variant="object" />
              <ActionButton variant="plain" ref={node => { if (node) triggers.current.set(item.id, node); else triggers.current.delete(item.id) }}
                className="!block min-h-10 w-full !px-0 text-left" aria-label={`查看物件：${item.name}`} title={item.name}
                onClick={() => { if (scroll.current) positions.current.set(spaceId, scroll.current.scrollTop); setSelected(item) }}>
                <span className="line-clamp-2 break-words text-[13px] font-medium">{item.name}</span>
              </ActionButton>
            </article>)}
          </div> : null}
        </div>}
    </div>
  </div>
}
