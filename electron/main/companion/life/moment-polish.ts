/**
 * Moment 文案润色（M24-G2）
 *
 * 背景：规则拼接同源但干；华丽文案若脱离 event 会造双真相。
 * 意图：在已有 event 事实上可选 LLM 润色；失败/无 key → formatMomentText。
 * 约束：必须绑定 event；禁止发明新地点/行程；辅任务 Prompt 留本文件。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { chatComplete } from '../../llm/index'
import { createLogger } from '../../utils/logger'
import { loadRolePack } from '../identity/loader'
import type { CompanionEvent } from '../types'
import { formatMomentText } from './moment-format'

const log = createLogger('MomentPolish')

export const MOMENT_TEXT_MAX = 80

const LOCATION_HINTS = [
  '家', '工位', '路上', '咖啡馆', '附近街道', '公园', '合租', '公寓', '宿舍',
]

function buildPolishPrompt(input: {
  roleName: string
  activity: string
  mood: string
  location: string
  outfit?: string
  book?: string
  ruleText: string
  voiceHint: string
}): string {
  return `你是朋友圈短动态编辑。根据已发生事件写一句短动态（不是日记长文）。

角色：${input.roleName}
事实（不得增删行程）：
- 活动：${input.activity}
- 心情：${input.mood || '（无）'}
- 地点：${input.location || '（无）'}
- 着装：${input.outfit || '（无）'}
- 在读：${input.book || '（无）'}
规则底稿：${input.ruleText}

人设语气参考（勿写成对白）：
${input.voiceHint || '（无）'}

硬性要求：
1. 只输出一句中文动态，不要 JSON、不要引号包裹、不要话题标签堆砌
2. 总长不超过 ${MOMENT_TEXT_MAX} 字；必须能看出上述活动或地点
3. 禁止发明新地点、新约会、新人物；禁止「正在打字」类元叙述
4. 可略带情绪，但别写成小作文`
}

/**
 * 校验润色结果仍锚定事实；不合格返回 null。
 */
export function validatePolishedMomentText(
  polished: string,
  facts: { activity: string; location: string; ruleText: string },
): string | null {
  let t = polished.trim()
  t = t.replace(/^["「『]|["」』]$/g, '').trim()
  if (!t || t.length < 4) return null
  if (t.startsWith('{') || t.startsWith('[')) return null
  if (t.length > MOMENT_TEXT_MAX) t = t.slice(0, MOMENT_TEXT_MAX)

  const activity = facts.activity.trim()
  const location = facts.location.trim()
  const hasActivity = activity.length >= 2 && t.includes(activity.slice(0, Math.min(4, activity.length)))
  const hasLocation = location.length >= 2 && t.includes(location.slice(0, Math.min(2, location.length)))
  // 与底稿有一点字符重叠也算锚定
  const overlap = [...facts.ruleText].filter((ch) => t.includes(ch)).length
  if (!hasActivity && !hasLocation && overlap < 3) return null

  // 禁止引入底稿/事实里没有的已知地点词
  for (const hint of LOCATION_HINTS) {
    if (t.includes(hint) && !facts.ruleText.includes(hint) && !location.includes(hint) && !activity.includes(hint)) {
      return null
    }
  }
  return t
}

export async function polishMomentTextViaLlm(
  event: CompanionEvent,
  opts: {
    llmConfig: LLMConfig
    outfitName?: string
    bookName?: string
    universeId?: string
  },
): Promise<string | null> {
  if (!opts.llmConfig.apiKey?.trim()) return null
  if (event.status !== 'published') return null

  const activity = String(event.payload.activity ?? event.type)
  const mood = String(event.payload.mood ?? '')
  const location = String(event.payload.location ?? '')
  const refs = { outfitName: opts.outfitName, bookName: opts.bookName }
  const ruleText = formatMomentText(event, refs)

  try {
    const pack = loadRolePack(event.roleId, opts.universeId ?? 'default')
    const voiceHint = (pack.voice || pack.summary || '').slice(0, 160)
    const raw = await chatComplete({
      config: {
        ...opts.llmConfig,
        maxTokens: opts.llmConfig.maxTokens ?? 120,
        temperature: opts.llmConfig.temperature ?? 0.75,
      },
      messages: [{
        role: 'user',
        content: buildPolishPrompt({
          roleName: pack.name,
          activity,
          mood,
          location,
          outfit: opts.outfitName,
          book: opts.bookName,
          ruleText,
          voiceHint,
        }),
      }],
      caller: 'moment-polish',
    })
    const ok = validatePolishedMomentText(raw, { activity, location, ruleText })
    if (!ok) {
      log.warn('Moment polish rejected by validate', { eventId: event.id, roleId: event.roleId })
      return null
    }
    return ok
  } catch (err) {
    log.warn('Moment polish LLM failed', { eventId: event.id, error: String(err) })
    return null
  }
}

/**
 * 解析最终文案：preferLlm → 润色；否则/失败 → 规则底稿。
 */
export async function resolveMomentText(
  event: CompanionEvent,
  opts?: {
    preferLlm?: boolean
    llmConfig?: LLMConfig
    outfitName?: string
    bookName?: string
    universeId?: string
  },
): Promise<{ text: string; source: 'llm' | 'rule' }> {
  const refs = { outfitName: opts?.outfitName, bookName: opts?.bookName }
  const ruleText = formatMomentText(event, refs)
  if (opts?.preferLlm && opts.llmConfig?.apiKey?.trim()) {
    const polished = await polishMomentTextViaLlm(event, {
      llmConfig: opts.llmConfig,
      outfitName: opts.outfitName,
      bookName: opts.bookName,
      universeId: opts.universeId,
    })
    if (polished) return { text: polished, source: 'llm' }
  }
  return { text: ruleText, source: 'rule' }
}

export const __test = {
  buildPolishPrompt,
  validatePolishedMomentText,
  LOCATION_HINTS,
}
