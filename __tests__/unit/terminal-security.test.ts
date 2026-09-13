import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() }, safeStorage: { isEncryptionAvailable: () => false } }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  hashForLog: (value: string) => `hash:${value.length}`,
}))

import { limitTerminalOutput, MAX_TERMINAL_OUTPUT_CHARS } from '../../electron/main/ipc/terminal'
import { appendTerminalOutput } from '../../src/components/chat/right-dock/TerminalPanel'

describe('Terminal 输出边界', () => {
  it('跨 IPC 分片的正文衔接到同一行，只有真实换行才新增行', () => {
    expect(appendTerminalOutput(appendTerminalOutput([''], 'hel'), 'lo\r\nnext')).toEqual(['hello', 'next'])
    expect(appendTerminalOutput(appendTerminalOutput([''], 'hello\r'), '\nnext')).toEqual(['hello', 'next'])
  })
  it('单个 chunk 超过 8000 字符不误判为累计超限', () => {
    const result = limitTerminalOutput('x'.repeat(9000), 0)
    expect(result.chunk).toHaveLength(9000)
    expect(result.limitReached).toBe(false)
  })

  it('累计达到 2MB 后不再接受输出并触发终止标记', () => {
    const result = limitTerminalOutput('abcdef', MAX_TERMINAL_OUTPUT_CHARS - 2)
    expect(result.chunk).toBe('ab')
    expect(result.nextEmittedChars).toBe(MAX_TERMINAL_OUTPUT_CHARS)
    expect(result.limitReached).toBe(true)
  })
})
