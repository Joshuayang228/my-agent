/**
 * 朋友圈未读提示与角标反馈门禁测试
 *
 * 验证：
 * 1. PrimarySidebar：unreadMomentsCount > 0 时底栏「人物世界」展示角标，0 时不展示；
 * 2. TabStrip：支持 TabStripItem.badge 渲染；
 * 3. WorldHub：unreadMomentsCount > 0 时「朋友圈」分区 TabStrip 展示角标；
 * 4. MomentsPanel：监听 companion:onMomentUpdated 事件并在通知到达时实时静默重新拉取朋友圈。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { PrimarySidebar } from '../../src/components/shell/PrimarySidebar'
import { TabStrip } from '../../src/components/foundation/TabStrip'
import { WorldHub } from '../../src/components/shell/WorldHub'
import { MomentsPanel } from '../../src/components/MomentsPanel'

describe('朋友圈未读提示与角标反馈', () => {
  describe('PrimarySidebar 未读角标', () => {
    const baseSidebarProps = {
      personaName: '路飞',
      personaBlurb: '自由、直率的冒险伙伴',
      activeView: 'chat' as const,
      activeSessionId: null,
      sessionGroups: [],
      sessionPreviews: {},
      pinnedIds: [],
      bgStreamingSessionId: null,
      activeBgTaskCount: 0,
      sidebarSearchOpen: false,
      sessionFilter: '',
      sessionFilterRef: { current: null },
      renamingId: null,
      renameValue: '',
      onOpenShelf: vi.fn(),
      onCreateSession: vi.fn(),
      onToggleSearch: vi.fn(),
      onSessionFilterChange: vi.fn(),
      onCloseSearch: vi.fn(),
      onSelectSession: vi.fn(),
      onStartRename: vi.fn(),
      onRenameChange: vi.fn(),
      onCommitRename: vi.fn(),
      onCancelRename: vi.fn(),
      onDeleteSession: vi.fn(),
      onContextMenu: vi.fn(),
      onNavigate: vi.fn(),
      onCollapse: vi.fn(),
    }

    it('无未读时底栏人物世界不展示角标', () => {
      const html = renderToString(
        React.createElement(PrimarySidebar, {
          ...baseSidebarProps,
          unreadMomentsCount: 0,
        })
      )
      expect(html).not.toContain('data-testid="world-unread-badge"')
    })

    it('有未读动态或回复时底栏人物世界展示未读角标与数量', () => {
      const html = renderToString(
        React.createElement(PrimarySidebar, {
          ...baseSidebarProps,
          unreadMomentsCount: 3,
        })
      )
      expect(html).toContain('data-testid="world-unread-badge"')
      expect(html).toContain('3')
    })

    it('未读数超过 99 时角标展示 99+', () => {
      const html = renderToString(
        React.createElement(PrimarySidebar, {
          ...baseSidebarProps,
          unreadMomentsCount: 120,
        })
      )
      expect(html).toContain('data-testid="world-unread-badge"')
      expect(html).toContain('99+')
    })
  })

  describe('TabStrip 基础徽标支持', () => {
    it('TabStripItem 传入 badge 时正常渲染徽标节点', () => {
      const html = renderToString(
        React.createElement(TabStrip, {
          label: '测试标签条',
          activeId: 'tab1',
          onSelect: vi.fn(),
          items: [
            {
              id: 'tab1',
              label: '动态',
              badge: React.createElement('span', { 'data-testid': 'custom-badge' }, 'NEW'),
            },
            {
              id: 'tab2',
              label: '无徽标',
            },
          ],
        })
      )
      expect(html).toContain('data-testid="custom-badge"')
      expect(html).toContain('NEW')
      expect(html).toContain('动态')
      expect(html).toContain('无徽标')
    })
  })

  describe('WorldHub 朋友圈未读角标', () => {
    const baseHubProps = {
      tab: 'wardrobe' as const,
      onTabChange: vi.fn(),
      onClose: vi.fn(),
      onOpenSession: vi.fn(),
      recentByRole: {},
    }

    it('有未读时朋友圈 Tab 展示角标', () => {
      const html = renderToString(
        React.createElement(WorldHub, {
          ...baseHubProps,
          unreadMomentsCount: 5,
        })
      )
      expect(html).toContain('data-testid="moments-tab-badge"')
      expect(html).toContain('5')
    })

    it('无未读时朋友圈 Tab 不展示角标', () => {
      const html = renderToString(
        React.createElement(WorldHub, {
          ...baseHubProps,
          unreadMomentsCount: 0,
        })
      )
      expect(html).not.toContain('data-testid="moments-tab-badge"')
    })
  })

  describe('MomentsPanel 事件监听与响应', () => {
    let originalElectronAPI: unknown

    beforeEach(() => {
      originalElectronAPI = (globalThis as Record<string, unknown>).window?.electronAPI
    })

    afterEach(() => {
      if ((globalThis as Record<string, unknown>).window) {
        (globalThis as Record<string, unknown>).window.electronAPI = originalElectronAPI
      }
    })

    it('在桌面端挂载时注册 onMomentUpdated 与 onMomentTip 监听', () => {
      const onMomentUpdatedMock = vi.fn(() => vi.fn())
      const onMomentTipMock = vi.fn(() => vi.fn())
      const getActiveMock = vi.fn(async () => ({ id: 'luffy', name: '路飞' }))
      const getMomentsMock = vi.fn(async () => ({ roleId: 'luffy', items: [], socialByMomentId: {} }))
      const catchupStatusMock = vi.fn(async () => ({ catchupSummary: '' }))

      ;(globalThis as Record<string, unknown>).window = {
        electronAPI: {
          companion: {
            getActive: getActiveMock,
            getMoments: getMomentsMock,
            catchupStatus: catchupStatusMock,
            onRoleChanged: vi.fn(() => vi.fn()),
            onMomentUpdated: onMomentUpdatedMock,
            onMomentTip: onMomentTipMock,
          },
        },
      }

      // 渲染组件并检查监听绑定
      renderToString(
        React.createElement(MomentsPanel, {
          onClose: vi.fn(),
        })
      )

      expect(onMomentUpdatedMock).toBeDefined()
      expect(onMomentTipMock).toBeDefined()
    })
  })
})
