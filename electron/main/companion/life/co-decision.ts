import { commitLifeAction } from '../application/commit-life-action'
/**
 * 同伴求助与生活共同决策（Co-Decisions & Shared Choices）
 *
 * 背景：角色在日常生活、探险与航行推进中，往往会遇到选择困难或人生/旅途分支节点。
 * 如果角色只顾自己推进或者只被动回答用户，缺乏真实伙伴在重大选择时「征求你意见、由你做主」的同伴共创感。
 *
 * 设计意图：
 * 1. 建立 companion_co_decisions 决策表，同一角色同一时刻最多存在 1 个 pending 决策；
 * 2. 用户作出选择后，角色即时生成符合人设的第一人称回响并作为 assistant 消息写入主会话；
 * 3. 决断记录为关键生活线索，通过 collectDayScriptLifeContext 注入次日剧本，真实影响明天的生活活动、足迹或朋友圈；
 * 4. 支持按角色 Role Pack 的 life-presets.json 播种首件初始决策。
 *
 * 关键约束：
 * 1. 采用项目统一 sql.js 引擎，遵循 prepare/bind/step/free 模式与防穿越安全红线；
 * 2. 决策选择幂等化（已 resolve 的不可重复覆盖）；
 * 3. 模型不可用或解析失败时使用高质量规则预设保底。
 */

import { randomUUID } from 'crypto'
import { getDatabase, persist } from '../../storage/database'
import { ensureLifeSchema } from '../core/persistence/life-schema'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { compileCoDecisionReactionRequest } from '../../prompts/registered-request'
import { loadRoleLifePresets } from '../identity/life-presets'
import { loadRolePack } from '../identity/loader'
import { ensureMainSessionForRole } from '../../storage/session-store'
import type {
  CompanionCoDecisionRecord,
  CompanionCoDecisionEvent,
  CoDecisionOption,
  LLMConfig,
} from '../../../../src/shared/types'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import { enqueueCompanionSessionMessage } from '../application/session-outbox'

const log = createLogger('CoDecision')

interface CoDecisionDbRow {
  id: string
  role_id: string
  title: string
  dilemma: string
  options_json: string
  status: 'pending' | 'resolved' | 'expired'
  selected_option_id: string | null
  selected_option_label: string | null
  companion_reaction: string | null
  created_at: number
  resolved_at: number | null
  absorbed_in_script: number
}

