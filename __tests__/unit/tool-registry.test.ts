import { describe, it, expect, vi } from 'vitest'
import { ToolRegistry } from '../../electron/main/tools/registry'
import type { ToolDefinition, ToolCall } from '../../src/shared/types'

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: overrides.name ?? 'echo',
    description: 'echo tool',
    parameters: { type: 'object', properties: {}, required: [] },
    metadata: {
      isReadOnly: true,
      isDestructive: false,
      isConcurrencySafe: true,
      ...overrides.metadata,
    },
    execute: overrides.execute ?? (async (args) => JSON.stringify(args)),
  }
}

function makeCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: overrides.id ?? 'call-1',
    name: overrides.name ?? 'echo',
    arguments: overrides.arguments ?? '{}',
  }
}

describe('ToolRegistry', () => {
  it('register + get + has + getAll', () => {
    const reg = new ToolRegistry()
    const tool = makeTool()

    reg.register(tool)

    expect(reg.has('echo')).toBe(true)
    expect(reg.get('echo')).toBe(tool)
    expect(reg.getAll()).toHaveLength(1)
  })

  it('重复注册同名工具抛异常', () => {
    const reg = new ToolRegistry()
    reg.register(makeTool())
    expect(() => reg.register(makeTool())).toThrowError(/already registered/)
  })

  it('get 未知工具返回 undefined', () => {
    const reg = new ToolRegistry()
    expect(reg.get('nope')).toBeUndefined()
  })

  it('unregister 移除已注册工具', () => {
    const reg = new ToolRegistry()
    reg.register(makeTool())
    expect(reg.has('echo')).toBe(true)
    expect(reg.unregister('echo')).toBe(true)
    expect(reg.has('echo')).toBe(false)
    expect(reg.getAll()).toHaveLength(0)
  })

  it('unregister 不存在的工具返回 false', () => {
    const reg = new ToolRegistry()
    expect(reg.unregister('nope')).toBe(false)
  })

  describe('executeAll', () => {
    it('执行单个工具调用', async () => {
      const reg = new ToolRegistry()
      reg.register(makeTool({ execute: async () => 'hello' }))

      const results = await reg.executeAll([makeCall()])
      expect(results).toHaveLength(1)
      expect(results[0].content).toBe('hello')
      expect(results[0].isError).toBeUndefined()
    })

    it('未知工具返回错误结果', async () => {
      const reg = new ToolRegistry()
      const results = await reg.executeAll([makeCall({ name: 'unknown' })])

      expect(results).toHaveLength(1)
      expect(results[0].isError).toBe(true)
      expect(results[0].content).toContain('Unknown tool')
    })

    it('非法 JSON arguments 返回错误', async () => {
      const reg = new ToolRegistry()
      reg.register(makeTool())

      const results = await reg.executeAll([makeCall({ arguments: '{broken' })])
      expect(results[0].isError).toBe(true)
      expect(results[0].content).toContain('Invalid JSON')
    })

    it('execute 抛异常时捕获为错误结果', async () => {
      const reg = new ToolRegistry()
      reg.register(makeTool({
        execute: async () => { throw new Error('boom') },
      }))

      const results = await reg.executeAll([makeCall()])
      expect(results[0].isError).toBe(true)
      expect(results[0].content).toContain('boom')
    })

    it('并发安全的工具并行执行，不安全的串行', async () => {
      const order: string[] = []

      const concurrentTool = makeTool({
        name: 'fast',
        execute: async () => {
          order.push('fast-start')
          await new Promise(r => setTimeout(r, 10))
          order.push('fast-end')
          return 'fast'
        },
        metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
      })

      const seqTool = makeTool({
        name: 'slow',
        execute: async () => {
          order.push('slow-start')
          await new Promise(r => setTimeout(r, 10))
          order.push('slow-end')
          return 'slow'
        },
        metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
      })

      const reg = new ToolRegistry()
      reg.register(concurrentTool)
      reg.register(seqTool)

      const results = await reg.executeAll([
        makeCall({ id: '1', name: 'fast' }),
        makeCall({ id: '2', name: 'slow' }),
      ])

      expect(results).toHaveLength(2)
      expect(order.indexOf('fast-start')).toBeLessThan(order.indexOf('slow-start'))
    })

    it('保持 LLM 原始顺序：交替的安全/不安全工具分批执行', async () => {
      const order: string[] = []

      const safeA = makeTool({
        name: 'safeA',
        execute: async () => { order.push('safeA'); return 'a' },
        metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
      })
      const safeB = makeTool({
        name: 'safeB',
        execute: async () => { order.push('safeB'); return 'b' },
        metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
      })
      const unsafeC = makeTool({
        name: 'unsafeC',
        execute: async () => { order.push('unsafeC'); return 'c' },
        metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
      })
      const safeD = makeTool({
        name: 'safeD',
        execute: async () => { order.push('safeD'); return 'd' },
        metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
      })

      const reg = new ToolRegistry()
      reg.register(safeA)
      reg.register(safeB)
      reg.register(unsafeC)
      reg.register(safeD)

      // LLM 顺序：safeA → safeB → unsafeC → safeD
      const results = await reg.executeAll([
        makeCall({ id: '1', name: 'safeA' }),
        makeCall({ id: '2', name: 'safeB' }),
        makeCall({ id: '3', name: 'unsafeC' }),
        makeCall({ id: '4', name: 'safeD' }),
      ])

      expect(results).toHaveLength(4)
      expect(results.map(r => r.name)).toEqual(['safeA', 'safeB', 'unsafeC', 'safeD'])

      // safeA & safeB 先并行 → unsafeC 串行 → safeD 最后
      expect(order.indexOf('safeA')).toBeLessThan(order.indexOf('unsafeC'))
      expect(order.indexOf('safeB')).toBeLessThan(order.indexOf('unsafeC'))
      expect(order.indexOf('unsafeC')).toBeLessThan(order.indexOf('safeD'))
    })
  })
})
