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

  it('ChatWelcome 移除 3 颗模板胶囊，底部渲染等宽毛玻璃朋友圈悬浮切片卡（支持有图/纯文两态）', () => {
    const withThumbHtml = renderToStaticMarkup(createElement(ChatWelcome, {
      title: '上午好啊',
      subtitle: '我是要成为海贼王的男人！',
      roleName: '路飞',
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
    expect(withThumbHtml).not.toContain('打个招呼')
    expect(withThumbHtml).not.toContain('今天想怎么过？')
    expect(withThumbHtml).not.toContain('最近在忙啥呢？')
    expect(withThumbHtml).toContain('路飞')
    expect(withThumbHtml).toContain('在朋友圈')
    expect(withThumbHtml).toContain('aria-label="聊聊这条动态"')
    expect(withThumbHtml).toContain('aria-label="前往朋友圈查看"')
    expect(withThumbHtml).toContain('data-testid="chat-welcome-moment-thumb"')
    expect(withThumbHtml).toContain('+2')

    const textOnlyHtml = renderToStaticMarkup(createElement(ChatWelcome, {
      title: '上午好啊',
      subtitle: '我是要成为海贼王的男人！',
      roleName: '路飞',
      latestMoment: {
        id: 'm2',
        text: '书里那口锅边偷尝太香了。',
        publishedAt: Date.now() - 20 * 60_000,
        onOpen: () => {},
        onTalkAbout: () => {},
      },
    }))
    expect(textOnlyHtml).not.toContain('data-testid="chat-welcome-moment-thumb"')
    expect(textOnlyHtml).toContain('书里那口锅边偷尝太香了。')
    expect(textOnlyHtml).toContain('aria-label="聊聊这条动态"')
  })
})
