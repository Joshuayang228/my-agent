import fs from 'node:fs'
import path from 'node:path'
import type { Database } from 'sql.js'
import { createLogger } from '../utils/logger'

const log = createLogger('BackupRecovery')
export const BACKUP_MEDIA_MARKER = '.my-agent-pending-import'
const MARKER_CONTENT = 'my-agent-backup-media-v1\n'

export function markPendingBackupMedia(directory: string): void {
  const fd = fs.openSync(path.join(directory, BACKUP_MEDIA_MARKER), 'wx', 0o600)
  try { fs.writeFileSync(fd, MARKER_CONTENT); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
}

export function finishBackupMedia(directory: string): void {
  try { fs.unlinkSync(path.join(directory, BACKUP_MEDIA_MARKER)) }
  catch { log.warn('Committed backup media marker retained for startup reconciliation') }
}

/**
 * 背景：图片必须先于数据库快照准备，崩溃可能留下尚未被任何会话引用的恢复目录。
 * 意图：启动时仅清理带本服务标记且未被已落盘消息引用的目录，已提交媒体只移除标记。
 * 约束：在窗口和后台任务启动前执行；不接受外部路径，不跟随目录 / 标记链接，引用损坏时停止清理。
 */
export function recoverPendingBackupMedia(db: Database, userData: string): { removed: number; retained: number } {
  const root = fs.realpathSync(userData)
  const used = new Set<string>()
  const statement = db.prepare('SELECT generated_images FROM messages WHERE generated_images IS NOT NULL')
  try {
    while (statement.step()) {
      const images: unknown = JSON.parse(String(statement.getAsObject().generated_images))
      if (!Array.isArray(images)) throw new Error('Invalid image reference list')
      for (const image of images) {
        if (!image || typeof image.path !== 'string' || !path.isAbsolute(image.path)) throw new Error('Invalid image reference')
        const relative = path.relative(root, image.path)
        if (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) used.add(relative.split(path.sep)[0])
      }
    }
  } catch {
    log.warn('Backup media reconciliation skipped because stored references are invalid')
    return { removed: 0, retained: 0 }
  } finally { statement.free() }

  let removed = 0
  let retained = 0
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!/^restored-images-[a-zA-Z0-9]{6}$/.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) continue
    const directory = path.join(root, entry.name)
    const marker = path.join(directory, BACKUP_MEDIA_MARKER)
    try {
      if (path.dirname(directory) !== root || fs.realpathSync(directory) !== directory || !fs.existsSync(marker)) continue
      const status = fs.lstatSync(marker)
      if (!status.isFile() || status.isSymbolicLink() || status.size !== Buffer.byteLength(MARKER_CONTENT)) continue
      if (fs.readFileSync(marker, 'utf8') !== MARKER_CONTENT) continue
      if (used.has(entry.name)) {
        finishBackupMedia(directory)
        retained++
      } else {
        fs.rmSync(directory, { recursive: true, force: false })
        removed++
      }
    } catch { log.warn('Pending backup media cleanup deferred') }
  }
  return { removed, retained }
}
