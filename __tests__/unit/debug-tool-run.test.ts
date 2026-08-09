/**
 * Debug 工具手测：权限门闸（不执行真实工具副作用）
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ToolDefinition } from '../../src/shared/types'
import type { ToolRegistry } from '../../electron/main/tools/registry'

vi.mock('../../electron/main/sandbox/permission-engine', () => ({
  checkToolPermission: vi.fn(),
  checkCommandPermission: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getAllSettings: vi.fn(async () => ({ executionMode: 'auto' })),
}))

vi.mock('../../electron/main/agent/project-memory', () => ({
  getWorkspaceRoot: vi.fn(() => undefined),
}))

vi.mock('../../electron/main/utils/tracer', () => ({
  startLinkedAsyncSpan: vi.fn(() => ({
    end: vi.fn(),
    setAttribute: vi.fn(),
    dropped: false,
  })),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import {
  checkToolPermission,
  checkCommandPermission,
} from '../../electron/main/sandbox/permission-engine'
import { runDebugTool } from '../../electron/main/agent/debug-tool-run'

function makeRegistry(tool: Partial<ToolDefinition> & { name: string }): ToolRegistry {
  const def: ToolDefinition = {
    name: tool.name,
    description: tool.description ?? 't',
    parameters: tool.parameters ?? { type: 'object', properties: {} },
    metadata: tool.metadata ?? {
      isReadOnly: true,
      isDestructive: false,
      isConcurrencySafe: true,
    },
    execute: tool.execute ?? (async () => 'ok'),
  }
  return {
    get: (n: string) => (n === def.name ? def : undefined),
    executeAll: vi.fn(async () => [
      { callId: 'x', name: def.name, content: 'ran', isError: false },
    ]),
  } as unknown as ToolRegistry
}

describe('runDebugTool', () => {
  beforeEach(() => {
    vi.mocked(checkToolPermission).mockReset()
    vi.mocked(checkCommandPermission).mockReset()
  })

  it('未知工具拒绝', async () => {
    const registry = makeRegistry({ name: 'file_read' })
    const r = await runDebugTool(registry, { name: 'nope' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/未知工具/)
  })

  it('工具 deny 不可靠 confirmRisk 绕过', async () => {
    vi.mocked(checkToolPermission).mockReturnValue({
      allowed: false,
      reason: 'blocked',
      decisionType: 'custom-rule',
      chain: 'custom-rule',
    })
    const registry = makeRegistry({ name: 'file_write' })
    const r = await runDebugTool(registry, {
      name: 'file_write',
      args: { path: 'a' },
      confirmRisk: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Permission Denied/)
    expect(registry.executeAll).not.toHaveBeenCalled()
  })

  it('破坏性工具无 confirmRisk 时要求确认', async () => {
    vi.mocked(checkToolPermission).mockReturnValue({
      allowed: true,
      reason: '默认允许',
      decisionType: 'default-allow',
      chain: 'fallback',
    })
    const registry = makeRegistry({
      name: 'file_write',
      metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
    })
    const r = await runDebugTool(registry, { name: 'file_write', args: {} })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.needsConfirmation).toBe(true)
    expect(registry.executeAll).not.toHaveBeenCalled()
  })

  it('破坏性工具 confirmRisk 后执行', async () => {
    vi.mocked(checkToolPermission).mockReturnValue({
      allowed: true,
      reason: '默认允许',
      decisionType: 'default-allow',
      chain: 'fallback',
    })
    const registry = makeRegistry({
      name: 'file_write',
      metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
    })
    const r = await runDebugTool(registry, {
      name: 'file_write',
      args: { path: 'x' },
      confirmRisk: true,
    })
    expect(r.ok).toBe(true)
    expect(registry.executeAll).toHaveBeenCalledOnce()
  })

  it('shell_exec 命令 deny 拦截', async () => {
    vi.mocked(checkToolPermission).mockReturnValue({
      allowed: true,
      reason: '默认允许',
      decisionType: 'default-allow',
      chain: 'fallback',
    })
    vi.mocked(checkCommandPermission).mockReturnValue({
      allowed: false,
      reason: '危险命令被拦截',
      decisionType: 'dangerous',
      chain: 'sandbox-policy',
    })
    const registry = makeRegistry({
      name: 'shell_exec',
      metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
    })
    const r = await runDebugTool(registry, {
      name: 'shell_exec',
      args: { command: 'rm -rf /' },
      confirmRisk: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Permission Denied|危险/)
    expect(registry.executeAll).not.toHaveBeenCalled()
  })
})
