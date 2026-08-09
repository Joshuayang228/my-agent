import { describe, expect, it } from 'vitest'
import { resolveEffectiveSandbox } from '../../electron/main/sandbox/effective-sandbox'

describe('resolveEffectiveSandbox', () => {
  it('完全访问 → full-access', () => {
    expect(resolveEffectiveSandbox('full-access')).toBe('full-access')
  })

  it('请求批准 / 替我审批 / plan-first → workspace-write', () => {
    expect(resolveEffectiveSandbox('confirm-all')).toBe('workspace-write')
    expect(resolveEffectiveSandbox('auto')).toBe('workspace-write')
    expect(resolveEffectiveSandbox('plan-first')).toBe('workspace-write')
  })

  it('缺省 → workspace-write', () => {
    expect(resolveEffectiveSandbox(undefined)).toBe('workspace-write')
    expect(resolveEffectiveSandbox('')).toBe('workspace-write')
  })
})
