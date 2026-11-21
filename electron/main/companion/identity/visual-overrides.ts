/**
 * 角色视觉资产覆写存储（头像 / 封面壁纸）。
 *
 * 背景：此前角色头像（avatarVisualPath）与主页/世界封面（bannerVisualPath）只能从内置 Role Pack
 * 静态读取，用户无法在应用内替换本地图片或让 AI 生图更换头像与封面。
 * 设计意图：在 userData 下按 roleId 隔离保存用户自定义或 AI 生成的 avatar / banner 覆写文件，
 * 读取时覆写优先、缺省回退 Role Pack 默认资产；绝不修改仓库或打包内置的 Role Pack 文件。
 * 关键约束：roleId 必须通过安全字符白名单防路径穿越；图片字节必须经 normalizeGeneratedImage 校验
 * 且受 10MB 上限约束；写入采用临时文件 + 原子 rename；重置后立即恢复默认图。
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createLogger } from '../../utils/logger'
import { normalizeGeneratedImage } from '../../utils/generated-image-codec'

const log = createLogger('RoleVisualOverrides')

export type RoleVisualSlot = 'avatar' | 'banner'

export const ROLE_VISUAL_MAX_BYTES = 10 * 1024 * 1024 // 10MB

function resolveVisualRootDir(): string {
  try {
    // 延迟按需加载 electron，确保纯 Node 单测环境也能安全运行
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { app?: { getPath?: (name: string) => string } }
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('userData'), 'companion-visuals')
    }
  } catch {
    // 非 Electron 测试环境降级到本地临时数据目录
  }
  return path.join(process.cwd(), '.agent-data', 'companion-visuals')
}

function sanitizeRoleSegment(roleId: string): string {
  const trimmed = roleId.trim()
  if (!trimmed || !/^[a-zA-Z0-9_-]{1,80}$/.test(trimmed)) {
    throw new Error('角色标识无效，无法存取视觉资产。')
  }
  return trimmed
}

function resolveSlotFilePath(roleId: string, slot: RoleVisualSlot, rootDir?: string): string {
  const safeRole = sanitizeRoleSegment(roleId)
  const base = path.resolve(rootDir ?? resolveVisualRootDir())
  const filePath = path.resolve(base, safeRole, `${slot}.png`)
  if (!filePath.startsWith(base + path.sep)) {
    throw new Error('视觉资产路径越界，已拒绝。')
  }
  return filePath
}

export function isValidVisualSlot(value: unknown): value is RoleVisualSlot {
  return value === 'avatar' || value === 'banner'
}

/**
 * 读取指定角色的视觉覆写 Data URL；未设置覆写时返回 null。
 */
export function readRoleVisualOverrideDataUrl(
  roleId: string,
  slot: RoleVisualSlot,
  opts?: { rootDir?: string },
): string | null {
  try {
    const filePath = resolveSlotFilePath(roleId, slot, opts?.rootDir)
    if (!fs.existsSync(filePath)) return null
    const bytes = fs.readFileSync(filePath)
    if (!bytes.length) return null
    return `data:image/png;base64,${bytes.toString('base64')}`
  } catch (err) {
    log.warn('Failed to read role visual override', { roleId, slot, error: String(err) })
    return null
  }
}

/**
 * 校验并原子保存角色的头像或封面覆写。
 */
