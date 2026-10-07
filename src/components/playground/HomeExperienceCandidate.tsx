import { useState } from 'react'
import { BedDouble, BookOpen, DoorOpen, Sofa } from 'lucide-react'
import { WorldHomeGallery, type HomeObjectPreview, type HomeImageState } from '../world/WorldHomeGallery'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import overview from '../../assets/playground/home-overview.png'
import living from '../../assets/playground/home-living.png'
import bedroom from '../../assets/playground/home-bedroom.png'
import study from '../../assets/playground/home-study.png'
import entry from '../../assets/playground/home-entry.png'
import sofa from '../../assets/playground/home-sofa.png'
import lamp from '../../assets/playground/home-lamp.png'
import camera from '../../assets/playground/home-camera.png'
import umbrella from '../../assets/playground/home-umbrella.png'

export function HomeExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState('default')
  const spaces = [
    { id: 'living', name: '客厅', icon: <Sofa size={14} />, image: living, description: '窗边留出一块安静的地方，晚上常在这里坐一会儿。' },
    { id: 'bedroom', name: '卧室', icon: <BedDouble size={14} />, image: bedroom, description: '床头只留一盏灯，休息时不把工作带进来。' },
    { id: 'study', name: '书房', icon: <BookOpen size={14} />, image: study, description: '桌面留得宽一些，写东西和整理照片都在这里。' },
    { id: 'entry', name: '玄关', icon: <DoorOpen size={14} />, image: entry, description: '出门要带的东西，通常收在门边。' },
  ]
  let objects: HomeObjectPreview[] = [
    { id: 'sofa', spaceId: 'living', name: '窗边沙发', image: sofa, description: '写完第一个项目的那天，和朋友坐在这里聊到天黑。现在周末仍会在这里写几行日记。', originNote: '搬进这里时一起挑的。', displayInHome: true, displayReason: '承载项目完成的共同回忆与周末写日记的习惯。', displayEvidence: ['fixture:first-project', 'fixture:weekend-journal'] },
    { id: 'ordinary-sofa', spaceId: 'living', name: '另一张沙发', image: sofa, displayInHome: false, displayReason: '目前只有布置记录，没有人物经历或习惯依据。', displayEvidence: ['fixture:room-layout'] },
    { id: 'living-lamp', spaceId: 'living', name: '阅读台灯', image: lamp, description: '每晚读书时只开这一盏灯，读完再把当天喜欢的一句话记下来。', displayInHome: true, displayReason: '长期阅读与摘录习惯。', displayEvidence: ['fixture:night-reading'] },
    { id: 'bedside-lamp', spaceId: 'bedroom', name: '床头台灯', image: lamp, description: '睡前阅读时留的一盏小灯。', displayInHome: true, displayReason: '睡前阅读习惯。', displayEvidence: ['fixture:bedtime-reading'] },
    { id: 'camera', spaceId: 'study', name: '旧相机', image: camera, description: '平时放在书桌一角，散步时偶尔带出去。', originNote: '开始认真拍照时留下的第一台相机。', displayInHome: true, displayReason: '摄影起点的纪念物。', displayEvidence: ['fixture:first-camera'] },
    { id: 'umbrella', spaceId: 'entry', name: '折叠雨伞', image: umbrella, description: '朋友在一次雨天散步后送的，伞柄上还留着当时的小贴纸。', displayInHome: true, displayReason: '朋友赠送与雨天散步的共同经历。', displayEvidence: ['fixture:rainy-walk-gift'] },
  ]
  if (scenario === 'many') objects = [...objects, ...Array.from({ length: 10 }, (_, index) => ({ id: `lamp-${index}`, spaceId: 'living', name: `纪念小灯样张 ${index + 1}`, image: lamp, description: '用于检查收藏物件网格的隔离样张，不是人物真实经历。', displayInHome: true, displayReason: '样张中的旅行纪念物。', displayEvidence: [`fixture:trip-${index}`] }))]
  if (scenario === 'unassigned') objects = [...objects, { id: 'spare-lamp', spaceId: null, name: '朋友送的小灯', image: lamp, description: '搬家时朋友送的小灯，尚未确定收纳位置。', displayInHome: true, displayReason: '朋友赠送的搬家纪念物。', displayEvidence: ['fixture:moving-gift'] }]
  if (scenario === 'empty-room') objects = objects.filter(item => item.spaceId !== 'living')
  if (scenario === 'long') objects = objects.map(item => ({ ...item, name: `${item.name}：留给日常生活的一件值得慢慢记住的小东西`, description: '这是用于检验详情长文滚动的隔离样张，不是人物真实经历。\n'.repeat(60) }))
  const state: HomeImageState = scenario === 'no-image' ? 'missing' : scenario === 'pending' ? 'pending' : scenario === 'image-failed' ? 'failed' : 'ready'
  return <div className="flex h-full min-h-0 flex-col" data-testid="world-home-fixture" data-persona-id={personaId}>
    <div className="shrink-0 px-4 pt-3"><PlaygroundStateSwitcher ariaLabel="家居状态样张" value={scenario} onChange={setScenario} items={[
      { id: 'default', label: '居住空间' }, { id: 'many', label: '多物件' }, { id: 'long', label: '长名称与描述' },
      { id: 'unassigned', label: '未归置物件' }, { id: 'empty-room', label: '空房间' }, { id: 'empty', label: '空家居' },
      { id: 'no-image', label: '无配图' }, { id: 'pending', label: '配图生成中' }, { id: 'image-failed', label: '配图失败' }, { id: 'error', label: '读取失败' },
    ]} /></div>
    <WorldHomeGallery key={`${personaId}-${scenario}`} overviewImage={scenario === 'empty' ? undefined : overview}
      spaces={scenario === 'empty' ? [] : spaces} objects={scenario === 'empty' ? [] : objects} imageState={state}
      readError={scenario === 'error' ? '记录暂时未能读取，请重新读取。' : undefined} onRetry={() => setScenario('default')} />
  </div>
}
