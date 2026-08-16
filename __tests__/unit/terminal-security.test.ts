import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() }, safeStorage: { isEncryptionAvailable: () => false } }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  hashForLog: (value: string) => `hash:${value.length}`,
}))

import { limitTerminalOutput, MAX_TERMINAL_OUTPUT_CHARS } from '../../electron/main/ipc/terminal'

describe('Terminal 输出边界', () => {
  it('单个 chunk 截断到 8000 字符', () => {
    const result = limitTerminalOutput('x'.repeat(9000), 0)
    expect(result.chunk).toHaveLength(8000)
    expect(result.limitReached).toBe(true)
  })

  it('累计达到 2MB 后不再接受输出并触发终止标记', () => {
    const result = limitTerminalOutput('abcdef', MAX_TERMINAL_OUTPUT_CHARS - 2)
    expect(result.chunk).toBe('ab')
    expect(result.nextEmittedChars).toBe(MAX_TERMINAL_OUTPUT_CHARS)
    expect(result.limitReached).toBe(true)
  })
})
