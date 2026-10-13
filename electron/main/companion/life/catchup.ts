import { buildCatchupLlmPrompt } from '../../prompts/companion-behaviors'
/**
 * Catch-up（W3 / M23-G3）
 *
 * 背景：完整切换回曾暂停角色时，细补最近 ≤7×24h 窗口内的剧本/事件；更早只写概况摘要。
 * 意图：runCatchup(roleId, pausedAt, now)；概况优先 LLM，失败回退规则模板。
 * 约束：时区用本地日历日；不在打开瞬间伪造「正在发生」；辅任务正文来自 prompts/companion-behaviors，服务只提供事实和回退。
 */

import { SUMMARY_MAX_CHARS } from '../../prompts/behavior-limits'
import type { LLMConfig } from '../../../../src/shared/types'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { chatComplete } from '../../llm/index'
import { createLogger } from '../../utils/logger'
import { loadRolePack } from '../identity/loader'
import { compileCatchupRequest } from '../../prompts/registered-request'
import { eachLocalDateInclusive, toLocalDateString } from './dates'
import { ensureDayScripts } from './engine'
import { publishAndProjectRange } from './moments'
import * as store from './store'
import { ensureWorldState } from './world-state'

const log = createLogger('Catchup')

/** 细补时间窗长度（毫秒）— 与 tech-spec 冻结公式一致 */
export const CATCHUP_FINE_MS = 7 * 86_400_000

const SUMMARY_PREFIX = '【生活追赶摘要】'

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
  if (!hasLLMAuthentication(llmConfig)) return null
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
      request: compileCatchupRequest(pack, {
          roleName: pack.name,
          roleId,
          from,
          gapEnd,
          until,
          gapDays,
          home: world.home,
          voiceHint,
        }),
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
  if (preferLlm && llmConfig && hasLLMAuthentication(llmConfig)) {
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
