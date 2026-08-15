import { describe, expect, it } from 'vitest'
import { shouldAutoApproveHeadlessTool } from '../../electron/main/agent/headless-policy'

const readOnly = { metadata: { isReadOnly: true, isDestructive: false } }
const destructive = { metadata: { isReadOnly: false, isDestructive: true } }

describe('headless-policy', () => {
  it('只自动批准明确只读工具', () => {
    expect(shouldAutoApproveHeadlessTool('file_read', readOnly)).toBe(true)
    expect(shouldAutoApproveHeadlessTool('file_write', destructive)).toBe(false)
    expect(shouldAutoApproveHeadlessTool('unknown', undefined)).toBe(false)
  })

  it('阻止可间接扩大副作用的 Shell / 子 Agent / 继续任务入口', () => {
    expect(shouldAutoApproveHeadlessTool('shell_exec', readOnly)).toBe(false)
    expect(shouldAutoApproveHeadlessTool('delegate_task', readOnly)).toBe(false)
    expect(shouldAutoApproveHeadlessTool('continue_task', readOnly)).toBe(false)
  })
})
