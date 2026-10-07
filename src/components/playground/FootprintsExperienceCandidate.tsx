import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ImageOff, MapPin } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { ImageViewer } from '../foundation/ImageViewer'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import alley from '../../assets/playground/culture-photo.png'
import canal from '../../assets/playground/travel-canal.png'

export interface TravelPreview {
  id: string
  title: string
  destination: string
  start: string | null
  end: string | null
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  image?: string
  story: string
  stops: readonly { id: string; date: string; name: string; story: string }[]
}

export function visiblePreviewTrips(trips: readonly TravelPreview[]) {
  return trips.filter(trip => trip.start !== null && (trip.status === 'active' || trip.status === 'completed'))
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.start!.localeCompare(a.start!) || a.id.localeCompare(b.id))
}

export function previewTripDates(trip: TravelPreview) {
  if (!trip.start) return ''
  if (trip.status === 'active') return `${trip.start} 至今`
  return trip.end && trip.end !== trip.start ? `${trip.start} — ${trip.end}` : trip.start
}

export const TRAVEL_PREVIEWS: readonly TravelPreview[] = [
  { id: 'weekend', title: '在苏州慢慢过一个周末', destination: '苏州', start: '2026-09-26', end: '2026-09-27', status: 'completed', image: alley,
    story: '这次没有把行程排满。沿着小巷走，遇见喜欢的地方就停下来。雨后的石板路很亮，第二天又绕回同一条巷子，发现白天和傍晚的声音并不一样。',
    stops: [{ id: 'alley', date: '2026-09-26', name: '老城街巷', story: '雨刚停，沿着石板路走了一段。没有急着找下一个景点。' }, { id: 'garden', date: '2026-09-27', name: '园林', story: '在廊下坐了一会儿，看光影慢慢移动。' }, { id: 'alley-again', date: '2026-09-27', name: '老城街巷', story: '回来时又走过昨天的小巷，留下了不同的印象。' }] },
  { id: 'day', title: '去古镇待了一天', destination: '杭州 · 塘栖', start: '2026-09-12', end: '2026-09-12', status: 'completed', image: canal,
    story: '早上出发，傍晚回来。在河边走走，吃过午饭后找了一个安静的位置坐着。一天也足够从日常节奏里退出来一点。', stops: [{ id: 'canal', date: '2026-09-12', name: '运河边', story: '沿着水边走到桥下，停下来听船经过。' }] },
  { id: 'multi', title: '沿着江南走几天', destination: '苏州 · 湖州', start: '2026-08-16', end: '2026-08-19', status: 'completed',
    story: '前两天留在苏州，之后去湖州。换了城市，却没有换成赶路的节奏。把沿途想记下来的事情放在同一段旅行里。', stops: [{ id: 'suzhou', date: '2026-08-16', name: '苏州', story: '先在老城住下，慢慢认识周围的街道。' }, { id: 'huzhou', date: '2026-08-18', name: '湖州', story: '下午抵达，第二天再出去走走。' }] },
  { id: 'future', title: '尚未出发的计划', destination: '北海', start: null, end: null, status: 'planned', story: '', stops: [] },
  { id: 'cancelled', title: '已取消的计划', destination: '南京', start: null, end: null, status: 'cancelled', story: '', stops: [] },
]

