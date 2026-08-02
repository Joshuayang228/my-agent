/**
 * Catch-up（W3 / M23-G3）
 *
 * 背景：完整切换回曾暂停角色时，细补最近 ≤7×24h 窗口内的剧本/事件；更早只写概况摘要。
 * 意图：runCatchup(roleId, pausedAt, now)；概况优先 LLM，失败回退规则模板。
 * 约束：时区用本地日历日；不在打开瞬间伪造「正在发生」；辅任务 Prompt 留在本文件，不进 prompt-builder。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { chatComplete } from '../../llm/index'
import { createLogger } from '../../utils/logger'
import { loadRolePack } from '../identity/loader'
import { eachLocalDateInclusive, toLocalDateString } from './dates'
import { ensureDayScripts } from './engine'
import { publishAndProjectRange } from './moments'
import * as store from './store'
import { ensureWorldState } from './world-state'

const log = createLogger('Catchup')

/** 细补时间窗长度（毫秒）— 与 tech-spec 冻结公式一致 */
export const CATCHUP_FINE_MS = 7 * 86_400_000

const SUMMARY_PREFIX = '【生活追赶摘要】'
const SUMMARY_MAX_CHARS = 280

export function computeFineStart(pausedAt: number, now: number): number {
  return Math.max(pausedAt, now - CATCHUP_FINE_MS)
}

/** 规则模板概况（无 key / LLM 失败时回退） */
export function buildCatchupSummary(
  roleId: string,
  pausedAt: number,
  fineStart: number,
  now: number,
): string {
  const from = toLocalDateString(pausedAt)
  const gapEnd = toLocalDateString(fineStart)
  const until = toLocalDateString(now)
  const gapDays = eachLocalDateInclusive(from, gapEnd).length
  return (
    `${SUMMARY_PREFIX}角色 ${roleId} 自 ${from} 起暂停；` +
    `${from}～${gapEnd} 约 ${gapDays} 个日历日以概况带过（未逐日生成）。` +
    `已细补 ${gapEnd}～${until} 近窗生活。现在是 ${until}。`
  )
}

function buildCatchupLlmPrompt(input: {
  roleName: string
  roleId: string
  from: string
  gapEnd: string
  until: string
  gapDays: number
  home: string
  voiceHint: string
}): string {
  return `你是生活世界旁白编辑。角色「${input.roleName}」(id=${input.roleId}) 曾暂停一段时间，需要一条「期间概况」给对话系统用。

事实锚点（不得编造具体行程细节）：
- 暂停起：${input.from}
- 概况带过：${input.from}～${input.gapEnd}（约 ${input.gapDays} 个日历日，未逐日生成）
- 近窗已细补：${input.gapEnd}～${input.until}
- 居所参考：${input.home || '日常住处'}

人设语气参考（勿写成对白）：
${input.voiceHint || '（无）'}

硬性要求：
1. 只输出一段中文概况（可含一句氛围），不要 JSON、不要列表、不要标题
2. 总长不超过 ${SUMMARY_MAX_CHARS} 字；必须体现「中间一段以概况带过、近几天已接上」
3. 禁止伪造「此刻正在发生」的具体约会/对话；不要写精确钟点行程
4. 不要抄写 PROTECTED 长文或发明新身份`
}

/** 规范化 LLM 正文；不合格返回 null */
export function normalizeCatchupSummaryText(raw: string): string | null {
  let t = raw.trim()
  // 去掉常见包裹
  t = t.replace(/^```[\s\S]*?```$/g, '').trim()
  t = t.replace(/^["「]|["」]$/g, '').trim()
  if (!t) return null
  // 拒绝明显 JSON / 列表堆砌
  if (t.startsWith('{') || t.startsWith('[')) return null
  if ((t.match(/\n-/g) || []).length >= 3) return null
  if (t.length < 12) return null
  // 去掉模型可能自带的前缀再统一加
  if (t.startsWith(SUMMARY_PREFIX)) {
    t = t.slice(SUMMARY_PREFIX.length).trim()
  }
  t = t.slice(0, SUMMARY_MAX_CHARS)
  return `${SUMMARY_PREFIX}${t}`
}

