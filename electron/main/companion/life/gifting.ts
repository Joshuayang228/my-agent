/**
 * 专属物品赠送与羁绊好感（Companion Gifting & Bond Progression）
 *
 * 背景：同伴关系是双向的情感连接；角色不仅会主动赠送用户专属信物（relationship-keepsake），
 * 用户也应当能在日常相伴中主动赠予角色喜欢的礼物或小物件。
 * 角色收到礼物后，依据自身性格与喜好偏好产生真实、生动的第一人称回响，恢复生命体征并沉淀为长久羁绊。
 *
 * 设计意图：
 * 1. 独立持久化于 SQLite companion_received_gifts 表，记录历史赠礼与角色的欢呼回声；
 * 2. 提供精选礼物库（美食/收藏/实用/情感），每种礼物有明确的体征增益与角色喜好度（favorite/liked/neutral）；
 * 3. 用户赠礼可附带温暖寄语，角色由受控配方 compileGiftReactionRequest（或人设保底）生成第一人称回响；
 * 4. 收到礼物的反应即刻写入角色主会话（sessionKind: 'main'）作为 assistant 消息留痕；
 * 5. 联动角色生命体征（mood/energy 恢复提升）并记录关系里程碑 gift_received，全窗口广播通知。
 *
 * 关键约束：
 * - 纯主进程服务，所有 SQL 执行均参数化防注入；
 * - 依赖方向严格遵循主进程单向依赖（ipc -> agent -> companion -> storage）；
 * - 即使无外部 LLM 或模型生成失败，必须使用高质量人设预设保底，保证交互 100% 成功。
 */

import { randomUUID } from 'crypto'
import { getDatabase, persist } from '../../storage/database'
import { ensureLifeSchema } from '../core/persistence/life-schema'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig, loadImageGenerationConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { requestGeneratedImage } from '../../llm/image-generation'
import { compileGiftReactionRequest, compileImageGenerationRequest } from '../../prompts/registered-request'
import { normalizeGeneratedImage } from '../../utils/generated-image-codec'
import { prepareCompanionImageGen } from './image-gen-prep'
import { loadRoleLifePresets } from '../identity/life-presets'
import { getRoleVisualDataUrl, loadRolePack, resolveRoleUniverseId } from '../identity/loader'
import { ensureMainSessionForRole } from '../../storage/session-store'
import { tryRecordMilestone } from '../growth/milestones'
import { recordRelationshipEvent } from '../core/persistence/life-repository'
import { applyCompanionRuntimeDelta, getCompanionRuntimeState } from '../core/state/runtime-state'
import { appendCompanionDomainEvent } from '../core/events/domain-events'
import { enqueueCompanionOutbox } from '../core/outbox/outbox'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'
import { enqueueCompanionSessionMessage } from '../application/session-outbox'
import { dispatchCompanionSessionOutbox } from '../adapters/session-outbox-dispatcher'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import type {
  CompanionGiftItem,
  CompanionGiftRecord,
  GiftCategory,
  LLMConfig,
} from '../../../../src/shared/types'

const log = createLogger('CompanionGifting')

interface GiftDbRow {
  id: string
  role_id: string
  gift_key: string
  gift_name: string
  category: string
  giver_name?: string | null
  user_note: string | null
  companion_reaction: string
  vitals_buff_json: string | null
  image_url?: string | null
  created_at: number
}

function resolveReceivedGiftImageUrl(roleId: string, rawUrl: string | null | undefined, giftKey: string): string | undefined {
  const candidate = rawUrl?.trim()
    || loadRoleLifePresets(roleId).starterReceivedGifts?.find((item) => item.key === giftKey)?.visualPath
  if (!candidate) return undefined
  if (candidate.startsWith('data:image/')) return candidate
  if (candidate.startsWith('visual/')) {
    return getRoleVisualDataUrl(roleId, candidate, resolveRoleUniverseId(roleId)) ?? undefined
  }
  return candidate
}

