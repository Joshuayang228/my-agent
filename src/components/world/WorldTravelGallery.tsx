import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ImageOff, MapPin } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { contentGutterStyle, readingContentStyle } from '../../shared/content-layout'

export interface TravelRecordView {
  id: string; title: string; destination: string; start: string | null; end: string | null;
  status: 'planned' | 'active' | 'completed' | 'cancelled'; image?: string; story: string;
  stops: readonly { id: string; date?: string; name: string; story: string }[]
}

export function visibleTrips(trips: readonly TravelRecordView[]) {
  return trips.filter(trip => trip.start !== null && (trip.status === 'active' || trip.status === 'completed'))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.start!.localeCompare(a.start!) || a.id.localeCompare(b.id))
}

export function tripDates(trip: TravelRecordView) {
  if (!trip.start) return ''
  if (trip.status === 'active') return `${trip.start} 至今`
  return trip.end && trip.end !== trip.start ? `${trip.start} — ${trip.end}` : trip.start
}

/**
 * 背景：已确认的旅行列表需要进入正式页，样张图片和试验开关不能成为真实资料。
 * 设计意图：共享列表 / 详情，外层注入受控媒体和维护动作，沿用一个滚动容器。
 * 关键约束：只呈现已出发旅行；按 ID 选择，返回恢复原卡焦点与列表位置，不猜测日期。
 */
export function WorldTravelGallery({ trips: input, renderImage, renderEditor, toolbarAction, initialSelectedId = null, embedded = false }: {
  trips: readonly TravelRecordView[];
  renderImage?: (trip: TravelRecordView, thumbnail: boolean) => ReactNode;
  renderEditor?: (id: string) => ReactNode
  toolbarAction?: ReactNode
  initialSelectedId?: string | null; embedded?: boolean
}) {
  const trips = visibleTrips(input)
  const [selected, setSelected] = useState<string | null>(initialSelectedId)
  const trip = trips.find(item => item.id === selected)
  const scroller = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const savedScroll = useRef(0)
  const target = useRef<string | null>(null)
  const restoring = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = restoring.current ? savedScroll.current : 0
    if (restoring.current && target.current) buttons.current.get(target.current)?.focus({ preventScroll: true })
    else if (selected) heading.current?.focus({ preventScroll: true })
    restoring.current = false
  }, [selected])
  const back = () => { restoring.current = true; setSelected(null) }
  const picture = (item: TravelRecordView, thumbnail: boolean) => <div className={`flex w-full items-center justify-center overflow-hidden ${thumbnail ? '' : 'max-h-96 rounded-md'}`} style={{ aspectRatio: '3 / 2', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{renderImage?.(item, thumbnail) ?? <span className="inline-flex items-center gap-2 text-xs"><ImageOff size={16} />暂无旅行配图</span>}</div>
  return <div className="flex min-h-0 flex-1 flex-col" data-testid="travel-gallery">
    {!embedded && toolbarAction && <div className="flex shrink-0 justify-end px-4 pt-3">{toolbarAction}</div>}
    <div ref={scroller} className={embedded ? 'min-w-0' : 'min-h-0 flex-1 overflow-y-auto'} data-testid="travel-scroll" style={{ ...(!embedded ? contentGutterStyle() : {}), color: 'var(--text-primary)' }}>
      {trip ? <div onKeyDown={event => { if (event.key === 'Escape' && !embedded) { event.stopPropagation(); back() } }}>
        {!embedded && <ActionButton variant="plain" className="mb-5" onClick={back}><ArrowLeft size={14} className="mr-2" />返回</ActionButton>}
        <article data-testid="travel-detail" className="space-y-5 [overflow-wrap:anywhere]" style={readingContentStyle()}>
          <header className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h2 ref={heading} tabIndex={-1} className="text-lg font-semibold leading-7">{trip.title}</h2>{trip.status === 'active' && <Badge tone="accent">旅行中</Badge>}</div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}><span className="inline-flex items-center gap-1"><MapPin size={12} />{trip.destination}</span><span>{tripDates(trip)}</span></p></header>
          {picture(trip, false)}
          <p className="whitespace-pre-wrap text-sm leading-7">{trip.story}</p>
          {trip.stops.length > 0 && <section className="space-y-4" aria-label="旅途经历"><h3 className="text-sm font-medium">旅途经历</h3>{trip.stops.map(stop => <div key={stop.id} className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-medium">{stop.name}</h4>{stop.date && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{stop.date}</span>}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{stop.story}</p></div>)}</section>}
          {renderEditor?.(trip.id)}
        </article>
      </div> : trips.length ? <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2" aria-label="旅行记录">{trips.map(item => <li key={item.id} className="min-w-0">
        <ActionButton padding="none" ref={button => { if (button) buttons.current.set(item.id, button); else buttons.current.delete(item.id) }} aria-label={`查看旅行 ${item.title}`} onClick={() => { savedScroll.current = scroller.current?.scrollTop ?? 0; target.current = item.id; setSelected(item.id) }} className="h-full w-full flex-col items-stretch overflow-hidden rounded-lg text-left hover:bg-[var(--hover-overlay)]">
          {picture(item, true)}
          <div className="w-full space-y-2 p-3 [overflow-wrap:anywhere]"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{item.title}</h3>{item.status === 'active' && <Badge tone="accent">旅行中</Badge>}</div><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.destination}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tripDates(item)}</p></div>
        </ActionButton>
      </li>)}</ul> : <EmptyState centerWithoutAction title="还没有旅行足迹" description="出发后的旅行，会在这里留下记录。" />}
    </div>
  </div>
}
