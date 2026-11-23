import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NavigationRail, DEFAULT_RAIL_WORLD_SHORTCUTS } from '../../src/components/shell/NavigationRail'
import { ChatWelcome } from '../../src/components/chat/ChatWelcome'

describe('NavigationRail 与 ChatWelcome 升级门禁', () => {
  it('NavigationRail 顶部渲染伙伴头像、默认快捷入口、自定义开关与未读角标', () => {
    const html = renderToStaticMarkup(createElement(NavigationRail, {
      personaName: '路飞',
      avatarSrc: 'data:image/png;base64,abc',
      activeView: 'chat',
      activeWorldTab: 'moments',
      worldShortcuts: DEFAULT_RAIL_WORLD_SHORTCUTS,
      onChangeWorldShortcuts: () => {},
      onOpenShelf: () => {},
      onNavigate: () => {},
      onOpenWorldTab: () => {},
      unreadMomentsCount: 3,
      developerMode: true,
    }))
    expect(html).toContain('data-testid="navigation-rail"')
    expect(html).toContain('data-testid="rail-avatar-button"')
    expect(html).toContain('data-testid="rail-shortcut-moments"')
    expect(html).toContain('data-testid="rail-shortcut-journal"')
    expect(html).toContain('data-testid="rail-shortcut-keepsakes"')
    expect(html).not.toContain('data-testid="rail-nav-world"')
    expect(html).toContain('data-testid="rail-customize-shortcuts"')
    expect(html).toContain('data-testid="world-unread-badge"')
    expect(html).toContain('data-testid="rail-nav-debug"')
    expect(html).toContain('data-testid="rail-nav-playground"')

    const emptyShortcutsHtml = renderToStaticMarkup(createElement(NavigationRail, {
      personaName: '路飞',
      activeView: 'chat',
      activeWorldTab: 'moments',
      worldShortcuts: [],
      onChangeWorldShortcuts: () => {},
      onOpenShelf: () => {},
      onNavigate: () => {},
      onOpenWorldTab: () => {},
    }))
    expect(emptyShortcutsHtml).toContain('data-testid="rail-nav-world"')
  })

  it('ChatWelcome 顶部 3 颗全为纯提示词胶囊，底部最新动态支持纯图标操作与有图缩略图 +N 角标', () => {
    const html = renderToStaticMarkup(createElement(ChatWelcome, {
      title: '嗨，我是路飞',
      subtitle: '我要成为海贼王的男人！',
      onGreet: () => {},
      onPlanDay: () => {},
      onAskRecent: () => {},
      latestMoment: {
        id: 'm1',
        text: '刚在甲板钓到一条奇怪的大鱼！',
        publishedAt: Date.now() - 10 * 60_000,
        thumbSrc: 'data:image/png;base64,thumb',
        imageCount: 3,
        onOpen: () => {},
        onTalkAbout: () => {},
      },
    }))
    expect(html).toContain('打个招呼')
    expect(html).toContain('今天想怎么过？')
    expect(html).toContain('最近在忙啥呢？')
    expect(html).not.toContain('看看朋友圈')
    // 操作收为纯图标，不渲染文字按钮文案
    expect(html).not.toContain('>聊聊这条<')
    expect(html).not.toContain('>去看看<')
    expect(html).toContain('aria-label="聊聊这条动态"')
    expect(html).toContain('aria-label="前往朋友圈查看"')
    // 有图动态渲染缩略图与 +2 角标
    expect(html).toContain('data-testid="chat-welcome-moment-thumb"')
    expect(html).toContain('+2')
  })
})
