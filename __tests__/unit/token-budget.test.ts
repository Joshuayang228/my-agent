import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

vi.mock('../../electron/main/storage/session-store', () => ({
  getTokenUsage: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getAllSettings: vi.fn(),
}))

import { checkBudget, recordDailyUsage, getDailyUsage } from '../../electron/main/agent/token-budget'
import { getTokenUsage } from '../../electron/main/storage/session-store'
import { getAllSettings } from '../../electron/main/storage/settings-store'

const mockGetTokenUsage = vi.mocked(getTokenUsage)
const mockGetAllSettings = vi.mocked(getAllSettings)

describe('Token Budget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('无预算限制时允许通过', async () => {
    mockGetAllSettings.mockResolvedValue({
      sessionTokenBudget: '0',
      dailyTokenBudget: '0',
    } as any)

    const result = await checkBudget('sess-1')
    expect(result.allowed).toBe(true)
  })

  it('会话预算未超限时允许通过', async () => {
    mockGetAllSettings.mockResolvedValue({
      sessionTokenBudget: '100000',
      dailyTokenBudget: '0',
    } as any)
    mockGetTokenUsage.mockResolvedValue({ promptTokens: 5000, completionTokens: 3000 })

    const result = await checkBudget('sess-1')
    expect(result.allowed).toBe(true)
  })

  it('会话预算超限时拒绝', async () => {
    mockGetAllSettings.mockResolvedValue({
      sessionTokenBudget: '10000',
      dailyTokenBudget: '0',
    } as any)
    mockGetTokenUsage.mockResolvedValue({ promptTokens: 8000, completionTokens: 5000 })

    const result = await checkBudget('sess-1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('会话')
  })

  it('recordDailyUsage 累加 daily 计数', () => {
    const before = getDailyUsage()
    recordDailyUsage(100, 50)
    expect(getDailyUsage()).toBe(before + 150)
  })
})
