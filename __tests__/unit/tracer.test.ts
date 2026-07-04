/**
 * tracer.ts 单元测试
 *
 * 覆盖：
 * - SpanType 分类与属性设置
 * - 父子 span 嵌套（parentId）
 * - blocked_on_user vs tool_execution 独立计时
 * - mark() 启动打点
 * - getCallerStats() token 累计
 * - getSpanTypeStats() 类型统计
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  startSpan,
  mark,
  getRecentSpans,
  getCallerStats,
  getSpanTypeStats,
  getStartupMarks,
  clearSpans,
  type SpanType,
} from '../../electron/main/utils/tracer'

// 每个测试前清空 spans，保证隔离
beforeEach(() => {
  clearSpans()
})

describe('Tracer — Span 基础操作', () => {
  it('startSpan 返回 SpanHandle，id 格式符合预期', () => {
    const handle = startSpan('test_span', 'main', 'interaction')
    expect(handle.id).toMatch(/^span-\d+-[0-9a-z]+$/)
  })

  it('end() 正确设置 duration 和 status', () => {
    const handle = startSpan('test_span', 'main', 'llm_request')
    handle.end('ok')

    const spans = getRecentSpans(10)
    const span = spans.find(s => s.id === handle.id)
    expect(span).toBeDefined()
    expect(span!.status).toBe('ok')
    expect(span!.duration).toBeGreaterThanOrEqual(0)
    expect(span!.endTime).toBeDefined()
  })

  it('end("error") 时设置 error 字段', () => {
    const handle = startSpan('error_span', 'main', 'llm_request')
    handle.end('error', 'timeout')

    const spans = getRecentSpans(10)
    const span = spans.find(s => s.id === handle.id)
    expect(span!.status).toBe('error')
    expect(span!.error).toBe('timeout')
  })

  it('setAttribute 和 setAttributes 正确写入 attributes', () => {
    const handle = startSpan('attr_span', 'main', 'llm_request')
    handle.setAttribute('model', 'gpt-4')
    handle.setAttributes({ inputTokens: 100, outputTokens: 50 })
    handle.end('ok')

    const span = getRecentSpans(10).find(s => s.id === handle.id)
    expect(span!.attributes.model).toBe('gpt-4')
    expect(span!.attributes.inputTokens).toBe(100)
    expect(span!.attributes.outputTokens).toBe(50)
  })
})

describe('Tracer — SpanType 分类', () => {
  const TYPES: SpanType[] = [
    'interaction', 'llm_request', 'tool', 'tool_blocked',
    'tool_execution', 'compress', 'subagent',
  ]

  for (const type of TYPES) {
    it(`SpanType "${type}" 能正确创建和结束`, () => {
      const handle = startSpan(`test_${type}`, 'main', type)
      handle.end('ok')

      const spans = getRecentSpans(20)
      const span = spans.find(s => s.id === handle.id)
      expect(span).toBeDefined()
      expect(span!.type).toBe(type)
    })
  }
})

describe('Tracer — 父子嵌套（M7 核心：调用链树）', () => {
  it('子 span 携带 parentId 指向父 span', () => {
    const parent = startSpan('interaction', 'main', 'interaction')
    const child = startSpan('llm_request', 'main', 'llm_request', parent.id)
    child.end('ok')
    parent.end('ok')

    const spans = getRecentSpans(10)
    const childSpan = spans.find(s => s.id === child.id)
    expect(childSpan!.parentId).toBe(parent.id)
  })

  it('多层嵌套：interaction → tool → tool_blocked / tool_execution', () => {
    const interaction = startSpan('interaction', 'main', 'interaction')
    const toolSpan = startSpan('tool_shell', 'tool', 'tool', interaction.id)

    // blocked_on_user 是 tool 的子 span
    const blocked = startSpan('blocked_shell', 'tool', 'tool_blocked', interaction.id)
    blocked.setAttribute('decision', 'approved')
    blocked.end('ok')

    // tool_execution 是实际执行时间
    const exec = startSpan('tool_exec', 'tool', 'tool_execution', interaction.id)
    exec.end('ok')

    toolSpan.setAttribute('success', true)
    toolSpan.end('ok')
    interaction.end('ok')

    const spans = getRecentSpans(20)
    expect(spans.find(s => s.id === blocked.id)!.parentId).toBe(interaction.id)
    expect(spans.find(s => s.id === exec.id)!.parentId).toBe(interaction.id)
    expect(spans.find(s => s.id === toolSpan.id)!.parentId).toBe(interaction.id)
  })

  it('不传 parentId 时，span 是顶层 span（无父）', () => {
    const top = startSpan('top_span', 'main', 'interaction')
    top.end('ok')

    const span = getRecentSpans(10).find(s => s.id === top.id)
    expect(span!.parentId).toBeUndefined()
  })
})

describe('Tracer — blocked_on_user vs tool_execution 分离计时（G2）', () => {
  it('blocked span 和 execution span 耗时独立，不互相包含', async () => {
    const blockedSpan = startSpan('blocked', 'tool', 'tool_blocked')
    await new Promise(r => setTimeout(r, 10))  // 模拟等待用户确认
    blockedSpan.end('ok')

    const execSpan = startSpan('exec', 'tool', 'tool_execution')
    await new Promise(r => setTimeout(r, 10))  // 模拟工具执行
    execSpan.end('ok')

    const spans = getRecentSpans(10)
    const blocked = spans.find(s => s.id === blockedSpan.id)!
    const exec = spans.find(s => s.id === execSpan.id)!

    // 两个 span 的耗时都大于 0，且是独立的
    expect(blocked.duration).toBeGreaterThan(0)
    expect(exec.duration).toBeGreaterThan(0)
    // blocked 的 endTime 应该早于 exec 的 startTime
    expect(blocked.endTime!).toBeLessThanOrEqual(exec.startTime + 5)
  })
})

describe('Tracer — mark() 启动打点（Phase B）', () => {
  it('mark() 记录启动打点，包含 name 和 relativeMs', () => {
    mark('test_mark_phase_b')
    const marks = getStartupMarks()
    const found = marks.find(m => m.name === 'test_mark_phase_b')
    expect(found).toBeDefined()
    expect(found!.relativeMs).toBeGreaterThanOrEqual(0)
    expect(found!.timestamp).toBeGreaterThan(0)
  })
})

describe('Tracer — getCallerStats() token 累计（Phase C）', () => {
  it('llm_request span 的 token 归因到正确 caller', () => {
    const mainSpan = startSpan('llm_main', 'main', 'llm_request')
    mainSpan.setAttributes({ inputTokens: 1000, outputTokens: 200 })
    mainSpan.end('ok')

    const compactSpan = startSpan('llm_compact', 'compact', 'llm_request')
    compactSpan.setAttributes({ inputTokens: 500, outputTokens: 100 })
    compactSpan.end('ok')

    const stats = getCallerStats()

    expect(stats['main'].totalInputTokens).toBe(1000)
    expect(stats['main'].totalOutputTokens).toBe(200)
    expect(stats['compact'].totalInputTokens).toBe(500)
    expect(stats['compact'].totalOutputTokens).toBe(100)
  })

  it('非 llm_request 的 span 不影响 token 统计', () => {
    const toolSpan = startSpan('tool_exec', 'tool', 'tool')
    toolSpan.end('ok')

    const stats = getCallerStats()
    // tool caller 的 token 应该为 0
    expect(stats['tool']?.totalInputTokens ?? 0).toBe(0)
    expect(stats['tool']?.totalOutputTokens ?? 0).toBe(0)
  })

  it('同 caller 多次调用正确累加', () => {
    for (let i = 0; i < 3; i++) {
      const s = startSpan(`llm_${i}`, 'main', 'llm_request')
      s.setAttributes({ inputTokens: 100, outputTokens: 50 })
      s.end('ok')
    }

    const stats = getCallerStats()
    expect(stats['main'].totalInputTokens).toBe(300)
    expect(stats['main'].totalOutputTokens).toBe(150)
    expect(stats['main'].count).toBe(3)
  })
})

describe('Tracer — getSpanTypeStats() 类型统计', () => {
  it('按 SpanType 分类统计 count 和 avgMs', () => {
    const llm1 = startSpan('llm1', 'main', 'llm_request')
    llm1.end('ok')
    const llm2 = startSpan('llm2', 'main', 'llm_request')
    llm2.end('ok')

    const tool1 = startSpan('t1', 'tool', 'tool')
    tool1.end('ok')

    const stats = getSpanTypeStats()
    expect(stats['llm_request'].count).toBe(2)
    expect(stats['tool'].count).toBe(1)
    expect(stats['llm_request'].avgMs).toBeGreaterThanOrEqual(0)
  })
})

describe('Tracer — MAX_SPANS 溢出剪裁', () => {
  it('超出 MAX_SPANS 时旧 span 被删除，总数不超过 500', () => {
    // 先清空，再插入足够多的 span
    clearSpans()
    for (let i = 0; i < 510; i++) {
      const s = startSpan(`s${i}`, 'main', 'tool')
      s.end('ok')
    }
    const spans = getRecentSpans(1000)
    expect(spans.length).toBeLessThanOrEqual(500)
  })
})
