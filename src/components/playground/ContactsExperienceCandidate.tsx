import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, MapPin } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { ImageViewer } from '../foundation/ImageViewer'
import { contentGutterStyle, readingContentStyle } from '../../shared/content-layout'
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

function PersonAvatar({ person }: { person: PersonPreview }) {
  const [failed, setFailed] = useState(false)
  return <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-lg font-semibold" style={{ borderRadius: 'var(--radius-input)', background: 'var(--bg-secondary)', color: 'var(--companion-accent-warm)' }}>
    {person.avatarSrc && !failed ? <img src={person.avatarSrc} alt={person.name} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <span aria-hidden="true">{Array.from(person.name)[0]}</span>}
  </span>
}

export function ContactsExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState('default')
  const [selected, setSelected] = useState<string | null>(null)
  const [linkedId, setLinkedId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLButtonElement>())
  const position = useRef(0)
  const returnId = useRef<string | null>(null)
  const restore = useRef(false)
  const linkButton = useRef<HTMLButtonElement>(null)
  const restoreLink = useRef(false)
  const fixtures = contactFixtures(personaId)
  const people = scenario === 'empty' ? [] : fixtures.people.map((person, index) => ({ ...person,
    ...(scenario === 'long' && index === 0 ? { name: '阿遥和一段需要完整显示的很长人物姓名', introduction: person.introduction.repeat(4) } : {}),
    ...(scenario === 'failed-avatar' ? { avatarSrc: '/__missing-contact-avatar__.png' } : {}),
    ...(scenario === 'no-avatar' ? { avatarSrc: undefined } : {}),
  }))
  const person = people.find(item => item.id === selected)
  const relation = fixtures.relations.find(item => item.personId === selected)
  const experiences = scenario === 'no-experiences' ? [] : fixtures.experiences.filter(item => item.personId === selected)
  const trip = linkedId ? resolveContactReference({ kind: 'trip', targetId: linkedId }) : undefined

  /**
   * 背景：详情替换列表后，用户需要回到原人物位置。
   * 设计意图：保存滚动和按钮引用，返回恢复焦点而非重新从列表顶部开始。
   * 关键约束：切换场景不能恢复旧节点；关联记录返回必须留在人物详情。
   */
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = restore.current ? position.current : 0
    if (restore.current && returnId.current) cards.current.get(returnId.current)?.focus({ preventScroll: true })
    if (restoreLink.current) linkButton.current?.focus({ preventScroll: true })
    restore.current = false
    restoreLink.current = false
  }, [selected, linkedId, scenario])

  return <div className="flex h-full min-h-0 flex-col" data-testid="world-cast-fixture" data-persona-id={personaId}>
    <div className="shrink-0 px-4 pt-3"><PlaygroundStateSwitcher ariaLabel="通讯录状态样张" value={scenario} onChange={value => { setScenario(value); setSelected(null); setLinkedId(null); setPreviewImage(false) }} items={[
      { id: 'default', label: '人物清单' }, { id: 'long', label: '长姓名' }, { id: 'no-experiences', label: '无共同经历' }, { id: 'no-avatar', label: '无头像' }, { id: 'failed-avatar', label: '头像失败' }, { id: 'empty', label: '空通讯录' },
    ]} /></div>
    <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto" data-testid="contacts-scroll" style={{ ...contentGutterStyle(), color: 'var(--text-primary)' }}>
      {person ? <>
        <ActionButton variant="plain" className="mb-4 gap-2" onClick={() => {
          if (linkedId) { restoreLink.current = true; setLinkedId(null) }
          else { restore.current = true; setSelected(null) }
        }}><ArrowLeft size={14} />返回</ActionButton>
        <article style={readingContentStyle()} data-testid="contact-detail">
          {trip ? <>
            <h2 className="text-lg font-semibold">{trip.title}</h2>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{trip.destination} · {trip.start}</p>
            {trip.image && <button type="button" aria-label="预览旅行图片" className="mt-4 block w-full overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }} onClick={() => setPreviewImage(true)}><img src={trip.image} alt={trip.title} className="block w-full" /></button>}
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{trip.story}</p>
            {trip.stops.map(stop => <section key={stop.id} className="mt-4"><h3 className="text-sm font-semibold">{stop.name}</h3><p className="mt-1 text-sm leading-7">{stop.story}</p></section>)}
          </> : <>
            <header className="flex items-start gap-3"><PersonAvatar key={`${scenario}-${person.id}`} person={person} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-lg font-semibold">{person.name}</h2><Badge>{relation?.relationLabel}</Badge></div><p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{person.introduction}</p>{person.city && <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><MapPin size={12} />{person.city}</p>}</div></header>
            <section className="mt-6"><h3 className="text-sm font-semibold">与伙伴的关系</h3><p className="mt-3 text-sm leading-7">{relation?.firstMetStory}</p><p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>{relation?.interactionSummary}</p></section>
            <section className="mt-6"><h3 className="text-sm font-semibold">共同经历</h3>{experiences.length ? experiences.map(experience => <section key={experience.id} className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-medium">{experience.title}</h4>{experience.date && <time className="text-xs" style={{ color: 'var(--text-muted)' }}>{experience.date}</time>}</div><p className="mt-2 text-sm leading-7">{experience.story}</p>{experience.references?.map(reference => {
              const target = resolveContactReference(reference)
              return target ? <ActionButton ref={linkButton} key={`${reference.kind}-${reference.targetId}`} variant="plain" className="mt-2 gap-1" onClick={() => setLinkedId(target.id)}>查看旅行记录<ArrowUpRight size={12} /></ActionButton> : null
            })}</section>) : <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>还没有留下共同经历。</p>}</section>
          </>}
        </article>
      </> : people.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4" data-testid="contacts-grid">
        {people.map(item => <button type="button" key={item.id} ref={node => { if (node) cards.current.set(item.id, node); else cards.current.delete(item.id) }} data-testid={`contact-card-${item.id}`} className="flex min-w-0 items-start gap-3 border p-4 text-left transition hover:bg-[var(--hover-overlay)]" style={{ borderRadius: 'var(--radius-card)', borderColor: 'var(--border-color)', background: 'var(--card-bg)' }} onClick={() => { position.current = scroll.current?.scrollTop ?? 0; returnId.current = item.id; setSelected(item.id) }}>
          <PersonAvatar key={`${scenario}-${item.id}`} person={item} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-semibold">{item.name}</span><Badge>{fixtures.relations.find(entry => entry.personId === item.id)?.relationLabel}</Badge></span><span className="mt-2 block text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>{item.introduction}</span></span>
        </button>)}
      </div> : <EmptyState title="还没有认识的人" description="生活中建立的关系，会在这里留下记录。" />}
    </div>
    {previewImage && trip?.image && <ImageViewer open items={[{ src: trip.image, alt: trip.title }]} onClose={() => setPreviewImage(false)} />}
  </div>
}
