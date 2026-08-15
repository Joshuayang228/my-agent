import { describe, expect, it } from 'vitest'
import { resolveRuntimeDone } from '../../electron/main/agent/runtime'

describe('Runtime 终态去重', () => {
  it('Loop 已发出 aborted / max_turns 时，Runtime 不重复补发且不改写原因', () => {
    expect(resolveRuntimeDone(true, 'aborted')).toEqual({ emit: false, reason: 'aborted' })
    expect(resolveRuntimeDone(true, 'max_turns')).toEqual({ emit: false, reason: 'max_turns' })
  })

  it('异常路径没有 done 时只补发一次 model_error', () => {
    expect(resolveRuntimeDone(false)).toEqual({ emit: true, reason: 'model_error' })
  })
})
