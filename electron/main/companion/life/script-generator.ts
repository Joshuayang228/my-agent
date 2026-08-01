/**
 * 日剧本确定性生成器（W2 mock；日后可换 LLM）
 *
 * 背景：ensureDayScripts 缺页时需可测、无网可跑的剧本。
 * 意图：由 roleId + date 哈希产出稳定 theme/slots。
 * 约束：不调 LLM；输出符合 DayScriptPayload。
 */

import type { DayScriptPayload, DayScriptSlot } from '../types'

const THEMES = [
  '寻常工作日',
  '轻快的一天',
  '略忙碌',
  '散步与咖啡',
  '宅家充电',
  '见朋友',
  '灵感小爆发',
]

const ACTIVITIES: Array<Omit<DayScriptSlot, 'hour' | 'minute'>> = [
  { activity: '起床洗漱', mood: '迷糊', location: '家', type: 'activity' },
  { activity: '早餐边刷消息', mood: '平静', location: '家', type: 'moment' },
  { activity: '通勤/开工', mood: '专注', location: '路上/工位', type: 'activity' },
  { activity: '午饭散步', mood: '放松', location: '附近街道', type: 'moment' },
  { activity: '下午推进一件事', mood: '认真', location: '工位', type: 'activity' },
  { activity: '傍晚发条短动态', mood: '俏皮', location: '咖啡馆', type: 'moment' },
  { activity: '晚饭后放空', mood: '困倦', location: '家', type: 'activity' },
]

function hashSeed(roleId: string, date: string): number {
  const s = `${roleId}:${date}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性日剧本（可单测冻结） */
export function generateDayScript(roleId: string, date: string): DayScriptPayload {
  const seed = hashSeed(roleId, date)
  const theme = THEMES[seed % THEMES.length]
  const slotHours = [8, 9, 11, 13, 16, 19, 21]
  const slots: DayScriptSlot[] = slotHours.map((hour, i) => {
    const base = ACTIVITIES[(seed + i) % ACTIVITIES.length]
    return {
      hour,
      minute: (seed >> (i * 3)) % 4 === 0 ? 30 : 0,
      activity: base.activity,
      mood: base.mood,
      location: base.location,
      type: base.type,
    }
  })
  return { date, theme, slots }
}
