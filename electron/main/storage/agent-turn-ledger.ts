import { createHash } from 'node:crypto'
import { withDatabaseTransaction } from './database'

export type AgentTurnStatus = 'running' | 'completed' | 'failed' | 'aborted' | 'needs_recovery'

/**
 * 记录主对话回合的本地生命周期。
 *
 * 背景：模型请求和工具执行可能跨越窗口、网络和进程生命周期，只有会话消息无法区分
 * “尚未发出”“已发出但未收尾”和“已提交终态”。设计意图：先落一条轻量 turn 事实，
 * 再由 Runtime 更新终态，保留可恢复诊断；不把网络或模型等待放进数据库事务。
 * 关键约束：该账本只记录生命周期元数据，不保存 Prompt 正文、凭据或工具原始输出。
 */
export async function startAgentTurn(input: {
  turnId: string
  sessionId: string
  model: string
  requestFingerprint: string
}): Promise<void> {
  const now = Date.now()
  const requestHash = createHash('sha256').update(input.requestFingerprint).digest('hex')
  await withDatabaseTransaction(async (db) => {
    db.run(`INSERT INTO agent_turns
      (turn_id, session_id, status, model, request_hash, attempt, started_at, updated_at)
      VALUES (?, ?, 'running', ?, ?, 0, ?, ?)`,
    [input.turnId, input.sessionId, input.model, requestHash, now, now])
  })
}

export async function updateAgentTurn(
  turnId: string,
  update: { status: AgentTurnStatus; terminalReason?: string; errorMessage?: string; attempt?: number },
): Promise<void> {
  await withDatabaseTransaction(async (db) => {
    db.run(`UPDATE agent_turns
      SET status = ?, updated_at = ?, terminal_reason = ?, error_message = ?,
          attempt = COALESCE(?, attempt)
      WHERE turn_id = ?`, [
      update.status,
      Date.now(),
      update.terminalReason ?? null,
      update.errorMessage?.slice(0, 500) ?? null,
      update.attempt ?? null,
      turnId,
    ])
  })
}

export async function markInterruptedAgentTurns(sessionId?: string): Promise<number> {
  return withDatabaseTransaction(async (db) => {
    const where = sessionId ? "WHERE session_id = ? AND status = 'running'" : "WHERE status = 'running'"
    const args = sessionId ? [sessionId] : []
    const count = Number(db.exec(`SELECT COUNT(*) AS count FROM agent_turns ${where}`, args)[0]?.values[0]?.[0] || 0)
    if (!count) return 0
    db.run(`UPDATE agent_turns
      SET status = 'needs_recovery', updated_at = ?, terminal_reason = ? ${where}`,
    [Date.now(), 'process_interrupted', ...args])
    return count
  })
}
