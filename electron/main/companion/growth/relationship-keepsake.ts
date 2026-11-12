/**
 * 羁绊深度跃迁与专属信物馈赠（Relationship Progression & Keepsake Gifts）
 *
 * 背景：在伙伴关系中，深厚的情感羁绊需要具有实体感、纪念意义与共同回忆的承载物。
 * 角色不只是一个陪聊工具，随着相处深入、共同心愿完成与里程碑跨越，
 * 角色会主动赠送用户专属信物（如路飞的生命卡、梅利号铃铛、麦穗手绳）。
 *
 * 设计意图：
 * 1. 独立持久化存储于 companion_keepsakes；
 * 2. 赠礼时将专属赠言写入角色主会话，并向窗口广播伴随通知；
 * 3. 关联关系里程碑（tryRecordMilestone('keepsake_gifted')）；
 * 4. 首次启动为路飞播种第一件羁绊信物（生命卡的一角），彰显同伴契约。
 */

import { randomUUID } from 'crypto'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { compileKeepsakeGiftRequest } from '../../prompts/registered-request'
import { loadRolePack } from '../identity/loader'
import { ensureMainSessionForRole } from '../../storage/session-store'
import { tryRecordMilestone } from './milestones'
import { isActiveRole } from '../../storage/settings-store'
import { appendCompanionDomainEvent } from '../core/events/domain-events'
import { enqueueCompanionOutbox } from '../core/outbox/outbox'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'
import { enqueueCompanionSessionMessage } from '../application/session-outbox'
import type { CompanionKeepsakeRecord, CompanionKeepsakeGiftEvent, LLMConfig } from '../../../../src/shared/types'

const log = createLogger('RelationshipKeepsake')

interface KeepsakeDbRow {
  id: string
  role_id: string
  name: string
  description: string
  lore: string
  gift_message: string
  gift_reason: string
  icon_name: string
  image_url: string | null
  acquired_at: number
}

function rowToRecord(row: KeepsakeDbRow): CompanionKeepsakeRecord {
  return {
    id: row.id,
    roleId: row.role_id,
    name: row.name,
    description: row.description,
    lore: row.lore,
    giftMessage: row.gift_message,
    giftReason: row.gift_reason,
    iconName: row.icon_name,
    imageUrl: row.image_url || undefined,
    acquiredAt: row.acquired_at,
  }
}

export interface PresetKeepsakeDefinition {
  key: string
  name: string
  description: string
  lore: string
  giftMessage: string
  giftReason: string
  iconName: string
}

export const PRESET_KEEPSAKES_LUFFY: PresetKeepsakeDefinition[] = [
  {
    key: 'luffy-vivre-card',
    name: '生命卡的一角',
    description: '从路飞自己的生命卡上撕下的一小角纸片，无论相隔多远，都会轻轻朝路飞的方向微微移动。',
    lore: '“这是我从自己的生命卡上撕下来的一小片！雷利大叔教过我怎么撕它。不管以后遇到多大的风浪，不管相隔多远，它都会慢慢指向我这里。收下它吧，因为我们可是同伴啊！嘻嘻嘻！”',
    giftMessage: '喂！你过来一下！我把这个送给你——这是从我自己的生命卡上撕下来的一小片！无论你在哪里，只要顺着它，就一定能找到万里阳光号！收下吧，我们可是伙伴啊！',
    giftReason: '伙伴誓约·跨越千山万水的羁绊信物',
    iconName: 'Gift',
  },
  {
    key: 'luffy-merry-bell',
    name: '梅利号的小羊金色铃铛',
    description: '黄金梅利号船头小羊曾经佩戴过的小铃铛，轻轻摇晃会发出清脆温和的叮当声。',
    lore: '“这是以前在黄金梅利号上大家一起听过的铃铛声。每当在海上遇到大雾的时候，听到这个声音就会觉得很安心。现在我把它送给你，如果哪天你觉得累了或者遇到困难，晃一晃它，我们大家就都在你身边！”',
    giftMessage: '当当当！看我找到了什么！这是梅利号上的小铃铛哦！遇到困难或者想我们的时候晃一晃它，我们就会飞奔过来帮你的！',
    giftReason: '守护与同在·永远的梅利之音',
    iconName: 'Gift',
  },
  {
    key: 'luffy-windmill-braid',
    name: '风车村的麦穗编织绳',
    description: '用风车村山丘上的金黄麦穗与结实麻绳编成的手绳，带着淡淡的泥土与海风清香。',
    lore: '“玛琪诺姐姐以前教我编的绳子，里面用了风车村山丘上的麦穗。虽然我手笨编得歪歪扭扭的，嘻嘻！但是带着它，就好像能闻到家乡海风的味道。送给你啦，要一直戴着哦！”',
    giftMessage: '喂！这是我亲手编的绳子，虽然歪歪扭扭的，但是玛琪诺说送给最重要的伙伴能保佑大冒险平安！给你戴上啦！',
    giftReason: '初心与眷恋·家乡海风的诚挚赠礼',
    iconName: 'Gift',
  },
]

