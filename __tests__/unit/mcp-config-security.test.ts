import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), once: vi.fn(), removeListener: vi.fn() },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  dialog: { showMessageBox: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => false },
}))

import { isValidMcpConfig } from '../../electron/main/ipc/mcp'
import {
  MCP_REDACTED_ENV_VALUE,
  redactMcpConfigsForRenderer,
  hydrateMcpConfigSecrets,
  mergeMcpConfigListSecrets,
  hasNewOrChangedEnabledMcpConfig,
} from '../../electron/main/mcp/config-security'

describe('MCP 配置安全边界', () => {
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
