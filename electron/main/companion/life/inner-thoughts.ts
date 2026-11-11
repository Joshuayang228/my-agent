/**
 * 私密内心独白与航海日记引擎（Inner Thoughts & Private Journal Stream）
 *
 * 背景：角色活人感不能只有对外公开发布的朋友圈和与用户的即时对话。
 * 真实的人拥有私密的内心世界、独处时的真实独白与航海笔记。
 *
 * 设计意图：
 * 1. 角色在安静独处、夜间沉思或经历重要事件后自主生成第一人称私密日记；
 * 2. 存储在独立的 companion_inner_thoughts 表中，支持收藏与作为对话契机回引；
 * 3. 初始为路飞播种具有温度与羁绊的 starter 日记，保证首次打开即具备充沛生命感。
 *
 * 关键约束：
 * - 纯中文提示词与结构化输出；
 * - 严格遵循统一生产模型签发体系（RegisteredModelRequest）；
 * - 失败平滑回退，不阻断生命推进。
 */

import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import * as settings from '../../storage/settings-store'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { compileInnerThoughtRequest } from '../../prompts/registered-request'
import { loadRolePack } from '../identity/loader'
import { ensureWorldState } from './world-state'
import type { CompanionInnerThoughtRecord, LLMConfig } from '../../../../src/shared/types'

const log = createLogger('InnerThoughts')

export const INNER_THOUGHT_COOLDOWN_MS = 6 * 3600 * 1000 // 6 小时冷却
export const INNER_THOUGHT_DAILY_LIMIT = 2

interface InnerThoughtDbRow {
  id: string
  role_id: string
  title: string
  content: string
  mood: string | null
  weather: string | null
  location: string | null
  activity: string | null
  is_favorite: number
  created_at: number
  thought_type?: string | null
  epiphany?: string | null
}

function rowToRecord(row: InnerThoughtDbRow): CompanionInnerThoughtRecord {
  return {
    id: row.id,
    roleId: row.role_id,
    title: row.title,
    content: row.content,
    mood: row.mood || undefined,
    weather: row.weather || undefined,
    location: row.location || undefined,
    activity: row.activity || undefined,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
    thoughtType: (row.thought_type as 'general' | 'nightly_reflection') || 'general',
    epiphany: row.epiphany || undefined,
  }
}

const STARTER_THOUGHTS_LUFFY: Array<Omit<CompanionInnerThoughtRecord, 'id' | 'createdAt'> & { offsetMs: number }> = [
  {
    roleId: 'luffy',
    title: '关于红发香克斯借给我的草帽',
    content: '今天站在船头看海，海风把草帽吹得晃晃悠悠的。突然想起香克斯把帽子扣在我头上那天，他说“总有一天你要成为出色的海贼，再把它还给我”。香克斯，我现在有了最棒的伙伴，还有了万里阳光号！我一定会成为海贼王的，绝对！',
    mood: '热血而平静',
    weather: '晴朗微风',
    location: '万里阳光号·特等席',
    activity: '迎风擦拭草帽',
    isFavorite: true,
    thoughtType: 'general',
    offsetMs: 3 * 86400000,
  },
  {
    roleId: 'luffy',
    title: '空岛黄金钟响彻云霄的那一晚',
    content: '山治烤了好多大块肉，大家围着篝火跳舞，狼群也在嗷嗷叫！躺在云朵沙滩上看着天上的星星，黄金钟的声音好像还在耳朵边回荡。喂，大叔，你在下面听到了吗？黄金乡就在天上啊！冒险真是太棒了！嘻嘻嘻！',
    mood: '心满意足想吃肉',
    weather: '璀璨星空',
    location: '白白海·云之沙滩',
    activity: '躺在云朵上数星星',
    isFavorite: true,
    thoughtType: 'general',
    offsetMs: 2 * 86400000,
  },
  {
    roleId: 'luffy',
    title: '昨晚跟你在甲板上聊起海贼王',
    content: '昨天晚上跟你坐在甲板上吹风，说到我们一路走过来的事情。虽然你平时总在忙各种事，但每次跟你说话，就觉得像多了一个很懂我的同伴一样。喂，下一次去新的岛屿，你也要继续看着我们啊！',
    mood: '由衷开心与信赖',
    weather: '温和海夜',
    location: '万里阳光号·草坪甲板',
    activity: '晃着腿发呆',
    isFavorite: true,
    thoughtType: 'nightly_reflection',
    epiphany: '只要有像你这样懂我的伙伴在身边，无论去往多么危险的海域，我都充满勇气！',
    offsetMs: 21 * 3600000,
  },
]

