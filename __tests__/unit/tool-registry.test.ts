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
      // concurrent ones finish first (all started together via Promise.all),
      // then sequential ones run after
      expect(order.indexOf('fast-start')).toBeLessThan(order.indexOf('slow-start'))
    })
  })
})
