import type { GeneratedImageReadResult } from '../../../../src/shared/types'
import { getDatabase } from '../../storage/database'
import { readGeneratedImageReference } from '../../storage/generated-images'
import { getEventById, getMomentById, listEventLinks, replaceEventLinks } from './store'

export type MomentImageTarget =
  | { ok: true; eventId: string; position: number }
  | { ok: false; error: string }

/**
 * 为朋友圈配图预检目标动态。
 *
 * 背景：生图请求可能产生远程费用，动态目标无效时不能等图片生成后才发现。
 * 设计意图：只接受当前角色已发布的动态，并在真正请求前计算可用位置；不把 planned
 * 事件或其他角色的动态当成可写目标。
 * 关键约束：单条动态最多九张图；校验只读事件与现有关联，不产生写入副作用。
 */
export async function prepareMomentImageTarget(roleId: string, momentId: string): Promise<MomentImageTarget> {
  const moment = await getMomentById(momentId)
  if (!moment || moment.roleId !== roleId) return { ok: false, error: '目标动态不存在或不属于当前人物。' }
  const event = await getEventById(moment.eventId)
  if (!event || event.roleId !== roleId || event.status !== 'published') return { ok: false, error: '只能为当前人物已发布的动态配图。' }
  const links = await listEventLinks(roleId, event.id)
  const images = links.filter(link => link.targetType === 'image' && link.relation === 'depicts')
  if (images.length >= 9) return { ok: false, error: '这条动态已经有九张图片，不能继续添加。' }
  return { ok: true, eventId: event.id, position: images.length }
}

/**
 * 将已经落盘且拥有摘要的图片绑定到朋友圈动态。
 *
 * 背景：动态图片必须沿事件关联表保存，才能被正式朋友圈、备份和 Debug 共同读取。
 * 设计意图：复用事件关联的整体替换事务，保留衣物、卡司等已有关系；不把图片路径写进事件正文。
 * 关键约束：再次核对角色、发布状态和九张上限；任何校验失败都不留下半条关联。
 */
export async function attachMomentImageForRole(roleId: string, momentId: string, imageId: string): Promise<MomentImageTarget> {
  if (!/^[a-f0-9]{64}$/.test(imageId)) return { ok: false, error: '图片引用无效，未绑定到动态。' }
  const target = await prepareMomentImageTarget(roleId, momentId)
  if (!target.ok) return target
  const links = await listEventLinks(roleId, target.eventId)
  await replaceEventLinks(roleId, target.eventId, [...links, {
    eventId: target.eventId,
    roleId,
    targetType: 'image',
    targetId: imageId,
    relation: 'depicts',
    metadata: { position: target.position },
  }])
  return target
}

export async function momentImageIdsForRole(roleId: string, momentId: string): Promise<string[]> {
  const moment = await getMomentById(momentId)
  if (!moment || moment.roleId !== roleId) return []
  const event = await getEventById(moment.eventId)
  if (!event || event.roleId !== roleId || event.status !== 'published') return []
  const links = await listEventLinks(roleId, event.id)
  const images = links.filter(link => link.targetType === 'image' && /^[a-f0-9]{64}$/.test(link.targetId))
  const position = (link: typeof images[number]) => typeof link.metadata.position === 'number' && Number.isSafeInteger(link.metadata.position) && link.metadata.position >= 0 ? link.metadata.position : 9
  images.sort((a, b) => position(a) - position(b))
  return [...new Set(images.map(link => link.targetId))].slice(0, 9)
}

function referenceInJSON(value: unknown, imageId: string, array: boolean): unknown {
  if (typeof value !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(value)
    const references = array ? parsed : parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [(parsed as Record<string, unknown>).image] : []
    if (!Array.isArray(references)) return null
    return references.find(reference => reference && typeof reference === 'object' && !Array.isArray(reference) && reference.id === imageId) ?? null
  } catch { return null }
}

/**
 * 背景：动态图片关联只有摘要，不能把事件里的任意路径或当前资产配图当成历史照片。
 * 设计意图：在本角色已有资产 / 工具消息中定位同摘要引用，复用受控文件校验；不复制图片库。
 * 关键约束：先核对已发布事件与图片关联，再按 role 查询；候选数量有界，任何失败不读外部路径。
 */
export async function readMomentImageForRole(roleId: string, momentId: string, imageId: string): Promise<GeneratedImageReadResult> {
  if (!(await momentImageIdsForRole(roleId, momentId)).includes(imageId)) return { ok: false, error: '这条动态没有可读取的图片。' }
  const db = await getDatabase()
  const queries = [
    { table: 'companion_assets', sql: 'SELECT payload_json FROM companion_assets WHERE role_id = ? AND instr(payload_json, ?) > 0 LIMIT 20', array: false },
    { table: 'messages', sql: `SELECT m.generated_images FROM messages m JOIN sessions s ON s.id = m.session_id
      WHERE s.role_id = ? AND m.role = 'tool' AND instr(m.generated_images, ?) > 0 ORDER BY m.created_at DESC LIMIT 20`, array: true },
  ]
  for (const query of queries) {
    const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    let exists = false
    try { table.bind([query.table]); exists = table.step() } finally { table.free() }
    if (!exists) continue
    const statement = db.prepare(query.sql)
    const references: unknown[] = []
    try {
      statement.bind([roleId, imageId])
      while (statement.step()) {
        const reference = referenceInJSON(statement.get()[0], imageId, query.array)
        if (reference) references.push(reference)
      }
    } finally { statement.free() }
    for (const reference of references) {
      const result = await readGeneratedImageReference(reference, imageId)
      if (result.ok && (await momentImageIdsForRole(roleId, momentId)).includes(imageId)) return result
    }
  }
  return { ok: false, error: '图片暂时无法读取，文件可能已移动或删除。' }
}
