/**
 * Companion Orchestrator
 *
 * 背景：设置页与 runtime 需要统一读写 activeRoleId；切换必须门控进行中会话。
 * 意图：getActiveRoleId / requestSwitch / assertSessionRole / Assemble 输入。
 * 约束：有流式 chat 时拒绝切换（SESSION_ACTIVE）；切换时 pause 旧角色；
 *       新角色曾暂停则同步 runCatchup（W3）；本模块不 import agent/。
 */

import { BrowserWindow } from 'electron'
import * as settings from '../storage/settings-store'
import * as store from '../storage/session-store'
import * as identity from './identity/loader'
import {
  checkCastAvailability,
  describeCastPresence,
  type CastAvailability,
} from './cast/availability'
import {
  buildRosterLines,
  formatRosterForPrompt,
  listRelatedCast,
  loadCastBrief,
  type CastBrief,
  type RosterLine,
} from './cast/roster'
import { getMutable } from './growth/mutable-store'
import { runCatchup } from './life/catchup'
import { pauseRole, resumeRole } from './life/engine'
import { getRoleState } from './life/store'
import { listEmotionEvents, listRelationshipStates } from './life/store'
import { narrativeMood } from './life/world-codec'
import { recordAndBroadcastMilestone } from './growth/milestones'
import { buildReacquaintCopy } from './presence'
import { isStreamingActive } from './streaming-gate'
import type { RolePack, RoleSummary, SwitchResult } from './types'

export type { CastBrief, RosterLine }

export async function getActiveRoleId(): Promise<string> {
  const universeId = await settings.getSetting('universeId')
  const active = await settings.getSetting('activeRoleId')
  if (active && identity.isKnownProtagonist(active, universeId)) return active
  const fallback = identity.getDefaultProtagonistId(universeId)
  if (active !== fallback) {
    await settings.setSetting('activeRoleId', fallback)
  }
  return fallback
}

export async function getActiveRole(): Promise<RoleSummary & { universeId: string }> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  const pack = identity.loadRolePack(roleId, universeId)
  const [state, relationships, emotions] = await Promise.all([
    getRoleState(roleId),
    listRelationshipStates(roleId),
    listEmotionEvents(roleId, 1),
  ])
  const userRelationship = relationships.find(item => item.subjectId === 'user')
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    firstContact: pack.firstContact,
    universeId,
    statusSummary: formatCompanionStatusSummary({ world: state?.world, relationships, emotions }),
    statusMetrics: state ? {
      mood: state.world.mood,
      energy: state.world.energy,
      socialNeed: state.world.socialNeed,
      relationshipSignal: userRelationship?.signal ?? null,
      relationshipPhase: userRelationship?.phase ?? null,
    } : undefined,
  }
}

/**
 * 将运行态压成用户可读的当前状态摘要。
 *
 * 背景：人物世界需要让用户感知伙伴此刻的状态，但不能把内部 0–100 指标变成养成面板。
 * 设计意图：只保留叙事级心情、精力、关系阶段和最近情绪，来源仍是运行态事实；不显示
 * 原始数值，也不把关系信号写入设置或交给权限判断。
 * 关键约束：缺少运行态时返回 undefined，不用默认值补造“当前心情”；关系说明和情绪笔记
 * 必须有界，用户可见文案不能暴露内部字段名或诊断术语。
 */
/**
 * 将角色当前的话头与表达冲动转成主对话 Prompt 提示。
 *
 * 背景：角色虽然发了动态、经历了生活事件，但在聊天中仍常常被动等待提问，缺乏真人「忍不住想跟你分享」的活人感。
 * 设计意图：结合社交渴望度、最近一条已发布动态或最新生活活动，生成一条轻量的交流倾向提示；
 * 关键约束：闲聊或打招呼时允许自然带出，但遇到严肃指令或工具执行时严禁强行闲聊夺话。
 */
