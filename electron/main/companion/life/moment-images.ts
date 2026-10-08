import type { GeneratedImageReadResult } from '../../../../src/shared/types'
import { getDatabase } from '../../storage/database'
import { readGeneratedImageReference } from '../../storage/generated-images'
import { getEventById, getMomentById, listEventLinks } from './store'

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
