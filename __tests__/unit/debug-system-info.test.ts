import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: () => '0.1.0-test' },
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getAllSettings: vi.fn(async () => ({
    llmModel: 'gpt-4o',
    llmBaseUrl: 'https://api.openai.com/v1',
    activeRoleId: 'lin',
    llmApiKey: 'sk-test',
    systemPrompt: '',
    executionMode: 'confirm-all',
    sessionTokenBudget: '8000',
    dailyTokenBudget: '0',
  })),
}))

vi.mock('../../electron/main/sandbox/permission-engine', () => ({
  getRules: vi.fn(() => [
    {
      id: 'r1',
      type: 'command',
      pattern: 'rm *',
      action: 'deny',
      enabled: true,
      description: 'block rm',
    },
  ]),
}))

vi.mock('../../electron/main/skills/registry', () => ({
  getLoadedSkills: vi.fn(() => [
    {
      meta: { name: 'demo', description: 'demo skill' },
      source: 'builtin',
      filePath: '/x',
    },
  ]),
}))

vi.mock('../../electron/main/mcp/client', () => ({
  mcpManager: {
    getStatus: () => [{ id: 'm1', name: 'demo-mcp', status: 'connected', toolCount: 2 }],
  },
}))

import { buildDebugSystemInfo } from '../../electron/main/agent/debug-system-info'

describe('buildDebugSystemInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('聚合沙箱/权限/Skills，不暴露 API Key', async () => {
    const info = await buildDebugSystemInfo({
      getAll: () => [{ name: 'shell_exec' }, { name: 'read_file' }],
    } as never)

    expect(info.settings.sandboxMode).toBe('workspace-write')
    expect(info.settings.executionMode).toBe('confirm-all')
    expect(info.settings.hasApiKey).toBe(true)
    expect(JSON.stringify(info)).not.toContain('sk-test')
    expect(info.permissionRules.total).toBe(1)
    expect(info.permissionRules.items[0].action).toBe('deny')
    expect(info.skills.total).toBe(1)
    expect(info.skills.items[0].name).toBe('demo')
    expect(info.toolCount).toBe(2)
    expect(info.mcp[0].status).toBe('connected')
  })
})
