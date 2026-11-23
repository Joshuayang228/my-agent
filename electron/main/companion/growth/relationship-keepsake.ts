// 羁绊深度跃迁与专属信物馈赠
/**
 * 羁绊深度跃迁与专属信物馈赠（Relationship Progression & Keepsake Gifts）
 *
 * 背景：在伙伴关系中，深厚的情感羁绊需要具有实体感、纪念意义与共同回忆的承载物。
 * 角色不只是一个陪聊工具，随着相处深入、共同心愿完成与里程碑跨越，
 * 角色会主动赠送用户专属信物，具体信物资产由各角色 Role Pack 的 life-presets.json 提供。
 *
 * 设计意图：
 * 1. 独立持久化存储于 companion_keepsakes；
 * 2. 赠礼时将专属赠言写入角色主会话，并向窗口广播伴随通知；
 * 3. 关联关系里程碑（tryRecordMilestone('keepsake_gifted')）；
 * 4. 首次启动按当前角色 Role Pack 预设播种第一件羁绊信物。
 */

import { randomUUID } from 'crypto'
import { getDatabase, persist } from '../../storage/database'
import { ensureLifeSchema } from '../core/persistence/life-schema'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { compileKeepsakeGiftRequest } from '../../prompts/registered-request'
import { loadRoleLifePresets } from '../identity/life-presets'
import { getRoleVisualDataUrl, loadRolePack, resolveRoleUniverseId } from '../identity/loader'
import { loadImageGenerationConfig } from '../../llm/aux-config'
import { requestGeneratedImage } from '../../llm/image-generation'
import { compileImageGenerationRequest } from '../../prompts/registered-request'
import { normalizeGeneratedImage } from '../../utils/generated-image-codec'
import { prepareCompanionImageGen } from '../life/image-gen-prep'
import { ensureMainSessionForRole } from '../../storage/session-store'
import { tryRecordMilestone } from './milestones'
import { recordRelationshipEvent } from '../core/persistence/life-repository'
import { isActiveRole } from '../../storage/settings-store'
import { appendCompanionDomainEvent } from '../core/events/domain-events'
import { enqueueCompanionOutbox } from '../core/outbox/outbox'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'
import { enqueueCompanionSessionMessage } from '../application/session-outbox'
import { dispatchCompanionSessionOutbox } from '../adapters/session-outbox-dispatcher'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { enqueueAutomaticProactiveNotification } from '../application/proactive-budget'
import { COMPANION_FOLLOWUP } from '../core/outbox/followup-kinds'
import { recoverCompanionFollowups } from '../application/companion-followups'
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

function resolveKeepsakeImageUrl(roleId: string, rawUrl: string | null | undefined, keepsakeId: string, name: string): string | undefined {
  const candidate = rawUrl?.trim()
    || getPresetKeepsakes(roleId).find((item) => item.key === keepsakeId || item.name === name)?.visualPath
  if (!candidate) return undefined
  if (candidate.startsWith('data:image/')) return candidate
  if (candidate.startsWith('visual/')) {
    return getRoleVisualDataUrl(roleId, candidate, resolveRoleUniverseId(roleId)) ?? undefined
  }
  return candidate
}

async function scheduleKeepsakeImageGeneration(roleId: string, keepsakeId: string, name: string, description: string): Promise<void> {
  try {
    const config = await loadImageGenerationConfig()
    if (!config) return
    const prepared = await prepareCompanionImageGen({
      roleId,
      description: `特写静物插画：一件珍贵的纪念信物「${name}」，${description}，温暖柔和的光线，干净背景，无文字水印。`,
      category: 'gift',
    })
    const response = await requestGeneratedImage(
      config,
      compileImageGenerationRequest(prepared.prompt, prepared.visualAnchor),
      undefined,
      { referenceImages: prepared.referenceImages, aspectRatio: '4:3' },
    )
    const normalized = await normalizeGeneratedImage(response.bytes)
    const dataUrl = `data:image/png;base64,${normalized.bytes.toString('base64')}`
    const db = await getDatabase()
    db.run('UPDATE companion_keepsakes SET image_url = ? WHERE id = ? AND role_id = ?', [dataUrl, keepsakeId, roleId])
    persist()
  } catch (err) {
    log.warn('Async keepsake image generation skipped', { roleId, keepsakeId, error: String(err) })
  }
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
    imageUrl: resolveKeepsakeImageUrl(row.role_id, row.image_url, row.id, row.name),
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
  visualPath?: string
}

export function getPresetKeepsakes(roleId: string): PresetKeepsakeDefinition[] {
  return loadRoleLifePresets(roleId).presetKeepsakes ?? []
}

