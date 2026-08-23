import { describe, expect, it } from 'vitest'
import { PLAYGROUND_GROUPS, PLAYGROUND_TABS, UI_CONTROLS_SUBTABS } from '../../src/components/playground/catalog'

describe('playground catalog', () => {
  it('只暴露基础、产品体验与 Agent 实验三个工作域', () => {
    expect(PLAYGROUND_GROUPS.map((group) => group.id)).toEqual(['foundation', 'experience', 'agent-experiments'])
    expect(PLAYGROUND_TABS.filter((tab) => tab.status !== 'archived').map((tab) => tab.id)).toEqual([
      'design-tokens', 'visual-assets', 'foundation-components', 'chat', 'world', 'memory', 'settings', 'workspace', 'business-states', 'chat-lab', 'model-test', 'tools',
    ])
    expect(PLAYGROUND_TABS.find((tab) => tab.id === 'design-tokens')?.label).toBe('设计语言')
    expect(PLAYGROUND_TABS.find((tab) => tab.id === 'persona-review')?.status).toBe('archived')
    expect(PLAYGROUND_TABS.find((tab) => tab.id === 'fixtures')?.status).toBe('archived')
    for (const tab of PLAYGROUND_TABS.filter((item) => item.status !== 'archived')) expect(tab.description).toBeTruthy()
  })

  it('保留 UI 控件的细粒度状态故事', () => {
    expect(UI_CONTROLS_SUBTABS.map((tab) => tab.id)).toEqual([
      'buttons', 'inputs', 'tool-cards', 'memory-chips', 'empty', 'confirm', 'status-bar', 'feedback', 'toast', 'spinner', 'tabs', 'markdown', 'asset-table', 'file-tree', 'resize-handle', 'icons',
    ])
  })
})