export function formatConversationImpulseForPrompt(input: {
  socialNeed: number
  currentActivity?: string
  latestMomentText?: string
  resonanceFeedback?: string
  nostalgicReminiscence?: string
}): string | undefined {
  const points: string[] = []
  if (input.resonanceFeedback) {
    points.push(`【重要回访心愿反馈】你之前根据用户的推荐去体验了并有了深刻感悟，心里一直惦记着向用户反馈：“${input.resonanceFeedback.slice(0, 100)}”`)
  }
  if (input.nostalgicReminiscence) {
    points.push(`【高光回忆羁绊】你此刻忽然回想起过去的事：“${input.nostalgicReminiscence.slice(0, 100)}”`)
  }
  if (input.latestMomentText) {
    points.push(`你最近在朋友圈分享过：${input.latestMomentText.slice(0, 60)}`)
  } else if (input.currentActivity) {
    points.push(`你此刻刚在做的事：${input.currentActivity}`)
  }
  if (input.socialNeed >= 70) {
    points.push('你此刻很有倾诉欲和活力，很想跟用户说说今天好玩的事')
  } else if (input.socialNeed <= 30) {
    points.push('你当前状态较沉静，倾向于简练回应、多听对方说')
  }
  if (!points.length) return undefined
  return [
    ...points,
    '（交流指引：若这轮是闲聊开场或随口问候，找合适时机像真人一样顺口带出上述近况；若用户提出明确具体的工作或任务指令，则专注完成任务，不要强行闲聊。）',
  ].join('；')
}

export function formatCompanionStatusSummary(input: {
  world?: { mood: number; energy: number; socialNeed: number }
  relationships: Array<{ subjectId: string; phase: string; note: string }>
  emotions: Array<{ label: string; note: string }>
}): string | undefined {
  const parts: string[] = []
  if (input.world) {
    const energy = input.world.energy >= 75 ? '精力充足' : input.world.energy >= 45 ? '精力还够用' : '需要缓一缓'
    const social = input.world.socialNeed >= 70 ? '最近比较想找人说话' : input.world.socialNeed <= 30 ? '最近更想安静一点' : ''
    parts.push(`${narrativeMood(input.world.mood)}，${energy}`)
    if (social) parts.push(social)
  }
  const userRelationship = input.relationships.find(item => item.subjectId === 'user')
  if (userRelationship) {
    const phase: Record<string, string> = { stranger: '还在慢慢熟悉', familiar: '相处得越来越自然', rapport: '已经很有默契' }
    parts.push(`和你：${phase[userRelationship.phase] ?? '关系正在变化'}${userRelationship.note.trim() ? `，${userRelationship.note.trim().slice(0, 80)}` : ''}`)
  }
  const emotion = input.emotions[0]
  if (emotion?.label.trim()) parts.push(`最近有些${emotion.label.trim().slice(0, 40)}`)
  return parts.length ? parts.join(' · ') : undefined
}

export async function loadActiveRolePack(): Promise<RolePack> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  return identity.loadRolePack(roleId, universeId)
}

/**
 * 将持久化关系阶段转成模型可读的中文摘要。
 *
 * 背景：关系事实需要跨重启继续影响表达，但内部阶段值不能直接变成 RPG 数值或英文枚举。
 * 设计意图：只暴露阶段语义和有限说明，保留未知阶段的保守“变化”标签，不复制关系表全文。
 * 关键约束：摘要只影响表达与连续性，不能成为工具权限、事实判断或任务执行依据。
 */
function formatRelationshipStateSummary(states: Array<{ subjectId: string; phase: string; note: string }>): string | undefined {
  if (states.length === 0) return undefined
  const phaseLabel: Record<string, string> = { stranger: '陌生', familiar: '熟悉', rapport: '默契' }
  const lines = states.slice(0, 5).map(state => {
    const subject = state.subjectId === 'user' ? '用户' : state.subjectId.slice(0, 80)
    const phase = phaseLabel[state.phase] ?? '关系变化'
    const note = state.note.trim().slice(0, 180)
    return `${subject}：${phase}${note ? `（${note}）` : ''}`
  })
  return `持久化关系摘要：${lines.join('；')}`
}

/**
 * 把情绪事件的内部强度压成叙事级标签。
 *
 * 背景：情绪强度用于 Debug 和排序，直接把 0–100 注入模型会把人物变成可调数值条。
 * 设计意图：模型只接收“轻 / 中 / 明显”的表达提示，具体事件说明仍保留为运行时资料。
 * 关键约束：缺失或异常强度按中等处理，情绪提示不能改变事实、权限或任务结果。
 */
function formatEmotionSummary(events: Array<{ label: string; intensity: number; note: string }>): string | undefined {
  if (events.length === 0) return undefined
  const lines = events.slice(0, 5).map(event => {
    const level = event.intensity >= 70 ? '明显' : event.intensity >= 40 ? '中等' : '轻微'
    const label = event.label.trim().slice(0, 60) || '未命名情绪'
    const note = event.note.trim().slice(0, 120)
    return `${label}（${level}）${note ? `：${note}` : ''}`
  })
  return `近期情绪线索：${lines.join('；')}`
}

