import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  dialog: { showMessageBox: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => false },
}))

import { isValidMcpConfig } from '../../electron/main/ipc/mcp'
import type { McpServerConfig } from '../../src/shared/types'
import { createMcpTransport } from '../../electron/main/mcp/transport'
import {
  MCP_REDACTED_ENV_VALUE,
  redactMcpConfigsForRenderer,
  hydrateMcpConfigSecrets,
  mergeMcpConfigListSecrets,
  hasNewOrChangedEnabledMcpConfig,
} from '../../electron/main/mcp/config-security'

describe('MCP 配置安全边界', () => {
  const remote: McpServerConfig = { id: 'remote', name: '远程服务', command: '', args: [], enabled: true, transport: 'streamable-http', url: 'https://example.com/mcp', bearerToken: 'fixture-token' }

  it('Streamable HTTP 接受有界令牌，拒绝不安全协议、Header 注入与错误传输', () => {
    expect(isValidMcpConfig(remote)).toBe(true)
    for (const bearerToken of ['', 'x'.repeat(4097), 'secret\r\nX-Evil: true', 'Bearer value']) {
      expect(isValidMcpConfig({ ...remote, bearerToken })).toBe(false)
    }
    for (const url of ['http://example.com/mcp', 'http://127.evil.example/mcp', 'ftp://example.com/mcp', 'https://u:p@example.com/mcp']) {
      expect(isValidMcpConfig({ ...remote, url })).toBe(false)
    }
    for (const url of ['http://localhost:8080/mcp', 'http://127.0.0.1/mcp', 'http://[::1]/mcp']) {
      expect(isValidMcpConfig({ ...remote, url })).toBe(true)
    }
    expect(isValidMcpConfig({ ...remote, transport: 'sse' })).toBe(false)
    expect(isValidMcpConfig({ ...remote, transport: 'stdio', command: 'node' })).toBe(false)
    expect(isValidMcpConfig({ ...remote, bearerToken: undefined, url: 'http://example.com/mcp' })).toBe(true)
  })

  it('Bearer 经 Renderer 脱敏和保存合并恢复，换端点不能复用旧令牌', () => {
    const raw = JSON.stringify([remote])
    const redacted = JSON.parse(redactMcpConfigsForRenderer(raw))[0]
    expect(redacted.bearerToken).toBe(MCP_REDACTED_ENV_VALUE)
    expect(JSON.stringify(redacted)).not.toContain(remote.bearerToken)
    expect(hydrateMcpConfigSecrets(redacted, [remote])).toEqual(remote)
    expect(hydrateMcpConfigSecrets(redacted, [])).toBeNull()
    expect(hydrateMcpConfigSecrets({ ...redacted, url: 'https://other.example/mcp' }, [remote])).toBeNull()
    expect(hydrateMcpConfigSecrets({ ...redacted, url: `${remote.url}/other` }, [remote])).toBeNull()
    expect(hydrateMcpConfigSecrets({ ...redacted, bearerToken: 'new-token', url: 'https://other.example/mcp' }, [remote])?.bearerToken).toBe('new-token')
    const merged = mergeMcpConfigListSecrets(JSON.stringify([redacted]), raw)
    expect(merged.ok && merged.configs[0].bearerToken).toBe(remote.bearerToken)
    expect(hasNewOrChangedEnabledMcpConfig([remote], [{ ...remote, bearerToken: 'rotated-token' }])).toBe(true)
    expect(hasNewOrChangedEnabledMcpConfig([remote], [{ ...remote, bearerToken: undefined }])).toBe(true)
  })

  it('传输工厂拒绝未恢复哨兵及未知协议，不隐式降级为本地进程', () => {
    expect(() => createMcpTransport({ ...remote, bearerToken: MCP_REDACTED_ENV_VALUE })).toThrow('凭据尚未恢复')
    expect(() => createMcpTransport({ ...remote, transport: 'unknown' as McpServerConfig['transport'] })).toThrow()
    expect(createMcpTransport({ ...remote, bearerToken: undefined })).toBeDefined()
    expect(createMcpTransport({ ...remote, transport: 'sse', bearerToken: undefined })).toBeDefined()
    expect(createMcpTransport({ ...remote, transport: 'stdio', command: 'node', bearerToken: undefined })).toBeDefined()
  })

  it('接受有界 stdio / SSE 配置', () => {
    expect(isValidMcpConfig({ id: 'x', name: 'server', command: 'npx', args: ['pkg'], enabled: true })).toBe(true)
    expect(isValidMcpConfig({ id: 'x', name: 'server', command: '', args: [], enabled: true, transport: 'sse', url: 'https://example.com/sse' })).toBe(true)
  })

  it('拒绝非法协议、环境变量名和超限参数', () => {
    expect(isValidMcpConfig({ id: 'x', name: 'server', command: '', args: [], enabled: true, transport: 'sse', url: 'file:///tmp/x' })).toBe(false)
    expect(isValidMcpConfig({ id: 'x', name: 'server', command: '', args: [], enabled: true, transport: 'sse', url: 'https://user:pass@example.com/sse' })).toBe(false)
    expect(isValidMcpConfig({ id: 'x', name: 'server', command: 'node', args: [], enabled: true, env: { 'BAD-KEY': 'x' } })).toBe(false)
    expect(isValidMcpConfig({ id: 'x', name: 'server', command: 'x'.repeat(5000), args: [], enabled: true })).toBe(false)
  })

  it('旧配置默认全部允许，新配置校验工具许可并保持排序比较', () => {
    const base = { id: 'x', name: 'server', command: 'node', args: [], enabled: true }
    expect(isValidMcpConfig(base)).toBe(true)
    expect(isValidMcpConfig({ ...base, allowedTools: ['search', 'write'] })).toBe(true)
    expect(isValidMcpConfig({ ...base, allowedTools: ['search', 'search'] })).toBe(false)
    expect(isValidMcpConfig({ ...base, allowedTools: [''] })).toBe(false)
    expect(hasNewOrChangedEnabledMcpConfig([{ ...base, allowedTools: ['search'] }], [{ ...base, allowedTools: ['write'] }])).toBe(true)
  })

  it('Renderer 只能看到 env 哨兵，主进程可用旧配置恢复真实值', () => {
    const stored = [{ id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: 'real-secret' } }]
    const redacted = JSON.parse(redactMcpConfigsForRenderer(JSON.stringify(stored)))
    expect(redacted[0].env).toEqual({ TOKEN: MCP_REDACTED_ENV_VALUE })
    expect(JSON.stringify(redacted)).not.toContain('real-secret')
    expect(hydrateMcpConfigSecrets(redacted[0], stored)?.env).toEqual({ TOKEN: 'real-secret' })
  })

  it('旧 secret 即使是空字符串也能被正确保留', () => {
    const incoming = { id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { EMPTY: MCP_REDACTED_ENV_VALUE } }
    expect(hydrateMcpConfigSecrets(incoming, [{ ...incoming, env: { EMPTY: '' } }])?.env).toEqual({ EMPTY: '' })
  })

  it('没有旧 secret 时拒绝把脱敏哨兵当作真实环境变量启动', () => {
    const incoming = { id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: MCP_REDACTED_ENV_VALUE } }
    expect(hydrateMcpConfigSecrets(incoming, [])).toBeNull()
  })

  it('保存脱敏配置时保留旧 secret，并识别启用配置变更', () => {
    const stored = JSON.stringify([{ id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: 'real-secret' } }])
    const incoming = JSON.stringify([{ id: 'mcp-1', name: 'server', command: 'node', args: [], enabled: true, env: { TOKEN: MCP_REDACTED_ENV_VALUE } }])
    const merged = mergeMcpConfigListSecrets(incoming, stored)
    expect(merged.ok).toBe(true)
    if (!merged.ok) return
    expect(JSON.parse(merged.json)[0].env).toEqual({ TOKEN: 'real-secret' })
    expect(hasNewOrChangedEnabledMcpConfig(JSON.parse(stored), merged.configs)).toBe(false)
    expect(hasNewOrChangedEnabledMcpConfig(JSON.parse(stored), [{ ...merged.configs[0], command: 'python' }])).toBe(true)
  })
})
