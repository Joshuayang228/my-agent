import { describe, expect, it } from 'vitest'
import { DEBUG_TABS } from '../../src/components/DevPanel'

describe('debug catalog', () => {
  it('按开发者诊断任务组织 Debug 入口，并合并请求与运行入口', () => {
    expect(DEBUG_TABS.map((tab) => [tab.id, tab.label])).toEqual([
      ['prompt', '提示词管理器'],
      ['request-runtime', '请求与运行'],
      ['world', '伙伴状态'],
      ['eval', '质量 / Eval'],
      ['system', '系统'],
    ])
  })
})
