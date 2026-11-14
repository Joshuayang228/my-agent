/**
 * 会话到生活的因果反哺引擎（Chat to Life Resonance）
 *
 * 背景：角色与用户在主会话中聊到书籍、电影、音乐、美食或行动愿望时，若会话结束后状态完全不发生改变，
 * 就会产生“聊天只是纯文本生成、对角色生活毫无影响”的割裂感与机器感。
 * 设计意图：在主对话结束后异步结算，通过受控小模型提取对话中的具体文化推荐或生活意向：
 * 1. 文化推荐（书/影/音）：自动为主角生成状态为 planned / queued 的文化资产（待读/待看/待听），并沉淀为心愿；
 * 2. 生活与美食意愿：存为 active 心愿意向，在下一日日剧本生成时作为生活上下文被吸收（absorbed_in_script），
 *    形成“昨天聊到了章鱼烧，今天午餐真的去尝试了”的跨场景闭环。
 * 关键约束：纯主会话结算（sessionKind === 'main'），召唤会话不触发；对话无具体推荐或普通闲聊时不凭空捏造；
 * 异步执行且失败静默降级，不阻断主对话响应。
 */

import { randomUUID } from 'node:crypto'
import type {
  CompanionLifeResonance,
  CompanionLifeResonanceKind,
  LLMConfig,
} from '../../../../src/shared/types'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { getDatabase, persist } from '../../storage/database'
import { getSession } from '../../storage/session-store'
import { createLogger } from '../../utils/logger'
import { loadRolePack } from '../identity/loader'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import {
  compileChatResonanceRequest,
  compileCultureReviewRequest,
} from '../../prompts/registered-request'
import { createAsset, deleteAsset, getAsset, updateAsset, ASSET_KIND_CULTURE } from './assets'
import { getEventById, getMomentByEventId, insertEvent, insertMoment, recordEventExecution } from './store'
import { appendCompanionDomainEvent } from '../core/events/domain-events'
import { executeCompanionCommand } from '../core/commands/gateway'
import { enqueueCompanionOutbox } from '../core/outbox/outbox'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import { recordCompanionProjection } from '../core/projections/receipts'
import { linkCompanionExecutionEvent } from '../core/execution/ledger'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'

const log = createLogger('ChatResonance')

export async function ensureResonanceTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_life_resonances (
      id                    TEXT PRIMARY KEY,
      role_id               TEXT NOT NULL,
      session_id            TEXT NOT NULL,
      kind                  TEXT NOT NULL,
      title                 TEXT NOT NULL,
      target_name           TEXT NOT NULL,
      user_quote            TEXT NOT NULL,
      reason                TEXT NOT NULL,
      culture_type          TEXT,
      status                TEXT NOT NULL DEFAULT 'active',
      created_at            INTEGER NOT NULL,
      absorbed_at           INTEGER,
      completed_at          INTEGER,
      feedback_text         TEXT,
      feedback_delivered_at INTEGER,
      asset_id              TEXT
    )
  `)
  try { db.run('ALTER TABLE companion_life_resonances ADD COLUMN completed_at INTEGER') } catch { /* existing */ }
  try { db.run('ALTER TABLE companion_life_resonances ADD COLUMN feedback_text TEXT') } catch { /* existing */ }
  try { db.run('ALTER TABLE companion_life_resonances ADD COLUMN feedback_delivered_at INTEGER') } catch { /* existing */ }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_companion_resonances_role_status
      ON companion_life_resonances(role_id, status, created_at DESC)
  `)
}

function rowToResonance(row: Record<string, unknown>): CompanionLifeResonance {
  return {
    id: row.id as string,
    roleId: row.role_id as string,
    sessionId: row.session_id as string,
    kind: row.kind as CompanionLifeResonanceKind,
    title: row.title as string,
    targetName: row.target_name as string,
    userQuote: row.user_quote as string,
    reason: row.reason as string,
    cultureType: (row.culture_type as 'reading' | 'film' | 'music') || null,
    status: row.status as CompanionLifeResonance['status'],
    createdAt: row.created_at as number,
    absorbedAt: typeof row.absorbed_at === 'number' ? row.absorbed_at : null,
    completedAt: typeof row.completed_at === 'number' ? row.completed_at : null,
    feedbackText: (row.feedback_text as string) || null,
    feedbackDeliveredAt: typeof row.feedback_delivered_at === 'number' ? row.feedback_delivered_at : null,
    assetId: (row.asset_id as string) || null,
  }
}