export async function generateCatchupSummaryViaLlm(
  roleId: string,
  pausedAt: number,
  fineStart: number,
  now: number,
  llmConfig: LLMConfig,
  opts?: { universeId?: string },
): Promise<string | null> {
  if (!llmConfig.apiKey?.trim()) return null
  try {
    const pack = loadRolePack(roleId, opts?.universeId ?? 'default')
    const world = await ensureWorldState(roleId)
    const from = toLocalDateString(pausedAt)
    const gapEnd = toLocalDateString(fineStart)
    const until = toLocalDateString(now)
    const gapDays = eachLocalDateInclusive(from, gapEnd).length
    const voiceHint = (pack.voice || pack.summary || '').slice(0, 200)
    const raw = await chatComplete({
      config: {
        ...llmConfig,
        maxTokens: llmConfig.maxTokens ?? 400,
        temperature: llmConfig.temperature ?? 0.7,
      },
      messages: [{
        role: 'user',
        content: buildCatchupLlmPrompt({
          roleName: pack.name,
          roleId,
          from,
          gapEnd,
          until,
          gapDays,
          home: world.home,
          voiceHint,
        }),
      }],
      caller: 'catchup-summary',
    })
    const normalized = normalizeCatchupSummaryText(raw)
    if (!normalized) {
      log.warn('Catch-up LLM summary rejected by normalize', { roleId })
      return null
    }
    return normalized
  } catch (err) {
    log.warn('Catch-up LLM summary failed', { roleId, error: String(err) })
    return null
  }
}

export async function resolveCatchupSummary(
  roleId: string,
  pausedAt: number,
  fineStart: number,
  now: number,
  opts?: { preferLlm?: boolean; llmConfig?: LLMConfig; universeId?: string },
): Promise<{ summary: string; source: 'llm' | 'template' }> {
  const preferLlm = opts?.preferLlm !== false
  let llmConfig = opts?.llmConfig
  if (preferLlm && !llmConfig) {
    try {
      llmConfig = await loadAuxLLMConfig()
    } catch {
      llmConfig = undefined
    }
  }
  if (preferLlm && llmConfig?.apiKey?.trim()) {
    const llm = await generateCatchupSummaryViaLlm(
      roleId,
      pausedAt,
      fineStart,
      now,
      llmConfig,
      { universeId: opts?.universeId },
    )
    if (llm) return { summary: llm, source: 'llm' }
  }
  return {
    summary: buildCatchupSummary(roleId, pausedAt, fineStart, now),
    source: 'template',
  }
}

/**
 * 执行 Catch-up：摘要（若空洞 > 细窗）→ ensure 细窗剧本 → 发布并投影 moments → 清除 pause。
 */
export async function runCatchup(
  roleId: string,
  pausedAt: number,
  now: number,
  opts?: { preferLlmSummary?: boolean; llmConfig?: LLMConfig; universeId?: string },
): Promise<{ fineDays: number; summaryUpdated: boolean; published: number; summarySource?: 'llm' | 'template' }> {
  const fineStart = computeFineStart(pausedAt, now)
  let summaryUpdated = false
  let summarySource: 'llm' | 'template' | undefined

  if (pausedAt < fineStart) {
    const resolved = await resolveCatchupSummary(roleId, pausedAt, fineStart, now, {
      preferLlm: opts?.preferLlmSummary !== false,
      llmConfig: opts?.llmConfig,
      universeId: opts?.universeId,
    })
    await store.setCatchupSummary(roleId, resolved.summary)
    summaryUpdated = true
    summarySource = resolved.source
  }

  const fromDate = toLocalDateString(fineStart)
  const toDate = toLocalDateString(now)
  // 细补剧本仍默认哈希（不连打多日 LLM）
  await ensureDayScripts(roleId, fromDate, toDate)
  const fineDays = eachLocalDateInclusive(fromDate, toDate).length

  const published = await publishAndProjectRange(roleId, fineStart, now)
  await store.clearPausedAt(roleId)
  await store.touchLastTick(roleId, now)

  log.info('Catch-up done', {
    roleId,
    fineDays,
    summaryUpdated,
    summarySource,
    published,
    pausedAt,
    now,
  })
  return { fineDays, summaryUpdated, published, summarySource }
}

export const __test = {
  buildCatchupLlmPrompt,
  normalizeCatchupSummaryText,
  SUMMARY_PREFIX,
  SUMMARY_MAX_CHARS,
}
