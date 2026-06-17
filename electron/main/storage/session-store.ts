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

export async function deleteMessage(messageId: string): Promise<void> {
  const db = await getDatabase()
  db.run('DELETE FROM messages WHERE id = ?', [messageId])
  persist()
  log.info('Message deleted', { messageId })
}

export async function addTokenUsage(sessionId: string, promptTokens: number, completionTokens: number): Promise<void> {
  const db = await getDatabase()
  db.run(
    'UPDATE sessions SET total_prompt_tokens = total_prompt_tokens + ?, total_completion_tokens = total_completion_tokens + ? WHERE id = ?',
    [promptTokens, completionTokens, sessionId],
  )
  persist()
}

export async function getTokenUsage(sessionId: string): Promise<{ promptTokens: number; completionTokens: number }> {
  const db = await getDatabase()
  const stmt = db.prepare('SELECT total_prompt_tokens, total_completion_tokens FROM sessions WHERE id = ?')
  stmt.bind([sessionId])
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    stmt.free()
    return {
      promptTokens: (row.total_prompt_tokens as number) || 0,
      completionTokens: (row.total_completion_tokens as number) || 0,
    }
  }
  stmt.free()
  return { promptTokens: 0, completionTokens: 0 }
}

export async function updateMessageContent(messageId: string, content: string): Promise<void> {
  const db = await getDatabase()
  db.run('UPDATE messages SET content = ? WHERE id = ?', [content, messageId])
  persist()
}

export async function autoTitle(sessionId: string): Promise<void> {
  const db = await getDatabase()
  const check = db.prepare('SELECT title FROM sessions WHERE id = ?')
  check.bind([sessionId])
  if (check.step()) {
    const row = check.getAsObject() as Record<string, unknown>
    if (row.title !== '新对话' && row.title !== 'New Chat') {
      check.free()
      return
    }
  }
  check.free()

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

export async function generateSmartTitle(
  sessionId: string,
  userMessage: string,
  assistantReply: string,
  llmConfig: { apiKey: string; baseUrl: string; model: string },
): Promise<void> {
  try {
    const resp = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: llmConfig.model,
        max_tokens: 30,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: '用极简中文为这段对话生成一个标题（4-10个字，不加引号标点）。只返回标题本身。',
          },
          { role: 'user', content: userMessage.slice(0, 200) },
          { role: 'assistant', content: assistantReply.slice(0, 200) },
        ],
      }),
    })
    if (!resp.ok) return

    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
    const title = data.choices?.[0]?.message?.content?.trim()
    if (title && title.length >= 2 && title.length <= 30) {
      await updateSessionTitle(sessionId, title)
      log.info('Smart title generated', { sessionId, title })
    }
  } catch (err) {
    log.warn('Smart title generation failed', { error: String(err) })
  }
}
