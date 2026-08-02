/**
 * M23-G3：Catch-up 概况 LLM + 模板回退
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import initSqlJs from 'sql.js'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async () => 'default'),
  getAllSettings: vi.fn(async () => ({
    llmApiKey: '',
    llmBaseUrl: 'http://x',
    llmModel: 'm',
    auxModel: '',
  })),
}))

const {
  buildCatchupSummary,
  normalizeCatchupSummaryText,
  resolveCatchupSummary,
  computeFineStart,
  __test,
} = await import('../../electron/main/companion/life/catchup')
const { localDateTimeMs } = await import('../../electron/main/companion/life/dates')
const { chatComplete } = await import('../../electron/main/llm/index')

describe('normalizeCatchupSummaryText', () => {
  it('接受普通中文并加前缀', () => {
    const t = normalizeCatchupSummaryText('中间一阵按概况带过，近几天生活已经接上。')
    expect(t?.startsWith(__test.SUMMARY_PREFIX)).toBe(true)
    expect(t).toContain('近几天')
  })

  it('拒绝 JSON / 过短', () => {
    expect(normalizeCatchupSummaryText('{"a":1}')).toBeNull()
    expect(normalizeCatchupSummaryText('短')).toBeNull()
  })
})

describe('resolveCatchupSummary', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    vi.mocked(chatComplete).mockReset()
  })

  it('无 key 时走模板', async () => {
    const now = localDateTimeMs('2026-08-12', 12, 0)
    const pausedAt = localDateTimeMs('2026-08-01', 12, 0)
    const fineStart = computeFineStart(pausedAt, now)
    const r = await resolveCatchupSummary('lin', pausedAt, fineStart, now, {
      preferLlm: true,
      llmConfig: { apiKey: '', baseUrl: 'http://x', model: 'm' },
    })
    expect(r.source).toBe('template')
    expect(r.summary).toBe(buildCatchupSummary('lin', pausedAt, fineStart, now))
    expect(chatComplete).not.toHaveBeenCalled()
  })

  it('LLM 成功则采用叙事', async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(
      '她这段日子偏安静，中间一阵只用概况带过，近几天已经接上日常节奏。',
    )
    const now = localDateTimeMs('2026-08-12', 12, 0)
    const pausedAt = localDateTimeMs('2026-08-01', 12, 0)
    const fineStart = computeFineStart(pausedAt, now)
    const r = await resolveCatchupSummary('lin', pausedAt, fineStart, now, {
      preferLlm: true,
      llmConfig: { apiKey: 'k', baseUrl: 'http://x', model: 'm' },
    })
    expect(r.source).toBe('llm')
    expect(r.summary).toContain('生活追赶摘要')
    expect(r.summary).toContain('偏安静')
  })

  it('LLM 失败回退模板', async () => {
    vi.mocked(chatComplete).mockRejectedValueOnce(new Error('boom'))
    const now = localDateTimeMs('2026-08-12', 12, 0)
    const pausedAt = localDateTimeMs('2026-08-01', 12, 0)
    const fineStart = computeFineStart(pausedAt, now)
    const r = await resolveCatchupSummary('zhou', pausedAt, fineStart, now, {
      preferLlm: true,
      llmConfig: { apiKey: 'k', baseUrl: 'http://x', model: 'm' },
    })
    expect(r.source).toBe('template')
    expect(r.summary).toContain('zhou')
  })
})
