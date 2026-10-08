import { useState } from 'react'
import { ImageViewer } from '../foundation/ImageViewer'
import { WorldContactsGallery } from '../world/WorldContactsGallery'
import { WorldTravelGallery } from '../world/WorldTravelGallery'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { TRAVEL_PREVIEWS } from './FootprintsExperienceCandidate'
import yaoAvatar from '../../assets/playground/contact-yao-avatar.png'
import xuAvatar from '../../assets/playground/contact-xu-avatar.png'

interface PersonPreview { id: string; name: string; introduction: string; city?: string; avatarSrc?: string }
interface RelationPreview { ownerRoleId: string; personId: string; relationLabel: string; firstMetStory?: string; interactionSummary?: string }
interface ExperiencePreview { id: string; ownerRoleId: string; personId: string; date?: string; title: string; story: string; references?: readonly { kind: 'moment' | 'trip'; targetId: string }[] }

export function contactFixtures(ownerRoleId: string) {
  const first = ownerRoleId === 'lin' ? { id: 'yao', name: '阿遥' } : { id: 'lin', name: '小林' }
  const people: PersonPreview[] = [
    { ...first, introduction: '喜欢阅读，也喜欢不赶时间地散步。', city: '杭州', avatarSrc: first.id === 'yao' ? yaoAvatar : undefined },
    { id: 'xu', name: '许叔', introduction: '经营一家小咖啡店，记得熟客偏好的口味。', city: '杭州', avatarSrc: xuAvatar },
  ]
  const relations: RelationPreview[] = people.map((person, index) => ({ ownerRoleId, personId: person.id,
    relationLabel: index === 0 ? '大学同学' : '街坊',
    firstMetStory: index === 0 ? '大学时在读书小组认识，一次讨论没有聊完，后来就常常一起借书。' : '搬来后第一次去附近喝咖啡，聊起了窗边的座位和这条街的变化。',
    interactionSummary: index === 0 ? '不一定天天联系，看到喜欢的文章会发给对方，偶尔约着散步。' : '路过时会进去坐一会儿，聊聊最近读的书，也听他讲店里的小事。',
  }))
  const experiences: ExperiencePreview[] = [
    { id: 'weekend-together', ownerRoleId, personId: first.id, date: '2026-09-26', title: '在苏州慢慢走', story: '一起走过雨后的街巷，遇见喜欢的地方就停下来，没有把周末排满。', references: [{ kind: 'trip', targetId: 'weekend' }] },
    { id: 'reading', ownerRoleId, personId: first.id, date: '2026-09-18', title: '一本书，两种读法', story: '读到同一个段落，各自记下了不同的句子。聊过以后，又翻回去看了一遍。' },
    { id: 'coffee', ownerRoleId, personId: 'xu', date: '2026-09-20', title: '雨天的窗边座位', story: '许叔留了窗边的位置，坐着听雨，顺便聊起这条街以前的样子。' },
  ]
  return { people, relations, experiences }
}

export function resolveContactReference(reference: { kind: 'moment' | 'trip'; targetId: string }) {
  return reference.kind === 'trip' ? TRAVEL_PREVIEWS.find(trip => trip.id === reference.targetId && trip.start && ['active', 'completed'].includes(trip.status)) : undefined
}

export function ContactsExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState('default')
  const [previewImage, setPreviewImage] = useState(false)
  const fixtures = contactFixtures(personaId)
  const people = scenario === 'empty' ? [] : fixtures.people.map((person, index) => ({ ...person,
    ...(scenario === 'long' && index === 0 ? { name: '阿遥和一段需要完整显示的很长人物姓名', introduction: person.introduction.repeat(4) } : {}),
    ...(scenario === 'failed-avatar' ? { avatarSrc: '/__missing-contact-avatar__.png' } : {}),
    ...(scenario === 'no-avatar' ? { avatarSrc: undefined } : {}),
  }))
  return <div className="flex h-full min-h-0 flex-col" data-testid="world-cast-fixture" data-persona-id={personaId}>
    <div className="shrink-0 px-4 pt-3"><PlaygroundStateSwitcher ariaLabel="通讯录状态样张" value={scenario} onChange={value => { setScenario(value); setPreviewImage(false) }} items={[
      { id: 'default', label: '人物清单' }, { id: 'long', label: '长姓名' }, { id: 'no-experiences', label: '无共同经历' }, { id: 'no-avatar', label: '无头像' }, { id: 'failed-avatar', label: '头像失败' }, { id: 'empty', label: '空通讯录' },
    ]} /></div>
    <WorldContactsGallery key={`${personaId}-${scenario}`} ownerRoleId={personaId} people={people} relations={fixtures.relations} experiences={scenario === 'no-experiences' ? [] : fixtures.experiences} resolveReference={reference => {
      const trip = resolveContactReference(reference)
      return trip ? <WorldTravelGallery key={trip.id} embedded initialSelectedId={trip.id} trips={[trip]} renderImage={() => trip.image ? <>
        <button type="button" aria-label="预览旅行图片" className="block h-full w-full overflow-hidden" onClick={() => setPreviewImage(true)}><img src={trip.image} alt={trip.title} className="block h-full w-full object-cover" /></button>
        <ImageViewer open={previewImage} items={[{ src: trip.image, alt: trip.title }]} onClose={() => setPreviewImage(false)} />
      </> : null} /> : null
    }} />
  </div>
}