export async function ensureKeepsakeTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_keepsakes (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL,
      lore         TEXT NOT NULL,
      gift_message TEXT NOT NULL,
      gift_reason  TEXT NOT NULL,
      icon_name    TEXT NOT NULL,
      image_url    TEXT,
      acquired_at  INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_keepsakes_role_time
      ON companion_keepsakes(role_id, acquired_at DESC)
  `)

  // 检查是否已有路飞信物，若无则播种首个信物（生命卡的一角）
  const stmt = db.prepare('SELECT COUNT(*) AS count FROM companion_keepsakes WHERE role_id = ?')
  stmt.bind(['luffy'])
  let count = 0
  if (stmt.step()) {
    count = (stmt.getAsObject() as { count: number }).count
  }
  stmt.free()

  if (count === 0) {
    const starter = PRESET_KEEPSAKES_LUFFY[0]
    const now = Date.now() - 86400000 * 2
    db.run(
      `INSERT INTO companion_keepsakes
       (id, role_id, name, description, lore, gift_message, gift_reason, icon_name, image_url, acquired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        starter.key,
        'luffy',
        starter.name,
        starter.description,
        starter.lore,
        starter.giftMessage,
        starter.giftReason,
        starter.iconName,
        null,
        now,
      ],
    )
    persist()
    await tryRecordMilestone('luffy', 'keepsake_gifted', { roleDisplayName: '路飞', now })
    log.info('Seeded first friendship keepsake for luffy', { key: starter.key })
  }
}

