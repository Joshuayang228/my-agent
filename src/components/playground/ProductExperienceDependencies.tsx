/**
 * 背景：产品体验基础引用展示当前体验使用的全部基础资产；当体验引用的组件较多（如设置达 9+ 项）且右侧有源码路径时，空间有限会被截断。
 * 设计意图：将基础组件列表改为可横向滚动的轻量容器（overflow-x-auto + scrollbar-hover），并监听 onWheel 转换纵向滚轮为横向滚动，便于人工全面核验两层关系。
 * 关键约束：依赖正文来自 product-experience-registry，反向关系不在 Renderer 另存一份；保持 data-testid="experience-foundation-parts" 契约与单行不折行。
 */

import type { WheelEvent } from 'react'
import { PRODUCT_EXPERIENCE_ASSETS, experienceFoundationKeys, type ProductExperienceTabId } from '../../shared/product-experience-registry'
import { UI_COMPONENT_REGISTRY } from '../../shared/ui-component-registry'
import { PlaygroundSourcePath } from './PlaygroundLayout'

export function ProductExperienceDependencies({ tabId, showSource = false }: { tabId: ProductExperienceTabId; showSource?: boolean }) {
  const experience = PRODUCT_EXPERIENCE_ASSETS.find((asset) => asset.playgroundTabId === tabId)
  if (!experience) return null

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY !== 0 && event.currentTarget.scrollWidth > event.currentTarget.clientWidth) {
      event.currentTarget.scrollLeft += event.deltaY
    }
  }

  return (
    <div className="playground-experience-meta mt-2 flex min-w-0 items-center gap-3 border-t pt-2 text-[10px]" data-testid="product-experience-dependencies" aria-label={`${experience.labelZh} 的基础引用`}>
      <span className="shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>基础引用</span>
      <div
        className="scrollbar-hover flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto overflow-y-hidden py-0.5"
        data-testid="experience-foundation-parts"
        aria-label="使用的基础组件"
        onWheel={handleWheel}
      >
        {experienceFoundationKeys(experience).map((key) => {
          const asset = UI_COMPONENT_REGISTRY[key]
          return (
            <span key={key} className="max-w-[8rem] shrink-0 truncate rounded-full border px-2 py-0.5" title={asset.labelZh} style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {asset.labelZh}
            </span>
          )
        })}
      </div>
      {showSource && <PlaygroundSourcePath sourcePaths={experience.sourcePaths} testId="experience-source" />}
    </div>
  )
}
