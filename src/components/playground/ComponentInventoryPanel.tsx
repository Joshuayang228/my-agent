/**
 * UI 组件资产目录：只读展示组件语义、来源、采用状态和验收要求。
 *
 * 背景：组件故事和正式实现分散在不同页面，仅靠文件名无法判断哪些已采用、哪些只是候选。
 * 设计意图：从统一注册表筛选组件资产，帮助开发者在新增实现前先复用或建立 Playground 故事。
 * 关键约束：目录不动态安装外部库，不把 candidate 渲染成已落地组件，也不复制正式组件实现。
 */

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import {
  UI_COMPONENT_ASSETS,
  UI_COMPONENT_CATEGORIES,
  UI_COMPONENT_STATUSES,
  type UiAccessibilityStatus,
  type UiComponentCategoryId,
  type UiComponentImplementation,
  type UiComponentStatus,
} from '../../shared/ui-component-registry'
import { StoryBlock } from './StoryBlock'

const IMPLEMENTATION_LABELS: Record<UiComponentImplementation, string> = {
  custom: '自有实现',
  'radix-candidate': 'Radix 候选',
  'reference-only': '仅参考',
}

const ACCESSIBILITY_LABELS: Record<UiAccessibilityStatus, string> = {
  verified: '已验证',
  'needs-review': '待复核',
  'not-applicable': '不适用',
}

const STATUS_COLORS: Record<UiComponentStatus, string> = {
  candidate: 'var(--text-muted)',
  playground: 'var(--warning)',
  adopted: 'var(--success)',
  deprecated: 'var(--warning)',
  archived: 'var(--text-muted)',
}

export function ComponentInventoryPanel() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<UiComponentCategoryId | 'all'>('all')
  const [status, setStatus] = useState<UiComponentStatus | 'all'>('all')

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN')
    return UI_COMPONENT_ASSETS.filter((asset) => {
      if (category !== 'all' && asset.category !== category) return false
      if (status !== 'all' && asset.status !== status) return false
      if (!normalized) return true
      return [asset.key, asset.labelZh, asset.labelEn, asset.descriptionZh, asset.sourcePath ?? '', asset.reference ?? '']
        .some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized))
    })
  }, [category, query, status])

  return (
    <div className="space-y-3" data-testid="component-inventory">
      <StoryBlock title="UI 组件资产目录" source="src/shared/ui-component-registry.ts" adopted>
        <div className="space-y-3">
          <div className="rounded-lg border px-3 py-2 text-[11px] leading-5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            目录只登记组件的语义身份、来源、状态和验收要求。候选组件不会自动安装，Playground 故事也不会自动升级为正式产品能力。
          </div>

          <div className="flex flex-col gap-2 xl:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">搜索 UI 组件</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索中文、English、语义 key 或来源"
                className="h-8 w-full rounded-md border pl-8 pr-2 text-xs outline-none"
                style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </label>
            <span className="inline-flex h-8 items-center rounded-md px-2.5 text-[11px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              {filteredAssets.length} / {UI_COMPONENT_ASSETS.length} 个组件资产
            </span>
          </div>

          <div className="space-y-2">
            <div className="scrollbar-hover flex gap-1 overflow-x-auto pb-1" aria-label="组件分类">
              <FilterButton active={category === 'all'} onClick={() => setCategory('all')}>全部</FilterButton>
              {UI_COMPONENT_CATEGORIES.map((item) => (
                <FilterButton key={item.id} active={category === item.id} onClick={() => setCategory(item.id)} title={item.description}>
                  {item.label}
                </FilterButton>
              ))}
            </div>
            <div className="scrollbar-hover flex gap-1 overflow-x-auto pb-1" aria-label="采用状态">
              <FilterButton active={status === 'all'} onClick={() => setStatus('all')}>全部状态</FilterButton>
              {UI_COMPONENT_STATUSES.map((item) => (
                <FilterButton key={item.id} active={status === item.id} onClick={() => setStatus(item.id)} title={item.description}>
                  {item.label}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            {filteredAssets.map((asset) => {
              const statusDefinition = UI_COMPONENT_STATUSES.find((item) => item.id === asset.status)
              return (
                <article key={asset.key} className="min-w-0 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h5 className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{asset.labelZh}</h5>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.labelEn}</span>
                        <span className="ml-auto shrink-0 text-[10px] font-medium" style={{ color: STATUS_COLORS[asset.status] }} title={statusDefinition?.description}>
                          {statusDefinition?.label}
                        </span>
                      </div>
                      <code className="mt-0.5 block truncate font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{asset.key}</code>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>{asset.descriptionZh}</p>

                  <dl className="mt-2 grid gap-1 text-[10px] sm:grid-cols-2">
                    <MetaItem label="实现" value={IMPLEMENTATION_LABELS[asset.implementation]} />
                    <MetaItem label="故事" value={asset.stories.length ? `${asset.stories.length} 个状态` : '尚未建场'} />
                    <MetaItem label="来源" value={asset.sourcePath ?? asset.reference ?? '未登记'} wide />
                    <MetaItem label="无障碍" value={`${ACCESSIBILITY_LABELS[asset.accessibilityStatus]} · ${asset.accessibilityNotes.length} 项检查`} wide />
                  </dl>

                  {asset.stories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {asset.stories.map((story) => (
                        <span key={story} className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{story}</span>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {filteredAssets.length === 0 && (
            <div className="rounded-lg border px-3 py-6 text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
              没有匹配的组件资产。可以搜索 `Dialog`、`Toast` 或 `layout.right-dock`。
            </div>
          )}
        </div>
      </StoryBlock>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="shrink-0 rounded-md px-2 py-1 text-[11px] transition"
      style={{ background: active ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', color: active ? 'var(--accent-fg)' : 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}

function MetaItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <dt className="inline" style={{ color: 'var(--text-muted)' }}>{label}：</dt>
      <dd className="inline break-all" style={{ color: 'var(--text-secondary)' }}>{value}</dd>
    </div>
  )
}
