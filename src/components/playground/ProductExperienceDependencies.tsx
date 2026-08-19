/**
 * 产品体验依赖摘要：展示成品声明使用的基础资产，帮助人工与测试检查两层关系。
 * 依赖正文来自 product-experience-registry，反向关系不在 Renderer 另存一份。
 */

import { PRODUCT_EXPERIENCE_ASSETS, type ProductExperienceTabId } from '../../shared/product-experience-registry'
import { UI_COMPONENT_REGISTRY } from '../../shared/ui-component-registry'

export function ProductExperienceDependencies({ tabId }: { tabId: ProductExperienceTabId }) {
  const experience = PRODUCT_EXPERIENCE_ASSETS.find((asset) => asset.playgroundTabId === tabId)
  if (!experience) return null

  return (
    <section className="mx-auto mb-4 max-w-5xl rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }} data-testid="product-experience-dependencies">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{experience.labelZh}</h2>
        <code className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{experience.key}</code>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--warning)' }}>产品体验 · {experience.status === 'playground' ? 'Playground' : experience.status}</span>
      </div>
      <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>{experience.descriptionZh}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1" aria-label="使用的基础组件">
        <span className="mr-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>使用的基础：</span>
        {experience.usesFoundation.map((key) => {
          const asset = UI_COMPONENT_REGISTRY[key]
          return (
            <span key={key} className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }} title={key}>
              {asset.labelZh}
            </span>
          )
        })}
      </div>
    </section>
  )
}
