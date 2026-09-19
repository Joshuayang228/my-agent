import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
export type RestrictedFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

const blocked = new BlockList()
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(address, prefix, 'ipv4')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2001::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
const DEFAULT_MAX_BYTES = 1024 * 1024
export interface RestrictedFetchOptions { maxBytes?: number; timeoutMs?: number; streaming?: boolean; allowLocalOrigin?: boolean }

export async function withRequestAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort!: () => void
  const cancelled = new Promise<never>((_, reject) => { onAbort = () => reject(signal.reason) })
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) onAbort()
  try { return await Promise.race([promise, cancelled]) }
  finally { signal.removeEventListener('abort', onAbort) }
}

export function isLoopbackUrl(url: URL): boolean {
  return ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
}

/**
 * 背景：授权元数据与生成图片下载地址由外部服务提供，不能借响应访问本机管理面。
 * 意图：仅明确选择的本机服务可访问同源回环；远程只允许 HTTPS 公网地址。
 * 约束：连接必须使用这里返回的解析结果，禁止校验后再次解析；不跟随重定向。
 */
export async function resolveRestrictedTarget(raw: string | URL, serverUrl: string, allowLocalOrigin = true): Promise<{ url: URL; address: string; family: number }> {
  const url = new URL(raw)
  const server = new URL(serverUrl)
  if (url.href.length > 8192 || url.username || url.password || url.hash) throw new Error('Restricted HTTP URL rejected')
  const local = allowLocalOrigin && isLoopbackUrl(server) && url.origin === server.origin
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Restricted HTTP requires HTTPS')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address, family }) => local
    ? !(address === '127.0.0.1' || address === '::1')
    : blocked.check(address, family === 6 ? 'ipv6' : 'ipv4') || (family === 6 && !globalV6.check(address, 'ipv6')))) throw new Error('Restricted HTTP address rejected')
  return { url, ...(local ? addresses.find(item => item.family === 4) ?? addresses[0] : addresses[0]) }
}

/**
 * 背景：授权与生图需要不同载荷上限，但必须共享 DNS 固定和重定向保护。
 * 意图：以受限 Fetch 适配器集中网络边界，调用方只选择明确的大小、超时和回环策略。
 * 约束：仅接受文本请求体；非流式响应同时限制总时长和字节数，流式调用方负责消费边界。
 */
export function createRestrictedFetch(serverUrl: string, signal: AbortSignal, options: RestrictedFetchOptions = {}): RestrictedFetch {
  const { maxBytes = DEFAULT_MAX_BYTES, timeoutMs = 15_000, streaming = false, allowLocalOrigin = true } = options
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 64 * 1024 * 1024 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new Error('Invalid request limits')
  return async (input, init) => {
    signal.throwIfAborted()
    const bounded = AbortSignal.any([signal, ...(streaming ? [] : [AbortSignal.timeout(timeoutMs)]), ...(init?.signal ? [init.signal] : [])])
    const target = await withRequestAbort(resolveRestrictedTarget(input, serverUrl, allowLocalOrigin), AbortSignal.any([bounded, AbortSignal.timeout(timeoutMs)]))
    bounded.throwIfAborted()
    const body = init?.body
    if (body !== undefined && body !== null && typeof body !== 'string' && !(body instanceof URLSearchParams)) throw new Error('Restricted HTTP body rejected')
    const text = body?.toString()
    if (text && Buffer.byteLength(text) > maxBytes) throw new Error('Restricted HTTP request too large')
    return new Promise<Response>((resolve, reject) => {
      const request = (target.url.protocol === 'https:' ? httpsRequest : httpRequest)(target.url, {
        method: init?.method ?? 'GET', headers: Object.fromEntries(new Headers(init?.headers)), signal: bounded,
        family: target.family,
        lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      }, response => {
        request.setTimeout(0)
        const chunks: Buffer[] = []
        let bytes = 0
        response.on('error', reject)
        const status = response.statusCode ?? 500
        if (status >= 300 && status < 400 || !streaming && Number(response.headers['content-length']) > maxBytes || response.headers['content-encoding']) {
          response.destroy(new Error('Restricted HTTP response rejected'))
          return
        }
        const headers = new Headers()
        for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        if (streaming) {
          if ([204, 205, 304].includes(status)) response.resume()
          resolve(new Response([204, 205, 304].includes(status) ? null : Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers }))
          return
        }
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          if (bytes > maxBytes) response.destroy(new Error('Restricted HTTP response too large'))
          else chunks.push(chunk)
        })
        response.on('end', () => {
          resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers }))
        })
      })
      request.on('error', reject)
      request.setTimeout(timeoutMs, () => request.destroy(new Error('Restricted HTTP request timed out')))
      request.end(text)
    })
  }
}
