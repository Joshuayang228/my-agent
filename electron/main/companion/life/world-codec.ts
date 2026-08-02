/**
 * 世界状态编解码（无 IO；供 store / world-state 共用，避免循环依赖）
 */

import type { CompanionWorldState } from '../types'

const DEFAULT_TZ = 'Asia/Shanghai'

const DEFAULT_HOME: Record<string, string> = {
  lin: '城西小公寓',
  zhou: '热闹街区合租',
  xia: '靠窗的安静小屋',
}

export function defaultWorldState(roleId: string): CompanionWorldState {
  return {
    home: DEFAULT_HOME[roleId] || '日常住处',
    timezone: DEFAULT_TZ,
    situation: '',
    updatedAt: 0,
  }
}

export function parseWorldJson(raw: string | null | undefined): CompanionWorldState {
  if (!raw?.trim()) {
    return { home: '', timezone: DEFAULT_TZ, situation: '', updatedAt: 0 }
  }
  try {
    const obj = JSON.parse(raw) as Partial<CompanionWorldState>
    return {
      home: typeof obj.home === 'string' ? obj.home.trim().slice(0, 40) : '',
      timezone: typeof obj.timezone === 'string' && obj.timezone.trim()
        ? obj.timezone.trim().slice(0, 64)
        : DEFAULT_TZ,
      situation: typeof obj.situation === 'string' ? obj.situation.trim().slice(0, 80) : '',
      updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : 0,
    }
  } catch {
    return { home: '', timezone: DEFAULT_TZ, situation: '', updatedAt: 0 }
  }
}

export function serializeWorldState(world: CompanionWorldState): string {
  return JSON.stringify({
    home: (world.home || '').slice(0, 40),
    timezone: (world.timezone || DEFAULT_TZ).slice(0, 64),
    situation: (world.situation || '').slice(0, 80),
    updatedAt: world.updatedAt || 0,
  })
}

export function mergeWorldDefaults(
  roleId: string,
  current: CompanionWorldState,
): CompanionWorldState {
  const d = defaultWorldState(roleId)
  return {
    home: current.home || d.home,
    timezone: current.timezone || d.timezone,
    situation: current.situation,
    updatedAt: current.updatedAt,
  }
}

export function formatWorldSliceForPrompt(world: CompanionWorldState): string {
  const bits: string[] = []
  if (world.home) bits.push(`居所${world.home}`)
  if (world.timezone) bits.push(`时区${world.timezone}`)
  if (world.situation) bits.push(`近况${world.situation}`)
  return bits.join(' · ')
}
