import { describe, expect, it } from 'vitest'
import { PLAYGROUND_TABS, UI_CONTROLS_SUBTABS } from '../../src/components/playground/catalog'
import { PROMPT_ASSETS } from '../../src/components/playground/prompt-assets'

describe('playground catalog', () => {
  it('顶栏含合同 Phase 0 六 tab 且默认无 archived', () => {
    const ids = PLAYGROUND_TABS.map((t) => t.id)
    expect(ids).toEqual([
      'design-system',
      'ui-controls',
      'prompts',
      'chat-lab',
      'tools',
      'fixtures',
    ])
    expect(PLAYGROUND_TABS.every((t) => t.status !== 'archived')).toBe(true)
  })

  it('UI 控件子区覆盖按钮/输入/工具卡/空态/确认/芯片/状态条', () => {
    expect(UI_CONTROLS_SUBTABS.map((t) => t.id)).toEqual([
      'buttons',
      'inputs',
      'tool-cards',
      'empty',
      'confirm',
      'memory-chips',
      'status-bar',
    ])
  })

  it('Prompt 资产目录非空且带源路径', () => {
    expect(PROMPT_ASSETS.length).toBeGreaterThanOrEqual(5)
    for (const a of PROMPT_ASSETS) {
      expect(a.id).toBeTruthy()
      expect(a.sourcePath).toBeTruthy()
    }
  })
})
