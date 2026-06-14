import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from './database'
import { createLogger } from '../utils/logger'
import type { ChatMessage, ChatSession } from '../../../src/shared/types'

const log = createLogger('SessionStore')

export interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

// ── 会话 CRUD ──

export async function createSession(): Promise<ChatSession> {
  const db = await getDatabase()
  const id = randomUUID()
  const now = Date.now()

  db.run('INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, '新对话', now, now])
  persist()

  log.info('Session created', { id })
  return { id, messages: [], createdAt: now }
}

export async function listSessions(): Promise<SessionSummary[]> {
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT s.id, s.title, s.created_at, s.updated_at,
           (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
    FROM sessions s
    ORDER BY s.updated_at DESC
  `)

  const results: SessionSummary[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    results.push({
      id: row.id as string,
      title: row.title as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      messageCount: row.message_count as number,
    })
  }
  stmt.free()
  return results
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const db = await getDatabase()

  const sessionStmt = db.prepare('SELECT * FROM sessions WHERE id = ?')
  sessionStmt.bind([sessionId])
  if (!sessionStmt.step()) {
    sessionStmt.free()
    return null
  }
  const session = sessionStmt.getAsObject() as Record<string, unknown>
  sessionStmt.free()

  const msgStmt = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY sort_order ASC',
  )
  msgStmt.bind([sessionId])

  const messages: ChatMessage[] = []
  while (msgStmt.step()) {
    const r = msgStmt.getAsObject() as Record<string, unknown>
    messages.push({
      id: r.id as string,
      role: r.role as ChatMessage['role'],
      content: r.content as string,
      timestamp: r.created_at as number,
      ...(r.tool_calls ? { toolCalls: JSON.parse(r.tool_calls as string) } : {}),
      ...(r.tool_call_id ? { toolCallId: r.tool_call_id as string } : {}),
    })
  }
  msgStmt.free()

  return { id: session.id as string, messages, createdAt: session.created_at as number }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDatabase()
  db.run('DELETE FROM messages WHERE session_id = ?', [sessionId])
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId])
  persist()
  log.info('Session deleted', { id: sessionId })
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const db = await getDatabase()
  db.run('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?',
    [title, Date.now(), sessionId])
  persist()
}

// ── 消息持久化 ──

export async function saveMessage(sessionId: string, message: ChatMessage): Promise<void> {
  const db = await getDatabase()

  const stmt = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM messages WHERE session_id = ?',
  )
  stmt.bind([sessionId])
  stmt.step()
  const maxOrder = (stmt.getAsObject() as Record<string, unknown>).max_order as number
  stmt.free()

  db.run(`
    INSERT INTO messages (id, session_id, role, content, tool_calls, tool_call_id, created_at, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    message.id,
    sessionId,
    message.role,
    message.content,
    message.toolCalls ? JSON.stringify(message.toolCalls) : null,
    message.toolCallId || null,
    message.timestamp,
    maxOrder + 1,
  ])

  db.run('UPDATE sessions SET updated_at = ? WHERE id = ?', [Date.now(), sessionId])
  persist()
}

export async function updateMessageContent(messageId: string, content: string): Promise<void> {
  const db = await getDatabase()
  db.run('UPDATE messages SET content = ? WHERE id = ?', [content, messageId])
  persist()
}

export async function autoTitle(sessionId: string): Promise<void> {
  const db = await getDatabase()
  const stmt = db.prepare(
    "SELECT content FROM messages WHERE session_id = ? AND role = 'user' ORDER BY sort_order ASC LIMIT 1",
  )
  stmt.bind([sessionId])

  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    const content = row.content as string
    const title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
    stmt.free()
    await updateSessionTitle(sessionId, title)
  } else {
    stmt.free()
  }
}