/** Assemble 输入：Pack + MUTABLE + catchup + 世界薄片 + 近 Moment + 名册浅注入 */
export async function loadRoleAssembleInput(
  roleId: string,
  universeId?: string,
): Promise<{
  pack: RolePack
  mutableBody: string
  catchupSummary?: string
  /** M23-G2：居所/时区/近况一行 */
  worldSlice?: string
  /** M24-G1：近 1–3 条 Moment 薄锚点 */
  recentMomentsSlice?: string
  /** M25 旁路：书架薄切片 */
  bookshelfSlice?: string
  /** 当前穿着 / 在读在看在听 / 进行中旅程 */
  lifeAssetsSlice?: string
  /** 当前话头与表达冲动 */
  conversationImpulse?: string
  pendingResonanceFeedbackId?: string
  rosterLines?: string
  relationshipSummary?: string
  emotionSummary?: string
}> {
  const uid = universeId ?? (await settings.getSetting('universeId'))
  const pack = identity.loadRolePack(roleId, uid)
  const mutableBody = await getMutable(roleId, uid)
  const state = await getRoleState(roleId)
  const catchupSummary = state?.catchupSummary?.trim() || undefined
  const roster = formatRosterForPrompt(buildRosterLines(roleId, uid))
  // 延迟 import，避免 orchestrator ↔ life 启动环
  const { ensureWorldState, formatWorldSliceForPrompt } = await import('./life/world-state')
  const { collectRecentMomentsSlice } = await import('./life/moment-consistency')
  const { collectBookshelfSlice, collectLifeAssetsSlice } = await import('./life/assets')
  const { listEvents, listRelationshipStates, listEmotionEvents } = await import('./life/store')
  const { getPendingResonanceFeedback } = await import('./life/chat-resonance')
  const { pickNostalgicReminiscence } = await import('./life/nostalgia')
  const world = await ensureWorldState(roleId)
  const worldSlice = formatWorldSliceForPrompt(world) || undefined
  const { slice: recentMomentsSlice } = await collectRecentMomentsSlice(roleId)
  const { slice: bookshelfSlice } = await collectBookshelfSlice(roleId)
  const { slice: lifeAssetsSlice } = await collectLifeAssetsSlice(roleId)
  const pendingFeedback = await getPendingResonanceFeedback(roleId)
  const nostalgicItem = await pickNostalgicReminiscence(roleId).catch(() => null)
  const conversationImpulse = formatConversationImpulseForPrompt({
    socialNeed: world.socialNeed,
    currentActivity: world.currentActivity,
    resonanceFeedback: pendingFeedback?.feedbackText || undefined,
    nostalgicReminiscence: nostalgicItem?.text || undefined,
  })
  const relationshipStates = await listRelationshipStates(roleId)
  const relationshipEvents = (await listEvents(roleId, { status: 'published', order: 'desc', limit: 30 }))
    .filter(event => event.payload.relationship && typeof event.payload.relationship === 'object')
    .slice(0, 5)
    .map(event => {
      const relationship = event.payload.relationship as Record<string, unknown>
      const note = typeof relationship.note === 'string' ? relationship.note : ''
      const phase = typeof relationship.phase === 'string' ? relationship.phase : '变化'
      return `${phase}${note ? `：${note}` : ''}`
    })
  const relationshipSummary = formatRelationshipStateSummary(relationshipStates)
    ?? (relationshipEvents.length ? `近期关系事件：${relationshipEvents.join('；')}` : undefined)
  const emotionSummary = formatEmotionSummary(await listEmotionEvents(roleId, 5))
  return {
    pack,
    mutableBody,
    catchupSummary,
    worldSlice,
    recentMomentsSlice: recentMomentsSlice || undefined,
    bookshelfSlice: bookshelfSlice || undefined,
    lifeAssetsSlice: lifeAssetsSlice || undefined,
    conversationImpulse: conversationImpulse || undefined,
    pendingResonanceFeedbackId: pendingFeedback?.id,
    rosterLines: roster || undefined,
    relationshipSummary,
    emotionSummary,
  }
}

export async function loadActiveAssembleInput(): Promise<{
  pack: RolePack
  mutableBody: string
  catchupSummary?: string
  worldSlice?: string
  recentMomentsSlice?: string
  bookshelfSlice?: string
  /** 当前穿着 / 在读在看在听 / 进行中旅程 */
  lifeAssetsSlice?: string
  /** 当前话头与表达冲动 */
  conversationImpulse?: string
  pendingResonanceFeedbackId?: string
  rosterLines?: string
  relationshipSummary?: string
  emotionSummary?: string
}> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  return loadRoleAssembleInput(roleId, universeId)
}

