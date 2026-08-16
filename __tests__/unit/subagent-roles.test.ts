/**
 * M8 补齐：子 Agent 角色系统 + 权限只降不升 + 工具集构建
 */
import { describe, it, expect } from 'vitest'
import {
  AGENT_ROLES,
  resolveChildExecutionMode,
  buildChildRegistry,
  type SubAgentConfig,
} from '../../electron/main/agent/subagent'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { resolveDelegateTaskMetadata } from '../../electron/main/tools/builtins/delegate-task'
import { continueTaskTool } from '../../electron/main/tools/builtins/continue-task'
import type { ToolDefinition } from '../../src/shared/types'

function fakeTool(name: string, opts: Partial<ToolDefinition['metadata']> = {}): ToolDefinition {
  return {
    name,
    description: name,
    parameters: { type: 'object', properties: {} },
    metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true, ...opts },
    execute: async () => 'ok',
  }
}

function makeParentRegistry(): ToolRegistry {
  const r = new ToolRegistry()
  r.register(fakeTool('file_read', { isReadOnly: true, isDestructive: false }))
  r.register(fakeTool('code_search', { isReadOnly: true, isDestructive: false }))
  r.register(fakeTool('web_search', { isReadOnly: true, isDestructive: false }))
  r.register(fakeTool('url_fetch', { isReadOnly: true, isDestructive: false }))
  r.register(fakeTool('rag_search', { isReadOnly: true, isDestructive: false }))
  r.register(fakeTool('file_write', { isReadOnly: false, isDestructive: true }))
  r.register(fakeTool('file_edit', { isReadOnly: false, isDestructive: true }))
  r.register(fakeTool('apply_patch', { isReadOnly: false, isDestructive: true }))
  r.register(fakeTool('shell_exec', { isReadOnly: false, isDestructive: true }))
  r.register(fakeTool('delegate_task', { isReadOnly: true, isDestructive: false }))
  r.register(fakeTool('continue_task', { isReadOnly: true, isDestructive: false }))
  r.register(fakeTool('remember', { isReadOnly: false, isDestructive: false }))
  return r
}

describe('G4: resolveChildExecutionMode 权限只降不升', () => {
  it('父级 auto → 子 auto', () => {
    expect(resolveChildExecutionMode('auto')).toBe('auto')
  })

  it('父级 confirm-all → 子继承 confirm-all（不能降到 auto）', () => {
    expect(resolveChildExecutionMode('confirm-all')).toBe('confirm-all')
  })

  it('父级 plan-first → 子继承 plan-first（最严，不能逃逸）', () => {
    expect(resolveChildExecutionMode('plan-first')).toBe('plan-first')
  })

  it('父级 undefined → 默认 auto', () => {
    expect(resolveChildExecutionMode(undefined)).toBe('auto')
  })

  it('父为 full-access 时子仍落到 auto（不能比父更松，但可不继承最松）', () => {
    expect(resolveChildExecutionMode('full-access')).toBe('auto')
  })
})

describe('G6: AGENT_ROLES 预设', () => {
  it('三个预设角色齐全', () => {
    expect(AGENT_ROLES.researcher).toBeDefined()
    expect(AGENT_ROLES.coder).toBeDefined()
    expect(AGENT_ROLES.analyst).toBeDefined()
  })

  it('researcher 只读，带研究工具', () => {
    expect(AGENT_ROLES.researcher.defaultReadOnly).toBe(true)
    expect(AGENT_ROLES.researcher.defaultAllowedTools).toContain('web_search')
    expect(AGENT_ROLES.researcher.defaultAllowedTools).not.toContain('file_write')
  })

  it('coder 非只读，带编辑工具', () => {
    expect(AGENT_ROLES.coder.defaultReadOnly).toBe(false)
    expect(AGENT_ROLES.coder.defaultAllowedTools).toContain('file_edit')
    expect(AGENT_ROLES.coder.defaultAllowedTools).toContain('shell_exec')
  })

  it('analyst 只读', () => {
    expect(AGENT_ROLES.analyst.defaultReadOnly).toBe(true)
    expect(AGENT_ROLES.analyst.defaultAllowedTools).not.toContain('file_write')
  })
})

