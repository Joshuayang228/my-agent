import { describe, it, expect, vi } from 'vitest'
import type { ToolDefinition } from '../../src/shared/types'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))
vi.mock('../../electron/main/llm/provider-router', () => ({
  detectProvider: vi.fn().mockReturnValue('openai'),
  buildAnthropicBody: vi.fn(),
}))

import { appendExamplesToDescription } from '../../electron/main/llm/index'

function makeTool(over: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'demo',
    description: 'A demo tool',
    parameters: { type: 'object', properties: {} },
    metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
    execute: async () => 'ok',
    ...over,
  }
}

describe('appendExamplesToDescription (M2 Tool Use Examples)', () => {
  it('无 inputExamples 时原样返回 description', () => {
    const tool = makeTool()
    expect(appendExamplesToDescription(tool)).toBe('A demo tool')
  })

  it('空数组时原样返回', () => {
    const tool = makeTool({ inputExamples: [] })
    expect(appendExamplesToDescription(tool)).toBe('A demo tool')
  })

  it('有示例时追加到 description 末尾', () => {
    const tool = makeTool({
      inputExamples: [{ path: 'src/a.ts' }, { path: 'src/b.ts', line_start: '10' }],
    })
    const result = appendExamplesToDescription(tool)
    expect(result).toContain('A demo tool')
    expect(result).toContain('Example inputs:')
    expect(result).toContain('Example 1: {"path":"src/a.ts"}')
    expect(result).toContain('Example 2: {"path":"src/b.ts","line_start":"10"}')
  })

  it('示例是合法 JSON（能被 parse 回来）', () => {
    const tool = makeTool({ inputExamples: [{ query: 'export function \\w+', is_regex: 'true' }] })
    const result = appendExamplesToDescription(tool)
    const match = result.match(/Example 1: (.+)$/m)
    expect(match).toBeTruthy()
    const parsed = JSON.parse(match![1])
    expect(parsed.query).toBe('export function \\w+')
    expect(parsed.is_regex).toBe('true')
  })
})
