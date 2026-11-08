/**
 * 突发生活意图与主动找聊引擎（Spontaneous Impulse & Proactive Conversation Outreach）
 *
 * 背景：角色如果只在用户发问或发朋友圈后才说话，在体验上仍是“被动响应”的工具感。
 * 真人伙伴会在自己体力充沛、社交渴望高涨或在做某件事时，忍不住像朋友一样发来一句即兴消息。
 * 设计意图：生命调度定时评估（Life Ticker），结合角色当下生命体征（socialNeed/energy/mood）
 * 及生活活动，在受控冷却（每日最多 2 次、冷却 3 小时、避开勿扰时段）下，自主生成第一人称突发搭话，
 * 并直接写入角色主会话，桌面同步轻提醒，用户点击即可无缝承接。
 * 关键约束：纯主会话写入；尊重勿扰时段与冷却保护，绝不高频轰炸；无 LLM 时具备生动角色保底。
 */

import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import type {
  LLMConfig,
  SpontaneousImpulseEvent,
  SpontaneousImpulseTopicKind,
  CompanionSpontaneousImpulseRecord,
} from '../../../../src/shared/types'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { compileSpontaneousImpulseRequest } from '../../prompts/registered-request'
import { getDatabase, persist } from '../../storage/database'
import * as settings from '../../storage/settings-store'
import { ensureMainSessionForRole, saveMessage } from '../../storage/session-store'
import { createLogger } from '../../utils/logger'
import { loadRolePack } from '../identity/loader'
import { ensureWorldState } from './world-state'
import {
  DEFAULT_QUIET_END_HOUR,
  DEFAULT_QUIET_START_HOUR,
  isInQuietHours,
  parseHourSetting,
  MOMENT_TIPS_MUTED_KEY,
  MOMENT_TIPS_QUIET_END_KEY,
  MOMENT_TIPS_QUIET_START_KEY,
} from './moment-tips'

const log = createLogger('SpontaneousImpulse')

export const SPONTANEOUS_IMPULSE_COOLDOWN_MS = 3 * 3600 * 1000 // 3 小时冷却
export const SPONTANEOUS_IMPULSE_DAILY_LIMIT = 2

