import { describe, expect, it } from 'vitest'
import { DEBUG_TABS } from '../../src/components/DevPanel'

describe('debug catalog', () => {
  it('按开发者诊断任务组织 Debug 入口，并把真实请求作为独立域', () => {
    expect(DEBUG_TABS.map((tab) => [tab.id, tab.label])).toEqual([
      ['prompt', 'Prompt 来源'],
      ['request', '请求'],
      ['world', '伙伴状态'],
      ['runtime', '运行'],
      ['eval', '质量 / Eval'],
      ['system', '系统'],
    ])
  })
})
