/**
 * M30-G1：关系里程碑（反成就绑架）
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'

const store = new Map<string, string>()

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getPath: () => '/tmp' },
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => store.get(key) || ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    store.set(key, value)
  }),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

const {
  tryRecordMilestone,
  listMilestoneKinds,
  formatMilestonesForPrompt,
  __test,
} = await import('../../electron/main/companion/growth/milestones')

describe('milestones', () => {
  beforeEach(() => {
    store.clear()
  })

  it('同 kind 只记一次', async () => {
    const a = await tryRecordMilestone('lin', 'first_role_switch', {
      roleDisplayName: '小林',
      now: 1000,
    })
    expect(a.recorded).toBe(true)
    expect(a.toast).toContain('第一次切到小林')
    expect(a.promptHint).toContain('换到此主角')

    const b = await tryRecordMilestone('lin', 'first_role_switch')
    expect(b.recorded).toBe(false)
    expect(await listMilestoneKinds('lin')).toEqual(['first_role_switch'])
  })

  it('不同角色分桶', async () => {
    await tryRecordMilestone('lin', 'first_reflection')
    await tryRecordMilestone('zhou', 'first_reflection')
    expect(await listMilestoneKinds('lin')).toEqual(['first_reflection'])
    expect(await listMilestoneKinds('zhou')).toEqual(['first_reflection'])
  })

  it('Prompt 格式反成就绑架', () => {
    const text = formatMilestonesForPrompt(['first_rapport', 'first_reflection'])
    expect(text).toContain('绝不能游戏化')
    expect(text).toContain('默契')
  })

  it('parseStore 忽略非法 kind', () => {
    const s = __test.parseStore(
      JSON.stringify({ lin: ['first_role_switch', 'hack', 'first_rapport'] }),
    )
    expect(s.lin).toEqual(['first_role_switch', 'first_rapport'])
  })
})
