import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { BACKUP_MEDIA_MARKER, markPendingBackupMedia, recoverPendingBackupMedia } from '../../electron/main/storage/backup-recovery'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
let root: string
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'backup-recovery-')))
  db = new SQL.Database()
  db.run('CREATE TABLE messages (generated_images TEXT)')
})
afterEach(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }) })
function mediaDirectory(mark = true) {
  const directory = fs.mkdtempSync(path.join(root, 'restored-images-'))
  if (mark) markPendingBackupMedia(directory)
  fs.writeFileSync(path.join(directory, 'image.png'), 'fixture')
  return directory
}

it('提交前崩溃遗留媒体被清理，提交后崩溃保留已引用媒体并完成标记', () => {
  const pending = mediaDirectory()
  const committed = mediaDirectory()
  db.run('INSERT INTO messages VALUES (?)', [JSON.stringify([{ path: path.join(committed, 'image.png') }])])
  const bytes = db.export(); db.close(); db = new SQL.Database(bytes)
  expect(recoverPendingBackupMedia(db, root)).toEqual({ removed: 1, retained: 1 })
  expect(fs.existsSync(pending)).toBe(false)
  expect(fs.readFileSync(path.join(committed, 'image.png'), 'utf8')).toBe('fixture')
  expect(fs.existsSync(path.join(committed, BACKUP_MEDIA_MARKER))).toBe(false)
  expect(recoverPendingBackupMedia(db, root)).toEqual({ removed: 0, retained: 0 })
})

it('没有管理标记、标记被篡改和链接目录都不触碰', () => {
  const unmanaged = mediaDirectory(false)
  const tampered = mediaDirectory()
  fs.writeFileSync(path.join(tampered, BACKUP_MEDIA_MARKER), 'not-owned')
  const target = path.join(root, 'external')
  fs.mkdirSync(target)
  markPendingBackupMedia(target)
  const linked = path.join(root, 'restored-images-ABC123')
  fs.symlinkSync(target, linked, 'junction')
  expect(recoverPendingBackupMedia(db, root)).toEqual({ removed: 0, retained: 0 })
  expect(fs.existsSync(unmanaged)).toBe(true)
  expect(fs.existsSync(tampered)).toBe(true)
  expect(fs.existsSync(target)).toBe(true)
})

it('持久图片引用损坏时停止清理，不能把解析失败当作无人引用', () => {
  const directory = mediaDirectory()
  db.run('INSERT INTO messages VALUES (?)', ['{broken'])
  expect(recoverPendingBackupMedia(db, root)).toEqual({ removed: 0, retained: 0 })
  expect(fs.existsSync(directory)).toBe(true)
})
