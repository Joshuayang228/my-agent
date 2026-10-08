/**
 * Companion IPC — 取代旧 persona:* 通道
 *
 * 四处同步：本文件 / preload / vite-env / 调用方（SettingsPanel 等）
 */

import { ipcMain, shell } from 'electron'
import type { CompanionAssetCreateInput, CompanionWardrobeChangeInput } from '../../../src/shared/types'
import { hasLLMAuthentication } from '../../../src/shared/llm-connection-test'
import {
  getActiveRole,
  getActiveRoleId,
  getActiveRoster,
  listActiveUniverseProtagonists,
  getCastAvailability,
  requestSwitch,
  startSummonSession,
  summonCastBrief,
} from '../companion/orchestrator'
import {
  getMutable,
  listMutableVersions,
  rollbackMutable,
  setMutable,
} from '../companion/growth/mutable-store'
import {
  getReflectionStatus,
  runReflectionNow,
} from '../companion/growth/reflection-service'
import { describeCastPresence } from '../companion/cast/availability'
import { getContactsForRole } from '../companion/cast/contacts'
import {
  createAsset,
  changeWardrobe,
  deleteAsset,
  ensureStarterAssets,
  getAsset,
  listAssets,
  updateAsset,
} from '../companion/life/assets'
import {
  addMomentCommentForRole,
  listMomentUserInteractionsForRole,
  listMomentsForRole,
  toggleMomentLikeForRole,
} from '../companion/life/moments'
import { describeMomentSocial } from '../../../src/shared/moment-user-interactions'
import { getRoleState } from '../companion/life/store'
import { getLifeSliceForRole } from '../companion/life/slices'
import { momentImageIdsForRole, readMomentImageForRole } from '../companion/life/moment-images'
import * as settings from '../storage/settings-store'
import { loadAuxLLMConfig } from '../llm/aux-config'
import { createLogger } from '../utils/logger'
import { readGeneratedImageReference, loadGeneratedImageReference } from '../storage/generated-images'

const log = createLogger('CompanionIPC')

