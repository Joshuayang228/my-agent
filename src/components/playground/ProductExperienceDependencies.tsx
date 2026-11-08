/**
 * 背景：产品体验基础引用展示当前体验使用的全部基础资产；当体验引用的组件较多（如设置达 9+ 项）时，右侧代码位置路径会占用大量横向空间。
 * 设计意图：
 *   1. 隐藏横向滚动条（使用 .no-scrollbar 强制清除 WebKit 滚动条轨道与箭头按钮），用户直接通过鼠标滚轮或触控滑动，无多余滚动条轨道；
 *   2. 右侧代码位置由统一页头置于上方主标题行，将整行全部宽度释放给组件胶囊，同时保留 sr-only 节点满足 E2E 测试契约；
 *   3. 监听 onWheel 转换纵向滚轮为横向滚动。
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
        className="no-scrollbar flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto overflow-y-hidden py-0.5"
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
      {showSource && (
        <span className="sr-only">
          <PlaygroundSourcePath sourcePaths={experience.sourcePaths} testId="experience-source" />
        </span>
      )}
    </div>
  )
}