function parseOptions(jsonStr: string): CoDecisionOption[] {
  try {
    const parsed = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function rowToRecord(row: CoDecisionDbRow): CompanionCoDecisionRecord {
  return {
    id: row.id,
    roleId: row.role_id,
    title: row.title,
    dilemma: row.dilemma,
    options: parseOptions(row.options_json),
    status: row.status,
    selectedOptionId: row.selected_option_id || undefined,
    selectedOptionLabel: row.selected_option_label || undefined,
    companionReaction: row.companion_reaction || undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || undefined,
    absorbedInScript: row.absorbed_in_script === 1,
  }
}

export const GENERIC_DECISION_TEMPLATE = {
  key: 'generic-daily-choice',
  title: '今天的一点小选择',
  dilemma: '今天有几件都挺想做的事，拿不太准先从哪一件开始，你帮我挑一个吧？',
  options: [
    { id: 'opt-relax', label: '先放慢节奏歇一会', desc: '给自己留一点喘息的空间' },
    { id: 'opt-explore', label: '出门换个环境走走', desc: '看看附近有没有新鲜发现' },
  ] as CoDecisionOption[],
  defaultReactions: {} as Record<string, string>,
}

function getRoleDecisionTemplates(roleId: string) {
  const presets = loadRoleLifePresets(roleId).coDecisions
  return presets?.length ? presets : [GENERIC_DECISION_TEMPLATE]
}

export async function ensureCoDecisionTable(targetRoleId?: string): Promise<void> {
  await ensureLifeSchema()
  if (!targetRoleId) return
  const presets = loadRoleLifePresets(targetRoleId).coDecisions
  if (!presets?.length) return

  const db = await getDatabase()
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM companion_co_decisions WHERE role_id = ?')
  let count = 0
  try {
    countStmt.bind([targetRoleId])
    if (countStmt.step()) {
      const obj = countStmt.getAsObject() as { count?: number }
      count = Number(obj.count ?? 0)
    }
  } finally {
    countStmt.free()
  }

  if (count === 0) {
    const starter = presets[0]
    db.run(
      `INSERT INTO companion_co_decisions (
        id, role_id, title, dilemma, options_json, status, created_at, absorbed_in_script
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, 0)`,
      [
        `${targetRoleId}-starter-decision-1`,
        targetRoleId,
        starter.title,
        starter.dilemma,
        JSON.stringify(starter.options),
        Date.now(),
      ],
    )
    log.info('Seeded starter co-decision', { roleId: targetRoleId })
    persist()
  }
}

/** 获取当前角色唯一的待决策事项（若无则返回 null） */
export async function getPendingCoDecision(roleId: string): Promise<CompanionCoDecisionRecord | null> {
  await ensureCoDecisionTable(roleId)
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_co_decisions
    WHERE role_id = ? AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1
  `)
  let row: CoDecisionDbRow | null = null
  try {
    stmt.bind([roleId])
    if (stmt.step()) {
      row = stmt.getAsObject() as unknown as CoDecisionDbRow
    }
  } finally {
    stmt.free()
  }

  return row ? rowToRecord(row) : null
}

/** 列出角色的所有决策历史 */
export async function listCoDecisions(roleId: string): Promise<CompanionCoDecisionRecord[]> {
  await ensureCoDecisionTable(roleId)
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_co_decisions
    WHERE role_id = ?
    ORDER BY created_at DESC
  `)
  const rows: CoDecisionDbRow[] = []
  try {
    stmt.bind([roleId])
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as CoDecisionDbRow)
    }
  } finally {
    stmt.free()
  }

  return rows.map(rowToRecord)
}

/**
 * 用户对某项求助困境做出决断：
 * 1. 验证选项合法性并更新为 resolved；
 * 2. 生成第一人称即时回响并存入数据库；
 * 3. 作为 assistant 消息推入角色专属主会话；
 * 4. 广播 companion:co-decision-resolved；
 * 5. 留给次日日剧本作为关键因果依据。
 */