/** 当前活跃主角相关的名册短句 */
export async function getActiveRoster(): Promise<{
  roleId: string
  lines: RosterLine[]
  cast: CastBrief[]
}> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  return {
    roleId,
    lines: buildRosterLines(roleId, universeId),
    cast: listRelatedCast(roleId, universeId),
  }
}

/**
 * 召唤摘要：装载非 active 角色浅层信息，不启用其生活世界、不返回 protected。
 */
export async function summonCastBrief(roleId: string): Promise<CastBrief> {
  const universeId = await settings.getSetting('universeId')
  return loadCastBrief(roleId, universeId)
}

/** 召唤前忙闲查询（UI 可先预检） */
export async function getCastAvailability(
  roleId: string,
  opts?: { now?: number; random?: () => number },
): Promise<CastAvailability | { ok: false; error: string }> {
  const universeId = await settings.getSetting('universeId')
  const id = roleId.trim()
  if (!id) return { ok: false, error: 'INVALID_ROLE' }
  try {
    return await checkCastAvailability(id, { ...opts, universeId })
  } catch {
    return { ok: false, error: 'UNKNOWN_ROLE' }
  }
}

/**
 * 开启召唤子会话：绑定目标 Role Pack（含 protected），不改 activeRoleId，不 resume 对方生活。
 * 若目标就是当前活跃主角，退化为普通主线会话。
 * 默认走可用性检查（Alice checkFriendAvailability）；force=true 可强开。
 */
export async function startSummonSession(
  roleId: string,
  opts?: { force?: boolean; now?: number; random?: () => number },
): Promise<
  | {
      ok: true
      sessionId: string
      roleId: string
      name: string
      sessionKind: 'main' | 'summon'
      activeRoleId: string
      presence?: string
    }
  | {
      ok: false
      error: string
      reason?: string
      alternative?: string
      presence?: string
    }
> {
  const universeId = await settings.getSetting('universeId')
  const id = roleId.trim()
  if (!id) return { ok: false, error: 'INVALID_ROLE' }

  let pack
  try {
    pack = identity.loadRolePack(id, universeId)
  } catch {
    return { ok: false, error: 'UNKNOWN_ROLE' }
  }

  const activeRoleId = await getActiveRoleId()
  if (id === activeRoleId) {
    const session = await store.createSession(id, { sessionKind: 'main' })
    return {
      ok: true,
      sessionId: session.id,
      roleId: id,
      name: pack.name,
      sessionKind: 'main',
      activeRoleId,
    }
  }

  if (!opts?.force) {
    const avail = await checkCastAvailability(id, {
      universeId,
      now: opts?.now,
      random: opts?.random,
    })
    if (!avail.available) {
      return {
        ok: false,
        error: 'BUSY',
        reason: avail.reason,
        alternative: avail.alternative,
        presence: avail.presence,
      }
    }
  }

  const presence =
    (await describeCastPresence(id, { universeId, now: opts?.now })) || undefined

  const session = await store.createSession(id, {
    sessionKind: 'summon',
    title: `召唤 · ${pack.name}`,
  })
  return {
    ok: true,
    sessionId: session.id,
    roleId: id,
    name: pack.name,
    sessionKind: 'summon',
    activeRoleId,
    presence,
  }
}

export function listActiveUniverseProtagonists(universeId?: string): RoleSummary[] {
  return identity.listProtagonists(universeId ?? 'default')
}

export function listAvailableUniverseIds(): string[] {
  return identity.listAvailableUniverseIds()
}

/**
 * 切换当前世界观套装，并把 activeRoleId 指向目标世界默认主角。
 *
 * 背景：世界观设置和主角设置分开保存，先改其中一个会让运行时短暂读取到跨世界组合。
 * 设计意图：先校验目标 manifest 与默认主角，再在暂停旧角色后连续写入世界观 / 主角并恢复新角色。
 * 关键约束：流式会话期间拒绝切换；目标世界不存在、默认主角无效或写入失败时不宣称切换成功。
 */
export async function requestUniverseSwitch(universeId: string): Promise<
  | { ok: true; universeId: string; roleId: string; name: string }
  | { ok: false; code: 'UNKNOWN_UNIVERSE' | 'SESSION_ACTIVE' | 'ALREADY_ACTIVE' | 'INVALID_UNIVERSE' }