export async function listLifeResonances(
  roleId: string,
  opts?: { status?: string; limit?: number },
): Promise<CompanionLifeResonance[]> {
  await ensureResonanceTable()
  const db = await getDatabase()
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 20))
  let stmt: import('sql.js').Statement
  if (opts?.status) {
    stmt = db.prepare(
      'SELECT * FROM companion_life_resonances WHERE role_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?',
    )
    stmt.bind([roleId, opts.status, limit])
  } else {
    stmt = db.prepare(
      'SELECT * FROM companion_life_resonances WHERE role_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    stmt.bind([roleId, limit])
  }

  const results: CompanionLifeResonance[] = []
  try {
    while (stmt.step()) {
      results.push(rowToResonance(stmt.getAsObject()))
    }
  } finally {
    stmt.free()
  }
  return results
}

export async function markResonancesAbsorbed(ids: string[]): Promise<void> {
  if (!ids.length) return
  await ensureResonanceTable()
  const db = await getDatabase()
  const now = Date.now()
  for (const id of ids) {
    db.run(
      "UPDATE companion_life_resonances SET status = 'absorbed_in_script', absorbed_at = ? WHERE id = ?",
      [now, id],
    )
  }
  persist()
}

interface ParsedResonanceOutput {
  hasResonance: boolean
  kind?: CompanionLifeResonanceKind
  cultureType?: 'reading' | 'film' | 'music' | null
  title?: string
  targetName?: string
  userQuote?: string
  reason?: string
}

function parseResonanceJson(raw: string): ParsedResonanceOutput | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.hasResonance !== true) return { hasResonance: false }

    const kind = String(parsed.kind || '') as CompanionLifeResonanceKind
    if (!['culture_wish', 'day_activity_wish', 'travel_wish', 'cuisine_wish'].includes(kind)) {
      return { hasResonance: false }
    }

    const title = typeof parsed.title === 'string' ? parsed.title.trim() : ''
    const targetName = typeof parsed.targetName === 'string' ? parsed.targetName.trim() : ''
    if (!title || !targetName || targetName.length > 40) return { hasResonance: false }

    const userQuote = typeof parsed.userQuote === 'string' ? parsed.userQuote.trim() : ''
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : ''
    const rawCulture = parsed.cultureType
    const cultureType = rawCulture === 'reading' || rawCulture === 'film' || rawCulture === 'music'
      ? rawCulture
      : null

    return {
      hasResonance: true,
      kind,
      cultureType,
      title: title.slice(0, 30),
      targetName: targetName.slice(0, 40),
      userQuote: userQuote.slice(0, 120),
      reason: reason.slice(0, 150),
    }
  } catch {
    return null
  }
}

