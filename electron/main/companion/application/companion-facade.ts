/**
 * Companion Application Facade — IPC 与外部宿主调用伙伴领域用例的统一应用入口。
 *
 * 背景：此前 `electron/main/ipc/companion.ts` 直接交叉导入 20 余个 `companion/life/*`、`companion/growth/*`
 * 与 `companion/cast/*` 子模块，导致传输层耦合过多领域内部实现路径，后续新增 CLI 或无头服务端入口时需要重复编排。
 * 设计意图：在 Application 层提供薄而清晰的用例门面，汇总角色编排、成长反思、生活资产、朋友圈、时间线、
 * 日记、信物、赠礼、脆弱心境、穿搭与旅行等标准用例；IPC 层只需做参数校验、安全守卫与本门面转发。
 * 关键约束：不引入 `electron` 或 `ipc/`；保持单向依赖 `ipc/ -> companion/application/ -> companion/{core,life,growth,cast,identity}`。
 */

export {
  getActiveRole,
  getActiveRoleId,
  getActiveRoster,
  getRoleVisuals,
  listActiveUniverseProtagonists,
  listAvailableUniverseIds,
  requestUniverseSwitch,
  getCastAvailability,
  requestSwitch,
  startSummonSession,
  summonCastBrief,
} from '../orchestrator'

export * as identity from '../identity/loader'
export { isValidVisualSlot, resetRoleVisualOverride, saveRoleVisualOverride, type RoleVisualSlot } from '../identity/visual-overrides'

export { getCompanionRuntimeReadModel } from '../core/read-models/runtime-read-model'
export { executeCompanionCommand } from '../core/commands/gateway'
export { claimFirstContact, listRelationshipStates } from '../core/persistence/life-repository'

export {
  getMutable,
  listMutableVersions,
  rollbackMutable,
  setMutable,
} from '../growth/mutable-store'
export { getReflectionStatus, runReflectionNow } from '../growth/reflection-service'
export { listKeepsakes, triggerGiftKeepsake } from '../growth/relationship-keepsake'
export { listMilestoneKinds } from '../growth/milestones'
export { resolveRelationshipStageForRole } from '../growth/relationship-stage'

export { describeCastPresence } from '../cast/availability'
export { getContactsForRole } from '../cast/contacts'

export {
  createAsset,
  changeWardrobe,
  deleteAsset,
  ensureStarterAssets,
  getAsset,
  listAssets,
  updateAsset,
} from '../life/assets'
export {
  addMomentCommentForRole,
  listMomentUserInteractionsForRole,
  listMomentsForRole,
  toggleMomentLikeForRole,
} from '../life/moments'
export { describeMomentVisibility, resolveMomentVisibilityDays } from '../life/moment-visibility'
export { getLifeSliceForRole } from '../life/slices'
export { getTodayTimelineForRole } from '../life/timeline'
export { listLifeResonances } from '../life/chat-resonance'
export { momentImageIdsForRole, readMomentImageForRole } from '../life/moment-images'
export { getHostPresenceStatus, checkAndTriggerHostCare } from '../life/host-presence'
export { replanRemainingSlots } from '../life/replan'
export { listInnerThoughts, deleteInnerThought, toggleInnerThoughtFavorite, triggerInnerThought } from '../life/inner-thoughts'
export { triggerNightlyReflection } from '../life/nightly-reflection'
export { pickNostalgicReminiscence } from '../life/nostalgia'
export { listAvailableGifts, listReceivedGifts, sendGiftToCompanion } from '../life/gifting'
export { getActiveVulnerability, listVulnerabilities, comfortVulnerability, triggerVulnerability } from '../life/vulnerability'
export { listAutonomousDressings } from '../life/autonomous-dressing'
export { listTravelProgressions, triggerTravelProgression } from '../life/travel-progression'