> {
  const id = universeId.trim()
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return { ok: false, code: 'INVALID_UNIVERSE' }
  let manifest
  try { manifest = identity.loadUniverseManifest(id) } catch { return { ok: false, code: 'UNKNOWN_UNIVERSE' } }
  if (!identity.isKnownProtagonist(manifest.defaultProtagonistId, id)) return { ok: false, code: 'UNKNOWN_UNIVERSE' }
  const currentUniverse = await settings.getSetting('universeId')
  const currentRole = await getActiveRoleId()
  if (currentUniverse === id) return { ok: false, code: 'ALREADY_ACTIVE' }
  if (isStreamingActive()) return { ok: false, code: 'SESSION_ACTIVE' }
  const now = Date.now()
  await pauseRole(currentRole, now)
  try {
    await settings.setSetting('universeId', id)
    await settings.setSetting('activeRoleId', manifest.defaultProtagonistId)
    await resumeRole(manifest.defaultProtagonistId)
  } catch (error) {
    // 两个设置键不是同一个 SQL 事务；失败时尽力恢复旧组合，避免留下跨世界半切换状态。
    try {
      await settings.setSetting('universeId', currentUniverse)
      await settings.setSetting('activeRoleId', currentRole)
      await resumeRole(currentRole)
    } catch { /* 下次启动会按旧世界 / 默认主角校验并报告异常 */ }
    throw error
  }
  const pack = identity.loadRolePack(manifest.defaultProtagonistId, id)
  broadcastRoleChanged({ roleId: manifest.defaultProtagonistId, catchupQueued: false, previousRoleId: currentRole, reacquaint: buildReacquaintCopy({ fromName: currentRole, toName: pack.name, catchupQueued: false }) })
  return { ok: true, universeId: id, roleId: manifest.defaultProtagonistId, name: pack.name }
}

/**
 * 聊天前校验：会话绑定的 role_id 不可被 activeRoleId 悄悄替换。
 * 返回应使用的 assembleRoleId；mismatch 时 UI 应提示「当前会话仍是旧主角」。
 */
export async function assertSessionRole(sessionRoleId: string | undefined | null): Promise<{
  assembleRoleId: string
  activeRoleId: string
  mismatch: boolean
}> {
  const activeRoleId = await getActiveRoleId()
  const bound = (sessionRoleId || '').trim()
  if (!bound) {
    return { assembleRoleId: activeRoleId, activeRoleId, mismatch: false }
  }
  return {
    assembleRoleId: bound,
    activeRoleId,
    mismatch: bound !== activeRoleId,
  }
}

function broadcastRoleChanged(payload: {
  roleId: string
  catchupQueued: boolean
  previousRoleId: string
  reacquaint: { title: string; body: string; toast: string }
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('companion:role-changed', payload)
  }
}

/**
 * 完整切换活跃主角。
 * 成功：pause 旧角色 → 写 activeRoleId → 若新角色曾暂停则 runCatchup，否则 resume。
 * 并向渲染进程广播 Surfaces rebind。
 */
export async function requestSwitch(roleId: string): Promise<SwitchResult> {
  const universeId = await settings.getSetting('universeId')
  if (!identity.isKnownProtagonist(roleId, universeId)) {
    return { ok: false, code: 'UNKNOWN_ROLE' }
  }
  const current = await getActiveRoleId()
  if (current === roleId) {
    return { ok: false, code: 'ALREADY_ACTIVE' }
  }
  if (isStreamingActive()) {
    return { ok: false, code: 'SESSION_ACTIVE' }
  }

  const now = Date.now()
  await pauseRole(current, now)

  const targetPrev = await getRoleState(roleId)
  const pausedAt = targetPrev?.pausedAt ?? null

  await settings.setSetting('activeRoleId', roleId)

  let catchupQueued = false
  if (pausedAt != null) {
    await runCatchup(roleId, pausedAt, now)
    catchupQueued = true
  } else {
    await resumeRole(roleId)
  }

  // M28-G3：再认识微文案（不碰成长时钟）
  let fromName = current
  let toName = roleId
  try {
    fromName = identity.loadRolePack(current, universeId).name
    toName = identity.loadRolePack(roleId, universeId).name
  } catch {
    /* 名缺失时用 id */
  }
  const reacquaint = buildReacquaintCopy({
    fromName,
    toName,
    catchupQueued,
  })

  broadcastRoleChanged({
    roleId,
    catchupQueued,
    previousRoleId: current,
    reacquaint,
  })

  // M30-G1：第一次切到该主角（反成就绑架，仅记一次）
  void recordAndBroadcastMilestone(roleId, 'first_role_switch', {
    roleDisplayName: toName,
  }).catch(() => {})

  return { ok: true, catchupQueued, reacquaint }
}
