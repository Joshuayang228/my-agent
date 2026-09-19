import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { GeneratedImageReference } from '../../../src/shared/types'
import { BACKUP_IMAGE_ERRORS } from '../../../src/shared/backup-errors'
import { GENERATED_IMAGE_LIMITS, normalizeGeneratedImage } from '../utils/generated-image-codec'
import { loadGeneratedImageFile } from './generated-images'

export type BackupImageReference = Omit<GeneratedImageReference, 'path'> & { fileName: string }
export type BackupImageMedia = Omit<GeneratedImageReference, 'path'> & { data: string }
export const BACKUP_IMAGE_LIMITS = { count: 32, totalBytes: 16 * 1024 * 1024 } as const
export class BackupImageError extends Error {}

interface ImageSession {
  id: string
  messages: Array<{ generatedImages?: BackupImageReference[] }>
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function metadata(value: unknown): value is Omit<GeneratedImageReference, 'path'> & Record<string, unknown> {
  if (!record(value)) return false
  return typeof value.id === 'string' && /^[a-f0-9]{64}$/.test(value.id) && value.mimeType === 'image/png'
    && Number.isSafeInteger(value.byteLength) && (value.byteLength as number) > 0 && (value.byteLength as number) <= GENERATED_IMAGE_LIMITS.bytes
    && Number.isSafeInteger(value.width) && (value.width as number) > 0 && (value.width as number) <= GENERATED_IMAGE_LIMITS.dimension
    && Number.isSafeInteger(value.height) && (value.height as number) > 0 && (value.height as number) <= GENERATED_IMAGE_LIMITS.dimension
    && (value.width as number) * (value.height as number) <= GENERATED_IMAGE_LIMITS.pixels
    && !('path' in value)
}
function sameMetadata(a: Omit<GeneratedImageReference, 'path'>, b: Omit<GeneratedImageReference, 'path'>): boolean {
  return a.id === b.id && a.width === b.width && a.height === b.height && a.byteLength === b.byteLength && a.mimeType === b.mimeType
}
export function toBackupImageReference(image: GeneratedImageReference): BackupImageReference {
  return { id: image.id, fileName: path.basename(image.path), width: image.width, height: image.height, byteLength: image.byteLength, mimeType: image.mimeType }
}

/**
 * 背景：备份是外部输入，图片必须有真实工具归属，不能凭一个路径扩展本机读取权限。
 * 意图：先检查整份引用图再解码，拒绝孤立字节、伪造角色和重复媒体；不把备份路径带入存储。
 * 约束：只接受此前 assistant 发起的 image_generate 结果；总量先于 base64 分配和磁盘写入检查。
 */
function indexBackupMedia(raw: unknown): Map<string, BackupImageMedia> | null {
  const media = raw === undefined ? [] : raw
  if (!Array.isArray(media) || media.length > BACKUP_IMAGE_LIMITS.count) return null
  const byId = new Map<string, BackupImageMedia>()
  let total = 0
  for (const image of media) {
    if (!metadata(image) || !record(image) || typeof image.data !== 'string'
      || image.data.length !== 4 * Math.ceil(image.byteLength / 3) || byId.has(image.id)) return null
    total += image.byteLength
    if (total > BACKUP_IMAGE_LIMITS.totalBytes) return null
    byId.set(image.id, image as unknown as BackupImageMedia)
  }
  return byId
}

export function isValidBackupImageBundle(sessions: unknown[], raw: unknown): raw is BackupImageMedia[] | undefined {
  const byId = indexBackupMedia(raw)
  if (!byId) return false
  const used = new Set<string>()
  for (const session of sessions) {
    if (!record(session) || !Array.isArray(session.messages)) return false
    const calls = new Map<string, string>()
    for (const message of session.messages) {
      if (!record(message)) return false
      if (message.role === 'assistant' && Array.isArray(message.toolCalls)) {
        for (const call of message.toolCalls) if (record(call) && typeof call.id === 'string' && typeof call.name === 'string') calls.set(call.id, call.name)
      }
      if (message.generatedImages === undefined) continue
      if (message.role !== 'tool' || typeof message.toolCallId !== 'string' || calls.get(message.toolCallId) !== 'image_generate'
        || !Array.isArray(message.generatedImages) || message.generatedImages.length > BACKUP_IMAGE_LIMITS.count) return false
      for (const image of message.generatedImages) {
        if (!metadata(image) || !record(image) || typeof image.fileName !== 'string'
          || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}\.png$/.test(image.fileName)) return false
        const bytes = byId.get(image.id)
        if (!bytes || !sameMetadata(image, bytes)) return false
        used.add(image.id)
      }
    }
  }
  return used.size === byId.size
}

