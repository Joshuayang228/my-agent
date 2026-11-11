/**
 * 角色深夜反思与心灵领悟引擎（Nightly Reflection & Heartfelt Epiphany）
 *
 * 背景：角色活人感与情感深度需要宁静独处时刻的自我反思；
 * 在深夜安静时刻（22:00～04:00），角色回溯今日与用户的互动聊天、生活琐事与羁绊经历，
 * 自主产生一篇第一人称私密深夜独白，并提炼出一句深刻的心灵感悟（epiphany）；
 * 该感悟同步写入长期记忆（feedback“我们之间”），让角色的情感与认知真实伴随用户相处而成长。
 *
 * 设计意图：
 * 1. 结合生活推进（Life Ticker）与深夜时段（或强制触发），每日最多产生 1 篇深夜反思（20小时冷却）；
 * 2. 结合今日生活事件与近期用户对话线索，由受控小模型配方（compileNightlyReflectionRequest）生成；
 * 3. 结果保存至 companion_inner_thoughts（thought_type='nightly_reflection'），并落入 memories 长期记忆；
 * 4. 广播 companion:nightly-reflection-created，通知前端生活面日记板块高光展示。
 *
 * 关键约束：
 * - 纯主进程内部服务，SQLite 参数化查询；
 * - 模型调用符合 AST 门禁与 RegisteredModelRequest 配方签发；
 * - 无网络或无 LLM Key 时平滑使用人设预设保底，不阻断生命推进。
 */

import { randomUUID } from 'crypto'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { compileNightlyReflectionRequest } from '../../prompts/registered-request'
import { isActiveRole } from '../../storage/settings-store'
import { loadRolePack } from '../identity/loader'
import { ensureWorldState } from './world-state'
import { listEvents } from './store'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import { listRecentUserMessagesForRole } from '../../storage/session-store'
import { addMemory } from '../../storage/memory-store'
import { recordAssetUsage } from '../../utils/asset-usage'
import { ensureInnerThoughtTable } from './inner-thoughts'
import type { CompanionInnerThoughtRecord, LLMConfig } from '../../../../src/shared/types'

const log = createLogger('NightlyReflection')

export const NIGHTLY_REFLECTION_COOLDOWN_MS = 20 * 3600 * 1000 // 20 小时冷却，确保一天最多一次

export interface NightlyReflectionResult {
  title: string
  content: string
  epiphany: string
  mood: string
  weather: string
  location: string
}

function parseNightlyReflectionJson(raw: string): NightlyReflectionResult | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const obj = JSON.parse(match[0]) as Partial<NightlyReflectionResult>
    if (!obj.title || !obj.content || !obj.epiphany) return null
    return {
      title: String(obj.title).trim().slice(0, 30),
      content: String(obj.content).trim().slice(0, 500),
      epiphany: String(obj.epiphany).trim().slice(0, 100),
      mood: obj.mood ? String(obj.mood).trim().slice(0, 10) : '静谧深沉',
      weather: obj.weather ? String(obj.weather).trim().slice(0, 15) : '夜朗星稀微风',
      location: obj.location ? String(obj.location).trim().slice(0, 20) : '万里阳光号·特等席',
    }
  } catch {
    return null
  }
}

function getFallbackReflection(roleId: string): NightlyReflectionResult {
  if (roleId === 'luffy') {
    return {
      title: '星光洒满甲板的深夜',
      content:
        '夜深了，甲板上只有风声和海浪声。靠在船舷边看着漫天的星星，想起今天我们聊过的那些话。每一天的航行都有新的风景，但最开心的还是有你一直在看着我们的冒险。就算前面有再大的风暴，有大家在身边，我也一点都不害怕！',
      epiphany: '无论前方海域有多么汹涌，只要有彼此信任的同伴在身边，每一步都是最好的冒险！',
      mood: '温暖平静',
      weather: '夜朗星稀微风',
      location: '万里阳光号·特等席',
    }
  }
  return {
    title: '深夜时分的内心沉淀',
    content:
      '夜深人静，周围的一切都安静下来。回顾今天的一幕幕对话与经历，心里感到格外踏实。人与人之间的信任往往就是在这些微小却真诚的相处中慢慢扎根的。明天也要元气满满地前行。',
    epiphany: '真诚的陪伴就像夜空中的灯塔，让人在航行中永远不会迷失方向。',
    mood: '恬淡安详',
    weather: '静谧星空',
    location: '安静的窗台边',
  }
}

export async function checkAndTriggerNightlyReflection(
  roleId: string,
  now = Date.now(),
  opts?: { force?: boolean },
): Promise<CompanionInnerThoughtRecord | null> {
  if (!(await isActiveRole(roleId))) return null
  const hour = new Date(now).getHours()
  const isNightTime = hour >= 22 || hour < 4

  if (!opts?.force && !isNightTime) {
    return null
  }

  await ensureInnerThoughtTable()
  const db = await getDatabase()

  // 检查 20 小时内是否已经生成过深夜反思
  const checkStmt = db.prepare(
    `SELECT created_at FROM companion_inner_thoughts
     WHERE role_id = ? AND thought_type = 'nightly_reflection'
     ORDER BY created_at DESC LIMIT 1`,
  )
  checkStmt.bind([roleId])
  let lastCreatedAt: number | null = null
  if (checkStmt.step()) {
    lastCreatedAt = (checkStmt.getAsObject() as { created_at: number }).created_at
  }
  checkStmt.free()

  if (!opts?.force && lastCreatedAt !== null && now - lastCreatedAt < NIGHTLY_REFLECTION_COOLDOWN_MS) {
    return null
  }

  return triggerNightlyReflection(roleId, now, opts)
}

