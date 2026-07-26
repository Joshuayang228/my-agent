import { describe, it, expect } from 'vitest'
import { resolveConfirmOnTimeout, CONFIRM_TIMEOUT_MS } from '../../electron/main/ipc/chat'
import { mcpReconnectDelayMs } from '../../electron/main/mcp/client'
import { diffBaseline } from '../../evals/baseline'
import type { EvalReport } from '../../evals/types'

describe('M17 G4 IPC / 可测纯逻辑', () => {
  it('confirm 超时默认拒绝', () => {
    expect(resolveConfirmOnTimeout()).toBe(false)
    expect(CONFIRM_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it('MCP 重连退避有上限', () => {
    expect(mcpReconnectDelayMs(0)).toBe(1000)
    expect(mcpReconnectDelayMs(10)).toBe(60_000)
  })
})

describe('M18 Baseline diff', () => {
  it('标出回归与改进', () => {
    const baseline: EvalReport = {
      timestamp: 't0',
      totalScenarios: 2,
      passed: 2,
      failed: 0,
      required_failed: 0,
      results: [
        { id: 'F01', description: '', pass: true, durationMs: 1, graderResults: [] },
        { id: 'F02', description: '', pass: false, durationMs: 1, graderResults: [] },
      ],
    }
    const current: EvalReport = {
      ...baseline,
      results: [
        { id: 'F01', description: '', pass: false, durationMs: 1, graderResults: [] },
        { id: 'F02', description: '', pass: true, durationMs: 1, graderResults: [] },
        { id: 'B01', description: '', pass: true, durationMs: 1, graderResults: [] },
      ],
    }
    const d = diffBaseline(current, baseline)
    expect(d.regressions).toEqual(['F01'])
    expect(d.improvements).toEqual(['F02'])
    expect(d.newScenarios).toEqual(['B01'])
  })
})