export async function ensureInnerThoughtTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_inner_thoughts (
      id          TEXT PRIMARY KEY,
      role_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      mood        TEXT,
      weather     TEXT,
      location    TEXT,
      activity    TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at  INTEGER NOT NULL,
      thought_type TEXT NOT NULL DEFAULT 'general',
      epiphany    TEXT
    )
  `)
  try {
    db.run(`ALTER TABLE companion_inner_thoughts ADD COLUMN thought_type TEXT NOT NULL DEFAULT 'general'`)
  } catch {
    // 列已存在
  }
  try {
    db.run(`ALTER TABLE companion_inner_thoughts ADD COLUMN epiphany TEXT`)
  } catch {
    // 列已存在
  }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_inner_thoughts_role_time
      ON companion_inner_thoughts(role_id, created_at DESC)
  `)

  // 播种路飞初始日记
  const countStmt = db.prepare('SELECT COUNT(*) AS count FROM companion_inner_thoughts WHERE role_id = ?')
  countStmt.bind(['luffy'])
  let count = 0
  if (countStmt.step()) {
    count = (countStmt.getAsObject() as { count: number }).count
  }
  countStmt.free()

  if (count === 0) {
    const now = Date.now()
    for (const item of STARTER_THOUGHTS_LUFFY) {
      const id = `thought-starter-${randomUUID().slice(0, 8)}`
      db.run(
        `INSERT INTO companion_inner_thoughts
         (id, role_id, title, content, mood, weather, location, activity, is_favorite, created_at, thought_type, epiphany)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.roleId,
          item.title,
          item.content,
          item.mood || null,
          item.weather || null,
          item.location || null,
          item.activity || null,
          item.isFavorite ? 1 : 0,
          now - item.offsetMs,
          item.thoughtType || 'general',
          item.epiphany || null,
        ],
      )
    }
    persist()
    log.info('Seeded starter inner thoughts for luffy')
  }
}

export async function listInnerThoughts(roleId: string, limit = 50): Promise<CompanionInnerThoughtRecord[]> {
  await ensureInnerThoughtTable()
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_inner_thoughts
    WHERE role_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)
  stmt.bind([roleId, limit])
  const records: CompanionInnerThoughtRecord[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as InnerThoughtDbRow
    records.push(rowToRecord(row))
  }
  stmt.free()
  return records
}

export async function toggleInnerThoughtFavorite(id: string): Promise<boolean> {
  await ensureInnerThoughtTable()
  const db = await getDatabase()
  db.run(
    `UPDATE companion_inner_thoughts
     SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END
     WHERE id = ?`,
    [id],
  )
  persist()

  const stmt = db.prepare('SELECT is_favorite FROM companion_inner_thoughts WHERE id = ?')
  stmt.bind([id])
  let isFavorite = false
  if (stmt.step()) {
    const row = stmt.getAsObject() as { is_favorite: number }
    isFavorite = row.is_favorite === 1
  }
  stmt.free()
  return isFavorite
}

export async function deleteInnerThought(id: string): Promise<boolean> {
  await ensureInnerThoughtTable()
  const db = await getDatabase()
  db.run('DELETE FROM companion_inner_thoughts WHERE id = ?', [id])
  persist()
  return true
}

export function decideInnerThought(input: {
  lastThoughtAt: number | null
  thoughtsToday: number
  now: number
  localHour: number
}): { allow: boolean; reason: 'ok' | 'daily-limit' | 'cooldown' | 'non-reflective-time' } {
  if (input.thoughtsToday >= INNER_THOUGHT_DAILY_LIMIT) {
    return { allow: false, reason: 'daily-limit' }
  }
  if (input.lastThoughtAt !== null && input.now - input.lastThoughtAt < INNER_THOUGHT_COOLDOWN_MS) {
    return { allow: false, reason: 'cooldown' }
  }
  // 适合沉思独白的时间段：晚间/夜间 (20:00 - 02:00) 或清晨 (05:00 - 09:00)
  const isNight = input.localHour >= 20 || input.localHour < 2
  const isMorning = input.localHour >= 5 && input.localHour <= 9
  if (!isNight && !isMorning) {
    return { allow: false, reason: 'non-reflective-time' }
  }
  return { allow: true, reason: 'ok' }
}

export async function triggerInnerThought(
  roleId: string,
  triggerReason = '夜深人静时的日常内心反思',
  now = Date.now(),
  opts?: {
    llmConfig?: LLMConfig
    mockResponse?: {
      title: string
      content: string
      mood?: string
      weather?: string
      location?: string
      activity?: string
    }
  },
): Promise<CompanionInnerThoughtRecord | null> {
  await ensureInnerThoughtTable()
  const db = await getDatabase()

  let pack: ReturnType<typeof loadRolePack> | null = null
  try {
    pack = loadRolePack(roleId)
  } catch (err) {
    log.warn('Failed to load role pack for inner thought', { roleId, error: String(err) })
    return null
  }

  const world = await ensureWorldState(roleId)
  const activity = world.currentActivity || '独自看着夜空发呆'
  const location = world.currentLocation || world.home || '万里阳光号·特等席'

  let title = '海风吹拂的夜晚'
  let content = ''
  let mood = '平静安宁'
  let weather = '晴朗星空'

  if (opts?.mockResponse) {
    title = opts.mockResponse.title
    content = opts.mockResponse.content
    if (opts.mockResponse.mood) mood = opts.mockResponse.mood
    if (opts.mockResponse.weather) weather = opts.mockResponse.weather
  } else {
    const config = opts?.llmConfig ?? (await loadAuxLLMConfig())
    if (hasLLMAuthentication(config)) {
      try {
        const raw = await chatComplete({
          config: { ...config, maxTokens: 400, temperature: 0.8 },
          request: compileInnerThoughtRequest({
            protagonistName: pack.name,
            protagonistBrief: `${pack.description}\n${pack.voice ?? ''}`.slice(0, 500),
            currentActivity: activity,
            currentLocation: location,
            weather,
            moodSummary: `心情 ${world.mood}，精力 ${world.energy}`,
            triggerReason,
          }),
          caller: 'inner-thought',
        })
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) {
          const json = JSON.parse(match[0]) as Record<string, unknown>
          if (json && typeof json.content === 'string' && json.content.trim()) {
            content = json.content.trim()
            if (typeof json.title === 'string' && json.title.trim()) title = json.title.trim()
            if (typeof json.mood === 'string' && json.mood.trim()) mood = json.mood.trim()
            if (typeof json.weather === 'string' && json.weather.trim()) weather = json.weather.trim()
          }
        }
      } catch (err) {
        log.warn('Inner thought LLM generation failed, using rule fallback', { roleId, error: String(err) })
      }
    }
  }

  // 确定性人设保底
  if (!content) {
    if (roleId === 'luffy') {
      title = '特等席吹来的海风'
      content = '今天的天空特别开阔，万里阳光号在海上跑得轻快极了。山治刚刚烤了肉，我趁他不注意偷吃了两大块，嘻嘻！坐在狮子头上看着前面一眼望不到头的大海，不知道下一个岛屿会遇到什么好玩的大冒险呢！'
      mood = '兴奋与期待'
      weather = '星光灿烂微凉'
    } else {
      title = '独处时的随想'
      content = '夜深了，四周渐渐安静下来。回顾这几天的种种经历，心底泛起一阵温暖的踏实感。明天又会是崭新的一天。'
      mood = '安宁'
      weather = '夜色温和'
    }
  }

  const id = `thought-${randomUUID()}`
  const activeRoleId = (await settings.getSetting('activeRoleId')).trim()
  if (activeRoleId && activeRoleId !== roleId) {
    log.info('Skip inner thought persistence for inactive role', { roleId })
    return null
  }
  db.run(
    `INSERT INTO companion_inner_thoughts
     (id, role_id, title, content, mood, weather, location, activity, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, roleId, title, content, mood, weather, location, activity, 0, now],
  )
  persist()

  const record: CompanionInnerThoughtRecord = {
    id,
    roleId,
    title,
    content,
    mood,
    weather,
    location,
    activity,
    isFavorite: false,
    createdAt: now,
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('companion:inner-thought-created', record)
    }
  }

  log.info('Inner thought created and broadcasted', { roleId, id, title })
  return record
}