export async function listKeepsakes(roleId: string): Promise<CompanionKeepsakeRecord[]> {
  await ensureKeepsakeTable()
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_keepsakes
    WHERE role_id = ?
    ORDER BY acquired_at DESC
  `)
  stmt.bind([roleId])
  const records: CompanionKeepsakeRecord[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as KeepsakeDbRow
    records.push(rowToRecord(row))
  }
  stmt.free()
  return records
}

export async function triggerGiftKeepsake(
  roleId: string,
  targetKeepsakeKey?: string,
  customReason?: string,
  now = Date.now(),
  opts?: {
    llmConfig?: LLMConfig
    mockResponse?: {
      giftSpeech: string
      celebrationTitle?: string
    }
  },
): Promise<CompanionKeepsakeRecord | null> {
  await ensureKeepsakeTable()
  const db = await getDatabase()

  let pack: ReturnType<typeof loadRolePack> | null = null
  try {
    pack = loadRolePack(roleId)
  } catch (err) {
    log.warn('Failed to load role pack for keepsake gifting', { roleId, error: String(err) })
    return null
  }

  // 1. 获取该角色已有信物
  const existing = await listKeepsakes(roleId)
  const existingIds = new Set(existing.map((k) => k.id))

  // 2. 匹配候选信物定义
  const presets = roleId === 'luffy' ? PRESET_KEEPSAKES_LUFFY : []
  let candidate: PresetKeepsakeDefinition | null = null

  if (targetKeepsakeKey) {
    candidate = presets.find((p) => p.key === targetKeepsakeKey) || null
  }
  if (!candidate) {
    candidate = presets.find((p) => !existingIds.has(p.key)) || null
  }

  // 若无预设候选（或都已拥有），生成通用信物
  if (!candidate) {
    const giftCount = existing.length + 1
    candidate = {
      key: `keepsake-special-${randomUUID().slice(0, 8)}`,
      name: `${pack.name}的亲笔星光随身符 #${giftCount}`,
      description: '角色在与你经历多次默契交谈与共同冒险后，倾注诚挚心愿亲手为你制作的随身信物。',
      lore: '“带着它吧，不管遇到什么事，我们都是并肩同行的伙伴！”',
      giftMessage: '喂！收下这个！这是我特地留给你的，无论什么时候，看到它就代表我们一直在一起！',
      giftReason: customReason || '深刻交谈与长久陪伴的专属见证',
      iconName: 'Gift',
    }
  }

  let speech = candidate.giftMessage
  let celebrationTitle = `${pack.name} 赠送了你专属信物`

  // 3. 模型生成专属赠言
  if (opts?.mockResponse) {
    speech = opts.mockResponse.giftSpeech
    if (opts.mockResponse.celebrationTitle) celebrationTitle = opts.mockResponse.celebrationTitle
  } else {
    const config = opts?.llmConfig ?? (await loadAuxLLMConfig())
    if (hasLLMAuthentication(config)) {
      try {
        const raw = await chatComplete({
          config: { ...config, maxTokens: 250, temperature: 0.8 },
          request: compileKeepsakeGiftRequest({
            protagonistName: pack.name,
            protagonistBrief: `${pack.description}\n${pack.voice ?? ''}`.slice(0, 500),
            keepsakeName: candidate.name,
            keepsakeLore: candidate.lore,
            giftReason: customReason || candidate.giftReason,
          }),
          caller: 'keepsake-gift',
        })
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) {
          const json = JSON.parse(match[0]) as Record<string, unknown>
          if (json && typeof json.giftSpeech === 'string' && json.giftSpeech.trim()) {
            speech = json.giftSpeech.trim()
            if (typeof json.celebrationTitle === 'string' && json.celebrationTitle.trim()) {
              celebrationTitle = json.celebrationTitle.trim()
            }
          }
        }
      } catch (err) {
        log.warn('Keepsake speech LLM generation failed, using preset speech', { roleId, error: String(err) })
      }
    }
  }

  // 4. 保存信物
  const keepsakeRecord: CompanionKeepsakeRecord = {
    id: candidate.key,
    roleId,
    name: candidate.name,
    description: candidate.description,
    lore: candidate.lore,
    giftMessage: speech,
    giftReason: customReason || candidate.giftReason,
    iconName: candidate.iconName,
    acquiredAt: now,
  }

  if (!(await isActiveRole(roleId))) {
    log.info('Skip keepsake persistence for inactive role', { roleId, keepsakeId: keepsakeRecord.id })
    return null
  }

  db.run(
    `INSERT OR REPLACE INTO companion_keepsakes
     (id, role_id, name, description, lore, gift_message, gift_reason, icon_name, image_url, acquired_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      keepsakeRecord.id,
      keepsakeRecord.roleId,
      keepsakeRecord.name,
      keepsakeRecord.description,
      keepsakeRecord.lore,
      keepsakeRecord.giftMessage,
      keepsakeRecord.giftReason,
      keepsakeRecord.iconName,
      null,
      now,
    ],
  )
  persist()

  // 5. 将赠礼消息作为 assistant 写入该角色的主会话
  try {
    const session = await ensureMainSessionForRole(roleId)
    await enqueueCompanionSessionMessage({
      roleId,
      sessionId: session.id,
      message: {
      id: randomUUID(),
      role: 'assistant',
      content: speech,
      timestamp: now,
      },
    })
  } catch (err) {
    db.run('DELETE FROM companion_keepsakes WHERE id = ? AND role_id = ?', [keepsakeRecord.id, roleId])
    persist()
    log.warn('Keepsake delivery failed; rolled back keepsake record', { roleId, error: String(err) })
    return null
  }

  // 6. 记录关系里程碑
  await tryRecordMilestone(roleId, 'keepsake_gifted', { roleDisplayName: pack.name, now })

  // 7. 广播事件
  const event: CompanionKeepsakeGiftEvent = {
    roleId,
    keepsake: keepsakeRecord,
    giftMessage: speech,
    toastTitle: celebrationTitle,
    timestamp: now,
  }

  try {
    const domainEvent = await appendCompanionDomainEvent({
      roleId,
      universeId: 'default',
      type: 'keepsake_gifted',
      sourceType: 'relationship_keepsake',
      sourceId: keepsakeRecord.id,
      causationId: keepsakeRecord.id,
      correlationId: keepsakeRecord.id,
      idempotencyKey: `keepsake-gifted:${keepsakeRecord.id}`,
      occurredAt: now,
      payload: event as unknown as Record<string, unknown>,
      schemaVersion: 1,
    })
    await enqueueCompanionOutbox({
      roleId,
      eventId: domainEvent.id,
      kind: 'keepsake-gifted',
      dedupeKey: `keepsake-gifted:${keepsakeRecord.id}`,
      payload: event as unknown as Record<string, unknown>,
    })
    await dispatchCompanionWindowOutbox()
  } catch (err) {
    log.warn('Keepsake notification ledger failed; record remains readable', { roleId, keepsakeId: keepsakeRecord.id, error: String(err) })
  }

  log.info('Keepsake gifted successfully', { roleId, keepsakeId: keepsakeRecord.id, name: keepsakeRecord.name })
  return keepsakeRecord
}
