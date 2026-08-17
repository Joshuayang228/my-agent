/**
 * M22-G2：feedback 记忆按 role 分桶
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

vi.mock('../../electron/main/memory/vector-store', () => ({
  addToVectorStore: vi.fn(async () => {}),
  removeFromVectorStore: vi.fn(async () => {}),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getAllSettings: vi.fn(async () => ({
    llmApiKey: '',
    llmBaseUrl: 'http://x',
    llmModel: 'm',
  })),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

const {
  addMemory,
  listFeedbackForRole,
  buildUserProfile,
  drainMemoryBackgroundTasks,
} = await import('../../electron/main/storage/memory-store')

describe('memory feedback role bucket (M22-G2)', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
  })

  afterEach(async () => {
    await drainMemoryBackgroundTasks()
    memDb.close()
  })

  it('listFeedbackForRole 只返回同 role 的 feedback', async () => {
    await addMemory('feedback', '对小林：回答要短', { roleId: 'lin' })
    await addMemory('feedback', '对小周：可以活泼一点', { roleId: 'zhou' })
    await addMemory('fact', '用户喜欢咖啡')

    const lin = await listFeedbackForRole('lin')
    const zhou = await listFeedbackForRole('zhou')
    expect(lin.map((m) => m.content)).toEqual(['对小林：回答要短'])
    expect(zhou.map((m) => m.content)).toEqual(['对小周：可以活泼一点'])
  })

  it('旧无 role 的 feedback 不进入任何角色反思桶', async () => {
    await addMemory('feedback', '历史全局反馈')
    expect(await listFeedbackForRole('lin')).toEqual([])
  })

  it('buildUserProfile 按 role 过滤 feedback', async () => {
    await addMemory('feedback', '小林专属反馈', { roleId: 'lin' })
    await addMemory('feedback', '小周专属反馈', { roleId: 'zhou' })
    await addMemory('workflow', '喜欢 checklist')

    const linProfile = await buildUserProfile('lin')
    expect(linProfile?.workflow).toContain('小林专属反馈')
    expect(linProfile?.workflow).not.toContain('小周专属反馈')
    expect(linProfile?.workflow).toContain('喜欢 checklist')
  })
})
