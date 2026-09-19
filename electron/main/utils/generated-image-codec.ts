import sharp from 'sharp'

export const GENERATED_IMAGE_LIMITS = { bytes: 8 * 1024 * 1024, pixels: 16 * 1024 * 1024, dimension: 8192, seconds: 15 } as const
export interface NormalizedGeneratedImage { bytes: Buffer; width: number; height: number; mimeType: 'image/png' }

/**
 * 背景：供应商返回的光栅也可能损坏、超大或携带元数据，文件头不是可展示证明。
 * 意图：经 libvips 完整解码并重编码，保留像素而非原始文件；不把未经校验的字节发布到 UI。
 * 约束：取消后不返回结果，拒绝多帧及超限输入；不自动缩小图片来掩盖越界返回。
 */
export async function normalizeGeneratedImage(input: Buffer, signal?: AbortSignal): Promise<NormalizedGeneratedImage> {
  signal?.throwIfAborted()
  if (!Buffer.isBuffer(input) || !input.length || input.length > GENERATED_IMAGE_LIMITS.bytes) throw new Error('图片文件为空或超过 8MB，已拒绝保存。')
  const decoder = sharp(input, { failOn: 'warning', limitInputPixels: GENERATED_IMAGE_LIMITS.pixels, limitInputChannels: 4, pages: 1 })
  const cancel = () => { decoder.destroy() }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    const metadata = await decoder.metadata()
    signal?.throwIfAborted()
    if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1
      || !metadata.width || !metadata.height || metadata.width > GENERATED_IMAGE_LIMITS.dimension || metadata.height > GENERATED_IMAGE_LIMITS.dimension
      || metadata.width * metadata.height > GENERATED_IMAGE_LIMITS.pixels) throw new Error('Unsupported image')
    const result = await decoder.autoOrient().png().timeout({ seconds: GENERATED_IMAGE_LIMITS.seconds }).toBuffer({ resolveWithObject: true })
    signal?.throwIfAborted()
    if (!result.data.length || result.data.length > GENERATED_IMAGE_LIMITS.bytes || result.info.width * result.info.height > GENERATED_IMAGE_LIMITS.pixels) throw new Error('Image exceeds limits')
    return { bytes: result.data, width: result.info.width, height: result.info.height, mimeType: 'image/png' }
  } catch {
    throw new Error(signal?.aborted ? '已取消图片处理。' : '生成图片无法安全解码或超过大小限制，已拒绝保存。')
  } finally {
    signal?.removeEventListener('abort', cancel)
    decoder.destroy()
  }
}