export async function resolveCoDecision(
  decisionId: string,
  optionId: string,
): Promise<CompanionCoDecisionRecord | null> {
  await ensureCoDecisionTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM companion_co_decisions WHERE id = ?')
  let row: CoDecisionDbRow | null = null
  try {
    stmt.bind([decisionId])
    if (stmt.step()) {
      row = stmt.getAsObject() as unknown as CoDecisionDbRow
    }
  } finally {
    stmt.free()
  }

  if (!row) {
    log.warn('Co-decision not found', { decisionId })
    return null
  }

  // 幂等保护：若该决策已被解决，直接返回当前记录，避免重复覆盖
  if (row.status !== 'pending') {
    return rowToRecord(row)
  }

  const options = parseOptions(row.options_json)
  const selectedOption = options.find((opt) => opt.id === optionId)
  if (!selectedOption) {
    log.warn('Option not found in decision', { decisionId, optionId })
    return null
  }

  const roleId = row.role_id
  let reactionText = ''

  // 1. 尝试使用 LLM 生成生动第一人称回响
  try {
    const auxConfig = await loadAuxLLMConfig()
    if (hasLLMAuthentication(auxConfig)) {
      const rolePack = loadRolePack(roleId)
      const protagonistName = rolePack?.name || '伙伴'
      const protagonistBrief = rolePack?.description || '真诚陪伴的数字伙伴'

      const request = compileCoDecisionReactionRequest({
        protagonistName,
        protagonistBrief,
        decisionTitle: row.title,
        dilemma: row.dilemma,
        selectedOptionLabel: selectedOption.label,
        selectedOptionDesc: selectedOption.desc,
      })

      const rawText = await chatComplete({
        config: auxConfig as LLMConfig,
        request,
        caller: 'co-decision',
      })
      const text = rawText?.trim()
      if (text) {
        try {
          const parsed = JSON.parse(text)
          if (typeof parsed.reactionText === 'string' && parsed.reactionText.trim()) {
            reactionText = parsed.reactionText.trim()
          } else if (typeof parsed.chatMessage === 'string' && parsed.chatMessage.trim()) {
            reactionText = parsed.chatMessage.trim()
          }
        } catch {
          if (!text.startsWith('{')) {
            reactionText = text
          }
        }
      }
    }
  } catch (err) {
    log.warn('Failed to generate co-decision reaction via LLM, falling back to rule preset', { error: String(err) })
  }

  // 2. 规则保底
  if (!reactionText) {
    const template = getRoleDecisionTemplates(roleId).find((t) => t.title === row.title)
    if (template && template.defaultReactions[optionId]) {
      reactionText = template.defaultReactions[optionId]
    } else {
      reactionText = `好！听你的，就选「${selectedOption.label}」！我们马上就这么办！冲啊！`
    }
  }

  return await commitLifeAction(async () => {
    const now = Date.now()
    db.run(
      `UPDATE companion_co_decisions
       SET status = 'resolved',
           selected_option_id = ?,
           selected_option_label = ?,
           companion_reaction = ?,
           resolved_at = ?
       WHERE id = ?`,
      [optionId, selectedOption.label, reactionText, now, decisionId],
    )

    persist()

    const selectStmt = db.prepare('SELECT * FROM companion_co_decisions WHERE id = ?')
    let updatedRow: CoDecisionDbRow | null = null
    try {
      selectStmt.bind([decisionId])
      if (selectStmt.step()) {
        updatedRow = selectStmt.getAsObject() as unknown as CoDecisionDbRow
      }
    } finally {
      selectStmt.free()
    }

    const record = updatedRow ? rowToRecord(updatedRow) : {
      id: decisionId,
      roleId,
      title: row.title,
      dilemma: row.dilemma,
      options,
      status: 'resolved' as const,
      selectedOptionId: optionId,
      selectedOptionLabel: selectedOption.label,
      companionReaction: reactionText,
      createdAt: row.created_at,
      resolvedAt: now,
      absorbedInScript: false,
    }

    // 3. 将角色反应写入主会话
    try {
      const mainSession = await ensureMainSessionForRole(roleId)
      await enqueueCompanionSessionMessage({
        roleId,
        sessionId: mainSession.id,
        message: { id: randomUUID(), role: 'assistant', content: reactionText, timestamp: Date.now() },
      })
      log.info('Co-decision reaction saved to main chat session', { roleId, mainSessionId: mainSession.id })
    } catch (err) {
      log.warn('Failed to save co-decision reaction to chat session', { error: String(err) })
    }

    // 4. 全局广播
    const eventPayload: CompanionCoDecisionEvent = {
      roleId,
      decision: record,
    }

    await recordCompanionEventAndNotify({
      roleId,
      type: 'co_decision_resolved',
      sourceType: 'co_decision',
      sourceId: record.id,
      idempotencyKey: `co-decision-resolved:${record.id}`,
      occurredAt: now,
      payload: eventPayload as unknown as Record<string, unknown>,
      notification: [
        { kind: 'timeline-updated', dedupeKey: `co-decision-timeline:${record.id}`, payload: { roleId, reason: 'co-decision-resolved' } },
        { kind: 'co-decision-resolved', dedupeKey: `co-decision-resolved:${record.id}`, payload: eventPayload as unknown as Record<string, unknown> },
      ],
    })

    return record
  })
}

