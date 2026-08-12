import { describe, expect, it } from 'vitest'
import { DEBUG_TABS } from '../../src/components/DevPanel'

describe('debug catalog', () => {
  it('只包含生产真相视图，提示词管理器为首项', () => {
    expect(DEBUG_TABS.map((tab) => [tab.id, tab.label])).toEqual([
      ['prompt', '提示词管理器'],
      ['context', '上下文'],
      ['world', '世界态'],
      ['runtime', '运行记录'],
      ['eval', 'Eval'],
      ['system', '系统'],
    ])
  })
})