/** 导出只读已保存会话引用；缺图必须使整份备份失败，不能生成看似成功的残缺备份。 */
export async function collectBackupImageMedia(sessions: ImageSession[], load = loadGeneratedImageFile): Promise<BackupImageMedia[]> {
  const images = new Map<string, BackupImageMedia>()
  let total = 0
  for (const session of sessions) for (const message of session.messages) for (const reference of message.generatedImages ?? []) {
    const result = await load(session.id, reference.id)
    if (result.ok === false) throw new BackupImageError(BACKUP_IMAGE_ERRORS.missing)
    if (result.bytes.length !== reference.byteLength) throw new BackupImageError(BACKUP_IMAGE_ERRORS.changed)
    if (images.has(reference.id)) continue
    total += result.bytes.length
    if (images.size >= BACKUP_IMAGE_LIMITS.count || total > BACKUP_IMAGE_LIMITS.totalBytes) throw new BackupImageError(BACKUP_IMAGE_ERRORS.limit)
    images.set(reference.id, { id: reference.id, width: reference.width, height: reference.height, byteLength: reference.byteLength, mimeType: reference.mimeType, data: result.bytes.toString('base64') })
  }
  return [...images.values()]
}

export interface PreparedBackupImage {
  sourceId: string
  bytes: Buffer
  reference: Omit<GeneratedImageReference, 'path'>
}

/**
 * 背景：JSON 结构和 PNG 文件头不能证明压缩像素安全，也不能信任导入的摘要声明。
 * 意图：在任何写入前完整解码并移除元数据，恢复引用使用实际新字节的摘要，不依赖旧编码器版本。
 * 约束：不静默缩图；源摘要、声明大小和解码尺寸须一致，调用方先完成 bundle 规模预检。
 */
export async function prepareBackupImages(images: BackupImageMedia[]): Promise<PreparedBackupImage[]> {
  if (!indexBackupMedia(images)) throw new BackupImageError(BACKUP_IMAGE_ERRORS.corrupt)
  const prepared: PreparedBackupImage[] = []
  let totalBytes = 0
  for (const image of images) {
    try {
      const bytes = Buffer.from(image.data, 'base64')
      if (bytes.toString('base64') !== image.data || bytes.length !== image.byteLength
        || createHash('sha256').update(bytes).digest('hex') !== image.id
        || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid bytes')
      const decoded = await normalizeGeneratedImage(bytes)
      if (decoded.width !== image.width || decoded.height !== image.height) throw new Error('Invalid dimensions')
      totalBytes += decoded.bytes.length
      if (totalBytes > BACKUP_IMAGE_LIMITS.totalBytes) throw new Error('Decoded media exceeds total limit')
      prepared.push({ sourceId: image.id, bytes: decoded.bytes, reference: {
        id: createHash('sha256').update(decoded.bytes).digest('hex'), width: decoded.width, height: decoded.height,
        byteLength: decoded.bytes.length, mimeType: 'image/png',
      } })
    } catch { throw new BackupImageError(BACKUP_IMAGE_ERRORS.corrupt) }
  }
  return prepared
}

/**
 * 背景：原项目可能已不存在，备份也可能来自另一台机器，不能向其声明的路径写入。
 * 意图：在主进程指定的 userData 下排他创建一批媒体，再把本地引用交给会话事务。
 * 约束：仅恢复待新增会话使用的图片；失败只清理本批目录，事务成功后不得调用 rollback。
 */
export function restoreBackupImages(images: PreparedBackupImage[], sessions: ImageSession[], userData: string) {
  const needed = new Map<string, string>()
  for (const session of sessions) for (const message of session.messages) for (const image of message.generatedImages ?? []) {
    if (!/^[a-f0-9]{64}$/.test(image.id) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}\.png$/.test(image.fileName)) throw new BackupImageError(BACKUP_IMAGE_ERRORS.reference)
    needed.set(image.id, image.fileName)
  }
  const references = new Map<string, GeneratedImageReference>()
  if (needed.size === 0) return { references, rollback: () => {} }
  const root = fs.realpathSync(userData)
  const directory = fs.mkdtempSync(path.join(root, 'restored-images-'))
  const rollback = () => {
    if (!fs.existsSync(directory)) return
    if (path.dirname(directory) !== root || fs.realpathSync(directory) !== directory) throw new BackupImageError(BACKUP_IMAGE_ERRORS.directory)
    fs.rmSync(directory, { recursive: true, force: true })
  }
  try {
    for (const image of images) {
      const fileName = needed.get(image.sourceId)
      if (!fileName) continue
      const folder = path.join(directory, image.sourceId, 'images')
      fs.mkdirSync(folder, { recursive: true })
      const target = path.join(folder, fileName)
      const fd = fs.openSync(target, 'wx', 0o600)
      try { fs.writeFileSync(fd, image.bytes); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      references.set(image.sourceId, { ...image.reference, path: target })
    }
    if (references.size !== needed.size) throw new BackupImageError(BACKUP_IMAGE_ERRORS.incomplete)
    return { references, rollback }
  } catch (error) { rollback(); throw error }
}
