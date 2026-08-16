import { describe, it, expect } from 'vitest'
import {
  mcpToolFullName,
  isMcpTool,
  parseMcpToolName,
  mcpToolToDefinition,
  DEFAULT_MCP_TOOL_METADATA,
  normalizeMcpNameSegment,
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
  it('命名空间 mcp__serverId__toolName（Provider 安全）', () => {
    expect(mcpToolFullName('notes', 'search')).toBe('mcp__notes__search')
    expect(isMcpTool('mcp__notes__search')).toBe(true)
    expect(isMcpTool('mcp:notes:search')).toBe(true) // 旧格式仍识别
    expect(isMcpTool('file_read')).toBe(false)
  })

  it('normalizeMcpNameSegment 去掉非法字符', () => {
    expect(normalizeMcpNameSegment('my-server.v1')).toBe('my-server_v1')
    expect(normalizeMcpNameSegment('a:b')).toBe('a_b')
  })

  it('parseMcpToolName 解析新格式与旧冒号格式', () => {
    expect(parseMcpToolName('mcp__notes__a__b')).toEqual({
      serverId: 'notes',
      toolName: 'a__b',
    })
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
    expect(def.description).toContain('[Notes]')
    expect(def.description).toContain('外部 MCP 工具描述')
  })

  it('schema 映射 properties / required', () => {
    const def = mcpToolToDefinition(makeMcpTool())
    expect(def.parameters.type).toBe('object')
    expect(def.parameters.properties).toEqual({ q: { type: 'string' } })
    expect(def.parameters.required).toEqual(['q'])
  })

  it('外部 MCP schema 超过上限时 fail-closed，不把巨大结构注入模型', () => {
    const def = mcpToolToDefinition(makeMcpTool({
      inputSchema: { type: 'object', properties: { payload: { description: 'x'.repeat(140_000) } } },
    }))
    expect(def.parameters.properties).toEqual({})
    expect(def.parameters.additionalProperties).toBe(false)
  })
})