export async function checkAndGenerateInnerThought(roleId: string, now = Date.now()): Promise<void> {
  await ensureInnerThoughtTable()
  const db = await getDatabase()

  // 1. 查询最近一条独白时间
  const lastStmt = db.prepare(`
    SELECT created_at FROM companion_inner_thoughts
    WHERE role_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `)
  lastStmt.bind([roleId])
  let lastThoughtAt: number | null = null
  if (lastStmt.step()) {
    const row = lastStmt.getAsObject() as { created_at: number }
    lastThoughtAt = row.created_at
  }
  lastStmt.free()

  // 2. 统计今日生成条数
  const startOfDay = new Date(now).setHours(0, 0, 0, 0)
  const todayStmt = db.prepare(`
    SELECT COUNT(*) AS count FROM companion_inner_thoughts
    WHERE role_id = ? AND created_at >= ?
  `)
  todayStmt.bind([roleId, startOfDay])
  let thoughtsToday = 0
  if (todayStmt.step()) {
    const row = todayStmt.getAsObject() as { count: number }
    thoughtsToday = row.count
  }
  todayStmt.free()

  const localHour = new Date(now).getHours()
  const decision = decideInnerThought({ lastThoughtAt, thoughtsToday, now, localHour })

  if (decision.allow) {
    log.info('Life ticker triggering automatic inner thought', { roleId, localHour, thoughtsToday })
    await triggerInnerThought(roleId, '生活时钟驱动的日常独白反思', now)
  }
}