export async function triggerNightlyReflection(
  roleId: string,
  now = Date.now(),
  opts?: { force?: boolean },
): Promise<CompanionInnerThoughtRecord | null> {
  if (!(await isActiveRole(roleId))) return null
  await ensureInnerThoughtTable()
  const db = await getDatabase()

  const pack = loadRolePack(roleId)
  const world = await ensureWorldState(roleId)

  // 抓取近 24 小时用户发言线索
  const recentUserMessages = await listRecentUserMessagesForRole(roleId, now - 24 * 3600 * 1000, 10).catch(() => [])
  const recentUserChatSummary = recentUserMessages.length
    ? `用户今天跟你说过这些话题：“${recentUserMessages.slice(-3).map((m) => m.slice(0, 40)).join('”；“')}”`
    : '今天和用户一起度过了宁静祥和的时光'

  // 抓取今天的生活事件
  const todayEvents = await listEvents(roleId, { status: 'published', limit: 3 }).catch(() => [])
  const todayEventsSummary = todayEvents.length
    ? todayEvents.map((e) => `${(e as any).title || (e as any).activity || ''}`).filter(Boolean).join('、')
    : '在大海上顺风航行，度过充实的一天'

  let result: NightlyReflectionResult | null = null

  const auxConfig = await loadAuxLLMConfig()
  const canUseLLM = hasLLMAuthentication(auxConfig)

  if (canUseLLM) {
    try {
      const request = compileNightlyReflectionRequest({
        protagonistName: pack.name,
        protagonistBrief: pack.summary || pack.description,
        currentLocation: world.currentLocation || '万里阳光号·特等席',
        currentActivity: world.currentActivity || '深夜坐在船头看星星放空',
        weather: (world as any).weather || '夜朗星稀微风',
        todayEventsSummary,
        recentUserChatSummary,
      })

      const raw = await chatComplete({
        config: auxConfig,
        request,
        temperature: 0.7,
        maxTokens: 800,
        caller: 'nightly-reflection',
      })
      result = parseNightlyReflectionJson(raw)
    } catch (err) {
      log.warn('Nightly reflection LLM call failed, fallback used', { roleId, error: String(err) })
    }
  }

  if (!result) {
    result = getFallbackReflection(roleId)
  }

  const id = `thought-nightly-${randomUUID()}`

  db.run(
    `INSERT INTO companion_inner_thoughts
     (id, role_id, title, content, mood, weather, location, activity, is_favorite, created_at, thought_type, epiphany)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      roleId,
      result.title,
      result.content,
      result.mood,
      result.weather,
      result.location,
      '深夜独坐沉淀',
      1, // 深夜反思默认自动星标收藏
      now,
      'nightly_reflection',
      result.epiphany,
    ],
  )
  persist()

  // 同步将心灵感悟写入长期记忆的 feedback（我们之间）分桶
  try {
    await addMemory('feedback', `[深夜感悟] ${result.epiphany}`, { roleId })
    log.info('Nightly reflection epiphany added to long-term memory feedback bucket', { roleId, epiphany: result.epiphany })
  } catch (memErr) {
    log.warn('Failed to add epiphany to memory store', { roleId, error: String(memErr) })
  }

  const record: CompanionInnerThoughtRecord = {
    id,
    roleId,
    title: result.title,
    content: result.content,
    mood: result.mood,
    weather: result.weather,
    location: result.location,
    activity: '深夜独坐沉淀',
    isFavorite: true,
    createdAt: now,
    thoughtType: 'nightly_reflection',
    epiphany: result.epiphany,
  }

  await recordCompanionEventAndNotify({
    roleId,
    type: 'nightly_reflection_created',
    sourceType: 'nightly_reflection',
    sourceId: id,
    idempotencyKey: `nightly-reflection-created:${id}`,
    occurredAt: now,
    payload: record as unknown as Record<string, unknown>,
    notification: [
      { kind: 'nightly-reflection-created', dedupeKey: `nightly-reflection-created:${id}`, payload: record as unknown as Record<string, unknown> },
      { kind: 'inner-thought-created', dedupeKey: `nightly-inner-thought-created:${id}`, payload: record as unknown as Record<string, unknown> },
    ],
  })

  void recordAssetUsage({
    assetKey: 'companion:policy:nightly-reflection',
    relation: 'used',
    usageKind: 'memory-operation',
    status: 'success',
    metadata: { roleId, thoughtId: id, hasEpiphany: Boolean(result.epiphany) },
  })

  log.info('Nightly reflection created successfully', { roleId, id, title: result.title })
  return record
}
