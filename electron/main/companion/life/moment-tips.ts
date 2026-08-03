/**
 * 新 Moment 应用内轻提示（M31-G1）
 *
 * 背景：L0 静默推进用户无感；需要可选 L2「有新动态」气泡，且必须可静音。
 * 意图：tick 新发布后广播一句 toast；受静音开关与最短间隔约束。
 * 约束：不发系统桌面通知；不编造假动态；内容必须来自已投影 Moment；失败静默。
 */

import { BrowserWindow } from 'electron'
import * as settings from '../../storage/settings-store'
import * as identity from '../identity/loader'
import { listMomentsForRole } from './moments'

export const MOMENT_TIPS_MUTED_KEY = 'companionMomentTipsMuted' as const
export const MOMENT_TIPS_LAST_AT_KEY = 'companionMomentTipsLastAt' as const
/** 最短提示间隔，防通知风暴（完整勿扰预算见 M31-G2） */
export const MOMENT_TIP_MIN_INTERVAL_MS = 15 * 60 * 1000

export interface MomentTipDecision {
  allow: boolean
  reason: 'ok' | 'muted' | 'no-publish' | 'cooldown' | 'no-moment'
}

/**
 * 纯函数：是否应发轻提示。
 */
export function decideMomentTip(input: {
  muted: boolean
  published: number
  lastAt: number
  now: number
  hasMoment: boolean
  minIntervalMs?: number
}): MomentTipDecision {
  if (input.muted) return { allow: false, reason: 'muted' }
  if (input.published <= 0) return { allow: false, reason: 'no-publish' }
  if (!input.hasMoment) return { allow: false, reason: 'no-moment' }
  const gap = input.minIntervalMs ?? MOMENT_TIP_MIN_INTERVAL_MS
  if (input.lastAt > 0 && input.now - input.lastAt < gap) {
    return { allow: false, reason: 'cooldown' }
  }
  return { allow: true, reason: 'ok' }
}

export function formatMomentTipToast(input: {
  roleName: string
  preview: string
  published: number
}): string {
  const name = input.roleName.trim() || '伙伴'
  const preview = input.preview.replace(/\s+/g, ' ').trim().slice(0, 40)
  if (input.published === 1 && preview) {
    return `${name}有新动态：${preview}`
  }
  if (preview) {
    return `${name}有 ${input.published} 条新动态，最近：${preview}`
  }
  return `${name}有新动态，可打开朋友圈看看`
}

function broadcast(payload: {
  roleId: string
  toast: string
  published: number
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('companion:moment-tip', payload)
  }
}

/**
 * tick 发布后调用：条件满足则广播应用内轻提示。
 * 返回是否已广播。
 */
export async function maybeNotifyNewMoments(
  roleId: string,
  published: number,
  now = Date.now(),
): Promise<{ notified: boolean; reason: MomentTipDecision['reason'] }> {
  const id = roleId.trim()
  if (!id || published <= 0) {
    return { notified: false, reason: 'no-publish' }
  }

  const mutedRaw = (await settings.getSetting(MOMENT_TIPS_MUTED_KEY)).trim().toLowerCase()
  const muted = mutedRaw === '1' || mutedRaw === 'true' || mutedRaw === 'yes'
  const lastAt = Number(await settings.getSetting(MOMENT_TIPS_LAST_AT_KEY)) || 0

  const moments = await listMomentsForRole(id, { limit: 1 })
  const latest = moments[0]
  const decision = decideMomentTip({
    muted,
    published,
    lastAt,
    now,
    hasMoment: Boolean(latest?.text?.trim()),
  })
  if (!decision.allow) {
    return { notified: false, reason: decision.reason }
  }

  let roleName = id
  try {
    const universeId = (await settings.getSetting('universeId')) || 'default'
    roleName = identity.loadRolePack(id, universeId).name
  } catch {
    /* id 即可 */
  }

  const toast = formatMomentTipToast({
    roleName,
    preview: latest!.text,
    published,
  })
  await settings.setSetting(MOMENT_TIPS_LAST_AT_KEY, String(now))
  broadcast({ roleId: id, toast, published })
  return { notified: true, reason: 'ok' }
}

export async function isMomentTipsMuted(): Promise<boolean> {
  const raw = (await settings.getSetting(MOMENT_TIPS_MUTED_KEY)).trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export async function setMomentTipsMuted(muted: boolean): Promise<void> {
  await settings.setSetting(MOMENT_TIPS_MUTED_KEY, muted ? 'true' : 'false')
}

export const __test = { decideMomentTip, formatMomentTipToast }
