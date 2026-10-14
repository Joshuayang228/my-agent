import { describe, expect, it } from 'vitest'
import { DEBUG_TABS } from '../../src/components/DevPanel'
import { DEBUG_GROUPS, DEBUG_PERSPECTIVES } from '../../src/shared/debug-navigation'
import { DEBUG_PERSPECTIVES as CANDIDATE_TABS } from '../../src/components/playground/debug-experience-fixtures'

describe('debug catalog', () => {
  it('正式与候选共用七组领域导航，六生活面与质量入口独立可达', () => {
    expect(DEBUG_TABS).toBe(DEBUG_PERSPECTIVES)
    expect(CANDIDATE_TABS).toBe(DEBUG_PERSPECTIVES)
    expect(DEBUG_GROUPS).toHaveLength(7)
    expect(new Set(DEBUG_TABS.map(tab => tab.id)).size).toBe(26)
    expect(DEBUG_TABS[0].label).toBe('提示词管理器')
    for (const label of ['家居', '足迹', '衣柜', '文化角', '通讯录', '朋友圈', '用户画像', 'Skill 验收', '人格验收']) expect(DEBUG_TABS.some(tab => tab.label === label)).toBe(true)
  })
})
