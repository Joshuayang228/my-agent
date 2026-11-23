import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChatScrollToBottomButton, ChatTurnRail, formatTurnPreview } from '../../src/components/chat/ChatScrollNavigator'

describe('ChatScrollNavigator（长对话回底与轮次跳转轨）', () => {
  it('formatTurnPreview 折叠换行并截断超长输入', () => {
    expect(formatTurnPreview('  你好\n世界  ')).toBe('你好 世界')
    expect(formatTurnPreview('')).toBe('（空消息）')
    const longText = '这是一条非常非常长的测试消息，用于确认单条预览卡片里会自动截断超长用户发言而不会把浮层撑破，确保长对话侧边圆点跳转时的预览卡片始终保持清爽紧凑，不会溢出卡片边缘。'
    expect(formatTurnPreview(longText).endsWith('…')).toBe(true)
    expect(formatTurnPreview(longText).length).toBeLessThanOrEqual(69)
  })

  it('ChatTurnRail 少于 2 条用户发言时不渲染，达到 2 条后渲染左侧小横杠跳转轨', () => {
    const single = renderToStaticMarkup(createElement(ChatTurnRail, {
      turns: [{ id: 'm1', preview: '你好' }],
      activeTurnId: 'm1',
      onJumpToTurn: () => {},
    }))
    expect(single).toBe('')

    const multi = renderToStaticMarkup(createElement(ChatTurnRail, {
      turns: [
        { id: 'm1', preview: '第一条问题' },
        { id: 'm2', preview: '第二条问题' },
      ],
      activeTurnId: 'm2',
      onJumpToTurn: () => {},
    }))
    expect(multi).toContain('data-testid="chat-turn-rail"')
    expect(multi).toContain('跳转到第 1 轮：第一条问题')
    expect(multi).toContain('跳转到第 2 轮：第二条问题')
  })

  it('ChatScrollToBottomButton 按 visible 控制显隐并具备可读标签', () => {
    expect(renderToStaticMarkup(createElement(ChatScrollToBottomButton, { visible: false, onClick: () => {} }))).toBe('')
    const shown = renderToStaticMarkup(createElement(ChatScrollToBottomButton, { visible: true, onClick: () => {} }))
    expect(shown).toContain('data-testid="chat-scroll-to-bottom"')
    expect(shown).toContain('回到底部')
  })
})
