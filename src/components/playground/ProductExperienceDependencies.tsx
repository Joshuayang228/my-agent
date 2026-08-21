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
    <section className="mx-auto mb-3 max-w-5xl border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }} data-testid="product-experience-dependencies">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{experience.labelZh}</span>
        <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>{experience.status === 'playground' ? 'Playground' : experience.status}</span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[10px] sm:grid-cols-[72px_1fr] sm:items-start">
        <span style={{ color: 'var(--text-muted)' }}>体验组成</span>
        <div className="flex flex-wrap gap-1" data-testid="experience-parts">
          {experience.experienceParts.map((part) => (
            <span key={part} className="rounded px-1.5 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{part}</span>
          ))}
        </div>
        <span style={{ color: 'var(--text-muted)' }}>基础能力</span>
        <div className="flex flex-wrap gap-1" aria-label="使用的基础组件">
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
    </section>
  )}
