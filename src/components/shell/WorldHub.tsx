/**
 * 人物世界口袋 — 对齐 Alice `/moments`：一页多 tab，侧栏只留一个入口。
 */

import type { ReactNode } from 'react'
import { Newspaper, Shirt, Users, BookOpen, Home, MapPin, LayoutGrid, X } from 'lucide-react'
import { MomentsPanel, type MomentsPreviewData } from '../MomentsPanel'
import { AssetsPanel } from '../AssetsPanel'
import { CastPanel } from '../CastPanel'
import { CharacterShelfPanel } from '../CharacterShelfPanel'
import { WorldDetailsPanel } from '../WorldDetailsPanel'
import type { ShellView } from './SecondaryNav'

export type WorldTab = 'moments' | 'assets' | 'cast' | 'shelf' | 'wardrobe' | 'culture' | 'home' | 'footprints'

export type WorldTabDefinition = { id: WorldTab; label: string; icon: ReactNode }

const WORLD_TABS: WorldTabDefinition[] = [
  { id: 'moments', label: '朋友圈', icon: <Newspaper size={14} strokeWidth={1.5} /> },
  { id: 'wardrobe', label: '衣柜', icon: <Shirt size={14} strokeWidth={1.5} /> },
  { id: 'culture', label: '文化角', icon: <BookOpen size={14} strokeWidth={1.5} /> },
  { id: 'home', label: '家居', icon: <Home size={14} strokeWidth={1.5} /> },
  { id: 'cast', label: '通讯录', icon: <Users size={14} strokeWidth={1.5} /> },
  { id: 'footprints', label: '足迹', icon: <LayoutGrid size={14} strokeWidth={1.5} /> },
]

export function isWorldView(view: ShellView): boolean {
  return view === 'world' || view === 'moments' || view === 'assets' || view === 'cast' || view === 'shelf' || view === 'wardrobe' || view === 'culture' || view === 'home' || view === 'footprints'
}

export function worldTabFromView(view: ShellView): WorldTab {
  if (view === 'assets') return 'wardrobe'
  if (view === 'cast' || view === 'shelf' || view === 'moments' || view === 'wardrobe' || view === 'culture' || view === 'home' || view === 'footprints') return view
  return 'moments'
}

export function WorldHub({
  tab,
  onTabChange,
  onClose,
  onOpenSession,
  onSwitched,
  recentByRole,
  momentsPreview,
  momentsAppearance,
  hideMomentsHeader,
  hideHeader,
  showSocialActions = false,
  previewPanels,
  hiddenTabs = [],
  tabLabels,
  tabs,
}: {
  tab: WorldTab
  onTabChange: (tab: WorldTab) => void
  onClose: () => void
  onOpenSession: (sessionId: string) => void
  onSwitched: (p: { id: string; name: string; description: string }) => void
  recentByRole: Record<string, { sessionId: string; title: string; updatedAt: number }>
  /** Playground / 测试专用只读朋友圈样张。 */
  momentsPreview?: MomentsPreviewData
  /** 正式页默认 Alice 流；Playground 可显式覆盖。 */
  momentsAppearance?: 'default' | 'social-feed' | 'alice-feed'
  /** WorldHub 已有标题时隐藏 Moments 重复标题行。 */
  hideMomentsHeader?: boolean
  /** Playground 可用自定义人物世界头图替代默认标题行。 */
  hideHeader?: boolean
  /** Playground 夹具才需要这个开关；正式页只要没有 previewData 就走真实赞 / 评论。 */
  showSocialActions?: boolean
  /** Playground / 测试专用业务样张；存在时替代对应真实面板，避免读取生产数据。 */
  previewPanels?: Partial<Record<WorldTab, ReactNode>>
  /** 候选组合可隐藏不属于该页面的 Tab；默认产品世界仍保留完整入口。 */
  hiddenTabs?: readonly WorldTab[]
  /** Playground 可替换用户可见标签；内部 tab key 保持稳定，正式页面默认文案不变。 */
  tabLabels?: Partial<Record<WorldTab, string>>
  /** Playground 可提供独立的生活面 Tab 定义；不传时保持正式页面的既有入口。 */
  tabs?: readonly WorldTabDefinition[]
}) {
  const visibleTabs = (tabs ?? WORLD_TABS).filter((item) => !hiddenTabs.includes(item.id))
  const labelFor = (item: WorldTabDefinition) => tabLabels?.[item.id] ?? item.label

  return (
    <div className="flex h-full flex-col" data-testid="world-hub">
      {!hideHeader && <div
        className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            人物世界
          </h1>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {visibleTabs.map(labelFor).join('、')} — 一个口袋里的生活面。
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 transition"
          style={{ color: 'var(--text-muted)' }}
          title="返回聊天"
        >
          <X size={14} />
        </button>
      </div>}

      <div
        className="flex shrink-0 gap-1 overflow-x-auto border-b px-4"
        style={{ borderColor: 'var(--border-subtle)' }}
        role="tablist"
        aria-label="人物世界分区"
      >
        {visibleTabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`world-panel-${t.id}`}
              onClick={() => onTabChange(t.id)}
              className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12px] transition"
              data-testid={`world-tab-${t.id}`}
              style={{
                borderColor: active ? 'var(--companion-accent-warm)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ color: active ? 'var(--companion-accent-warm)' : 'var(--text-muted)' }}>
                {t.icon}
              </span>
              {labelFor(t)}
            </button>
          )
        })}
      </div>

      <div id={`world-panel-${tab}`} role="tabpanel" className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {previewPanels?.[tab] ?? (
          <>
            {tab === 'moments' && <MomentsPanel onClose={onClose} previewData={momentsPreview} appearance={momentsAppearance ?? 'alice-feed'} hideHeader={hideMomentsHeader ?? true} showSocialActions={showSocialActions} />}
            {tab === 'wardrobe' && <AssetsPanel onClose={onClose} />}
            {(tab === 'culture' || tab === 'home' || tab === 'footprints') && <WorldDetailsPanel tab={tab} />}
            {tab === 'cast' && (
              <CastPanel
                onClose={onClose}
                onOpenSession={onOpenSession}
                onOpenShelf={() => onTabChange('shelf')}
                recentByRole={recentByRole}
              />
            )}
            {tab === 'shelf' && <CharacterShelfPanel onClose={onClose} onSwitched={onSwitched} />}
          </>
        )}
      </div>
    </div>
  )
}
