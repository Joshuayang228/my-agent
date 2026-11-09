/**
 * 专属物品赠送与羁绊好感（Companion Gifting & Bond Progression）
 *
 * 背景：同伴关系是双向的情感连接；角色不仅会主动赠送用户专属信物（relationship-keepsake），
 * 用户也应当能在日常相伴中主动挑选或定制礼物赠予角色（如路飞的最爱带骨大肉、神秘藏宝图、便当、手织围巾）。
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
import { BrowserWindow } from 'electron'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { compileGiftReactionRequest } from '../../prompts/registered-request'
import { loadRolePack } from '../identity/loader'
import { ensureMainSessionForRole, saveMessage } from '../../storage/session-store'
import { tryRecordMilestone } from '../growth/milestones'
import { ensureWorldState } from './world-state'
import * as store from './store'
import type {
  CompanionGiftItem,
  CompanionGiftRecord,
  CompanionGiftEvent,
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
  user_note: string | null
  companion_reaction: string
  vitals_buff_json: string | null
  created_at: number
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
    userNote: row.user_note || undefined,
    companionReaction: row.companion_reaction,
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
    description: '烤得滋滋冒油的超大块带骨烤肉，肉香扑鼻，在海风中格外诱人！',
    vitalsBuff: { satiety: 30, mood: 25, energy: 15 },
    roleAffinity: { luffy: 'favorite' },
  },
  {
    key: 'treasure-map',
    name: '泛黄的神秘海图',
    category: 'collectible',
    iconName: 'Map',
    description: '边缘略微磨损的古老羊皮纸航海图，标注着未知的神秘海域与危险航标。',
    vitalsBuff: { mood: 20, energy: 10 },
    roleAffinity: { luffy: 'favorite' },
  },
  {
    key: 'handmade-bento',
    name: '山治风特制便当',
    category: 'food',
    iconName: 'Utensils',
    description: '荤素搭配、极为讲究的现做海上便当，打开还冒着腾腾热气。',
    vitalsBuff: { satiety: 25, mood: 15, energy: 10 },
    roleAffinity: { luffy: 'liked' },
  },
  {
    key: 'star-compass',
    name: '星光探险罗盘',
    category: 'practical',
    iconName: 'Compass',
    description: '黄铜外壳、指针泛着微光的航海罗盘，无论风浪多大都坚定指引航向。',
    vitalsBuff: { mood: 15, energy: 10 },
    roleAffinity: { luffy: 'liked' },
  },
  {
    key: 'warm-scarf',
    name: '手织温暖围巾',
    category: 'emotional',
    iconName: 'Heart',
    description: '用柔软绒线亲手织成的红蓝两色围巾，在甲板夜航的风暴中格外暖和。',
    vitalsBuff: { mood: 20 },
    roleAffinity: { luffy: 'liked' },
  },
  {
    key: 'sunny-postcard',
    name: '万里阳光号海景明信片',
    category: 'emotional',
    iconName: 'Sparkles',
    description: '手绘的阳光号破浪前行风景明信片，带着阳光与海盐的清新气息。',
    vitalsBuff: { mood: 15 },
    roleAffinity: { luffy: 'liked' },
  },
  {
    key: 'remedy-kit',
    name: '随身急救草药包',
    category: 'practical',
    iconName: 'Coffee',
    description: '便携的航海急救包，里面装有止血草药与结实绷带，探险必备。',
    vitalsBuff: { energy: 15, mood: 10 },
    roleAffinity: { luffy: 'neutral' },
  },
]

export async function ensureGiftTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_received_gifts (
      id                  TEXT PRIMARY KEY,
      role_id             TEXT NOT NULL,
      gift_key            TEXT NOT NULL,
      gift_name           TEXT NOT NULL,
      category            TEXT NOT NULL,
      user_note           TEXT,
      companion_reaction  TEXT NOT NULL,
      vitals_buff_json    TEXT,
      created_at          INTEGER NOT NULL
    );
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_received_gifts_role_time
      ON companion_received_gifts(role_id, created_at DESC);
  `)
}

export async function listAvailableGifts(roleId = 'luffy'): Promise<CompanionGiftItem[]> {
  return PRESET_GIFTS.map((gift) => ({
    ...gift,
    roleAffinity: gift.roleAffinity ? { [roleId]: gift.roleAffinity[roleId] || 'liked' } : undefined,
  }))
}

export async function listReceivedGifts(roleId = 'luffy', limit = 50): Promise<CompanionGiftRecord[]> {
  await ensureGiftTable()
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

function getFallbackReaction(roleId: string, giftKey: string, protagonistName: string, userNote?: string): string {
  if (roleId === 'luffy') {
    if (giftKey === 'bone-meat') {
      return '哇啊啊啊！是大肉！大块带骨烤肉！太棒啦——！你怎么知道我正好肚子饿得咕咕叫了！我要开动啦——！嚼嚼嚼……超级好吃！你果然是最好的同伴！肉也分你一小口……不行，还是我全吃啦！嘻嘻嘻！'
    }
    if (giftKey === 'treasure-map') {
      return '喂喂喂！这难道是……藏宝图吗？！好厉害！上面画的小岛看起来好危险又好好玩！看这个骷髅标记，明天我们就向着这个岛全速前进！'
    }
    if (giftKey === 'warm-scarf') {
      return '哇！红色的围巾！虽然海上跑步的时候会有点热，不过系在脖子上当海贼披风超级帅气啊！谢谢你啦！'
    }
    return `哇！这是送给我的《${giftKey}》吗？！太棒了！谢谢你！无论收到什么我都超级开心，因为这可是同伴的心意啊！嘻嘻嘻！`
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

  const affinity = (giftDef.roleAffinity && giftDef.roleAffinity[roleId]) || 'liked'

  let pack: ReturnType<typeof loadRolePack> | null = null
  try {
    pack = loadRolePack(roleId)
  } catch {
    // 允许测试或无 Role Pack 时降级
  }
  const protagonistName = pack?.name || (roleId === 'luffy' ? '路飞' : '伙伴')
  const protagonistBrief = `${pack?.description || '热血、真诚、极度珍视同伴的海贼'}\n${pack?.voice || ''}`.trim()

  let reactionText = getFallbackReaction(roleId, giftKey, protagonistName, userNote)

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

  db.run(
    `INSERT INTO companion_received_gifts
     (id, role_id, gift_key, gift_name, category, user_note, companion_reaction, vitals_buff_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recordId,
      roleId,
      giftDef.key,
      giftDef.name,
      giftDef.category,
      userNote || null,
      reactionText,
      buffJson,
      now,
    ],
  )
  persist()

  // 2. 反应写入角色主会话留痕
  try {
    const mainSession = await ensureMainSessionForRole(roleId)
    if (mainSession) {
      const giftMessageContent = userNote
        ? `【送上了礼物 · ${giftDef.name}】“${userNote}”\n\n${reactionText}`
        : `【送上了礼物 · ${giftDef.name}】\n\n${reactionText}`
      await saveMessage(mainSession.id, {
        id: randomUUID(),
        role: 'assistant',
        content: giftMessageContent,
        timestamp: now,
      })
      log.info('Recorded gift reaction in main session', { roleId, sessionId: mainSession.id })
    }
  } catch (err) {
    log.warn('Failed to save gift reaction to main session', { roleId, error: String(err) })
  }

  // 3. 提升角色生命体征
  if (giftDef.vitalsBuff) {
    try {
      const world = await ensureWorldState(roleId)
      const newMood = Math.min(100, (world.mood ?? 65) + (giftDef.vitalsBuff.mood ?? 0))
      const newEnergy = Math.min(100, (world.energy ?? 70) + (giftDef.vitalsBuff.energy ?? 0))
      const updatedWorld = {
        ...world,
        mood: newMood,
        energy: newEnergy,
        situation: `${world.situation}（刚刚收到了心意礼物《${giftDef.name}》，心情大好！）`,
      }
      await store.setWorldState(roleId, updatedWorld)
      log.info('Buffed companion vitals after gift', { roleId, newMood, newEnergy })
    } catch (err) {
      log.warn('Failed to update companion vitals', { roleId, error: String(err) })
    }
  }

  // 4. 记录关系成长里程碑
  try {
    await tryRecordMilestone(roleId, 'gift_received', {
      roleDisplayName: protagonistName,
      now,
    })
  } catch (err) {
    log.warn('Failed to record gift milestone', { roleId, error: String(err) })
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

  // 5. 广播全窗口事件
  const eventPayload: CompanionGiftEvent = { roleId, gift: record }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('companion:gift-received', eventPayload)
      win.webContents.send('companion:timeline-updated', { roleId })
    }
  }

  return record
}
