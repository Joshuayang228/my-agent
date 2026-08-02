/**
 * 日剧本确定性生成器（W2 mock；日后可换 LLM）
 *
 * 背景：ensureDayScripts 缺页时需可测、无网可跑的剧本。
 * 意图：由 roleId + date 哈希产出稳定 theme/slots；主角各有活动池分味。
 * 约束：不调 LLM；输出符合 DayScriptPayload。
 */

import type { DayScriptPayload, DayScriptSlot } from '../types'

type ActivitySeed = Omit<DayScriptSlot, 'hour' | 'minute'>

const DEFAULT_THEMES = [
  '寻常工作日',
  '轻快的一天',
  '略忙碌',
  '散步与咖啡',
  '宅家充电',
  '见朋友',
  '灵感小爆发',
]

const DEFAULT_ACTIVITIES: ActivitySeed[] = [
  { activity: '起床洗漱', mood: '迷糊', location: '家', type: 'activity' },
  { activity: '早餐边刷消息', mood: '平静', location: '家', type: 'moment' },
  { activity: '通勤/开工', mood: '专注', location: '路上/工位', type: 'activity' },
  { activity: '午饭散步', mood: '放松', location: '附近街道', type: 'moment' },
  { activity: '下午推进一件事', mood: '认真', location: '工位', type: 'activity' },
  { activity: '傍晚发条短动态', mood: '俏皮', location: '咖啡馆', type: 'moment' },
  { activity: '晚饭后放空', mood: '困倦', location: '家', type: 'activity' },
]

/** 小林：务实收束型日常 */
const LIN_ACTIVITIES: ActivitySeed[] = [
  { activity: '起床后列今日三件事', mood: '清醒', location: '家', type: 'activity' },
  { activity: '早餐边看待办', mood: '平静', location: '家', type: 'moment' },
  { activity: '通勤听一段播客', mood: '专注', location: '路上', type: 'activity' },
  { activity: '午饭后快走一圈', mood: '放松', location: '附近街道', type: 'moment' },
  { activity: '下午把一件事收尾', mood: '认真', location: '工位', type: 'activity' },
  { activity: '傍晚整理笔记发短动态', mood: '沉稳', location: '咖啡馆', type: 'moment' },
  { activity: '晚饭后复盘今天', mood: '平和', location: '家', type: 'activity' },
]

/** 小周：外向点火型日常 */
const ZHOU_ACTIVITIES: ActivitySeed[] = [
  { activity: '起床就想约人', mood: '兴奋', location: '家', type: 'moment' },
  { activity: '早餐边刷灵感备忘', mood: '雀跃', location: '家', type: 'moment' },
  { activity: '路上给朋友甩三个点子', mood: '轻快', location: '路上', type: 'activity' },
  { activity: '午饭约人吃路边摊', mood: '开心', location: '附近街道', type: 'moment' },
  { activity: '下午头脑风暴半小时', mood: '来劲', location: '工位', type: 'activity' },
  { activity: '傍晚咖啡馆拍张窗景', mood: '俏皮', location: '咖啡馆', type: 'moment' },
  { activity: '晚饭后还想出门走走', mood: '坐不住', location: '附近街道', type: 'activity' },
]

/** 小夏：安静观察型日常 */
const XIA_ACTIVITIES: ActivitySeed[] = [
  { activity: '起床开窗看一会天色', mood: '安静', location: '家', type: 'moment' },
  { activity: '早餐慢慢吃完再碰手机', mood: '松弛', location: '家', type: 'activity' },
  { activity: '通勤戴耳机不说话', mood: '内收', location: '路上', type: 'activity' },
  { activity: '午饭后独自坐公园椅', mood: '平和', location: '附近街道', type: 'moment' },
  { activity: '下午把一句关键话写清楚', mood: '专注', location: '工位', type: 'activity' },
  { activity: '傍晚咖啡馆看人来人往', mood: '观察', location: '咖啡馆', type: 'moment' },
  { activity: '晚饭后关灯听雨或静坐', mood: '困倦', location: '家', type: 'activity' },
]

const ROLE_POOL: Record<string, { themes: string[]; activities: ActivitySeed[] }> = {
  lin: {
    themes: ['稳稳推进', '把一件事做完', '留白与复盘', '咖啡馆整理思绪', ...DEFAULT_THEMES],
    activities: LIN_ACTIVITIES,
  },
  zhou: {
    themes: ['点子满天飞', '约人出门', '灵感小爆发', '轻快的一天', ...DEFAULT_THEMES],
    activities: ZHOU_ACTIVITIES,
  },
  xia: {
    themes: ['安静的一天', '观察与留白', '宅家充电', '散步与咖啡', ...DEFAULT_THEMES],
    activities: XIA_ACTIVITIES,
  },
}

function hashSeed(roleId: string, date: string): number {
  const s = `${roleId}:${date}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function poolFor(roleId: string): { themes: string[]; activities: ActivitySeed[] } {
  return ROLE_POOL[roleId] ?? { themes: DEFAULT_THEMES, activities: DEFAULT_ACTIVITIES }
}

/** 确定性日剧本（可单测冻结） */
export function generateDayScript(roleId: string, date: string): DayScriptPayload {
  const seed = hashSeed(roleId, date)
  const { themes, activities } = poolFor(roleId)
  const theme = themes[seed % themes.length]
  const slotHours = [8, 9, 11, 13, 16, 19, 21]
  const slots: DayScriptSlot[] = slotHours.map((hour, i) => {
    const base = activities[(seed + i) % activities.length]
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