export function registerCompanionIPC(): void {
  ipcMain.handle('companion:list-protagonists', async () => {
    const universeId = await settings.getSetting('universeId')
    return listActiveUniverseProtagonists(universeId)
  })

  ipcMain.handle('companion:get-active', async () => getActiveRole())

  ipcMain.handle('companion:request-switch', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) {
      return { ok: false, code: 'UNKNOWN_ROLE' as const }
    }
    return requestSwitch(roleId.trim())
  })

  ipcMain.handle('companion:get-mutable', async (_e, roleId?: string) => {
    const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
    const universeId = await settings.getSetting('universeId')
    const body = await getMutable(id, universeId)
    return { roleId: id, body }
  })

  ipcMain.handle(
    'companion:set-mutable',
    async (_e, roleId: string, body: string, summary?: string) => {
      if (typeof roleId !== 'string' || !roleId.trim()) {
        return { ok: false as const, error: 'INVALID_ROLE' }
      }
      if (typeof body !== 'string') {
        return { ok: false as const, error: 'INVALID_BODY' }
      }
      const result = await setMutable(roleId.trim(), body, summary || '')
      if (!result.ok) {
        return { ok: false as const, error: result.error, code: result.code }
      }
      return { ok: true as const, version: result.version }
    },
  )

  ipcMain.handle('companion:list-mutable-versions', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) return []
    return listMutableVersions(roleId.trim())
  })

  ipcMain.handle('companion:rollback-mutable', async (_e, roleId: string, toVersion: number) => {
    if (typeof roleId !== 'string' || !roleId.trim() || !Number.isFinite(toVersion)) {
      return { ok: false as const, error: 'INVALID_ARGS' }
    }
    try {
      const { version } = await rollbackMutable(roleId.trim(), toVersion)
      return { ok: true as const, version }
    } catch (err) {
      log.warn('Mutable rollback failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { ok: false as const, error: '回滚失败，请稍后重试' }
    }
  })

  /** 朋友圈：仅返回当前活跃主角；用户赞 / 评论不写回动态正文 */
  ipcMain.handle(
    'companion:get-moments',
    async (_e, opts?: { limit?: number; offset?: number }) => {
      const roleId = await getActiveRoleId()
      const limit = Number.isSafeInteger(opts?.limit) ? Math.max(1, Math.min(200, opts!.limit!)) : 50
      const offset = Number.isSafeInteger(opts?.offset) ? Math.max(0, opts!.offset!) : 0
      const moments = await listMomentsForRole(roleId, { limit, offset })
      const items = await Promise.all(moments.map(async moment => ({ ...moment, imageIds: await momentImageIdsForRole(roleId, moment.id) })))
      const interactions = await listMomentUserInteractionsForRole(roleId)
      const socialByMomentId = Object.fromEntries(
        items.map((item) => [item.id, describeMomentSocial(item.id, interactions)]),
      )
      return { roleId, items, socialByMomentId }
    },
  )

  ipcMain.handle('companion:read-moment-image', async (_e, momentId: unknown, imageId: unknown) => {
    if (typeof momentId !== 'string' || !momentId || momentId.length > 200
      || typeof imageId !== 'string' || !/^[a-f0-9]{64}$/.test(imageId)) return { ok: false as const, error: '图片引用无效。' }
    try {
      const roleId = await getActiveRoleId()
      const result = await readMomentImageForRole(roleId, momentId, imageId)
      if (await getActiveRoleId() !== roleId) return { ok: false as const, error: '人物已切换，请重新读取图片。' }
      return result
    } catch { return { ok: false as const, error: '图片暂时无法读取，请重试。' } }
  })

  /** 生活切片：事件是事实源，Renderer 不自行拼接跨表关联。 */
  ipcMain.handle('companion:get-life-slice', async (_e, eventId: unknown) => {
    if (typeof eventId !== 'string' || !eventId.trim()) return null
    const roleId = await getActiveRoleId()
    return getLifeSliceForRole(roleId, eventId.trim())
  })

  ipcMain.handle('companion:toggle-moment-like', async (_e, momentId: string) => {
    if (typeof momentId !== 'string' || !momentId.trim()) {
      return { ok: false as const, error: '动态不存在', code: 'INVALID' }
    }
    const roleId = await getActiveRoleId()
    return toggleMomentLikeForRole(roleId, momentId.trim())
  })

  ipcMain.handle(
    'companion:add-moment-comment',
    async (_e, momentId: string, text?: string) => {
      if (typeof momentId !== 'string' || !momentId.trim()) {
        return { ok: false as const, error: '动态不存在', code: 'INVALID' }
      }
      const roleId = await getActiveRoleId()
      return addMomentCommentForRole(roleId, momentId.trim(), text)
    },
  )

  ipcMain.handle('companion:catchup-status', async () => {
    const roleId = await getActiveRoleId()
    const state = await getRoleState(roleId)
    const universeId = await settings.getSetting('universeId')
    const presence = (await describeCastPresence(roleId, { universeId })) || ''
    return {
      roleId,
      pausedAt: state?.pausedAt ?? null,
      catchupSummary: state?.catchupSummary ?? '',
      lastTickAt: state?.lastTickAt ?? 0,
      /** 此刻活动/地点一句话（供 Chat 状态条） */
      presence,
    }
  })

  /** 物什（衣柜/书架）：仅活跃主角；空 kind 时播种 starter */
  ipcMain.handle(
    'companion:get-assets',
    async (_e, opts?: { kind?: string }) => {
      const roleId = await getActiveRoleId()
      await ensureStarterAssets(roleId)
      const kind = typeof opts?.kind === 'string' ? opts.kind : undefined
      const items = await listAssets(roleId, kind ? { kind } : undefined)
      return { roleId, items }
    },
  )

  /** 用户主动写入活跃主角生活资产；kind 白名单由 createAsset 校验 */
  ipcMain.handle(
    'companion:create-asset',
    async (
      _e,
      input?: CompanionAssetCreateInput,
    ) => {
      if (!input || typeof input !== 'object') {
        return { ok: false as const, error: 'INVALID_INPUT' }
      }
      if (typeof input.kind !== 'string' || typeof input.name !== 'string') {
        return { ok: false as const, error: 'INVALID_INPUT' }
      }
      if (typeof input.roleId !== 'string' || !input.roleId.trim() || input.roleId.length > 128) {
        return { ok: false as const, code: 'INVALID', error: '请刷新人物页面后重试。' }
      }
      // 切角通知可能迟到；先核对页面归属，拒绝替用户把旧草稿写给新角色。
      // 受理后固定使用此次核验的 roleId，后续切角不能改变这次写入归属。
      const roleId = await getActiveRoleId()
      if (input.roleId !== roleId) {
        return { ok: false as const, code: 'ROLE_MISMATCH', error: '伙伴已切换，请刷新人物页面后重试。' }
      }
      const result = await createAsset({
        roleId,
        kind: input.kind,
        name: input.name,
        payload: input.payload,
      })
      if (!result.ok) return { ok: false as const, error: result.error, code: result.code }
      return { ok: true as const, asset: result.asset }
    },
  )

  /** 显式换装：核对当前角色与页面版本，按完整槽位原子保存。 */
  ipcMain.handle('companion:change-wardrobe', async (_e, input?: CompanionWardrobeChangeInput) => {
    if (!input || typeof input.roleId !== 'string' || input.roleId.length > 128 || typeof input.assetId !== 'string' || input.assetId.length > 160
      || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) return { ok: false as const, code: 'INVALID', error: '换装信息无效，请重新读取衣柜。' }
    const roleId = await getActiveRoleId()
    if (input.roleId !== roleId) return { ok: false as const, code: 'ROLE_MISMATCH', error: '伙伴已切换，请重新读取衣柜。' }
    try { return await changeWardrobe({ ...input, roleId }) } catch (error) {
      log.error('Wardrobe change failed', { errorType: error instanceof Error ? error.name : 'unknown' })
      return { ok: false as const, code: 'INVALID', error: '换装暂时未能保存，请重新读取衣柜后重试。' }
    }
  })

  /** M25-G1：更新活跃主角资产 */
  ipcMain.handle(
    'companion:update-asset',
    async (
      _e,
      assetId: string,
      patch?: { name?: string; payload?: Record<string, unknown> },
    ) => {
      if (typeof assetId !== 'string' || !assetId.trim()) {
        return { ok: false as const, error: 'INVALID_ID' }
      }
      if (!patch || typeof patch !== 'object') {
        return { ok: false as const, error: 'INVALID_PATCH' }
      }
      const roleId = await getActiveRoleId()
      const result = await updateAsset(assetId.trim(), patch, { expectedRoleId: roleId })
      if (!result.ok) return { ok: false as const, error: result.error, code: result.code }
      return { ok: true as const, asset: result.asset }
    },
  )

  /** M25-G1：删除活跃主角资产 */
  ipcMain.handle('companion:delete-asset', async (_e, assetId: string) => {
    if (typeof assetId !== 'string' || !assetId.trim()) {
      return { ok: false as const, error: 'INVALID_ID' }
    }
    const roleId = await getActiveRoleId()
    const result = await deleteAsset(assetId.trim(), { expectedRoleId: roleId })
    if (!result.ok) return { ok: false as const, error: result.error, code: result.code }
    return { ok: true as const }
  })

  /**
   * 背景：人物世界图片可能来自项目生成或用户数据备份恢复，不能以当前项目判定归属。
   * 意图：只读取活跃角色的持久化资产引用，沿用文件摘要与真实路径校验，而非放开任意路径。
   * 约束：Renderer 只传资产和图片 ID；异步读取后必须再次核对角色与资产图片引用。
   */
  ipcMain.handle('companion:read-asset-image', async (_e, assetId: unknown, imageId: unknown) => {
    if (typeof assetId !== 'string' || !assetId.trim() || typeof imageId !== 'string') return { ok: false as const, error: '图片引用无效。' }
    const roleId = await getActiveRoleId()
    const asset = await getAsset(assetId.trim())
    if (!asset || asset.roleId !== roleId) return { ok: false as const, error: '人物世界资产不存在。' }
    const result = await readGeneratedImageReference(asset.payload.image, imageId)
    const current = await getAsset(asset.id)
    if (roleId !== await getActiveRoleId() || !current || current.roleId !== roleId
      || JSON.stringify(current.payload.image) !== JSON.stringify(asset.payload.image)) return { ok: false as const, error: '人物或图片已变化，请重新读取。' }
    return result
  })

  ipcMain.handle('companion:reveal-asset-image', async (event, assetId: unknown, imageId: unknown) => {
    try {
      if (typeof assetId !== 'string' || !assetId.trim() || typeof imageId !== 'string') return { ok: false as const, error: '图片引用无效。' }
      const frame = event.senderFrame
      if (event.sender.isDestroyed() || !frame || frame !== event.sender.mainFrame) return { ok: false as const, error: '当前页面不能定位人物世界图片。' }
      const roleId = await getActiveRoleId()
      const asset = await getAsset(assetId.trim())
      if (!asset || asset.roleId !== roleId) return { ok: false as const, error: '人物世界资产不存在。' }
      const result = await loadGeneratedImageReference(asset.payload.image, imageId)
      if (result.ok === false) return { ok: false as const, error: result.error }
      const current = await getAsset(asset.id)
      if (roleId !== await getActiveRoleId() || !current || current.roleId !== roleId
        || JSON.stringify(current.payload.image) !== JSON.stringify(asset.payload.image)) return { ok: false as const, error: '人物或图片已变化，未定位图片。' }
      if (event.sender.isDestroyed() || frame.detached || frame !== event.sender.mainFrame) return { ok: false as const, error: '页面已变化，未定位图片。' }
      shell.showItemInFolder(result.filePath)
      return { ok: true as const }
    } catch {
      return { ok: false as const, error: '无法定位图片，请稍后重试。' }
    }
  })

  /** 名册：以活跃主角为视角的关系短句 + 卡司浅层 */
  ipcMain.handle('companion:get-roster', async () => getActiveRoster())
  ipcMain.handle('companion:get-contacts', async () => {
    try {
      const roleId = await getActiveRoleId()
      const universeId = await settings.getSetting('universeId')
      const result = await getContactsForRole(roleId, universeId)
      if (roleId !== await getActiveRoleId()) throw new Error('角色已切换')
      return result
    } catch (error) {
      log.warn('Contacts read failed', { errorType: error instanceof Error ? error.name : 'unknown' })
      throw new Error('通讯录暂时未能读取，请重新读取。')
    }
  })

  /** 召唤摘要：不含 protected，不启用对方生活世界 */
  ipcMain.handle('companion:summon-brief', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) {
      return { ok: false as const, error: 'INVALID_ROLE' }
    }
    try {
      const brief = await summonCastBrief(roleId.trim())
      return { ok: true as const, brief }
    } catch (err) {
      log.warn('Summon brief failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { ok: false as const, error: '召唤摘要生成失败，请稍后重试' }
    }
  })

  /** 召唤前忙闲（Alice checkFriendAvailability 对照） */
  ipcMain.handle('companion:check-cast-availability', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) {
      return { ok: false as const, error: 'INVALID_ROLE' }
    }
    return getCastAvailability(roleId.trim())
  })

  /** 召唤子会话：装载对方完整 Pack，不改 active、不启对方生活 */
  ipcMain.handle(
    'companion:start-summon',
    async (_e, roleId: string, force?: boolean) => {
      if (typeof roleId !== 'string' || !roleId.trim()) {
        return { ok: false as const, error: 'INVALID_ROLE' }
      }
      return startSummonSession(roleId.trim(), { force: !!force })
    },
  )

  /** 成长反思状态（门闸 + 最近 runs） */
  ipcMain.handle('companion:reflection-status', async (_e, roleId?: string) => {
    const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
    return getReflectionStatus(id)
  })

  /** 立即反思；force 跳过 72h/24h/消息数门闸 */
  ipcMain.handle(
    'companion:run-reflection',
    async (_e, roleId?: string, force?: boolean) => {
      const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
      const llm = await loadAuxLLMConfig()
      if (!hasLLMAuthentication(llm)) {
        return { skipped: true, changed: false, summary: 'NO_API_KEY', reason: 'NO_API_KEY' }
      }
      return runReflectionNow(id, llm, { force: !!force })
    },
  )

  /** M30-G1：已记录的关系里程碑种类（无成就点数） */
  ipcMain.handle('companion:list-milestones', async (_e, roleId?: string) => {
    const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
    const { listMilestoneKinds } = await import('../companion/growth/milestones')
    return { roleId: id, kinds: await listMilestoneKinds(id) }
  })
}
