/**
 * 日剧本生成器（M23-G1：LLM 优先 + 哈希回退）
 *
 * 背景：ensureDayScripts 缺页时需要 theme/slots；纯哈希可测但文案重复。
 * 意图：有 aux 配置时用 LLM 按角色分味生成；失败/无 key/解析坏 → 确定性哈希。
 * 约束：输出必须通过结构校验；Catch-up 细补默认不用 LLM（见 engine opts）。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { chatComplete } from '../../llm/index'
import { PROMPT_KEYS } from '../../prompts/keys'
import { createLogger } from '../../utils/logger'
import { loadRolePack } from '../identity/loader'
import {
  formatRoleProfileForPrompt,
  formatRoleWorldDefaultsForPrompt,
} from '../identity/profile'
import type { DayScriptPayload, DayScriptSlot } from '../types'
import { normalizeGrantAsset } from './grant-asset'

const log = createLogger('DayScriptGen')

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

/**
 * 故事待定角色的中性剧本池。
 *
 * 背景：小航当前只验收行为人格，不能由通用回退池反向写死住所、工位或常去地点。
 * 设计意图：保留 LifeEngine 所需的日内槽位，但所有活动只描述行为验收，不声明生活路线。
 * 关键约束：地点固定为“未设定”；人物故事确认前不得加入职业、住所、交通或店铺事实。
 */