describe('G6: buildChildRegistry 工具集构建', () => {
  function cfg(over: Partial<SubAgentConfig> = {}): SubAgentConfig {
    return { role: 'researcher', task: 't', ...over }
  }

  it('researcher 角色 → 用预设工具集（只读工具）', () => {
    const child = buildChildRegistry(makeParentRegistry(), cfg({ role: 'researcher' }))
    const names = child.getAll().map(t => t.name)
    expect(names).toContain('file_read')
    expect(names).toContain('web_search')
    expect(names).not.toContain('file_write')  // 只读，破坏性工具被过滤
  })

  it('coder 角色 → 带编辑工具（非只读）', () => {
    const child = buildChildRegistry(makeParentRegistry(), cfg({ role: 'coder' }))
    const names = child.getAll().map(t => t.name)
    expect(names).toContain('file_edit')
    expect(names).toContain('shell_exec')
  })

  it('显式 allowedTools 覆盖角色预设', () => {
    const child = buildChildRegistry(makeParentRegistry(), cfg({ role: 'coder', allowedTools: ['file_read'] }))
    const names = child.getAll().map(t => t.name)
    expect(names).toEqual(['file_read'])
  })

  it('显式 readOnly=true 覆盖 coder 的非只读，过滤破坏性工具', () => {
    const child = buildChildRegistry(makeParentRegistry(), cfg({ role: 'coder', readOnly: true }))
    const names = child.getAll().map(t => t.name)
    expect(names).not.toContain('file_write')
    expect(names).toContain('file_read')
  })

  it('自由字符串角色 → 回退到父只读工具', () => {
    const child = buildChildRegistry(makeParentRegistry(), cfg({ role: 'API tester' }))
    const names = child.getAll().map(t => t.name)
    expect(names).toContain('file_read')
    expect(names).not.toContain('file_write')
  })

  it('黑名单工具永不进子 Agent（防递归/越权）', () => {
    const child = buildChildRegistry(makeParentRegistry(), cfg({ role: 'coder', allowedTools: ['delegate_task', 'continue_task', 'remember', 'file_read'] }))
    const names = child.getAll().map(t => t.name)
    expect(names).not.toContain('delegate_task')
    expect(names).not.toContain('continue_task')
    expect(names).not.toContain('remember')
    expect(names).toContain('file_read')
  })
})

describe('子 Agent 工具 metadata 权限边界', () => {
  it('researcher/analyst 默认只读，coder 与显式可写必须确认', () => {
    expect(resolveDelegateTaskMetadata({ role: 'researcher' })).toMatchObject({ isReadOnly: true, isDestructive: false })
    expect(resolveDelegateTaskMetadata({ role: 'analyst' })).toMatchObject({ isReadOnly: true, isDestructive: false })
    expect(resolveDelegateTaskMetadata({ role: 'coder' })).toMatchObject({ isReadOnly: false, isDestructive: true })
    expect(resolveDelegateTaskMetadata({ role: 'researcher', read_only: 'false' })).toMatchObject({ isReadOnly: false, isDestructive: true })
  })

  it('自由角色显式工具列表按潜在可写处理，read_only=true 可证明只读', () => {
    expect(resolveDelegateTaskMetadata({ role: 'tester', allowed_tools: 'file_read,file_edit' })).toMatchObject({
      isReadOnly: false,
      isDestructive: true,
      isConcurrencySafe: false,
    })
    expect(resolveDelegateTaskMetadata({ role: 'coder', read_only: 'true' })).toMatchObject({
      isReadOnly: true,
      isDestructive: false,
      isConcurrencySafe: true,
    })
  })

  it('continue_task 无法从 agent_id 证明只读，静态 fail-closed', () => {
    expect(continueTaskTool.metadata).toMatchObject({
      isReadOnly: false,
      isDestructive: true,
      isConcurrencySafe: false,
    })
  })
})
