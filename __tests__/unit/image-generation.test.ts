import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { requestGeneratedImage, inspectGeneratedImageBytes } from '../../electron/main/llm/image-generation'
import type { LLMConfig } from '../../src/shared/types'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFOkAAAAASUVORK5CYII='
const cleanups: Array<() => Promise<void>> = []
afterEach(async () => { for (const close of cleanups.splice(0)) await close() })
async function fixture(handler: (body: Record<string, unknown>, url: string, headers: Record<string, unknown>) => { status?: number; body?: unknown; location?: string; delay?: number }) {
  const calls: Array<{ body: Record<string, unknown>; url: string; headers: Record<string, unknown> }> = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const call = { body: JSON.parse(Buffer.concat(chunks).toString() || '{}'), url: req.url!, headers: req.headers }
    calls.push(call)
    const result = handler(call.body, call.url, call.headers)
    if (result.delay) await new Promise(resolve => setTimeout(resolve, result.delay))
    res.writeHead(result.status ?? 200, { 'Content-Type': 'application/json', ...(result.location ? { Location: result.location } : {}) })
    res.end(JSON.stringify(result.body ?? {}))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }))
  const config: LLMConfig = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, model: 'fixture-image', apiKey: 'fixture-key', provider: 'openai' }
  return { config, calls }
}

describe('真实生图协议适配器（本地协议，不代表外部模型验收）', () => {
  it('Images 请求真实发送，返回二进制；不重复版本路径或自动重试', async () => {
    const { config, calls } = await fixture(() => ({ body: { data: [{ b64_json: png }] } }))
    const image = await requestGeneratedImage(config, '一张测试图片')
    expect(image.mimeType).toBe('image/png')
    expect(image.bytes.equals(Buffer.from(png, 'base64'))).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ url: '/v1/images/generations', body: { model: 'fixture-image', prompt: '一张测试图片', n: 1 }, headers: { authorization: 'Bearer fixture-key' } })
  })
  it('Gemini 发送独立协议及认证头，不把密钥放 URL', async () => {
    const { config, calls } = await fixture(() => ({ body: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] } }))
    config.provider = 'gemini'; config.baseUrl = config.baseUrl.replace('/v1', '/v1beta')
    expect((await requestGeneratedImage(config, '测试')).mimeType).toBe('image/png')
    expect(calls[0].url).toBe('/v1beta/models/fixture-image:generateContent')
    expect(calls[0].headers['x-goog-api-key']).toBe('fixture-key')
    expect(calls[0].headers.authorization).toBeUndefined()
    expect(calls[0].body).toMatchObject({ generationConfig: { responseModalities: ['IMAGE'] } })
  })
  it.each([401, 403, 429, 500])('HTTP %s 只调用一次且不暴露上游错误正文', async status => {
    const { config, calls } = await fixture(() => ({ status, body: { error: 'secret-upstream-detail' } }))
    await expect(requestGeneratedImage(config, '测试')).rejects.not.toThrow('secret-upstream-detail')
    expect(calls).toHaveLength(1)
  })
  it('显式本机服务允许无 Key，但不发送空 Bearer', async () => {
    const { config, calls } = await fixture(() => ({ body: { data: [{ b64_json: png }] } }))
    config.apiKey = ''
    await requestGeneratedImage(config, '测试')
    expect(calls[0].headers.authorization).toBeUndefined()
  })
  it('缺配置、不支持协议与非法描述在发请求前失败', async () => {
    const { config, calls } = await fixture(() => ({}))
    await expect(requestGeneratedImage({ ...config, model: '' }, '测试')).rejects.toThrow('安排生图模型')
    await expect(requestGeneratedImage({ ...config, provider: 'anthropic' }, '测试')).rejects.toThrow('协议不支持')
    await expect(requestGeneratedImage(config, ' ')).rejects.toThrow('图片描述')
    await expect(requestGeneratedImage({ ...config, baseUrl: 'https://example.test', apiKey: '' }, '测试')).rejects.toThrow('配置密钥')
    expect(calls).toHaveLength(0)
  })
  it.each([{ data: [] }, { data: [{ b64_json: '<html>no</html>' }] }, { data: [{ b64_json: Buffer.from('<svg/>').toString('base64') }] }, { data: [{ b64_json: png }, { b64_json: png }] }])('拒绝非图片、非法 base64 或超出请求数量的响应 %#', async body => {
    const { config } = await fixture(() => ({ body }))
    await expect(requestGeneratedImage(config, '测试')).rejects.toThrow('有效图片')
  })
  it('拒绝重定向及响应诱导的本机下载，不向下载地址泄露凭据', async () => {
    const redirected = await fixture(() => ({ status: 302, location: 'http://127.0.0.1/private' }))
    await expect(requestGeneratedImage(redirected.config, '测试')).rejects.toThrow('没有自动重试')
    const download = await fixture(() => ({ body: { data: [{ url: 'http://127.0.0.1/private' }] } }))
    await expect(requestGeneratedImage(download.config, '测试')).rejects.toThrow('没有自动重试')
    expect(download.calls).toHaveLength(1)
  })
  it('取消等待不重试，也不返回迟到图片', async () => {
    const { config, calls } = await fixture(() => ({ delay: 150, body: { data: [{ b64_json: png }] } }))
    const controller = new AbortController()
    const promise = requestGeneratedImage(config, '测试', controller.signal)
    await new Promise(resolve => setTimeout(resolve, 40))
    controller.abort()
    await expect(promise).rejects.toThrow('已取消')
    expect(calls).toHaveLength(1)
  })
  it('限制响应及图片字节，不接受空图片', async () => {
    expect(() => inspectGeneratedImageBytes(Buffer.alloc(0))).toThrow('有效图片')
    expect(() => inspectGeneratedImageBytes(Buffer.alloc(8 * 1024 * 1024 + 1))).toThrow('有效图片')
    const { config } = await fixture(() => ({ body: { data: [{ b64_json: 'A'.repeat(13 * 1024 * 1024) }] } }))
    await expect(requestGeneratedImage(config, '测试')).rejects.toThrow('没有自动重试')
  })
  it('数 MiB 的规范 base64 不因重复捕获组耗尽正则栈；此处只验证传输而非解码', async () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024)
    Buffer.from(png, 'base64').copy(bytes)
    const { config } = await fixture(() => ({ body: { data: [{ b64_json: bytes.toString('base64') }] } }))
    expect((await requestGeneratedImage(config, '测试')).bytes.length).toBe(bytes.length)
  })
})
