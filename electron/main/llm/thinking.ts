/**
 * Thinking / reasoning 开关与能力缓存。
 *
 * 背景：DeepSeek V4 等默认开启 thinking，reasoning 与 content 共用 max_tokens；
 *       辅助调用（title/profile）若 max_tokens 偏小会只吐 reasoning、content 为空。
 * 意图：提供启发式 + Playground 探测缓存，辅助路径可稳定关闭 thinking。
 * 对照：Alice settings 里 deepseek/moonshot 的 `extraParams: { thinking: { type: "disabled" } }`。
 */

import type { LLMConfig } from '../../../src/shared/types'
import { PROVIDER_ASSET_KEYS } from './provider-asset-keys'
import * as settings from '../storage/settings-store'

export type ThinkingDisableSupport = 'supported' | 'unsupported' | 'unknown'

export interface ThinkingCapabilityEntry {
  thinkingDisable: ThinkingDisableSupport
  probedAt?: number
  note?: string
}

export function normalizeBaseUrl(baseUrl: string): string {
  return (baseUrl || '').trim().replace(/\/+$/, '').toLowerCase()
}

export function capabilityCacheKey(baseUrl: string, model: string): string {
  return `${normalizeBaseUrl(baseUrl)}|${(model || '').trim().toLowerCase()}`
}

/**
 * 厂商启发式：已知默认开 thinking、且文档支持 disabled 的端点。
 * 探测结果优先于启发式。
 */
export const THINKING_DISABLE_BASE_URL_PATTERNS = [
  /deepseek\.com/,
  /moonshot\.cn|moonshot\.ai/,
] as const

export const THINKING_DISABLE_MODEL_RULE = {
  requiredMarker: 'deepseek',
  anyVersionMarker: ['v4', 'reasoner', 'r1'],
} as const

export const AUX_THINKING_DECISION_PRIORITY = [
  'capability-cache:supported',
  'capability-cache:unsupported',
  'provider-model-heuristic',
] as const

export function prefersThinkingDisabledByHeuristic(baseUrl: string, model?: string): boolean {
  const base = normalizeBaseUrl(baseUrl)
  if (THINKING_DISABLE_BASE_URL_PATTERNS.some((pattern) => pattern.test(base))) return true
  const normalizedModel = (model || '').toLowerCase()
  if (
    normalizedModel.includes(THINKING_DISABLE_MODEL_RULE.requiredMarker)
    && THINKING_DISABLE_MODEL_RULE.anyVersionMarker.some((marker) => normalizedModel.includes(marker))
  ) {
    return true
  }
  return false
}

function parseCache(raw: string): Record<string, ThinkingCapabilityEntry> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, ThinkingCapabilityEntry> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!k || !v || typeof v !== 'object') continue
      const entry = v as ThinkingCapabilityEntry
      if (
        entry.thinkingDisable === 'supported' ||
        entry.thinkingDisable === 'unsupported' ||
        entry.thinkingDisable === 'unknown'
      ) {
        out[k] = {
          thinkingDisable: entry.thinkingDisable,
          ...(typeof entry.probedAt === 'number' ? { probedAt: entry.probedAt } : {}),
          ...(typeof entry.note === 'string' ? { note: entry.note } : {}),
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

export async function getThinkingCapability(
  baseUrl: string,
  model: string,
): Promise<ThinkingCapabilityEntry> {
  const key = capabilityCacheKey(baseUrl, model)
  const raw = await settings.getSetting('llmCapabilityCache')
  const cache = parseCache(raw)
  return cache[key] ?? { thinkingDisable: 'unknown' }
}

export async function setThinkingCapability(
  baseUrl: string,
  model: string,
  entry: ThinkingCapabilityEntry,
): Promise<void> {
  const key = capabilityCacheKey(baseUrl, model)
  const raw = await settings.getSetting('llmCapabilityCache')
  const cache = parseCache(raw)
  cache[key] = {
    ...entry,
    probedAt: entry.probedAt ?? Date.now(),
  }
  await settings.setSetting('llmCapabilityCache', JSON.stringify(cache))
}

/**
 * 辅助调用应否关闭 thinking。
 * 优先级：探测 supported → 关；探测 unsupported → 不关；未知 → 启发式。
 */
export async function shouldDisableThinkingForAux(
  baseUrl: string,
  model: string,
): Promise<boolean> {
  const cap = await getThinkingCapability(baseUrl, model)
  if (cap.thinkingDisable === 'supported') return true
  if (cap.thinkingDisable === 'unsupported') return false
  return prefersThinkingDisabledByHeuristic(baseUrl, model)
}

/** 给辅助 LLMConfig 挂上 thinking.disabled（若适用） */
export async function withAuxThinking(config: LLMConfig): Promise<LLMConfig> {
  if (config.thinking) return config
  const disable = await shouldDisableThinkingForAux(config.baseUrl, config.model)
  if (!disable) return config
  return { ...config, thinking: { type: 'disabled' }, runtimeAssetKeys: [...(config.runtimeAssetKeys ?? []), PROVIDER_ASSET_KEYS.auxThinking] }
}

export const __test = {
  parseCache,
  prefersThinkingDisabledByHeuristic,
  capabilityCacheKey,
}
