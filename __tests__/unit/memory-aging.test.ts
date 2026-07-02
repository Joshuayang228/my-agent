import { describe, it, expect } from 'vitest'
import { formatMemoryAge, formatRecallForInjection, MEMORY_STALE_THRESHOLD_DAYS } from '../../electron/main/memory/vector-store'
import type { VectorSearchResult } from '../../electron/main/memory/vector-store'

describe('G2: formatMemoryAge 记忆老化格式化', () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = 1_700_000_000_000

  it('当天返回「今天」', () => {
    expect(formatMemoryAge(now, now)).toBe('今天')
    expect(formatMemoryAge(now - 3 * 60 * 60 * 1000, now)).toBe('今天') // 3 小时前仍是今天
  })

  it('一天前返回「昨天」', () => {
    expect(formatMemoryAge(now - DAY, now)).toBe('昨天')
  })

  it('多天前返回「N 天前」', () => {
    expect(formatMemoryAge(now - 5 * DAY, now)).toBe('5 天前')
    expect(formatMemoryAge(now - 47 * DAY, now)).toBe('47 天前')
  })

  it('未来时间戳 clamp 到今天（防时钟偏移）', () => {
    expect(formatMemoryAge(now + DAY, now)).toBe('今天')
  })

  it('陈旧阈值常量为 7 天', () => {
    expect(MEMORY_STALE_THRESHOLD_DAYS).toBe(7)
  })

  it('超过阈值的记忆天数可被判定为陈旧', () => {
    const staleTs = now - (MEMORY_STALE_THRESHOLD_DAYS + 1) * DAY
    const ageDays = Math.floor((now - staleTs) / DAY)
    expect(ageDays > MEMORY_STALE_THRESHOLD_DAYS).toBe(true)
  })
})

describe('G5+G2: formatRecallForInjection 召回加工', () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = 1_700_000_000_000

  function result(id: string, text: string, ageDays = 0): VectorSearchResult {
    return { id, text, category: 'conversation', score: 0.8, timestamp: now - ageDays * DAY }
  }

  it('G5: 排除 mem- 前缀的 SQLite 记忆镜像（避免双重注入）', () => {
    const results = [
      result('mem-123', 'SQLite 记忆已全量注入'),
      result('conv-user-456', '对话片段召回'),
    ]
    const output = formatRecallForInjection(results, now)
    expect(output).not.toContain('SQLite 记忆已全量注入')
    expect(output).toContain('对话片段召回')
  })

  it('G5: 全部是 mem- 镜像时返回 null', () => {
    const results = [result('mem-1', 'a'), result('mem-2', 'b')]
    expect(formatRecallForInjection(results, now)).toBeNull()
  })

  it('空结果返回 null', () => {
    expect(formatRecallForInjection([], now)).toBeNull()
  })

  it('G2: 每条召回带相对时间感', () => {
    const results = [result('conv-1', '昨天说的事', 1)]
    const output = formatRecallForInjection(results, now)
    expect(output).toContain('·昨天]')
    expect(output).toContain('昨天说的事')
  })

  it('G2: 存在超阈值记忆时追加陈旧提示', () => {
    const results = [result('conv-old', '很久前的话', MEMORY_STALE_THRESHOLD_DAYS + 5)]
    const output = formatRecallForInjection(results, now)
    expect(output).toContain('请以用户当前表述为准')
  })

  it('G2: 全部是新记忆时不加陈旧提示', () => {
    const results = [result('conv-fresh', '刚说的', 1)]
    const output = formatRecallForInjection(results, now)
    expect(output).not.toContain('请以用户当前表述为准')
  })
})
