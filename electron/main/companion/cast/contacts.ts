import { loadRelations } from '../identity/loader'
import { listRelatedCast } from './roster'
import { listEvents, listEventLinks, getMomentByEventId } from '../life/store'
import { listAssets } from '../life/assets'
import type { CompanionContactsData, CompanionContactExperience } from '../../../../src/shared/types'

/**
 * 背景：通讯录需要生活共同经历，召唤会话不是生活事件，不能拿聊天历史充数。
 * 设计意图：人物浅层与关系分离，只投影已发布且明确共同在场关联的事件。
 * 关键约束：事件、动态、旅行和关联都限定 ownerRoleId；缺失目标不提供死链接，不写第二份事实库。
 */
export async function getContactsForRole(roleId: string, universeId = 'default'): Promise<CompanionContactsData> {
  const cast = listRelatedCast(roleId, universeId)
  const ids = new Set(cast.map(person => person.id))
  const relations = loadRelations(universeId).edges.flatMap(edge => {
    const personId = edge.from === roleId ? edge.to : edge.to === roleId ? edge.from : null
    return personId && ids.has(personId) ? [{ ownerRoleId: roleId, personId, relationType: edge.type, summary: edge.note ?? '' }] : []
  })
  const [events, assets] = await Promise.all([listEvents(roleId, { status: 'published', order: 'desc' }), listAssets(roleId)])
  const experiences: CompanionContactExperience[] = []
  for (const event of events) {
    if (event.roleId !== roleId || event.status !== 'published') continue
    const links = await listEventLinks(roleId, event.id)
    const participants = new Set(links.filter(link => link.roleId === roleId && link.eventId === event.id
      && ((link.targetType === 'cast' && link.relation === 'coframe') || (link.targetType === 'person' && link.relation === 'participant'))
      && ids.has(link.targetId)).map(link => link.targetId))
    if (!participants.size) continue
    const moment = await getMomentByEventId(roleId, event.id)
    const story = typeof event.payload.story === 'string' ? event.payload.story : moment?.roleId === roleId ? moment.text : typeof event.payload.activity === 'string' ? event.payload.activity : ''
    if (!story.trim()) continue
    const title = typeof event.payload.title === 'string' ? event.payload.title : typeof event.payload.activity === 'string' ? event.payload.activity : '共同经历'
    const references: CompanionContactExperience['references'] = []
    if (moment?.roleId === roleId) references.push({ kind: 'moment', targetId: moment.id })
    for (const link of links) {
      if (link.roleId !== roleId || link.targetType !== 'asset') continue
      const trip = assets.find(asset => asset.id === link.targetId && asset.roleId === roleId && asset.kind === 'footprint' && asset.payload.recordType === 'trip' && ['active', 'completed'].includes(String(asset.payload.status)))
      if (trip && !references.some(reference => reference.kind === 'trip' && reference.targetId === trip.id)) references.push({ kind: 'trip', targetId: trip.id })
    }
    for (const personId of participants) experiences.push({ id: `${event.id}:${personId}`, ownerRoleId: roleId, personId, occurredAt: event.scheduledAt, eventId: event.id, title, story, references })
  }
  return { roleId, people: cast.map(person => ({ id: person.id, name: person.name, introduction: person.description || person.summary })), relations, experiences }
}
