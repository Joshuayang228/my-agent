/**
 * 可选真实生图质量门。
 *
 * 背景：本地 fixture 只能证明协议和落盘链，不能证明外部模型真的返回可用图片。
 * 设计意图：在用户明确配置独立生图凭据时走一次真实 Images 请求；无凭据保持跳过，不阻断本地门禁。
 * 关键约束：只发一次请求；请求描述带路飞视觉与千里阳光号家居锚点；只验证返回图像可解码，不把审美判断伪装成自动通过。
 */
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { requestGeneratedImage } from '../../electron/main/llm/image-generation'
import { compileImageGenerationRequest } from '../../electron/main/prompts/registered-request'

const apiKey = process.env.TEST_IMAGE_API_KEY || ''
const baseUrl = process.env.TEST_IMAGE_BASE_URL || ''
const model = process.env.TEST_IMAGE_MODEL || ''

describe.skipIf(!apiKey || !baseUrl || !model)('路飞真实外部生图质量门', () => {
  it('返回可解码图片并保留人物与居所视觉锚点', async () => {
    const request = compileImageGenerationRequest(
      '原创生活场景：路飞在千里阳光号内部的木质餐桌旁整理航海地图，草帽放在桌边；明亮自然光，适合人物世界家居记录。',
      '草帽是稳定视觉锚点；基础服装为红色背心、深蓝短裤和甲板凉鞋；居所是千里阳光号内部的伙伴生活空间。',
    )
    const result = await requestGeneratedImage({ provider: 'openai', apiKey, baseUrl, model }, request)
    const metadata = await sharp(result.bytes).metadata()
    expect(metadata.format).toMatch(/png|jpeg|webp/)
    expect(metadata.width).toBeGreaterThan(0)
    expect(metadata.height).toBeGreaterThan(0)
  }, 240_000)
})
