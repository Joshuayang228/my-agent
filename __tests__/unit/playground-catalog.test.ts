import { describe, expect, it } from 'vitest'
import { PLAYGROUND_GROUPS, PLAYGROUND_TABS, UI_CONTROLS_SUBTABS } from '../../src/components/playground/catalog'

describe('playground catalog', () => {
  it('只暴露设计与 Agent 实验两个任务域', () => {
    expect(PLAYGROUND_GROUPS.map((group) => group.id)).toEqual(['design', 'agent-experiments'])
    expect(PLAYGROUND_TABS.filter((tab) => tab.status !== 'archived').map((tab) => tab.id)).toEqual([
      'design-system', 'component-catalog', 'buttons', 'inputs', 'tool-cards', 'empty', 'confirm', 'memory-chips', 'status-bar', 'icons', 'feedback', 'surface-baseline', 'chat-lab', 'model-test', 'tools',
    ])
    expect(PLAYGROUND_TABS.find((tab) => tab.id === 'persona-review')?.status).toBe('archived')
    expect(PLAYGROUND_TABS.find((tab) => tab.id === 'fixtures')?.status).toBe('archived')
  })

  it('保留 UI 控件的细粒度状态故事', () => {
    expect(UI_CONTROLS_SUBTABS.map((tab) => tab.id)).toEqual([
      'component-catalog', 'buttons', 'inputs', 'tool-cards', 'empty', 'confirm', 'memory-chips', 'status-bar', 'icons', 'feedback',
    ])
  })
})
