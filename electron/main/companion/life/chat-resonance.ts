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
import { BrowserWindow } from 'electron'
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
import { compileChatResonanceRequest } from '../../prompts/registered-request'
import { createAsset, ASSET_KIND_CULTURE } from './assets'

const log = createLogger('ChatResonance')

export async function ensureResonanceTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_life_resonances (
      id           TEXT PRIMARY KEY,
      role_id      TEXT NOT NULL,
      session_id   TEXT NOT NULL,
      kind         TEXT NOT NULL,
      title        TEXT NOT NULL,
      target_name  TEXT NOT NULL,
      user_quote   TEXT NOT NULL,
      reason       TEXT NOT NULL,
      culture_type TEXT,
      status       TEXT NOT NULL DEFAULT 'active',
      created_at   INTEGER NOT NULL,
      absorbed_at  INTEGER,
      asset_id     TEXT
    )
  `)
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
    persist()

    const message = parsed.kind === 'culture_wish'
      ? `${pack.name} 把「${parsed.targetName}」加入了待体验文化清单！`
      : `${pack.name} 记下了关于「${parsed.targetName}」的生活心愿！`

    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('companion:life-resonance-created', {
          roleId,
          resonance,
          message,
        })
      }
    }

    log.info('Chat resonance settled', { roleId, kind: parsed.kind, targetName: parsed.targetName, assetId })
    return { triggered: true, resonance }
  } catch (err) {
    log.warn('Failed to settle chat resonance', { roleId, error: String(err) })
    return { triggered: false }
  }
}
