/**
 * 会话内文件变更账本（右坞「审阅」用）
 *
 * 背景：Agent 写盘后用户要在右栏看到改了哪些文件，不必翻工具卡。
 * 设计意图：按 sessionId 去重保留最近一次；可选 before 快照供简单 diff。
 * 关键约束：仅内存；进程重启清空；before 截断防爆。
 */

export interface SessionFileChange {
  path: string
  toolName: string
  updatedAt: number
  /** 写前内容；新建或读失败为 null；超长则截断并标 truncated */
  before: string | null
  beforeTruncated?: boolean
}

const MAX_BEFORE_CHARS = 200_000
const WRITE_TOOLS = new Set(['file_write', 'file_edit', 'apply_patch'])

const bySession = new Map<string, Map<string, SessionFileChange>>()

export function isSessionWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name)
}

export function recordSessionFileChange(
  sessionId: string,
  entry: Omit<SessionFileChange, 'updatedAt'> & { updatedAt?: number },
): SessionFileChange {
  if (!sessionId) return { ...entry, updatedAt: entry.updatedAt ?? Date.now() }
  let map = bySession.get(sessionId)
  if (!map) {
    map = new Map()
    bySession.set(sessionId, map)
  }
  let before = entry.before
  let beforeTruncated = entry.beforeTruncated
  if (before != null && before.length > MAX_BEFORE_CHARS) {
    before = before.slice(0, MAX_BEFORE_CHARS)
    beforeTruncated = true
  }
  const record: SessionFileChange = {
    path: entry.path,
    toolName: entry.toolName,
    before,
    beforeTruncated,
    updatedAt: entry.updatedAt ?? Date.now(),
  }
  map.set(record.path, record)
  return record
}

export function listSessionFileChanges(sessionId: string): SessionFileChange[] {
  const map = bySession.get(sessionId)
  if (!map) return []
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getSessionFileChange(sessionId: string, filePath: string): SessionFileChange | undefined {
  return bySession.get(sessionId)?.get(filePath)
}

export function clearSessionFileChanges(sessionId: string): void {
  bySession.delete(sessionId)
}

/** 测试用 */
export function _resetSessionFileChangesForTests(): void {
  bySession.clear()
}
