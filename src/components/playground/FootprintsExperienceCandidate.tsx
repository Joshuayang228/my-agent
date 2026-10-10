import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { ImageViewer } from '../foundation/ImageViewer'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { WorldCandidateControls, WorldCandidateRefresh } from './WorldCandidateControls'
import alley from '../../assets/playground/culture-photo.png'
import canal from '../../assets/playground/travel-canal.png'
import { WorldTravelGallery, visibleTrips, tripDates } from '../world/WorldTravelGallery'

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
  return visibleTrips(trips)
}

export function previewTripDates(trip: TravelPreview) {
  return tripDates(trip)
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
  const [preview, setPreview] = useState(false)
  const trips = scenario === 'empty' ? [] : visiblePreviewTrips(TRAVEL_PREVIEWS.map(trip => ({ ...trip,
    ...(scenario === 'active' && trip.id === 'weekend' ? { status: 'active' as const, end: null } : {}),
    ...(scenario === 'long' && trip.id === 'weekend' ? { title: '一次没有赶路、在江南小城停下来观察日常生活的长名称旅行样张', story: Array(15).fill(trip.story).join('\n\n') } : {}),
  })))
  const imageState = scenario === 'pending' ? '旅行配图生成中' : scenario === 'failed' ? '旅行配图未能生成' : '暂无旅行配图'

  return <div className="flex h-full min-h-0 flex-col" data-testid="world-footprints-fixture" data-persona-id={personaId}>
    <WorldCandidateControls><PlaygroundStateSwitcher ariaLabel="足迹状态样张" value={scenario} onChange={value => { setScenario(value); setPreview(false) }} items={[
      { id: 'default', label: '旅行清单' }, { id: 'active', label: '进行中' }, { id: 'no-image', label: '无配图' }, { id: 'pending', label: '配图生成中' }, { id: 'failed', label: '配图失败' }, { id: 'long', label: '长名称与故事' }, { id: 'empty', label: '空足迹' },
    ]} /></WorldCandidateControls>
    <div className="flex items-center justify-between px-4 pt-3"><span className="text-sm font-semibold">旅行记录</span><WorldCandidateRefresh label="刷新足迹" /></div>
    <WorldTravelGallery key={`${personaId}-${scenario}`} trips={trips} renderImage={(trip, thumbnail) => {
      const src = ['no-image', 'pending', 'failed'].includes(scenario) ? undefined : trip.image
      if (!src) return <span className="inline-flex items-center gap-2 text-xs"><ImageOff size={16} />{imageState}</span>
      if (thumbnail) return <img src={src} alt="" className="h-full w-full object-cover" />
      return <><ActionButton padding="none" className="block h-full w-full overflow-hidden" aria-label="预览旅行封面" onClick={() => setPreview(true)}><img className="block h-full w-full object-cover" src={src} alt={trip.title} /></ActionButton><ImageViewer items={[{ src, alt: trip.title }]} open={preview} onClose={() => setPreview(false)} /></>
    }} />
  </div>
}
