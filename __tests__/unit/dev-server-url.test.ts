import { describe, expect, it } from 'vitest'
import { normalizeDevServerUrl } from '../../electron/main/utils/dev-server-url'

describe('normalizeDevServerUrl', () => {
  it('将 localhost 规范化为 IPv4 loopback，并保留端口和路径', () => {
    expect(normalizeDevServerUrl('http://localhost:5174/app?mode=dev')).toBe('http://127.0.0.1:5174/app?mode=dev')
  })

  it('将 IPv6 loopback 规范化为 IPv4 loopback', () => {
    expect(normalizeDevServerUrl('http://[::1]:5173/')).toBe('http://127.0.0.1:5173/')
  })

  it('不修改外部地址、无效地址和空值', () => {
    expect(normalizeDevServerUrl('https://dev.example.com:8443/')).toBe('https://dev.example.com:8443/')
    expect(normalizeDevServerUrl('not-a-url')).toBe('not-a-url')
    expect(normalizeDevServerUrl(undefined)).toBeUndefined()
  })
})
