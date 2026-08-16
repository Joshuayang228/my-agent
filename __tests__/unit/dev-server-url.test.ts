import { describe, expect, it } from 'vitest'
import { normalizeDevServerUrl } from '../../electron/main/utils/dev-server-url'

describe('normalizeDevServerUrl', () => {
  it('将 localhost 规范化为 IPv4 loopback，并保留端口和路径', () => {
    expect(normalizeDevServerUrl('http://localhost:5174/app?mode=dev')).toBe('http://127.0.0.1:5174/app?mode=dev')
  })

  it('将 IPv6 loopback 规范化为 IPv4 loopback', () => {
    expect(normalizeDevServerUrl('http://[::1]:5173/')).toBe('http://127.0.0.1:5173/')
  })

  it('外部地址、凭据 URL、非 HTTP(S) 和无效地址 fail-closed', () => {
    expect(normalizeDevServerUrl('https://dev.example.com:8443/')).toBeUndefined()
    expect(normalizeDevServerUrl('https://user:pass@localhost:5173/')).toBeUndefined()
    expect(normalizeDevServerUrl('file:///tmp/index.html')).toBeUndefined()
    expect(normalizeDevServerUrl('not-a-url')).toBeUndefined()
    expect(normalizeDevServerUrl(undefined)).toBeUndefined()
  })
})