async function scheduleReceivedGiftImageGeneration(roleId: string, giftId: string, giftName: string, userNote?: string): Promise<void> {
  try {
    const config = await loadImageGenerationConfig()
    if (!config) return
    const prepared = await prepareCompanionImageGen({
      roleId,
      description: `特写静物插画：一件收到的心意礼物「${giftName}」${userNote ? `（寄语背景：${userNote.slice(0, 60)}）` : ''}，温暖柔和光线，干净画面，无文字水印。`,
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
    db.run('UPDATE companion_received_gifts SET image_url = ? WHERE id = ? AND role_id = ?', [dataUrl, giftId, roleId])
    persist()
  } catch (err) {
    log.warn('Async received gift image generation skipped', { roleId, giftId, error: String(err) })
  }
}

function rowToRecord(row: GiftDbRow): CompanionGiftRecord {
  let vitalsBuff: CompanionGiftRecord['vitalsBuff']
  if (row.vitals_buff_json) {
    try {
      vitalsBuff = JSON.parse(row.vitals_buff_json) as CompanionGiftRecord['vitalsBuff']
    } catch {
      // 容错保持空
    }
  }
  return {
    id: row.id,
    roleId: row.role_id,
    giftKey: row.gift_key,
    giftName: row.gift_name,
    category: row.category as GiftCategory,
    giverName: row.giver_name || undefined,
    userNote: row.user_note || undefined,
    companionReaction: row.companion_reaction,
    imageUrl: resolveReceivedGiftImageUrl(row.role_id, row.image_url, row.gift_key),
    createdAt: row.created_at,
    vitalsBuff,
  }
}

export const PRESET_GIFTS: CompanionGiftItem[] = [
  {
    key: 'bone-meat',
    name: '特制带骨烤肉',
    category: 'food',
    iconName: 'Utensils',
    description: '烤得滋滋冒油的超大块带骨烤肉，肉香扑鼻，格外诱人！',
    vitalsBuff: { satiety: 30, mood: 25, energy: 15 },
  },
  {
    key: 'treasure-map',
    name: '泛黄的神秘地图',
    category: 'collectible',
    iconName: 'Map',
    description: '边缘略微磨损的古老羊皮纸地图，标注着未知的远方与探索路线。',
    vitalsBuff: { mood: 20, energy: 10 },
  },
  {
    key: 'handmade-bento',
    name: '手作特选便当',
    category: 'food',
    iconName: 'Utensils',
    description: '荤素搭配、极为讲究的现做便当，打开还冒着腾腾热气。',
    vitalsBuff: { satiety: 25, mood: 15, energy: 10 },
  },
  {
    key: 'star-compass',
    name: '星光探险罗盘',
    category: 'practical',
    iconName: 'Compass',
    description: '黄铜外壳、指针泛着微光的便携罗盘，无论风浪多大都坚定指引方向。',
    vitalsBuff: { mood: 15, energy: 10 },
  },
  {
    key: 'warm-scarf',
    name: '手织温暖围巾',
    category: 'emotional',
    iconName: 'Heart',
    description: '用柔软绒线亲手织成的温暖围巾，在起风的夜晚格外贴心。',
    vitalsBuff: { mood: 20 },
  },
  {
    key: 'sunny-postcard',
    name: '手绘海景明信片',
    category: 'emotional',
    iconName: 'Sparkles',
    description: '手绘的晴朗海景明信片，带着阳光与海风的清新气息。',
    vitalsBuff: { mood: 15 },
  },
  {
    key: 'remedy-kit',
    name: '随身急救草药包',
    category: 'practical',
    iconName: 'Coffee',
    description: '便携的随身急救包，里面装有常用草药与绷带，远行必备。',
    vitalsBuff: { energy: 15, mood: 10 },
  },
]

export async function ensureGiftTable(): Promise<void> {
  await ensureLifeSchema()
}

export async function listAvailableGifts(roleId: string): Promise<CompanionGiftItem[]> {
  const affinities = loadRoleLifePresets(roleId).giftAffinities ?? {}
  return PRESET_GIFTS.map((gift) => ({
    ...gift,
    roleAffinity: { [roleId]: affinities[gift.key] || 'liked' },
  }))
}

/**
 * 幂等播种角色出厂自带的珍藏礼物（来自伙伴或重要之人的赠礼，按稳定 ID 去重）。
 */
async function ensureStarterReceivedGifts(roleId: string): Promise<void> {
  const starters = loadRoleLifePresets(roleId).starterReceivedGifts
  if (!starters?.length) return
  const db = await getDatabase()
  const now = Date.now()
  for (const item of starters) {
    const id = `starter-gift:${roleId}:${item.key}`
    const createdAt = Math.max(1, now - (item.offsetMs ?? 0))
    db.run(
      `INSERT OR IGNORE INTO companion_received_gifts
        (id, role_id, gift_key, gift_name, category, giver_name, user_note, companion_reaction, vitals_buff_json, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [id, roleId, item.key, item.giftName, item.category, item.giverName, item.giverNote ?? null, item.companionReaction, item.visualPath ?? null, createdAt],
    )
  }
}

export async function listReceivedGifts(roleId: string, limit = 50): Promise<CompanionGiftRecord[]> {
  await ensureGiftTable()
  await ensureStarterReceivedGifts(roleId)
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_received_gifts
    WHERE role_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)
  stmt.bind([roleId, limit])
  const records: CompanionGiftRecord[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as GiftDbRow
    records.push(rowToRecord(row))
  }
  stmt.free()
  return records
}

function getFallbackReaction(roleId: string, giftKey: string, giftName: string, userNote?: string): string {
  const reactions = loadRoleLifePresets(roleId).giftFallbackReactions
  if (reactions) {
    const custom = reactions[giftKey] ?? reactions.default
    if (custom) {
      return custom.replace(/\{giftName\}/g, giftName).replace(/\{giftKey\}/g, giftKey)
    }
  }
  return `收到你送的礼物啦！真的太贴心了，心里暖洋洋的。${userNote ? `看到你的留言「${userNote}」，感觉整个人都被治愈了。` : ''}谢谢你一直以来的陪伴！`
}

export async function sendGiftToCompanion(
  roleId: string,
  giftKey: string,
  userNote?: string,
  opts?: {
    llmConfig?: LLMConfig
    mockResponse?: { reactionText: string; emotion?: string }
    now?: number
  },
): Promise<CompanionGiftRecord> {
  if (typeof roleId !== 'string' || roleId.trim().length === 0 || roleId.length > 128) throw new Error('人物标识无效。')
  if (typeof giftKey !== 'string' || giftKey.length === 0 || giftKey.length > 100) throw new Error('礼物标识无效。')
  if (typeof userNote !== 'undefined' && (userNote.length > 500 || userNote.includes('\u0000'))) throw new Error('赠礼寄语无效。')
  await ensureGiftTable()
  const db = await getDatabase()
  const now = opts?.now ?? Date.now()

  const giftDef = PRESET_GIFTS.find((g) => g.key === giftKey)
  if (!giftDef) throw new Error('礼物不存在，请从可用礼物中选择。')

  const affinities = loadRoleLifePresets(roleId).giftAffinities ?? {}
  const affinity = affinities[giftKey] || 'liked'

  let pack: ReturnType<typeof loadRolePack> | null = null
  try {
    pack = loadRolePack(roleId)
  } catch {
    // 允许测试或无 Role Pack 时降级
  }
  const protagonistName = pack?.name || '伙伴'
  const protagonistBrief = `${pack?.description || '真诚珍视彼此陪伴的数字伙伴'}\n${pack?.voice || ''}`.trim()

  let reactionText = getFallbackReaction(roleId, giftKey, giftDef.name, userNote)

  if (opts?.mockResponse) {
    reactionText = opts.mockResponse.reactionText
  } else {
    try {
      const auxConfig = opts?.llmConfig ?? (await loadAuxLLMConfig())
      if (hasLLMAuthentication(auxConfig)) {
        const request = compileGiftReactionRequest({
          protagonistName,
          protagonistBrief,
          giftName: giftDef.name,
          giftDescription: giftDef.description,
          userNote,
          affinity,
        })
        const rawText = await chatComplete({
          config: auxConfig as LLMConfig,
          request,
          caller: 'gift-reaction',
        })
        const cleaned = (rawText || '').replace(/```json\n?|\n?```/g, '').trim()
        const parsed = JSON.parse(cleaned) as { reactionText?: string }
        if (parsed.reactionText && typeof parsed.reactionText === 'string' && parsed.reactionText.trim()) {
          reactionText = parsed.reactionText.trim()
        }
      }
    } catch (err) {
      log.warn('LLM gift reaction generation failed, using rule fallback', { error: String(err) })
    }
  }

  // 1. 插入 companion_received_gifts 表
  const recordId = `gift-${now}-${randomUUID().slice(0, 8)}`
  const buffJson = giftDef.vitalsBuff ? JSON.stringify(giftDef.vitalsBuff) : null

  const record = await withCompanionUnitOfWork(async () => {
    db.run(
      `INSERT INTO companion_received_gifts
       (id, role_id, gift_key, gift_name, category, user_note, companion_reaction, vitals_buff_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recordId, roleId, giftDef.key, giftDef.name, giftDef.category, userNote || null, reactionText, buffJson, now],
    )

    // 2. 反应写入角色主会话留痕；事务内只入 Outbox，提交后再投递。
    const mainSession = await ensureMainSessionForRole(roleId)
    if (mainSession) {
      const giftMessageContent = userNote
        ? `【送上了礼物 · ${giftDef.name}】“${userNote}”\n\n${reactionText}`
        : `【送上了礼物 · ${giftDef.name}】\n\n${reactionText}`
      await enqueueCompanionSessionMessage({
        roleId,
        sessionId: mainSession.id,
        message: {
          id: randomUUID(),
          role: 'assistant',
          content: giftMessageContent,
          timestamp: now,
        },
        dispatch: false,
      })
      log.info('Recorded gift reaction in main session', { roleId, sessionId: mainSession.id })
    }

    const record: CompanionGiftRecord = {
      id: recordId,
      roleId,
      giftKey: giftDef.key,
      giftName: giftDef.name,
      category: giftDef.category,
      userNote: userNote || undefined,
      companionReaction: reactionText,
      createdAt: now,
      vitalsBuff: giftDef.vitalsBuff,
    }

    // 3. 提升角色生命体征、写领域事件和出站消息，和赠礼事实共享本地事务。
    const world = await getCompanionRuntimeState(roleId)
    const domainEvent = await appendCompanionDomainEvent({
      roleId,
      universeId: world.universeId,
      type: 'gift_received',
      sourceType: 'gifting',
      sourceId: recordId,
      causationId: recordId,
      correlationId: recordId,
      idempotencyKey: `gift-received:${recordId}`,
      occurredAt: now,
      payload: { giftKey: giftDef.key, giftName: giftDef.name, vitalsBuff: giftDef.vitalsBuff },
      schemaVersion: 1,
    })
    let next = world
    if (giftDef.vitalsBuff) {
      next = await applyCompanionRuntimeDelta({
        roleId,
        eventId: domainEvent.id,
        delta: {
          mood: giftDef.vitalsBuff.mood ?? 0,
          energy: giftDef.vitalsBuff.energy ?? 0,
        },
        updatedAt: now,
      })
    }
    await recordRelationshipEvent({
      roleId,
      subjectId: 'user',
      phase: 'familiar',
      delta: affinity === 'favorite' ? 5 : affinity === 'liked' ? 3 : 2,
      note: `收到礼物「${giftDef.name}」`,
      sourceEventId: domainEvent.id,
    })
    await enqueueCompanionOutbox({
      roleId,
      eventId: domainEvent.id,
      kind: 'gift-received',
      dedupeKey: `gift-received:${recordId}`,
      payload: { roleId, gift: record },
    })
    await enqueueCompanionOutbox({
      roleId,
      eventId: domainEvent.id,
      kind: 'timeline-updated',
      dedupeKey: `gift-timeline:${recordId}`,
      payload: { roleId, now },
    })
    log.info('Recorded gift domain event', { roleId, mood: next.mood, energy: next.energy })
    return record
  })
  await dispatchCompanionWindowOutbox()
  await dispatchCompanionSessionOutbox()

  // 4. 记录关系成长里程碑
  try {
    await tryRecordMilestone(roleId, 'gift_received', {
      roleDisplayName: protagonistName,
      now,
    })
  } catch (err) {
    log.warn('Failed to record gift milestone', { roleId, error: String(err) })
  }

  if (!opts?.mockResponse) {
    void scheduleReceivedGiftImageGeneration(roleId, record.id, record.giftName, record.userNote)
  }
  return record
}


export interface ChatGiftInput {
  roleId: string
  giftName: string
  category?: GiftCategory
  userNote?: string
  companionReaction?: string
  now?: number
}

/**
 * 通过主会话 Chat 工具接收用户送给伙伴的礼物并收进礼物柜。
 *
 * 背景：人物世界「礼物」Tab 定位为只读礼物柜，不提供手动点击送礼的按钮；
 * 用户在聊天里自然送出食物、纪念品或小物时，由伙伴调用 companion_receive_gift 收进礼物柜。
 * 设计意图：支持匹配预设礼物或记录任意自定义礼物名称；由于伙伴正在当前会话里直接回复用户，
 * 本入口不向主会话额外插一条重复的 assistant 消息，仅原子落库、更新体征/关系事件并广播礼物柜刷新。
 * 关键约束：giftName 必须为非空短文本（<=40字）；严格走 withCompanionUnitOfWork 与参数化 SQL。
 */
export async function recordGiftFromChat(input: ChatGiftInput): Promise<CompanionGiftRecord> {
  await ensureGiftTable()
  const db = await getDatabase()
  const now = input.now ?? Date.now()
  const cleanName = input.giftName.trim().slice(0, 40)
  if (!cleanName) throw new Error('礼物名称不能为空。')

  const matchedPreset = PRESET_GIFTS.find(
    (g) => g.key === cleanName || g.name === cleanName || cleanName.includes(g.name),
  )
  const giftKey = matchedPreset?.key ?? 'chat-custom'
  const category: GiftCategory = input.category ?? matchedPreset?.category ?? 'emotional'
  const vitalsBuff = matchedPreset?.vitalsBuff ?? { mood: 12, energy: 6 }
  const userNote = input.userNote?.trim().slice(0, 120) || undefined
  const reactionText = input.companionReaction?.trim().slice(0, 300) || `收下了你送的「${cleanName}」，已经好好放进礼物柜啦！`
  const recordId = `gift-${now}-${randomUUID().slice(0, 8)}`
  const buffJson = JSON.stringify(vitalsBuff)

  let protagonistName = input.roleId
  try {
    const pack = loadRolePack(input.roleId)
    if (pack?.name) protagonistName = pack.name
  } catch {
    // 忽略 Role Pack 加载降级
  }

  const record = await withCompanionUnitOfWork(async () => {
    db.run(
      `INSERT INTO companion_received_gifts
       (id, role_id, gift_key, gift_name, category, user_note, companion_reaction, vitals_buff_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recordId, input.roleId, giftKey, cleanName, category, userNote || null, reactionText, buffJson, now],
    )

    const record: CompanionGiftRecord = {
      id: recordId,
      roleId: input.roleId,
      giftKey,
      giftName: cleanName,
      category,
      userNote,
      companionReaction: reactionText,
      createdAt: now,
      vitalsBuff,
    }

    const world = await getCompanionRuntimeState(input.roleId)
    const domainEvent = await appendCompanionDomainEvent({
      roleId: input.roleId,
      universeId: world.universeId,
      type: 'gift_received',
      sourceType: 'chat_gift_tool',
      sourceId: recordId,
      causationId: recordId,
      correlationId: recordId,
      idempotencyKey: `gift-received:${recordId}`,
      occurredAt: now,
      payload: { giftKey, giftName: cleanName, category },
      schemaVersion: 1,
    })

    await applyCompanionRuntimeDelta({
      roleId: input.roleId,
      eventId: domainEvent.id,
      delta: {
        mood: vitalsBuff.mood ?? 0,
        energy: vitalsBuff.energy ?? 0,
      },
      updatedAt: now,
    })

    await recordRelationshipEvent({
      roleId: input.roleId,
      subjectId: 'user',
      phase: 'familiar',
      delta: matchedPreset?.roleAffinity?.[input.roleId] === 'favorite' ? 5 : 3,
      note: `在聊天里收到礼物「${cleanName}」`,
      sourceEventId: domainEvent.id,
    })

    await enqueueCompanionOutbox({
      roleId: input.roleId,
      eventId: domainEvent.id,
      kind: 'gift-received',
      dedupeKey: `gift-received:${recordId}`,
      payload: { roleId: input.roleId, gift: record },
    })

    await enqueueCompanionOutbox({
      roleId: input.roleId,
      eventId: domainEvent.id,
      kind: 'timeline-updated',
      dedupeKey: `gift-timeline:${recordId}`,
      payload: { roleId: input.roleId, now },
    })

    return record
  })

  await dispatchCompanionWindowOutbox()

  try {
    await tryRecordMilestone(input.roleId, 'gift_received', {
      roleDisplayName: protagonistName,
      now,
    })
  } catch (err) {
    log.warn('Failed to record chat gift milestone', { roleId: input.roleId, error: String(err) })
  }

  void scheduleReceivedGiftImageGeneration(input.roleId, record.id, record.giftName, record.userNote)
  return record
}
