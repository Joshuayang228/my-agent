import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight, MapPin } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { contentGutterStyle, readingContentStyle } from '../../shared/content-layout'

export interface ContactPersonView { id: string; name: string; introduction: string; city?: string; avatarSrc?: string }
export interface ContactRelationView { ownerRoleId: string; personId: string; relationLabel: string; firstMetStory?: string; interactionSummary?: string }
export interface ContactReference { kind: 'moment' | 'trip'; targetId: string }
export interface ContactExperienceView { id: string; ownerRoleId: string; personId: string; date?: string; title: string; story: string; references?: readonly ContactReference[] }

function PersonAvatar({ person }: { person: ContactPersonView }) {
  const [failed, setFailed] = useState(false)
  return <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-lg font-semibold" style={{ borderRadius: 'var(--radius-input)', background: 'var(--bg-secondary)', color: 'var(--companion-accent-warm)' }}>
    {person.avatarSrc && !failed ? <img src={person.avatarSrc} alt={person.name} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <span aria-hidden="true">{Array.from(person.name)[0] ?? '?'}</span>}
  </span>
}

/**
 * 背景：通讯录候选已确认关系型浏览，正式不能混入召唤和实验控制。
 * 设计意图：共用人物 / 关系 / 经历视图，由外层解析关联，不维护另一份生活事实。
 * 关键约束：关系与经历限定 ownerRoleId，缺字段不补栏目；关联返回恢复链接焦点，人物返回恢复原卡与位置。
 */
export function WorldContactsGallery({ ownerRoleId, people, relations, experiences, resolveReference }: {
  ownerRoleId: string; people: readonly ContactPersonView[]; relations: readonly ContactRelationView[];
  experiences: readonly ContactExperienceView[]; resolveReference?: (reference: ContactReference) => ReactNode
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [linked, setLinked] = useState<ContactReference | null>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLButtonElement>())
  const linkButtons = useRef(new Map<string, HTMLButtonElement>())
  const position = useRef(0)
  const detailPosition = useRef(0)
  const target = useRef<string | null>(null)
  const returnLink = useRef<string | null>(null)
  const openedLink = useRef<string | null>(null)
  const restoring = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const person = people.find(item => item.id === selected)
  const relation = relations.find(item => item.ownerRoleId === ownerRoleId && item.personId === selected)
  const items = experiences.filter(item => item.ownerRoleId === ownerRoleId && item.personId === selected)
  const linkedContent = linked && resolveReference?.(linked)
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = returnLink.current ? detailPosition.current : restoring.current ? position.current : 0
    if (returnLink.current) linkButtons.current.get(returnLink.current)?.focus({ preventScroll: true })
    else if (restoring.current && target.current) cards.current.get(target.current)?.focus({ preventScroll: true })
    else heading.current?.focus({ preventScroll: true })
    restoring.current = false; returnLink.current = null
  }, [selected, linked])
  const back = () => {
    if (linked) { returnLink.current = openedLink.current; setLinked(null) }
    else { restoring.current = true; setSelected(null) }
  }
  return <div className="flex h-full min-h-0 flex-col" data-testid="contacts-gallery">
    <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto" data-testid="contacts-scroll" style={{ ...contentGutterStyle(), color: 'var(--text-primary)' }} onKeyDown={event => { if (event.key === 'Escape' && person) { event.stopPropagation(); back() } }}>
      {person ? <>
        <ActionButton variant="plain" className="mb-4 gap-2" onClick={back}><ArrowLeft size={14} />返回</ActionButton>
        <article style={readingContentStyle()} data-testid="contact-detail">
          {linkedContent || <>
            <header className="flex items-start gap-3"><PersonAvatar key={`${person.id}-${person.avatarSrc}`} person={person} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 ref={heading} tabIndex={-1} className="break-words text-lg font-semibold">{person.name}</h2>{relation?.relationLabel && <Badge>{relation.relationLabel}</Badge>}</div>{person.introduction && <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{person.introduction}</p>}{person.city && <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><MapPin size={12} />{person.city}</p>}</div></header>
            {(relation?.firstMetStory || relation?.interactionSummary) && <section className="mt-6"><h3 className="text-sm font-semibold">与伙伴的关系</h3>{relation.firstMetStory && <p className="mt-3 text-sm leading-7">{relation.firstMetStory}</p>}{relation.interactionSummary && <p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>{relation.interactionSummary}</p>}</section>}
            <section className="mt-6"><h3 className="text-sm font-semibold">共同经历</h3>{items.length ? items.map(item => <section key={item.id} className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-medium">{item.title}</h4>{item.date && <time className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.date}</time>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{item.story}</p>{item.references?.map(reference => {
              if (!resolveReference?.(reference)) return null
              const key = `${item.id}:${reference.kind}:${reference.targetId}`
              return <ActionButton key={key} ref={node => { if (node) linkButtons.current.set(key, node); else linkButtons.current.delete(key) }} variant="plain" className="mt-2 gap-1" onClick={() => { detailPosition.current = scroll.current?.scrollTop ?? 0; openedLink.current = key; setLinked(reference) }}>查看{reference.kind === 'trip' ? '旅行记录' : '生活动态'}<ArrowUpRight size={12} /></ActionButton>
            })}</section>) : <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>还没有留下共同经历。</p>}</section>
          </>}
        </article>
      </> : people.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4" data-testid="contacts-grid">
        {people.map(item => <button type="button" key={item.id} ref={node => { if (node) cards.current.set(item.id, node); else cards.current.delete(item.id) }} data-testid={`contact-card-${item.id}`} className="flex min-w-0 items-start gap-3 border p-4 text-left transition hover:bg-[var(--hover-overlay)]" style={{ borderRadius: 'var(--radius-card)', borderColor: 'var(--border-color)', background: 'var(--card-bg)' }} onClick={() => { position.current = scroll.current?.scrollTop ?? 0; target.current = item.id; setSelected(item.id) }}>
          <PersonAvatar key={`${item.id}-${item.avatarSrc}`} person={item} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-semibold">{item.name}</span>{relations.find(entry => entry.ownerRoleId === ownerRoleId && entry.personId === item.id)?.relationLabel && <Badge>{relations.find(entry => entry.ownerRoleId === ownerRoleId && entry.personId === item.id)!.relationLabel}</Badge>}</span>{item.introduction && <span className="mt-2 block text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>{item.introduction}</span>}</span>
        </button>)}
      </div> : <EmptyState title="还没有认识的人" description="生活中建立的关系，会在这里留下记录。" />}
    </div>
  </div>
}