const UNDECIDED_ACTIVITIES: ActivitySeed[] = [
  { activity: '确认今天最重要的一件事', mood: '清醒', location: '未设定', type: 'activity' },
  { activity: '整理当前思路', mood: '平静', location: '未设定', type: 'moment' },
  { activity: '完成一个可逆小步骤', mood: '专注', location: '未设定', type: 'activity' },
  { activity: '停下来检查方向', mood: '审慎', location: '未设定', type: 'moment' },
  { activity: '收束一个阻塞点', mood: '认真', location: '未设定', type: 'activity' },
  { activity: '记录今天确认的边界', mood: '稳定', location: '未设定', type: 'moment' },
  { activity: '做简短复盘', mood: '平和', location: '未设定', type: 'activity' },
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
  hang: {
    themes: ['行为人格验收日', '故事待定', '确认一个小步骤'],
    activities: UNDECIDED_ACTIVITIES,
  },
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

const SLOT_COUNT_MIN = 5
const SLOT_COUNT_MAX = 8
const TEXT_MAX = 40

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

/** 确定性日剧本（回退 / 单测 / Catch-up 细补） */
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

function clipText(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return fallback
  return t.slice(0, TEXT_MAX)
}

function normalizeMinute(n: number): number {
  if (n < 15) return 0
  if (n < 45) return 30
  return 0
}

/**
 * 解析并规范化 LLM/任意 JSON → DayScriptPayload；失败返回 null。
 */
export function parseDayScriptPayload(
  raw: unknown,
  date: string,
): DayScriptPayload | null {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      obj = JSON.parse(match[0])
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const theme = clipText(rec.theme, '')
  if (!theme) return null
  if (!Array.isArray(rec.slots)) return null
  if (rec.slots.length < SLOT_COUNT_MIN || rec.slots.length > SLOT_COUNT_MAX) return null

  const slots: DayScriptSlot[] = []
  for (const item of rec.slots) {
    if (!item || typeof item !== 'object') return null
    const s = item as Record<string, unknown>
    const hour = Number(s.hour)
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
    const minuteRaw = Number(s.minute ?? 0)
    const minute = Number.isFinite(minuteRaw) ? normalizeMinute(minuteRaw) : 0
    const type = s.type === 'moment' ? 'moment' : s.type === 'activity' ? 'activity' : null
    if (!type) return null
    const activity = clipText(s.activity, '')
    const mood = clipText(s.mood, '平静')
    const location = clipText(s.location, '某处')
    if (!activity) return null
    const grantAsset = normalizeGrantAsset(s.grantAsset) ?? undefined
    slots.push({
      hour,
      minute,
      activity,
      mood,
      location,
      type,
      ...(grantAsset ? { grantAsset } : {}),
    })
  }

  slots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
  // 至少一条 moment，便于朋友圈有截面
  if (!slots.some((s) => s.type === 'moment')) {
    slots[Math.min(3, slots.length - 1)].type = 'moment'
  }
  // 每天最多一件 grant，防 LLM 刷柜
  let grantSeen = false
  for (const slot of slots) {
    if (!slot.grantAsset) continue
    if (grantSeen) delete slot.grantAsset
    else grantSeen = true
  }

  return { date, theme, slots }
}

function buildLlmPrompt(input: {
  roleName: string
  roleId: string
  date: string
  voiceHint: string
  characterHint: string
}): string {
  return `你是生活世界编剧。为数字伙伴「${input.roleName}」(id=${input.roleId}) 生成 ${input.date} 的一日剧本。

人设语气参考（勿写成对白，只影响活动气质）：
${input.voiceHint || '（无）'}

人物与默认世界参考（只用于保持生活连续性，不要逐条复述）：
${input.characterHint || '（无）'}

要求：
1. 日常可信、有分味，不要夸张奇幻；地点用短词（家/工位/路上/咖啡馆/附近街道等）
2. slots ${SLOT_COUNT_MIN}～${SLOT_COUNT_MAX} 条，按时间升序；hour 0-23，minute 0 或 30
3. type 只能是 "moment"（适合发动态）或 "activity"（推进日程）；至少 2 条 moment
4. theme / activity / mood / location 各不超过 ${TEXT_MAX} 字
5. 可选：整天最多 1 个 slot 带 grantAsset（购得/获赠的小物），形如 {"kind":"wardrobe","name":"短名","payload":{"color":"…"}}；日常勿滥发
6. 只输出 JSON：{"theme":"...","slots":[{"hour":8,"minute":0,"activity":"...","mood":"...","location":"...","type":"activity"}]}`
}

/** 尝试 LLM；失败返回 null（由调用方回退哈希） */
export async function generateDayScriptViaLlm(
  roleId: string,
  date: string,
  llmConfig: LLMConfig,
  opts?: { universeId?: string },
): Promise<DayScriptPayload | null> {
  if (!llmConfig.apiKey?.trim()) return null
  try {
    const pack = loadRolePack(roleId, opts?.universeId ?? 'default')
    const voiceHint = (pack.voice || pack.summary || pack.protected).slice(0, 280)
    const profileHint = pack.profile ? formatRoleProfileForPrompt(pack.profile).slice(0, 750) : ''
    const worldHint = pack.worldDefaults
      ? formatRoleWorldDefaultsForPrompt(pack.worldDefaults).slice(0, 750)
      : ''
    const characterHint = [profileHint, worldHint].filter(Boolean).join('\n')
    const raw = await chatComplete({
      config: {
        ...llmConfig,
        maxTokens: llmConfig.maxTokens ?? 900,
        temperature: llmConfig.temperature ?? 0.8,
      },
      messages: [{
        role: 'user',
        content: buildLlmPrompt({
          roleName: pack.name,
          roleId,
          date,
          voiceHint,
          characterHint,
        }),
      }],
      caller: 'day-script',
      promptAssetKeys: [PROMPT_KEYS.companionDayScript],
    })
    const parsed = parseDayScriptPayload(raw, date)
    if (!parsed) {
      log.warn('Day script LLM parse failed', { roleId, date })
      return null
    }
    return parsed
  } catch (err) {
    log.warn('Day script LLM failed', { roleId, date, error: String(err) })
    return null
  }
}

export interface ResolveDayScriptOpts {
  preferLlm?: boolean
  llmConfig?: LLMConfig
  universeId?: string
}

/**
 * 解析一日剧本：preferLlm + 有 key → LLM；否则或失败 → 哈希。
 */
export async function resolveDayScript(
  roleId: string,
  date: string,
  opts?: ResolveDayScriptOpts,
): Promise<{ payload: DayScriptPayload; source: 'llm' | 'hash' }> {
  if (opts?.preferLlm && opts.llmConfig?.apiKey?.trim()) {
    const llm = await generateDayScriptViaLlm(roleId, date, opts.llmConfig, {
      universeId: opts.universeId,
    })
    if (llm) return { payload: llm, source: 'llm' }
  }
  return { payload: generateDayScript(roleId, date), source: 'hash' }
}

export const __test = {
  parseDayScriptPayload,
  buildLlmPrompt,
  SLOT_COUNT_MIN,
  SLOT_COUNT_MAX,
}
