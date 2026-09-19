import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js'

const blocked = new BlockList()
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(address, prefix, 'ipv4')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2001::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
const MAX_BYTES = 1024 * 1024

export async function withOAuthAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort!: () => void
  const cancelled = new Promise<never>((_, reject) => { onAbort = () => reject(signal.reason) })
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) onAbort()
  try { return await Promise.race([promise, cancelled]) }
  finally { signal.removeEventListener('abort', onAbort) }
}

export function isOAuthLoopback(url: URL): boolean {
  return ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
}

/**
 * 背景：授权服务器元数据由外部服务提供，不能借发现流程访问本机管理面。
 * 意图：仅明确选择的本机服务可访问同源回环；远程只允许 HTTPS 公网地址。
 * 约束：连接必须使用这里返回的解析结果，禁止校验后再次解析；不跟随重定向。
 */
export async function resolveOAuthTarget(raw: string | URL, serverUrl: string): Promise<{ url: URL; address: string; family: number }> {
  const url = new URL(raw)
  const server = new URL(serverUrl)
  if (url.href.length > 8192 || url.username || url.password || url.hash) throw new Error('OAuth URL rejected')
  const local = isOAuthLoopback(server) && url.origin === server.origin
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('OAuth requires HTTPS')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address, family }) => local
    ? !(address === '127.0.0.1' || address === '::1')
    : blocked.check(address, family === 6 ? 'ipv6' : 'ipv4') || (family === 6 && !globalV6.check(address, 'ipv6')))) throw new Error('OAuth address rejected')
  return { url, ...(local ? addresses.find(item => item.family === 4) ?? addresses[0] : addresses[0]) }
}

/**
 * 背景：SDK 负责 OAuth 协议，应用仍必须限制发现、注册和换码的网络副作用。
 * 意图：提供 SDK FetchLike 适配器，用 Node 请求固定已校验 IP 并限制响应体。
 * 约束：只接受 SDK 的文本 / URLSearchParams 请求体；15 秒单请求超时与外部取消同时生效。
 */
export function createOAuthFetch(serverUrl: string, signal: AbortSignal, streaming = false): FetchLike {
  return async (input, init) => {
    signal.throwIfAborted()
    const bounded = AbortSignal.any([signal, ...(streaming ? [] : [AbortSignal.timeout(15_000)]), ...(init?.signal ? [init.signal] : [])])
    const target = await withOAuthAbort(resolveOAuthTarget(input, serverUrl), AbortSignal.any([bounded, AbortSignal.timeout(15_000)]))
    bounded.throwIfAborted()
    const body = init?.body
    if (body !== undefined && body !== null && typeof body !== 'string' && !(body instanceof URLSearchParams)) throw new Error('OAuth body rejected')
    const text = body?.toString()
    if (text && Buffer.byteLength(text) > MAX_BYTES) throw new Error('OAuth request too large')
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
        if (status >= 300 && status < 400 || !streaming && Number(response.headers['content-length']) > MAX_BYTES || response.headers['content-encoding']) {
          response.destroy(new Error('OAuth response rejected'))
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
          if (bytes > MAX_BYTES) response.destroy(new Error('OAuth response too large'))
          else chunks.push(chunk)
        })
        response.on('end', () => {
          resolve(new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), { status, headers }))
        })
      })
      request.on('error', reject)
      request.setTimeout(15_000, () => request.destroy(new Error('OAuth request timed out')))
      request.end(text)
    })
  }
}
