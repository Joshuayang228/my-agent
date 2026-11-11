import { randomUUID } from 'node:crypto'
/**
 * 宿主环境作息感知与虚实关怀锚点核心服务（M31 主动在场 / 现实锚点）
 *
 * 背景：角色不仅生活在自己的航海世界中，更应当敏锐感知用户的现实劳逸状态；
 * 当检测到用户连续高强度久坐（专注敲代码超 2 小时）或深夜 1-4 点仍未入眠时，
 * 角色以真诚活泼的第一人称口吻向用户发出富有同伴温情的休息或劝睡关怀。
 *
 * 设计意图：
 * 1. 严格遵守安全与隐私红线（零键盘按键监听、零屏幕截图、零无关进程扫描）；
 * 2. 仅利用 Electron 原生 powerMonitor.getSystemIdleTime() 与会话交互活跃时间差进行非侵入式判定；
 * 3. 关怀消息直接写入角色主会话（sessionKind: 'main'），实现虚实共振的真切在场陪伴；
 * 4. 具备严格的冷却与防打扰机制（久坐关怀 3 小时冷却，深夜劝睡 6 小时冷却）；
 * 5. 将宿主昨天的作息标签反哺次日日剧本（collectDayScriptLifeContext）。
 *
 * 关键约束：
 * - 纯主进程服务，按 roleId 严格隔离；
 * - 无论网络状况，均具备高质量人设规则兜底。
 */

import { powerMonitor } from 'electron'
import type { HostCareEvent, HostCareKind, HostPresenceStatus } from '../../../../src/shared/types'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { compileHostCareRequest } from '../../prompts/registered-request'
import { loadRolePack } from '../identity/loader'
import * as sessionStore from '../../storage/session-store'
import { isActiveRole } from '../../storage/settings-store'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'

const log = createLogger('HostPresence')

// 运行态内存记录（进程生命周期内维护）
let sessionStartAt = Date.now()
let lastActiveAt = Date.now()
const lastCareTriggeredAt: Record<string, number> = {}
let yesterdayNightWorkRecorded = false

/** 获取系统空闲秒数（带安全防护） */
function getSystemIdleSeconds(): number {
  try {
    if (powerMonitor && typeof powerMonitor.getSystemIdleTime === 'function') {
      return powerMonitor.getSystemIdleTime()
    }
  } catch {
    // 测试环境或无电源管理
  }
  return 0
}

/** 记录一次用户活跃交互（发消息、点击等） */
export function recordUserActivity(now = Date.now(), forceNewSession = false): void {
  const idleSec = getSystemIdleSeconds()
  // 如果空闲超过 5 分钟或强制新会话，重置连续专注计时起点
  if (forceNewSession || idleSec > 300 || now < sessionStartAt) {
    sessionStartAt = now
  }
  lastActiveAt = now
}

/** 供单测或跨天重置运行态内存 */
export function resetHostPresenceStateForTesting(startTime = Date.now()): void {
  sessionStartAt = startTime
  lastActiveAt = startTime
  for (const key of Object.keys(lastCareTriggeredAt)) {
    delete lastCareTriggeredAt[key]
  }
  yesterdayNightWorkRecorded = false
}

/** 查询当前宿主活跃度与作息状态 */
export function getHostPresenceStatus(now = Date.now()): HostPresenceStatus {
  const idleSeconds = getSystemIdleSeconds()
  const d = new Date(now)
  const hour = d.getHours()
  const isLateNight = hour >= 23 || hour < 5

  // 若空闲超过 5 分钟，当前专注中断
  const continuousActiveMinutes =
    idleSeconds > 300 ? 0 : Math.max(0, Math.round((now - sessionStartAt) / (60 * 1000)))

  return {
    continuousActiveMinutes,
    idleSeconds,
    isLateNight,
    isFocusSession: continuousActiveMinutes >= 60,
  }
}

/** 规则兜底：依据角色与关怀类型提供温暖鲜活的第一人称同伴关切 */
function getFallbackCareMessage(
  roleId: string,
  kind: HostCareKind,
  continuousMinutes: number,
): { careMessage: string; suggestedAction: string } {
  const isLuffy = roleId === 'luffy' || roleId.includes('luffy')

  if (kind === 'fatigue_break') {
    return {
      careMessage: isLuffy
        ? `喂！你从刚才开始就一直坐在那一动不动的，键盘都要敲出火星啦！已经忙了 ${continuousMinutes} 分钟了，快站起来伸个大大的懒腰，去吃点好吃的补充体力！`
        : `你已经连续专注工作了 ${continuousMinutes} 分钟，稍微站起来活动活动肩膀，眺望一下窗外吧。`,
      suggestedAction: isLuffy ? '站起来大跳两下伸伸懒腰，去倒杯温水！' : '离开工位走动 3 分钟，深呼吸放松肩膀',
    }
  }

  if (kind === 'late_night_sleep') {
    return {
      careMessage: isLuffy
        ? '哈欠……都这～么晚了你怎么还在忙啊！再不睡觉明天可就没力气去大海上冒险了，赶紧把电脑合上钻进被窝，明天我再陪你！'
        : '夜已经很深了，身体比待办事项更重要。今天就先停在这里，好好休息吧。',
      suggestedAction: isLuffy ? '立刻合上屏幕，钻进温暖被窝呼呼大睡！' : '保存手头工作，准备洗漱入睡',
    }
  }

  // welcome_back
  return {
    careMessage: isLuffy
      ? '哦！你可算回工位啦！刚才去哪探险了？快坐下歇歇，今天也要元气满满地开工啊！'
      : '欢迎回来，休息得还好吗？随时准备好接续刚才的任务。',
    suggestedAction: isLuffy ? '喝一大口水，精神饱满地出发！' : '整理手头思路，轻松进入状态',
  }
}

