import type { CompanionEvent, CompanionMoment } from '../types'
import { compileImageGenerationRequest } from '../../prompts/registered-request'
import { loadImageGenerationConfig } from '../../llm/aux-config'
import { requestGeneratedImage } from '../../llm/image-generation'
import { normalizeGeneratedImage } from '../../utils/generated-image-codec'
import { loadRolePack } from '../identity/loader'
import { formatRoleAppearanceForImagePrompt } from '../identity/profile'
import { attachMomentImageForRole } from './moment-images'
import { recordMomentMediaAttempt, storeMomentMedia } from './moment-media-store'

export async function generateAutomaticMomentMedia(roleId: string, event: CompanionEvent, moment: CompanionMoment): Promise<{ ok: true; imageId: string } | { ok: false; reason: string }> {
  const attemptedAt = Date.now()
  await recordMomentMediaAttempt({ roleId, eventId: event.id, momentId: moment.id, status: 'started', reason: 'requested', imageId: null, attemptedAt, completedAt: null })
  try {
    const config = await loadImageGenerationConfig()
    if (!config) {
      await recordMomentMediaAttempt({ roleId, eventId: event.id, momentId: moment.id, status: 'skipped', reason: 'no-image-config', imageId: null, attemptedAt, completedAt: Date.now() })
      return { ok: false, reason: 'no-image-config' }
    }
    const appearance = (() => { try { return formatRoleAppearanceForImagePrompt(loadRolePack(roleId).profile) } catch { return '' } })()
    const description = `为人物朋友圈动态生成一张自然生活照片。动态正文：${moment.text.slice(0, 1200)}。只表现动态已保存的活动、地点和情绪，不添加新的事件或人物事实。${appearance ? `人物外观锚点：${appearance}` : ''}`
    const response = await requestGeneratedImage(config, compileImageGenerationRequest(description), undefined)
    const image = await normalizeGeneratedImage(response.bytes)
    const stored = await storeMomentMedia({ roleId, eventId: event.id, momentId: moment.id, mimeType: 'image/png', width: image.width, height: image.height, bytes: image.bytes })
    const linked = await attachMomentImageForRole(roleId, moment.id, stored.id)
    if (!linked.ok) {
      await recordMomentMediaAttempt({ roleId, eventId: event.id, momentId: moment.id, status: 'failed', reason: 'moment-link-rejected', imageId: stored.id, attemptedAt, completedAt: Date.now() })
      return { ok: false, reason: 'moment-link-rejected' }
    }
    await recordMomentMediaAttempt({ roleId, eventId: event.id, momentId: moment.id, status: 'stored', reason: 'stored-and-linked', imageId: stored.id, attemptedAt, completedAt: Date.now() })
    return { ok: true, imageId: stored.id }
  } catch (error) {
    await recordMomentMediaAttempt({ roleId, eventId: event.id, momentId: moment.id, status: 'failed', reason: error instanceof Error ? error.message.slice(0, 120) : 'generation-failed', imageId: null, attemptedAt, completedAt: Date.now() })
    return { ok: false, reason: 'generation-failed' }
  }
}
