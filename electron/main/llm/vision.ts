/**
 * Vision 乐观探测与降级策略。
 *
 * 背景：OpenAI Compatible 端点对 image_url 的支持不统一，首次请求失败后需要自动去图重试。
 * 设计意图：缓存只记录当前进程内 model + baseUrl 的拒绝结果，策略事实可被 Debug 注册表只读引用。
 * 关键约束：缓存内容属于运行时状态，不得进入静态生产资产目录。
 */

import type { ChatMessage, LLMConfig } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'

const log = createLogger('LLM')

export const VISION_RELATED_ERROR_MARKERS = [
  'image_url',
  'unknown variant',
  'invalid content type',
  'does not support image',
  'multimodal',
  'vision',
] as const

export const VISION_FALLBACK_POLICY = {
  defaultAssumption: 'supported',
  cacheScope: 'process:model+baseUrl',
  retryMode: 'strip-images-once',
  strippedImageReplacement: 'filename-placeholder',
} as const

const visionDenyCache = new Set<string>()

function getVisionCacheKey(config: LLMConfig): string {
  return `${config.baseUrl}::${config.model}`
}

export function isVisionDenied(config: LLMConfig): boolean {
  return visionDenyCache.has(getVisionCacheKey(config))
}

export function markVisionDenied(config: LLMConfig): void {
  visionDenyCache.add(getVisionCacheKey(config))
  log.info('Vision support marked as denied', { model: config.model, baseUrl: config.baseUrl })
}

export function isVisionRelatedError(errorText: string): boolean {
  const lower = errorText.toLowerCase()
  return VISION_RELATED_ERROR_MARKERS.some((marker) => lower.includes(marker))
}

export function hasImages(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.images && message.images.length > 0)
}