/**
 * 检查并触发宿主作息关怀
 */
export async function checkAndTriggerHostCare(
  roleId: string,
  now = Date.now(),
  forceKind?: HostCareKind,
): Promise<HostCareEvent | null> {
  const status = getHostPresenceStatus(now)

  let targetKind: HostCareKind | null = forceKind ?? null

  if (!targetKind) {
    // 1. 深夜熬夜劝睡（优先级高）：本地处于 23:30 ~ 05:00，且用户近 15 分钟内仍在活跃
    const lastLateNight = lastCareTriggeredAt['late_night_sleep'] ?? 0
    const d = new Date(now)
    const isDeepNight = (d.getHours() === 23 && d.getMinutes() >= 30) || (d.getHours() >= 0 && d.getHours() < 5)
    if (isDeepNight && status.idleSeconds < 300 && now - lastLateNight >= 6 * 3600 * 1000) {
      targetKind = 'late_night_sleep'
    } else {
      // 2. 连续专注疲劳关切：持续工作 >= 120 分钟且 3 小时未提醒过
      const lastFatigue = lastCareTriggeredAt['fatigue_break'] ?? 0
      if (status.continuousActiveMinutes >= 120 && now - lastFatigue >= 3 * 3600 * 1000) {
        targetKind = 'fatigue_break'
      }
    }
  }

  if (!targetKind) return null

  log.info('Triggering host care', { roleId, targetKind, continuousMinutes: status.continuousActiveMinutes })

  // 尝试使用辅助模型生成第一人称关切
  let careMessage = ''
  let suggestedAction = ''

  try {
    const llmConfig = await loadAuxLLMConfig()
    if (hasLLMAuthentication(llmConfig)) {
      const pack = await loadRolePack(roleId)
      const request = compileHostCareRequest({
        protagonistName: pack?.name || roleId,
        protagonistBrief: pack?.summary || pack?.description || '热血温暖的航海同伴',
        kind: targetKind,
        continuousActiveMinutes: status.continuousActiveMinutes,
      })
      const rawText = await chatComplete({ config: llmConfig, request, caller: 'host-care' })
      const parsed = JSON.parse(rawText.trim().replace(/^```json/i, '').replace(/```$/i, ''))
      if (typeof parsed?.careMessage === 'string' && parsed.careMessage.trim()) {
        careMessage = parsed.careMessage.trim()
        suggestedAction = typeof parsed?.suggestedAction === 'string' ? parsed.suggestedAction.trim() : ''
      }
    }
  } catch (err) {
    log.warn('Host care LLM generation failed, using fallback', { roleId, targetKind, error: String(err) })
  }

  if (!careMessage) {
    const fb = getFallbackCareMessage(roleId, targetKind, status.continuousActiveMinutes)
    careMessage = fb.careMessage
    suggestedAction = fb.suggestedAction
  }

  if (!(await isActiveRole(roleId))) return null

  // 记录触发时间与熬夜标志
  lastCareTriggeredAt[targetKind] = now
  if (targetKind === 'late_night_sleep') {
    yesterdayNightWorkRecorded = true
  }

  const titles: Record<HostCareKind, string> = {
    fatigue_break: '休息一下吧！',
    late_night_sleep: '快去睡啦！',
    welcome_back: '欢迎回来！',
  }

  const careEvent: HostCareEvent = {
    kind: targetKind,
    title: titles[targetKind],
    message: careMessage,
    suggestedAction,
    continuousActiveMinutes: status.continuousActiveMinutes,
    triggeredAt: now,
  }

  // 写入主角专属主会话，实现会话留痕
  try {
    const mainSession = await sessionStore.ensureMainSessionForRole(roleId)
    await sessionStore.saveMessage(mainSession.id, {
      id: randomUUID(),
      role: 'assistant',
      content: careMessage,
      timestamp: now,
    })
  } catch (err) {
    log.warn('Failed to append host care message to main session', { roleId, error: String(err) })
  }

  await recordCompanionEventAndNotify({
    roleId,
    type: 'host_care_triggered',
    sourceType: 'host_presence',
    sourceId: `${roleId}:${careEvent.kind}:${now}`,
    idempotencyKey: `host-care:${roleId}:${careEvent.kind}:${now}`,
    occurredAt: now,
    payload: { roleId, care: careEvent },
    notification: {
      kind: 'host-care-triggered',
      dedupeKey: `host-care:${roleId}:${careEvent.kind}:${now}`,
      payload: { roleId, care: careEvent },
    },
  })

  return careEvent
}

/** 供次日日剧本吸收的宿主生活线索 */
export async function getRecentHostCareContext(): Promise<string | null> {
  if (yesterdayNightWorkRecorded) {
    return '用户昨日有深夜熬夜工作的记录（忙碌至凌晨），请在今日晨起日程或问候中温和关心，生活安排适度偏向安静温和。'
  }
  return null
}

/** 跨天重置熬夜标志（供测试或新一天重置） */
export function resetHostCareDayFlags(): void {
  yesterdayNightWorkRecorded = false
}
