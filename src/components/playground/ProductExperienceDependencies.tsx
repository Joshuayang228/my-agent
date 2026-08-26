/**
 * 产品体验基础引用：把当前体验使用的基础资产放进统一页头的轻量元信息行，帮助人工检查两层关系。
 * 依赖正文来自 product-experience-registry，反向关系不在 Renderer 另存一份。
 */

import { PRODUCT_EXPERIENCE_ASSETS, type ProductExperienceTabId } from '../../shared/product-experience-registry'
import { UI_COMPONENT_REGISTRY } from '../../shared/ui-component-registry'

export function ProductExperienceDependencies({ tabId, showSource = false }: { tabId: ProductExperienceTabId; showSource?: boolean }) {
  const experience = PRODUCT_EXPERIENCE_ASSETS.find((asset) => asset.playgroundTabId === tabId)
  if (!experience) return null

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[10px]" data-testid="product-experience-dependencies" aria-label={`${experience.labelZh} 的基础引用`}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>基础引用</span>
        <div className="flex min-w-0 flex-wrap gap-1" data-testid="experience-foundation-parts" aria-label="使用的基础组件">
          {experience.usesFoundation.map((key) => {
            const asset = UI_COMPONENT_REGISTRY[key]
            return (
              <span key={key} className="rounded px-1.5 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {asset.labelZh}
              </span>
            )
          })}
        </div>
      </div>
      {showSource && (
        <code className="ml-auto max-w-full truncate font-mono" data-testid="experience-source" style={{ color: 'var(--text-muted)' }}>
          {experience.sourcePaths.join(' · ')}
        </code>
      )}
    </div>
  )
}