export async function ensureImpulseTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_spontaneous_impulses (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      message_id   TEXT NOT NULL,
      impulse_text TEXT NOT NULL,
      topic_kind   TEXT NOT NULL,
      context_hint TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_impulses_role_time
      ON companion_spontaneous_impulses(role_id, created_at DESC)
  `)
}

export function decideSpontaneousImpulse(input: {
  muted: boolean
  localHour: number
  quietStartHour: number
  quietEndHour: number
  socialNeed: number
  energy: number
  lastImpulseAt: number | null
  impulsesToday: number
  now: number
}): { allow: boolean; reason: 'ok' | 'muted' | 'quiet-hours' | 'daily-limit' | 'cooldown' | 'low-need' } {
  if (input.muted) return { allow: false, reason: 'muted' }
  if (isInQuietHours(input.localHour, input.quietStartHour, input.quietEndHour)) {
    return { allow: false, reason: 'quiet-hours' }
  }
  if (input.impulsesToday >= SPONTANEOUS_IMPULSE_DAILY_LIMIT) {
    return { allow: false, reason: 'daily-limit' }
  }
  if (input.lastImpulseAt && input.now - input.lastImpulseAt < SPONTANEOUS_IMPULSE_COOLDOWN_MS) {
    return { allow: false, reason: 'cooldown' }
  }
  // 触发条件：社交渴望度高（>= 70），或者精力极高（>= 80）想找人分享
  if (input.socialNeed < 70 && input.energy < 80) {
    return { allow: false, reason: 'low-need' }
  }
  return { allow: true, reason: 'ok' }
}

export interface TriggerSpontaneousImpulseOptions {
  llmConfig?: LLMConfig
  force?: boolean
  mockResponse?: {
    impulseText: string
    contextHint: string
    toastTitle?: string
  }
}

export async function triggerSpontaneousImpulse(
  roleId: string,
  now = Date.now(),
  opts?: TriggerSpontaneousImpulseOptions,
): Promise<{ triggered: boolean; event?: SpontaneousImpulseEvent; reason?: string }> {
  await ensureImpulseTable()
  const db = await getDatabase()

  const mutedSetting = (await settings.getSetting(MOMENT_TIPS_MUTED_KEY)) || 'false'
  const muted = mutedSetting === 'true' || mutedSetting === '1'
  const quietStart = parseHourSetting(await settings.getSetting(MOMENT_TIPS_QUIET_START_KEY), DEFAULT_QUIET_START_HOUR)
  const quietEnd = parseHourSetting(await settings.getSetting(MOMENT_TIPS_QUIET_END_KEY), DEFAULT_QUIET_END_HOUR)

  const world = await ensureWorldState(roleId)

  // 统计当天已触发次数与最近一次时间
  const startOfDay = new Date(now).setHours(0, 0, 0, 0)
  const countStmt = db.prepare(
    'SELECT COUNT(*) as c FROM companion_spontaneous_impulses WHERE role_id = ? AND created_at >= ?',
  )
  countStmt.bind([roleId, startOfDay])
  let impulsesToday = 0
  try {
    if (countStmt.step()) impulsesToday = Number(countStmt.getAsObject().c) || 0
  } finally {
    countStmt.free()
  }

  const lastStmt = db.prepare(
    'SELECT created_at FROM companion_spontaneous_impulses WHERE role_id = ? ORDER BY created_at DESC LIMIT 1',
  )
  lastStmt.bind([roleId])
  let lastImpulseAt: number | null = null
  try {
    if (lastStmt.step()) lastImpulseAt = Number(lastStmt.getAsObject().created_at) || null
  } finally {
    lastStmt.free()
  }

  if (!opts?.force) {
    const decision = decideSpontaneousImpulse({
      muted,
      localHour: new Date(now).getHours(),
      quietStartHour: quietStart,
      quietEndHour: quietEnd,
      socialNeed: world.socialNeed,
      energy: world.energy,
      lastImpulseAt,
      impulsesToday,
      now,
    })
    if (!decision.allow) {
      return { triggered: false, reason: decision.reason }
    }
  }

  const pack = loadRolePack(roleId)
  const topicKind: SpontaneousImpulseTopicKind = world.socialNeed >= 85
    ? 'casual'
    : world.energy >= 85
    ? 'activity'
    : world.currentActivity?.includes('航行') || world.currentActivity?.includes('探险')
    ? 'adventure'
    : 'vitals'

  let generatedText: string | null = null
  let generatedHint = '突发表达意图'
  let toastTitle = `${pack.name} 找你聊天`

  if (opts?.mockResponse) {
    generatedText = opts.mockResponse.impulseText
    generatedHint = opts.mockResponse.contextHint
    if (opts.mockResponse.toastTitle) toastTitle = opts.mockResponse.toastTitle
  } else {
    const config = opts?.llmConfig ?? (await loadAuxLLMConfig())
    if (hasLLMAuthentication(config)) {
      try {
        const raw = await chatComplete({
          config: { ...config, maxTokens: 250, temperature: 0.8 },
          request: compileSpontaneousImpulseRequest({
            protagonistName: pack.name,
            protagonistBrief: `${pack.description}\n${pack.voice ?? ''}`.slice(0, 500),
            currentActivity: world.currentActivity,
            currentLocation: world.currentLocation || world.home || '甲板',
            vitalsSummary: `精力 ${world.energy}，心情 ${world.mood}，社交渴望 ${world.socialNeed}`,
            topicKind,
          }),
          caller: 'spontaneous-impulse',
        })
        const match = raw.match(/\{[\s\S]*\}/)
        if (match) {
          const json = JSON.parse(match[0]) as Record<string, unknown>
          if (json && typeof json.impulseText === 'string') {
            generatedText = json.impulseText.trim()
            if (typeof json.contextHint === 'string') generatedHint = json.contextHint.trim()
            if (typeof json.toastTitle === 'string') toastTitle = json.toastTitle.trim()
          }
        }
      } catch (err) {
        log.warn('Spontaneous impulse LLM generation failed, falling back to rule preset', { roleId, error: String(err) })
      }
    }
  }

  // 确定性规则保底
  if (!generatedText) {
    const isLuffy = roleId === 'luffy'
    if (isLuffy) {
      if (topicKind === 'activity') {
        generatedText = `喂！我刚在甲板上发现了一只超大的海鸥，你要不要来看看！`
        generatedHint = '甲板上的新奇发现'
      } else if (topicKind === 'vitals') {
        generatedText = `肚子好饿啊——不知道山治烤肉做好了没有！你今天吃了什么好吃的吗？`
        generatedHint = '肚子饿时的碎碎念'
      } else {
        generatedText = `喂！你在忙什么呢？今天海上的风吹得太舒服了，快来跟我聊聊！`
        generatedHint = '航海闲暇时的主动搭话'
      }
    } else {
      generatedText = `此刻有些闲暇，想起之前聊到的事情，你今天过得还顺利吗？`
      generatedHint = '日常随想搭话'
    }
  }

  // 1. 获取主角专属主会话并将消息直接保存为 assistant
  const session = await ensureMainSessionForRole(roleId)
  const messageId = randomUUID()
  await saveMessage(session.id, {
    id: messageId,
    role: 'assistant',
    content: generatedText,
    timestamp: now,
  })

  // 2. 存入数据库
  const recordId = randomUUID()
  db.run(
    `INSERT INTO companion_spontaneous_impulses
     (id, role_id, session_id, message_id, impulse_text, topic_kind, context_hint, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [recordId, roleId, session.id, messageId, generatedText, topicKind, generatedHint, now],
  )
  persist()

  // 3. 构造广播事件
  const event: SpontaneousImpulseEvent = {
    roleId,
    sessionId: session.id,
    messageId,
    impulseText: generatedText,
    topicKind,
    contextHint: generatedHint,
    toastMessage: `${pack.name}：${generatedText}`,
    timestamp: now,
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('companion:spontaneous-impulse', event)
    }
  }

  log.info('Spontaneous impulse triggered and delivered to main session', {
    roleId,
    sessionId: session.id,
    messageId,
    topicKind,
  })
  return { triggered: true, event }
}

export async function listSpontaneousImpulses(
  roleId: string,
  limit = 20,
): Promise<CompanionSpontaneousImpulseRecord[]> {
  await ensureImpulseTable()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT * FROM companion_spontaneous_impulses WHERE role_id = ? ORDER BY created_at DESC LIMIT ?',
  )
  stmt.bind([roleId, Math.max(1, Math.min(50, limit))])
  const list: CompanionSpontaneousImpulseRecord[] = []
  try {
    while (stmt.step()) {
      const row = stmt.getAsObject()
      list.push({
        id: row.id as string,
        roleId: row.role_id as string,
        sessionId: row.session_id as string,
        messageId: row.message_id as string,
        impulseText: row.impulse_text as string,
        topicKind: row.topic_kind as SpontaneousImpulseTopicKind,
        contextHint: row.context_hint as string,
        createdAt: row.created_at as number,
      })
    }
  } finally {
    stmt.free()
  }
  return list
}
