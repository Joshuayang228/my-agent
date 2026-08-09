import { describe, expect, it } from 'vitest'
import { PLAYGROUND_TABS, UI_CONTROLS_SUBTABS } from '../../src/components/playground/catalog'

describe('playground catalog', () => {
  it('顶栏含设计系统到体验夹具且含模型测试，默认无 archived', () => {
    const ids = PLAYGROUND_TABS.map((t) => t.id)
    expect(ids).toEqual([
      'design-system',
      'ui-controls',
      'surface-baseline',
      'chat-lab',
      'model-test',
      'tools',
      'fixtures',
    ])
    expect(PLAYGROUND_TABS.every((t) => t.status !== 'archived')).toBe(true)
  })

  it('UI 控件子区覆盖按钮/输入/工具卡/空态/确认/芯片/状态条/图标', () => {
    expect(UI_CONTROLS_SUBTABS.map((t) => t.id)).toEqual([
      'buttons',
      'inputs',
      'tool-cards',
      'empty',
      'confirm',
      'memory-chips',
      'status-bar',
      'icons',
    ])
  })
})
