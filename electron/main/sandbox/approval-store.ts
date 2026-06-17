/**
 * Approval Store — 审批记录管理
 *
 * 记住用户对命令的审批决策：
 * - session-scoped: 本次会话内有效
 * - persistent:     跨会话持久有效
 */

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
    persistentApprovals.set(key, record)
    log.info('Persistent approval recorded', { command: key, approved })
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
