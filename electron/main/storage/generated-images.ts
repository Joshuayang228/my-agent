import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { getSession } from './session-store'
import { GENERATED_IMAGE_LIMITS } from '../utils/generated-image-codec'
import type { GeneratedImageReadResult } from '../../../src/shared/types'

/**
 * 背景：历史生成图片可能被删除、替换或变为符号链接，Renderer 不能据旧路径任意读盘。
 * 意图：仅从本会话的工具消息查找生成引用，并按真实路径、大小和摘要复核本地 PNG。
 * 约束：不接受外部路径，不追随链接；文件已变化就要求用户重新定位，不展示替换内容。
 */
export async function loadGeneratedImageFile(sessionId: unknown, imageId: unknown): Promise<{ ok: true; bytes: Buffer; filePath: string } | { ok: false; error: string }> {
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 200 || typeof imageId !== 'string' || !/^[a-f0-9]{64}$/.test(imageId)) return { ok: false, error: '图片引用无效。' }
  try {
    const session = await getSession(sessionId)
    const reference = session?.messages.filter(message => message.role === 'tool').flatMap(message => message.generatedImages ?? []).find(image => image.id === imageId)
    if (!reference || reference.mimeType !== 'image/png' || typeof reference.path !== 'string' || !path.isAbsolute(reference.path)
      || path.basename(path.dirname(reference.path)) !== 'images' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}\.png$/.test(path.basename(reference.path))) return { ok: false, error: '此会话没有可读取的生成图片。' }
    const resolved = path.resolve(reference.path)
    if (fs.realpathSync(resolved) !== resolved || fs.lstatSync(resolved).isSymbolicLink()) return { ok: false, error: '图片位置已变化，无法安全读取。' }
    const fd = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0))
    try {
      const stat = fs.fstatSync(fd)
      if (!stat.isFile() || stat.size < 8 || stat.size > GENERATED_IMAGE_LIMITS.bytes || stat.size !== reference.byteLength) return { ok: false, error: '图片文件已变化或超出大小限制。' }
      // 固定读取上限，不用 readFileSync(fd) 追随读取过程中不断增长的文件。
      const bytes = Buffer.alloc(stat.size)
      let offset = 0
      while (offset < bytes.length) {
        const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset)
        if (!count) return { ok: false, error: '图片文件不完整。' }
        offset += count
      }
      if (createHash('sha256').update(bytes).digest('hex') !== imageId || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { ok: false, error: '图片内容已变化，未加载替换后的文件。' }
      return { ok: true, bytes, filePath: resolved }
    } finally { fs.closeSync(fd) }
  } catch {
    return { ok: false, error: '图片暂时无法读取，文件可能已移动或删除。' }
  }
}

export async function readGeneratedImage(sessionId: unknown, imageId: unknown): Promise<GeneratedImageReadResult> {
  const result = await loadGeneratedImageFile(sessionId, imageId)
  if (result.ok === false) return { ok: false, error: result.error }
  return { ok: true, dataUrl: `data:image/png;base64,${result.bytes.toString('base64')}`, fileName: path.basename(result.filePath) }
}
