import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { GENERATED_IMAGE_LIMITS } from '../../utils/generated-image-codec'
import { resolveRoleAssetFilePath } from '../identity/loader'
import type { GeneratedImageReference } from '../../../../src/shared/types'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const starterVisualImageCache = new Map<string, GeneratedImageReference>()

function resolveStarterImagesDir(): string {
  let baseRoot: string
  try {
    const userData = app.getPath('userData')
    baseRoot = process.platform === 'win32' && userData.startsWith('/')
      ? path.join(os.tmpdir(), 'my-agent-starter-media')
      : userData
  } catch {
    baseRoot = path.join(os.tmpdir(), 'my-agent-starter-media')
  }
  const targetDir = path.join(baseRoot, 'companion-media', 'images')
  fs.mkdirSync(targetDir, { recursive: true })
  return fs.realpathSync(targetDir)
}

/**
 * 背景：Role Pack 中的 visual/*.png 是仓库静态文件，而人物世界图片读取器要求图片位于受控 images 目录并通过真实路径、大小与 SHA-256 核验。
 * 设计意图：在出厂播种或无损补图时将 Role Pack 视觉参考落入 userData/companion-media/images，生成可由 companion:read-asset-image 安全读取的 GeneratedImageReference。
 * 关键约束：不放入静态 getStarterAssetDefinitions（避免机器绝对路径污染生产资产指纹）；源文件缺失或非合规 PNG 时静默返回 null。
 */
export function materializeRoleVisualImage(roleId: string, visualPath: unknown): GeneratedImageReference | null {
  if (typeof visualPath !== 'string' || !visualPath.trim()) return null
  const cacheKey = `${roleId}:${visualPath.trim()}`
  const cached = starterVisualImageCache.get(cacheKey)
  if (cached && fs.existsSync(cached.path)) return { ...cached }
  const sourcePath = resolveRoleAssetFilePath(roleId, visualPath)
  if (!sourcePath) return null
  try {
    const bytes = fs.readFileSync(sourcePath)
    if (
      bytes.byteLength < 24
      || bytes.byteLength > GENERATED_IMAGE_LIMITS.bytes
      || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    ) {
      return null
    }
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) return null
    const id = createHash('sha256').update(bytes).digest('hex')
    const imagesDir = resolveStarterImagesDir()
    const safeRole = roleId.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+/, '') || 'role'
    const safeBase = path.basename(visualPath, path.extname(visualPath)).replace(/[^a-zA-Z0-9_-]/g, '-')
    const fileName = `${safeRole}-${safeBase}-${id.slice(0, 12)}.png`.slice(0, 80)
    const targetPath = path.join(imagesDir, fileName)
    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size !== bytes.byteLength) {
      fs.writeFileSync(targetPath, bytes)
    }
    const ref: GeneratedImageReference = {
      id,
      path: targetPath,
      mimeType: 'image/png',
      width,
      height,
      byteLength: bytes.byteLength,
    }
    starterVisualImageCache.set(cacheKey, ref)
    return { ...ref }
  } catch {
    return null
  }
}