export function FootprintsExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState('default')
  const [selected, setSelected] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const returnTarget = useRef<string | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const savedScroll = useRef(0)
  const restoring = useRef(false)
  const trips = scenario === 'empty' ? [] : visiblePreviewTrips(TRAVEL_PREVIEWS.map(trip => ({ ...trip,
    ...(scenario === 'active' && trip.id === 'weekend' ? { status: 'active' as const, end: null } : {}),
    ...(scenario === 'long' && trip.id === 'weekend' ? { title: '一次没有赶路、在江南小城停下来观察日常生活的长名称旅行样张', story: Array(15).fill(trip.story).join('\n\n') } : {}),
  })))
  const trip = trips.find(item => item.id === selected)
  const image = scenario === 'no-image' || scenario === 'pending' || scenario === 'failed' ? undefined : trip?.image
  const imageState = scenario === 'pending' ? '旅行配图生成中' : scenario === 'failed' ? '旅行配图未能生成' : '暂无旅行配图'

  /**
   * 背景：详情替换列表后，用户应回到原来的旅行位置而非重新从头找。
   * 设计意图：在同一滚动容器内保存列表位置并恢复原按钮焦点，不创建第二个页面滚动条。
   * 关键约束：仅详情返回触发恢复；切换样张重置位置，不能恢复已卸载场景的按钮。
   */
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = restoring.current ? savedScroll.current : 0
    if (restoring.current && returnTarget.current) buttons.current.get(returnTarget.current)?.focus({ preventScroll: true })
    restoring.current = false
  }, [selected, scenario])

  const open = (item: TravelPreview) => {
    savedScroll.current = scroller.current?.scrollTop ?? 0
    returnTarget.current = item.id
    setSelected(item.id)
  }
  const back = () => { restoring.current = true; setSelected(null); setPreview(false) }
  return <div className="flex h-full min-h-0 flex-col" data-testid="world-footprints-fixture" data-persona-id={personaId}>
    <div className="shrink-0 px-4 pt-3"><PlaygroundStateSwitcher ariaLabel="足迹状态样张" value={scenario} onChange={value => { setScenario(value); setSelected(null); setPreview(false) }} items={[
      { id: 'default', label: '旅行清单' }, { id: 'active', label: '进行中' }, { id: 'no-image', label: '无配图' }, { id: 'pending', label: '配图生成中' }, { id: 'failed', label: '配图失败' }, { id: 'long', label: '长名称与故事' }, { id: 'empty', label: '空足迹' },
    ]} /></div>
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="travel-scroll" style={{ color: 'var(--text-primary)' }}>
      {trip ? <>
        <ActionButton variant="plain" className="mb-5" onClick={back}><ArrowLeft size={14} className="mr-2" />返回</ActionButton>
        <article data-testid="travel-detail" className="mx-auto max-w-2xl min-w-0 space-y-5 [overflow-wrap:anywhere]">
        <header className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold leading-7">{trip.title}</h2>{trip.status === 'active' && <Badge tone="accent">旅行中</Badge>}</div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}><span className="inline-flex items-center gap-1"><MapPin size={12} />{trip.destination}</span><span>{previewTripDates(trip)}</span></p></header>
        {image ? <ActionButton className="block w-full overflow-hidden p-0" aria-label="预览旅行封面" onClick={() => setPreview(true)}><img className="block max-h-96 w-full object-cover" style={{ aspectRatio: '3 / 2' }} src={image} alt={trip.title} /></ActionButton>
          : <div className="flex aspect-[3/2] max-h-96 items-center justify-center rounded-md text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}><ImageOff size={16} className="mr-2" />{imageState}</div>}
        <p className="whitespace-pre-wrap text-sm leading-7">{trip.story}</p>
        <section className="space-y-4" aria-label="旅途经历"><h3 className="text-sm font-medium">旅途经历</h3>{trip.stops.map(stop => <div key={stop.id} className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-medium">{stop.name}</h4><span className="text-xs" style={{ color: 'var(--text-muted)' }}>{stop.date}</span></div><p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{stop.story}</p></div>)}</section>
        <ImageViewer items={image ? [{ src: image, alt: trip.title }] : []} open={preview && !!image} onClose={() => setPreview(false)} />
      </article></> : trips.length ? <ul className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2" aria-label="旅行记录">{trips.map(item => {
        const src = ['no-image', 'pending', 'failed'].includes(scenario) ? undefined : item.image
        return <li key={item.id} className="min-w-0"><ActionButton ref={button => { if (button) buttons.current.set(item.id, button); else buttons.current.delete(item.id) }} aria-label={`查看旅行 ${item.title}`} onClick={() => open(item)} className="h-full w-full flex-col items-stretch overflow-hidden rounded-lg p-0 text-left hover:bg-[var(--hover-overlay)]">
          <div className="flex w-full items-center justify-center overflow-hidden" style={{ aspectRatio: '3 / 2', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="inline-flex items-center gap-2"><ImageOff size={16} />{imageState}</span>}</div>
          <div className="w-full space-y-2 p-3 [overflow-wrap:anywhere]"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>{item.status === 'active' && <Badge tone="accent">旅行中</Badge>}</div><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.destination}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{previewTripDates(item)}</p></div>
        </ActionButton></li>
      })}</ul> : <EmptyState centerWithoutAction title="还没有旅行足迹" description="出发后的旅行，会在这里留下记录。" />}
    </div>
  </div>
}