/** 创建一条新的共同求助事项（如果已有待决事项则直接返回它） */
export async function createCoDecision(
  roleId: string,
  dilemmaHintOrPayload?: string | { title?: string; dilemma?: string; options?: CoDecisionOption[] },
): Promise<CompanionCoDecisionRecord | null> {
  await ensureCoDecisionTable(roleId)
  const db = await getDatabase()

  // 检查是否已有 pending
  const existingPending = await getPendingCoDecision(roleId)
  if (existingPending) {
    return existingPending
  }

  // 轮换或基于模板选取
  const stmt = db.prepare('SELECT title FROM companion_co_decisions WHERE role_id = ?')
  const existingTitles = new Set<string>()
  try {
    stmt.bind([roleId])
    while (stmt.step()) {
      const obj = stmt.getAsObject() as { title?: string }
      if (obj.title) {
        existingTitles.add(obj.title)
      }
    }
  } finally {
    stmt.free()
  }

  const templates = getRoleDecisionTemplates(roleId)
  const availableTemplate = templates.find((t) => !existingTitles.has(t.title)) || templates[0]

  const customObj = typeof dilemmaHintOrPayload === 'object' && dilemmaHintOrPayload !== null ? dilemmaHintOrPayload : null
  const customString = typeof dilemmaHintOrPayload === 'string' ? dilemmaHintOrPayload : undefined

  const finalTitle = customObj?.title || availableTemplate.title
  const finalDilemma = customObj?.dilemma || customString || availableTemplate.dilemma
  const finalOptions = customObj?.options && customObj.options.length > 0 ? customObj.options : availableTemplate.options

  const newId = `decision-${Date.now()}-${randomUUID().slice(0, 8)}`
  const now = Date.now()

  return await commitLifeAction(async () => {
    db.run(
      `INSERT INTO companion_co_decisions (
        id, role_id, title, dilemma, options_json, status, created_at, absorbed_in_script
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, 0)`,
      [
        newId,
        roleId,
        finalTitle,
        finalDilemma,
        JSON.stringify(finalOptions),
        now,
      ],
    )

    persist()

    const record: CompanionCoDecisionRecord = {
      id: newId,
      roleId,
      title: finalTitle,
      dilemma: finalDilemma,
      options: finalOptions,
      status: 'pending',
      createdAt: now,
      absorbedInScript: false,
    }

    const eventPayload: CompanionCoDecisionEvent = {
      roleId,
      decision: record,
    }

    await recordCompanionEventAndNotify({
      roleId,
      type: 'co_decision_created',
      sourceType: 'co_decision',
      sourceId: newId,
      idempotencyKey: `co-decision-created:${newId}`,
      occurredAt: now,
      payload: eventPayload as unknown as Record<string, unknown>,
      notification: {
        kind: 'co-decision-created',
        dedupeKey: `co-decision-created:${newId}`,
        payload: eventPayload as unknown as Record<string, unknown>,
      },
    })

    return record
  })
}

/** 获取最近已解决、且尚未被日剧本吸收的关键决策（供日剧本规划吸收） */
export async function getRecentResolvedCoDecision(roleId: string): Promise<CompanionCoDecisionRecord | null> {
  const db = await getDatabase()
  const exists = db.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name='companion_co_decisions' LIMIT 1")
  if (!exists.length || !exists[0].values.length) return null
  const stmt = db.prepare(`
    SELECT * FROM companion_co_decisions
    WHERE role_id = ? AND status = 'resolved' AND absorbed_in_script = 0
    ORDER BY resolved_at DESC LIMIT 1
  `)
  let row: CoDecisionDbRow | null = null
  try {
    stmt.bind([roleId])
    if (stmt.step()) {
      row = stmt.getAsObject() as unknown as CoDecisionDbRow
    }
  } finally {
    stmt.free()
  }

  return row ? rowToRecord(row) : null
}

/** 标记该决策已被次日剧本吸收 */
export async function markCoDecisionAbsorbed(decisionId: string): Promise<void> {
  await ensureCoDecisionTable()
  const db = await getDatabase()
  db.run(
    `UPDATE companion_co_decisions
     SET absorbed_in_script = 1
     WHERE id = ?`,
    [decisionId],
  )
  persist()
}
