/**
 * Approval Store — 审批记录管理
 *
 * 记住用户对命令的审批决策：
 * - session-scoped: 本次会话内有效（内存 Map，会话结束/重启清空）
 * - persistent:     跨会话持久有效（内存 Map 镜像 + SQLite 落盘，重启后预加载）
 *
 * 设计：persistent 审批用「内存缓存 + 异步落盘」模式，保持 checkApproval 同步 API
 * 不变（权限链和 shell_exec 依赖同步读取），启动时 loadPersistentApprovals()
 * 从 SQLite 预热内存缓存。
 */

import { getDatabase, persist } from '../storage/database'
import { createLogger } from '../utils/logger'

const log = createLogger('ApprovalStore')

export type ApprovalScope = 'once' | 'session' | 'persistent'

interface ApprovalRecord {
  commandPattern: string
  scope: ApprovalScope
  approved: boolean
  createdAt: number
}

const sessionApprovals = new Map<string, ApprovalRecord>()
const persistentApprovals = new Map<string, ApprovalRecord>()

function normalizeCommand(command: string): string {
  return command.trim().split(/\s+/).slice(0, 3).join(' ')
}

/**
 * 启动时从 SQLite 预加载持久审批到内存缓存。
 * 应在 app ready 后调用一次（IPC 初始化时）。
 */
export async function loadPersistentApprovals(): Promise<void> {
  try {
    const db = await getDatabase()
    const stmt = db.prepare('SELECT command_pattern, approved, created_at FROM persistent_approvals')
    let count = 0
    while (stmt.step()) {
      const row = stmt.getAsObject() as { command_pattern: string; approved: number; created_at: number }
      persistentApprovals.set(row.command_pattern, {
        commandPattern: row.command_pattern,
        scope: 'persistent',
        approved: row.approved === 1,
        createdAt: row.created_at,
      })
      count++
    }
    stmt.free()
    log.info('Persistent approvals loaded', { count })
  } catch (err) {
    log.warn('Failed to load persistent approvals', { error: String(err) })
  }
}

/** 将一条持久审批异步写入 SQLite（内存缓存已在 recordApproval 里同步更新） */
async function persistApprovalToDisk(record: ApprovalRecord): Promise<void> {
  try {
    const db = await getDatabase()
    db.run(
      `INSERT INTO persistent_approvals (command_pattern, approved, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(command_pattern) DO UPDATE SET approved = excluded.approved, created_at = excluded.created_at`,
      [record.commandPattern, record.approved ? 1 : 0, record.createdAt],
    )
    persist()
  } catch (err) {
    log.warn('Failed to persist approval to disk', { command: record.commandPattern, error: String(err) })
  }
}

export function checkApproval(command: string): boolean | null {
  const key = normalizeCommand(command)

  const persistent = persistentApprovals.get(key)
  if (persistent) return persistent.approved

  const session = sessionApprovals.get(key)
  if (session) return session.approved

  return null
}

export function recordApproval(
  command: string,
  approved: boolean,
  scope: ApprovalScope = 'once',
): void {
  if (scope === 'once') return

  const key = normalizeCommand(command)
  const record: ApprovalRecord = {
    commandPattern: key,
    scope,
    approved,
    createdAt: Date.now(),
  }

  if (scope === 'session') {
    sessionApprovals.set(key, record)
    log.info('Session approval recorded', { command: key, approved })
  } else if (scope === 'persistent') {
    // 内存缓存同步更新（保证 checkApproval 立即可见），SQLite 异步落盘
    persistentApprovals.set(key, record)
    log.info('Persistent approval recorded', { command: key, approved })
    void persistApprovalToDisk(record)
  }
}

export function clearSessionApprovals(): void {
  sessionApprovals.clear()
}

export function getApprovalStats(): { session: number; persistent: number } {
  return {
    session: sessionApprovals.size,
    persistent: persistentApprovals.size,
  }
}
