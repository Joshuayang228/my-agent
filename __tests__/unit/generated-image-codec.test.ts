import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { GENERATED_IMAGE_LIMITS, normalizeGeneratedImage } from '../../electron/main/utils/generated-image-codec'

describe('生成图片完整解码与规格限制', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('%s 真实解码后统一 PNG，保留像素尺寸并移除元数据', async format => {
    const input = await sharp({ create: { width: 40, height: 24, channels: 3, background: '#207854' } }).withMetadata().toFormat(format).toBuffer()
    const result = await normalizeGeneratedImage(input)
    expect(result).toMatchObject({ mimeType: 'image/png', width: 40, height: 24 })
    const metadata = await sharp(result.bytes).metadata()
    expect(metadata.format).toBe('png')
    expect(metadata.exif).toBeUndefined()
    expect(metadata.icc).toBeUndefined()
    const pixel = await sharp(result.bytes).raw().toBuffer()
    expect(pixel.length).toBeGreaterThan(0)
  })
  it('有效文件头但损坏的图片不能通过；SVG 和 HTML 也被拒绝', async () => {
    const good = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer()
    for (const value of [good.subarray(0, 40), Buffer.from('<html>error</html>'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>')]) {
      await expect(normalizeGeneratedImage(value)).rejects.toThrow('无法安全解码')
    }
  })
  it('限制字节、像素、边长及取消，不缩小后冒充原结果', async () => {
    await expect(normalizeGeneratedImage(Buffer.alloc(GENERATED_IMAGE_LIMITS.bytes + 1))).rejects.toThrow('8MB')
    const pixels = await sharp({ create: { width: 4097, height: 4097, channels: 3, background: 'black' } }).png().toBuffer()
    await expect(normalizeGeneratedImage(pixels)).rejects.toThrow('限制')
    const wide = await sharp({ create: { width: 8193, height: 1, channels: 3, background: 'black' } }).png().toBuffer()
    await expect(normalizeGeneratedImage(wide)).rejects.toThrow('限制')
    const controller = new AbortController(); controller.abort()
    await expect(normalizeGeneratedImage(wide, controller.signal)).rejects.toThrow()
  })
})
