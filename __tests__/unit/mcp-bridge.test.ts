import { describe, it, expect } from 'vitest'
import {
  mcpToolFullName,
  isMcpTool,
  parseMcpToolName,
  mcpToolToDefinition,
  DEFAULT_MCP_TOOL_METADATA,
} from '../../electron/main/mcp/bridge'
import type { McpTool } from '../../electron/main/mcp/client'

function makeMcpTool(overrides: Partial<McpTool> = {}): McpTool {
  return {
    serverId: overrides.serverId ?? 'notes',
    serverName: overrides.serverName ?? 'Notes',
    name: overrides.name ?? 'search',
    description: overrides.description ?? 'Search notes',
    inputSchema: overrides.inputSchema ?? {
      type: 'object',
      properties: { q: { type: 'string' } },
      required: ['q'],
    },
  }
}

describe('MCP Bridge', () => {
  it('命名空间 mcp:serverId:toolName', () => {
    expect(mcpToolFullName('notes', 'search')).toBe('mcp:notes:search')
    expect(isMcpTool('mcp:notes:search')).toBe(true)
    expect(isMcpTool('file_read')).toBe(false)
  })

  it('parseMcpToolName 保留工具名内冒号', () => {
    expect(parseMcpToolName('mcp:notes:a:b')).toEqual({
      serverId: 'notes',
      toolName: 'a:b',
    })
    expect(parseMcpToolName('file_read')).toBeNull()
  })

  it('外部工具元数据默认保守（破坏性确认 + 不可并发）', () => {
    const def = mcpToolToDefinition(makeMcpTool())
    expect(def.metadata).toEqual(DEFAULT_MCP_TOOL_METADATA)
    expect(def.metadata.isDestructive).toBe(true)
    expect(def.metadata.isConcurrencySafe).toBe(false)
    expect(def.metadata.isReadOnly).toBe(false)
  })

  it('描述超过 2048 字符时截断并标注', () => {
    const long = 'x'.repeat(3000)
    const def = mcpToolToDefinition(makeMcpTool({ description: long }))
    expect(def.description.length).toBeLessThan(long.length + 50)
    expect(def.description).toContain('…[description truncated]')
    expect(def.description.startsWith('[Notes]')).toBe(true)
  })

  it('schema 映射 properties / required', () => {
    const def = mcpToolToDefinition(makeMcpTool())
    expect(def.parameters.type).toBe('object')
    expect(def.parameters.properties).toEqual({ q: { type: 'string' } })
    expect(def.parameters.required).toEqual(['q'])
  })
})