export async function saveRoleVisualOverride(
  roleId: string,
  slot: RoleVisualSlot,
  rawBytes: Buffer,
  opts?: { rootDir?: string },
): Promise<{ ok: true; dataUrl: string; width: number; height: number } | { ok: false; error: string }> {
  if (!Buffer.isBuffer(rawBytes) || rawBytes.length === 0) {
    return { ok: false, error: '图片内容为空。' }
  }
  if (rawBytes.length > ROLE_VISUAL_MAX_BYTES) {
    return { ok: false, error: '图片过大，请选择 10MB 以内的图片。' }
  }
  let filePath: string
  try {
    filePath = resolveSlotFilePath(roleId, slot, opts?.rootDir)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '路径校验失败。' }
  }

  let normalized: Awaited<ReturnType<typeof normalizeGeneratedImage>>
  try {
    normalized = await normalizeGeneratedImage(rawBytes)
  } catch {
    return { ok: false, error: '图片格式不受支持或已损坏，请使用 PNG、JPG 或 WebP 图片。' }
  }

  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmpPath = `${filePath}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(tmpPath, normalized.bytes)
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch { /* ignore */ }
    log.warn('Failed to write role visual override', { roleId, slot, error: String(err) })
    return { ok: false, error: '保存图片失败，请重试。' }
  }

  return {
    ok: true,
    dataUrl: `data:image/png;base64,${normalized.bytes.toString('base64')}`,
    width: normalized.width,
    height: normalized.height,
  }
}

/**
 * 重置指定角色的头像或封面覆写，恢复为 Role Pack 默认图。
 */
export function resetRoleVisualOverride(
  roleId: string,
  slot: RoleVisualSlot,
  opts?: { rootDir?: string },
): { ok: true } | { ok: false; error: string } {
  try {
    const filePath = resolveSlotFilePath(roleId, slot, opts?.rootDir)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '重置失败。' }
  }
}

export interface BackupRoleVisualOverride {
  roleId: string
  slot: RoleVisualSlot
  /** 规范化 PNG 的纯 base64 字符串（不含 data: 前缀） */
  base64: string
}

const MAX_BACKUP_ROLE_VISUAL_OVERRIDES = 50
// 10MB 原始字节的 base64 编码约 13.4MB，留轻微余量防误拒合法大图同时拦截恶意超大载荷
const MAX_BACKUP_ROLE_VISUAL_BASE64_LEN = 14_000_000

/**
 * 扫描并收集当前所有角色的自定义头像 / 封面覆写，用于 data:export 打包备份。
 *
 * 背景：用户替换或 AI 生成的角色头像与封面保存在 userData/companion-visuals 独立目录，
 * 不在 SQLite 中；旧备份未涵盖该目录，导致换机恢复后自定义外观丢失。
 * 设计意图：仅枚举符合安全白名单的一级 roleId 目录与 avatar.png / banner.png，跳过空文件与越界路径。
 * 关键约束：总条数与单文件体积受上限约束，避免异常目录拖垮导出。
 */
export function listRoleVisualOverrides(opts?: { rootDir?: string }): BackupRoleVisualOverride[] {
  const base = path.resolve(opts?.rootDir ?? resolveVisualRootDir())
  if (!fs.existsSync(base)) return []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(base, { withFileTypes: true })
  } catch {
    return []
  }

  const out: BackupRoleVisualOverride[] = []
  const slots: readonly RoleVisualSlot[] = ['avatar', 'banner']
  for (const entry of entries) {
    if (out.length >= MAX_BACKUP_ROLE_VISUAL_OVERRIDES) break
    if (!entry.isDirectory()) continue
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(entry.name)) continue
    for (const slot of slots) {
      if (out.length >= MAX_BACKUP_ROLE_VISUAL_OVERRIDES) break
      try {
        const filePath = resolveSlotFilePath(entry.name, slot, base)
        if (!fs.existsSync(filePath)) continue
        const bytes = fs.readFileSync(filePath)
        if (!bytes.length || bytes.length > ROLE_VISUAL_MAX_BYTES) continue
        out.push({ roleId: entry.name, slot, base64: bytes.toString('base64') })
      } catch (err) {
        log.warn('Skip unreadable role visual override during export', { roleId: entry.name, slot, error: String(err) })
      }
    }
  }
  return out
}

/**
 * 校验外部备份文件中的 roleVisualOverrides 载荷结构与规模。
 */
export function isValidBackupRoleVisualOverrides(value: unknown): value is BackupRoleVisualOverride[] {
  if (!Array.isArray(value) || value.length > MAX_BACKUP_ROLE_VISUAL_OVERRIDES) return false
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const record = item as Record<string, unknown>
    if (typeof record.roleId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(record.roleId)) return false
    if (!isValidVisualSlot(record.slot)) return false
    if (typeof record.base64 !== 'string' || record.base64.length === 0 || record.base64.length > MAX_BACKUP_ROLE_VISUAL_BASE64_LEN) return false
    const key = `${record.roleId}:${record.slot}`
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}

/**
 * 幂等恢复备份中的角色视觉覆写，并提供整批回滚句柄。
 *
 * 背景：数据导入遵循“按已有事实幂等合并、失败整笔回滚”原则；如果外层数据库导入回滚，
 * 刚写入磁盘的视觉覆写文件也必须同步清理，不能残留半成品。
 * 设计意图：目标槽位已有覆写时直接跳过不覆盖；缺失槽位经 saveRoleVisualOverride 重新解码规范化后再落盘。
 * 关键约束：任一文件解码或写盘失败时立即撤销本批已写文件并抛错，绝不静默吞错。
 */
export async function restoreRoleVisualOverrides(
  items: readonly BackupRoleVisualOverride[],
  opts?: { rootDir?: string },
): Promise<{ restored: number; restoredRoles: string[]; rollback: () => void }> {
  const createdFiles: string[] = []
  const restoredRoles = new Set<string>()
  const rollback = (): void => {
    for (const filePath of createdFiles.reverse()) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch {
        // 回滚尽力清理，不二次抛错
      }
    }
  }

  try {
    for (const item of items) {
      const filePath = resolveSlotFilePath(item.roleId, item.slot, opts?.rootDir)
      if (fs.existsSync(filePath)) continue
      const rawBytes = Buffer.from(item.base64, 'base64')
      const saved = await saveRoleVisualOverride(item.roleId, item.slot, rawBytes, opts)
      if (!saved.ok) {
        throw new Error(`恢复角色视觉覆写失败（${item.roleId}/${item.slot}）：${saved.error}`)
      }
      createdFiles.push(filePath)
      restoredRoles.add(item.roleId)
    }
    return {
      restored: createdFiles.length,
      restoredRoles: [...restoredRoles],
      rollback,
    }
  } catch (err) {
    rollback()
    throw err
  }
}