export async function ensureKeepsakeTable(targetRoleId?: string): Promise<void> {
  await ensureLifeSchema()
  if (!targetRoleId) return
  const presets = getPresetKeepsakes(targetRoleId)
  if (presets.length === 0) return

  const db = await getDatabase()
  const stmt = db.prepare('SELECT COUNT(*) AS count FROM companion_keepsakes WHERE role_id = ?')
  stmt.bind([targetRoleId])
  let count = 0
  if (stmt.step()) {
    count = (stmt.getAsObject() as { count: number }).count
  }
  stmt.free()

  if (count === 0) {
    const starter = presets[0]
    const now = Date.now() - 86400000 * 2
    db.run(
      `INSERT INTO companion_keepsakes
       (id, role_id, name, description, lore, gift_message, gift_reason, icon_name, image_url, acquired_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        starter.key,
        targetRoleId,
        starter.name,
        starter.description,
        starter.lore,
        starter.giftMessage,
        starter.giftReason,
        starter.iconName,
        starter.visualPath ?? null,
        now,
      ],
    )
    persist()
    let roleDisplayName = targetRoleId
    try {
      roleDisplayName = loadRolePack(targetRoleId)?.name || targetRoleId
    } catch {
      // 无 Role Pack 时回退 roleId
    }
    await tryRecordMilestone(targetRoleId, 'keepsake_gifted', { roleDisplayName, now })
    log.info('Seeded first friendship keepsake', { roleId: targetRoleId, key: starter.key })
  }
}

export async function listKeepsakes(roleId: string): Promise<CompanionKeepsakeRecord[]> {
  await ensureKeepsakeTable(roleId)
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
    automatic?: boolean
    assertClaim?: () => Promise<void>
    mockResponse?: {
      giftSpeech: string
      celebrationTitle?: string
    }
  },
): Promise<CompanionKeepsakeRecord | null> {
  await ensureKeepsakeTable(roleId)
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
  const previouslyAwarded = opts?.assertClaim && existing.find(item => item.id === targetKeepsakeKey)
  if (previouslyAwarded) return previouslyAwarded
  const existingIds = new Set(existing.map((k) => k.id))

  // 2. 匹配候选信物定义
  const presets = getPresetKeepsakes(roleId)
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

  const event: CompanionKeepsakeGiftEvent = {
    roleId,
    keepsake: keepsakeRecord,
    giftMessage: speech,
    toastTitle: celebrationTitle,
    timestamp: now,
  }

  try {
    const committed = await withCompanionUnitOfWork(async () => {
      if (opts?.assertClaim) {
        // 奖励生成可能跨模型等待，进入事实事务后重新检查领取与信物归属。
        await opts.assertClaim()
        const awarded = (await listKeepsakes(roleId)).find(item => item.id === keepsakeRecord.id)
        if (awarded) return awarded
      }
      db.run(
        `INSERT OR REPLACE INTO companion_keepsakes
         (id, role_id, name, description, lore, gift_message, gift_reason, icon_name, image_url, acquired_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [keepsakeRecord.id, keepsakeRecord.roleId, keepsakeRecord.name, keepsakeRecord.description, keepsakeRecord.lore, keepsakeRecord.giftMessage, keepsakeRecord.giftReason, keepsakeRecord.iconName, candidate.visualPath ?? null, now],
      )

      const domainEvent = await appendCompanionDomainEvent({
        roleId,
        universeId: resolveRoleUniverseId(roleId),
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
      await recordRelationshipEvent({
        roleId,
        subjectId: 'user',
        phase: 'rapport',
        delta: 10,
        note: `赠予专属信物「${keepsakeRecord.name}」`,
        sourceEventId: domainEvent.id,
      })
      await enqueueCompanionOutbox({
        roleId, eventId: domainEvent.id,
        kind: COMPANION_FOLLOWUP.keepsakeMilestone,
        dedupeKey: `${COMPANION_FOLLOWUP.keepsakeMilestone}:${domainEvent.id}`,
        payload: { roleDisplayName: pack.name, occurredAt: now },
      })
      const enqueueNotification = async () => {
        const session = await ensureMainSessionForRole(roleId)
        await enqueueCompanionSessionMessage({
          roleId,
          eventId: domainEvent.id,
          sessionId: session.id,
          message: { id: domainEvent.id, role: 'assistant', content: speech, timestamp: now },
          dispatch: false,
        })
        await enqueueCompanionOutbox({
          roleId,
          eventId: domainEvent.id,
          kind: 'keepsake-gifted',
          dedupeKey: `keepsake-gifted:${keepsakeRecord.id}`,
          payload: event as unknown as Record<string, unknown>,
        })
      }
      if (opts?.automatic) await enqueueAutomaticProactiveNotification(roleId, now, enqueueNotification)
      else await enqueueNotification()
      return keepsakeRecord
    })
    await dispatchCompanionWindowOutbox()
    await dispatchCompanionSessionOutbox()
    // 恢复消费者稍后统一处理新生成的里程碑，避免在消费中递归进入恢复队列。
    if (!opts?.assertClaim) await recoverCompanionFollowups()
    if (!candidate.visualPath && !opts?.mockResponse) {
      void scheduleKeepsakeImageGeneration(roleId, committed.id, committed.name, committed.description)
    }
    log.info('Keepsake gifted successfully', { roleId, keepsakeId: committed.id, name: committed.name })
    return committed
  } catch (err) {
    log.warn('Keepsake transaction failed; no partial record retained', { roleId, keepsakeId: keepsakeRecord.id, error: String(err) })
    return null
  }

}