export async function settleChatResonance(
  roleId: string,
  sessionId: string,
  llmConfig?: LLMConfig,
): Promise<{ triggered: boolean; resonance?: CompanionLifeResonance }> {
  if (!llmConfig || !hasLLMAuthentication(llmConfig)) {
    return { triggered: false }
  }

  try {
    const session = await getSession(sessionId)
    if (!session || session.sessionKind !== 'main' || session.roleId !== roleId) {
      return { triggered: false }
    }

    const meaningfulMsgs = session.messages.filter(
      (m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim(),
    )
    if (meaningfulMsgs.length < 2) return { triggered: false }

    const recent = meaningfulMsgs.slice(-6)
    const hasMeaningfulUserMsg = recent.some((m) => m.role === 'user' && m.content.trim().length >= 4)
    if (!hasMeaningfulUserMsg) return { triggered: false }

    const pack = loadRolePack(roleId)
    const recentDialogue = recent
      .map((m) => `${m.role === 'user' ? '用户' : pack.name}：${m.content}`)
      .join('\n')

    const raw = await chatComplete({
      config: {
        ...llmConfig,
        maxTokens: 320,
        temperature: 0.3,
      },
      request: compileChatResonanceRequest({
        protagonistName: pack.name,
        protagonistBrief: `${pack.description}\n${pack.voice ?? ''}`.slice(0, 500),
        recentDialogue: recentDialogue.slice(0, 2000),
      }),
      caller: 'chat-resonance',
    })

    const parsed = parseResonanceJson(raw)
    if (!parsed || !parsed.hasResonance || !parsed.kind || !parsed.targetName) {
      return { triggered: false }
    }

    await ensureResonanceTable()
    const db = await getDatabase()

    // 查重：避免 7 天内重复记录同一实体心愿
    const sevenDaysAgo = Date.now() - 7 * 86400 * 1000
    const dupStmt = db.prepare(
      'SELECT id FROM companion_life_resonances WHERE role_id = ? AND target_name = ? AND created_at > ?',
    )
    dupStmt.bind([roleId, parsed.targetName, sevenDaysAgo])
    const isDup = dupStmt.step()
    dupStmt.free()
    if (isDup) {
      log.info('Chat resonance deduplicated', { roleId, targetName: parsed.targetName })
      return { triggered: false }
    }

    let assetId: string | null = null

    // 若属于文化心愿（书/影/音），为主角自动在文化角创建 planned / queued 资产
    if (parsed.kind === 'culture_wish') {
      const cultureType = parsed.cultureType || 'reading'
      const statusPayload = cultureType === 'music'
        ? { listeningStatus: 'queued' }
        : cultureType === 'film'
        ? { watchStatus: 'planned' }
        : { readingStatus: 'planned' }

      const createRes = await createAsset({
        roleId,
        kind: ASSET_KIND_CULTURE,
        name: parsed.targetName,
        payload: {
          type: cultureType,
          ...statusPayload,
          summary: `源自与用户的交流对话：“${parsed.userQuote || parsed.targetName}”`,
          note: `心愿《${parsed.targetName}》：${parsed.reason || '用户在聊天中推荐，记下准备体验。'}`,
        },
      })
      if (createRes.ok) {
        assetId = createRes.asset.id
      }
    }

    const resonance: CompanionLifeResonance = {
      id: randomUUID(),
      roleId,
      sessionId,
      kind: parsed.kind,
      title: parsed.title || `心愿：${parsed.targetName}`,
      targetName: parsed.targetName,
      userQuote: parsed.userQuote || '',
      reason: parsed.reason || '',
      cultureType: parsed.cultureType || null,
      status: 'active',
      createdAt: Date.now(),
      absorbedAt: null,
      assetId,
    }

    try {
      db.run(
        `INSERT INTO companion_life_resonances
         (id, role_id, session_id, kind, title, target_name, user_quote, reason, culture_type, status, created_at, absorbed_at, asset_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resonance.id,
          resonance.roleId,
          resonance.sessionId,
          resonance.kind,
          resonance.title,
          resonance.targetName,
          resonance.userQuote,
          resonance.reason,
          resonance.cultureType ?? null,
          resonance.status,
          resonance.createdAt,
          resonance.absorbedAt,
          resonance.assetId,
        ],
      )
    } catch (error) {
      if (assetId) {
        await deleteAsset(assetId, { expectedRoleId: roleId }).catch((cleanupError) => {
          log.warn('Failed to clean up orphaned resonance asset', { roleId, assetId, error: String(cleanupError) })
        })
      }
      throw error
    }
    persist()

    const message = parsed.kind === 'culture_wish'
      ? `${pack.name} 把「${parsed.targetName}」加入了待体验文化清单！`
      : `${pack.name} 记下了关于「${parsed.targetName}」的生活心愿！`

    const resonancePayload = { roleId, resonance, message }
    await recordCompanionEventAndNotify({
      roleId,
      type: 'culture_resonance_created',
      sourceType: 'chat_resonance',
      sourceId: resonance.id,
      idempotencyKey: `culture-resonance-created:${resonance.id}`,
      occurredAt: resonance.createdAt,
      payload: resonancePayload as unknown as Record<string, unknown>,
      notification: {
        kind: 'life-resonance-created',
        dedupeKey: `culture-resonance-created:${resonance.id}`,
        payload: resonancePayload as unknown as Record<string, unknown>,
      },
    })

    log.info('Chat resonance settled', { roleId, kind: parsed.kind, targetName: parsed.targetName, assetId })
    return { triggered: true, resonance }
  } catch (err) {
    log.warn('Failed to settle chat resonance', { roleId, error: String(err) })
    return { triggered: false }
  }
}



export interface CompleteCultureResonanceOptions {
  llmConfig?: LLMConfig
  mockResponse?: {
    reviewText: string
    chatOpener: string
    shouldPostMoment?: boolean
    momentText?: string
  }
}

/**
 * 文化心愿体验闭环：生成角色第一人称感悟、下次主动交流话头及朋友圈分享
 *
 * 背景：角色将用户推荐的书籍/影视/音乐记录为文化资产并被日剧本吸收后，若体验过程毫无下文，
 * 用户就会觉得“推荐完就没了声响”。
 * 设计意图：受控小模型以角色人设口吻生成专属评语（reviewText），更新文化资产为 completed；
 * 同时生成下次聊天引子（chatOpener）与可选朋友圈文案，形成因果体验闭环。
 * 关键约束：幂等执行，已 completed 的心愿不重复触发；失败时优雅保底，不抛未捕获异常。
 */
export async function completeCultureResonance(
  resonanceId: string,
  roleId: string,
  opts?: CompleteCultureResonanceOptions,
): Promise<{ ok: boolean; resonance?: CompanionLifeResonance; error?: string }> {
  await ensureResonanceTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM companion_life_resonances WHERE id = ? AND role_id = ?')
  let row: Record<string, unknown> | null = null
  try {
    stmt.bind([resonanceId, roleId])
    if (stmt.step()) row = stmt.getAsObject()
  } finally {
    stmt.free()
  }
  if (!row) {
    return { ok: false, error: '心愿不存在' }
  }
  const currentResonance = rowToResonance(row)
  if (currentResonance.status === 'completed') {
    return { ok: true, resonance: currentResonance }
  }

  const pack = loadRolePack(roleId)
  let parsedReview: {
    reviewText: string
    chatOpener: string
    shouldPostMoment?: boolean
    momentText?: string
  } | null = null

  if (opts?.mockResponse) {
    parsedReview = opts.mockResponse
  } else if (opts?.llmConfig && hasLLMAuthentication(opts.llmConfig)) {
    try {
      const raw = await chatComplete({
        config: {
          ...opts.llmConfig,
          maxTokens: 400,
          temperature: 0.7,
        },
        request: compileCultureReviewRequest({
          protagonistName: pack.name,
          protagonistBrief: `${pack.description}\n${pack.voice ?? ''}`.slice(0, 500),
          targetName: currentResonance.targetName,
          cultureType: currentResonance.cultureType || 'reading',
          userQuote: currentResonance.userQuote,
          userReason: currentResonance.reason,
        }),
        caller: 'culture-review',
      })
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const json = JSON.parse(match[0]) as Record<string, unknown>
        if (json && typeof json.reviewText === 'string' && typeof json.chatOpener === 'string') {
          parsedReview = {
            reviewText: json.reviewText.trim(),
            chatOpener: json.chatOpener.trim(),
            shouldPostMoment: Boolean(json.shouldPostMoment),
            momentText: typeof json.momentText === 'string' ? json.momentText.trim() : undefined,
          }
        }
      }
    } catch (err) {
      log.warn('Culture review generation failed, falling back to rule-based review', { roleId, error: String(err) })
    }
  }

  // 规则保底（若 LLM 失败或未配 LLM）
  if (!parsedReview) {
    const isLuffy = roleId === 'luffy'
    const verb = currentResonance.cultureType === 'film' ? '看完' : currentResonance.cultureType === 'music' ? '听完' : '读完'
    const reviewText = isLuffy
      ? `哈哈！终于把《${currentResonance.targetName}》给${verb}了！里面有些地方太有意思了，真是一场大冒险！`
      : `体验完了《${currentResonance.targetName}》，感觉很有收获。`
    const chatOpener = isLuffy
      ? `喂！你之前跟我推荐的《${currentResonance.targetName}》，我已经全${verb}了！快跟我聊聊！`
      : `之前你推荐的《${currentResonance.targetName}》我已经体验完了，下次聊聊感想吧。`
    parsedReview = {
      reviewText,
      chatOpener,
      shouldPostMoment: true,
      momentText: isLuffy
        ? `《${currentResonance.targetName}》超棒的！下次出海还要找更多好玩的！`
        : `把之前记下的《${currentResonance.targetName}》体验完了，很充实。`,
    }
  }

  const now = Date.now()

  // 1. 若有关联文化资产，更新资产状态为 completed 并将 reviewText 追加至 readingNotes
  if (currentResonance.assetId) {
    try {
      const existingAsset = await getAsset(currentResonance.assetId)
      if (!existingAsset) return { ok: false, error: '文化资料不存在，体验结果会在下次生活推进时重试。' }
      const type = (existingAsset.payload.type as string) || currentResonance.cultureType || 'reading'
      const statusField = type === 'music' ? 'listeningStatus' : type === 'film' ? 'watchStatus' : 'readingStatus'
      const completedStatusVal = 'finished'
      const existingNotes = Array.isArray(existingAsset.payload.readingNotes)
        ? [...existingAsset.payload.readingNotes]
        : []
      existingNotes.push({
        id: `review:${randomUUID().slice(0, 8)}`,
        text: parsedReview.reviewText,
        author: 'companion',
        createdAt: now,
      })

      const updateResult = await updateAsset(currentResonance.assetId, {
        payload: {
          [statusField]: completedStatusVal,
          readingNotes: existingNotes,
          note: parsedReview.reviewText,
        },
      }, { expectedRoleId: roleId })
      if (!updateResult.ok) return { ok: false, error: '文化资料更新失败，体验结果会在下次生活推进时重试。' }
    } catch (err) {
      log.warn('Failed to update asset on resonance complete', { assetId: currentResonance.assetId, error: String(err) })
      return { ok: false, error: '文化资料更新失败，体验结果会在下次生活推进时重试。' }
    }
  }

  const updatedResonance: CompanionLifeResonance = {
    ...currentResonance,
    status: 'completed',
    completedAt: now,
    feedbackText: parsedReview.chatOpener,
  }
  const notificationMessage = `${pack.name} 已经体验完了「${currentResonance.targetName}」！`

  // 2. 旧文化状态和 Core 体验事实共享本地事务，避免状态已完成但事件账本缺失。
  try {
    await withCompanionUnitOfWork(async () => {
      db.run(
        `UPDATE companion_life_resonances
         SET status = 'completed', completed_at = ?, feedback_text = ?
         WHERE id = ?`,
        [now, parsedReview.chatOpener, currentResonance.id],
      )
      await executeCompanionCommand({
        roleId,
        actionType: 'culture-experience-completed',
        correlationId: currentResonance.id,
        handler: async (context) => {
          const domainEvent = await appendCompanionDomainEvent({
            roleId,
            universeId: 'default',
            type: 'culture_experience_completed',
            sourceType: 'chat_resonance',
            sourceId: currentResonance.id,
            causationId: currentResonance.id,
            correlationId: context.correlationId,
            idempotencyKey: `culture-experience-completed:${currentResonance.id}`,
            occurredAt: now,
            payload: {
              resonanceId: currentResonance.id,
              assetId: currentResonance.assetId,
              targetName: currentResonance.targetName,
              reviewText: parsedReview.reviewText,
              chatOpener: parsedReview.chatOpener,
            },
            schemaVersion: 1,
          })
          await linkCompanionExecutionEvent({ executionId: context.executionId, eventId: domainEvent.id })
          await recordCompanionProjection({ projectionName: 'legacy-culture-resonance', eventId: domainEvent.id })
          await enqueueCompanionOutbox({
            roleId,
            eventId: domainEvent.id,
            kind: 'resonance-completed',
            dedupeKey: `resonance-completed:${currentResonance.id}`,
            payload: { roleId, resonance: updatedResonance, message: notificationMessage },
          })
        },
      })
    })
    await dispatchCompanionWindowOutbox()
  } catch (err) {
    log.warn('Culture completion transaction failed; status remains retryable', { roleId, resonanceId: currentResonance.id, error: String(err) })
    return { ok: false, error: '文化体验记录暂时未完成，请稍后重试。' }
  }

  // 3. 若有朋友圈分享意向，插入 Moment
  if (parsedReview.shouldPostMoment && parsedReview.momentText) {
    try {
      const eventId = `resonance-${currentResonance.id}`
      const event = await getEventById(eventId) ?? await insertEvent({
        id: eventId,
        roleId,
        scheduledAt: now,
        status: 'published',
        type: 'moment',
        dayScriptId: null,
        payload: {
          activity: '文化体验回响',
          story: parsedReview.momentText,
          resonanceId: currentResonance.id,
          targetName: currentResonance.targetName,
          kind: currentResonance.kind,
        },
      })
      const moment = await insertMoment({
        roleId,
        eventId: event.id,
        publishedAt: now,
        text: parsedReview.momentText,
        meta: { resonanceId: currentResonance.id, targetName: currentResonance.targetName, kind: currentResonance.kind },
      }) ?? await getMomentByEventId(roleId, event.id)
      await recordEventExecution({ roleId, eventId: event.id, attemptedAt: now, action: 'published', reason: 'culture-resonance-completed', momentId: moment?.id ?? null })
    } catch (err) {
      log.warn('Failed to insert moment from resonance review', { roleId, error: String(err) })
    }
  }

  // 4. 共同心愿达成触发专属信物奖励（如梅利号金色小羊铃铛）
  if (roleId === 'luffy') {
    void (async () => {
      try {
        const { triggerGiftKeepsake, listKeepsakes } = await import('../growth/relationship-keepsake')
        const owned = await listKeepsakes(roleId)
        if (!owned.some((k) => k.id === 'luffy-merry-bell')) {
          await triggerGiftKeepsake(
            roleId,
            'luffy-merry-bell',
            `共同心愿达成·体验完「${currentResonance.targetName}」的专属纪念`,
            now,
          )
        }
      } catch (err) {
        log.warn('Failed to check keepsake on resonance completed', { roleId, error: String(err) })
      }
    })()
  }

  log.info('Culture resonance completed', { roleId, resonanceId: currentResonance.id, targetName: currentResonance.targetName })
  return { ok: true, resonance: updatedResonance }
}

/**
 * 查询等待向用户倾诉/反馈的心愿感悟（还未在对话中被消费）
 */
export async function getPendingResonanceFeedback(roleId: string): Promise<CompanionLifeResonance | null> {
  await ensureResonanceTable()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT * FROM companion_life_resonances
     WHERE role_id = ? AND status = 'completed' AND feedback_text IS NOT NULL AND feedback_delivered_at IS NULL
     ORDER BY completed_at DESC LIMIT 1`,
  )
  stmt.bind([roleId])
  try {
    if (stmt.step()) {
      return rowToResonance(stmt.getAsObject())
    }
  } finally {
    stmt.free()
  }
  return null
}

/**
 * 标记心愿反馈已在对话中向用户自然带出
 */
export async function markResonanceFeedbackDelivered(resonanceId: string): Promise<void> {
  await ensureResonanceTable()
  const db = await getDatabase()
  db.run(
    'UPDATE companion_life_resonances SET feedback_delivered_at = ? WHERE id = ?',
    [Date.now(), resonanceId],
  )
  persist()
}

/**
 * 检查已被日剧本吸收的心愿，当体验时间满足或剧本事件推移时，自动推进并生成体验闭环
 */
export async function checkAndProgressAbsorbedResonances(
  roleId: string,
  now: number,
  opts?: { llmConfig?: LLMConfig },
): Promise<number> {
  await ensureResonanceTable()
  const db = await getDatabase()
  const stmt = db.prepare(
    "SELECT * FROM companion_life_resonances WHERE role_id = ? AND status = 'absorbed_in_script'",
  )
  stmt.bind([roleId])
  const absorbed: CompanionLifeResonance[] = []
  try {
    while (stmt.step()) {
      absorbed.push(rowToResonance(stmt.getAsObject()))
    }
  } finally {
    stmt.free()
  }

  let completedCount = 0
  const FOUR_HOURS = 4 * 3600 * 1000

  for (const item of absorbed) {
    const absorbedAt = item.absorbedAt ?? item.createdAt
    if (now - absorbedAt >= FOUR_HOURS) {
      const config = opts?.llmConfig ?? (await loadAuxLLMConfig())
      const res = await completeCultureResonance(item.id, roleId, { llmConfig: config })
      if (res.ok) completedCount++
    }
  }

  return completedCount
}
