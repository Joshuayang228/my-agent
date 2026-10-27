import type { ModelContextAsset } from '../../shared/types'
import { REVIEW_SECTIONS } from './asset-review-layout'

export type AssetReviewScope = 'prompts' | 'other' | 'all'

export function registeredAssetBody(asset: ModelContextAsset): string | null {
  return asset.content ?? asset.locales[asset.locale]?.template ?? null
}
export function registeredAssetKind(asset: ModelContextAsset): string {
  if (registeredAssetBody(asset) === null) return '动态组装'
  return ['schema', 'data'].includes(asset.contentKind) ? '结构内容' : asset.contentKind === 'template' ? '模板' : '静态正文'
}
/** 背景：注册加载顺序不代表审阅优先级；意图：仅用已登记语义分类，不从显示名或正文猜用途。
 * 约束：未知用途不提升，角色关联不证明实际注入；分类和排序不得写回注册表或改变编译顺序。
 */
function section(asset: ModelContextAsset): keyof typeof REVIEW_SECTIONS | undefined {
  const domainSection: Record<string, keyof typeof REVIEW_SECTIONS> = {
    conversation: 'conversation', character: 'identity', life: 'world', social: 'social', visual: 'visual',
    memory: 'memory', proactive: 'proactive', tools: 'tools', platform: 'platform', evaluation: 'evaluation',
  }
  if (asset.domain && domainSection[asset.domain]) return domainSection[asset.domain]
  const uses = asset.roleUses?.map(use => use.purpose) ?? []
  if (asset.purpose === '主对话语义模块编译' || asset.role === 'companion' || uses.includes('行为')) return 'conversation'
  if (uses.includes('身份') || ['companion-manifest', 'companion-profile'].includes(asset.assetType)) return 'identity'
  if (uses.includes('成长与关系') || asset.role === 'companion-growth') return 'growth'
  if (uses.includes('生活情境') || ['companion-world', 'companion-scene', 'companion-life'].includes(asset.assetType) || ['companion-orchestrator', 'companion-background'].includes(asset.role)) return 'world'
  if (asset.assetType === 'memory-strategy' || ['memory-runtime', 'profile-extractor', 'embedding-runtime'].includes(asset.role) || asset.category === 'memory') return 'memory'
  if (['tool-schema', 'skill', 'subagent-role'].includes(asset.assetType) || ['tool', 'skill', 'subagent', 'external'].includes(asset.category)) return 'tools'
  if (asset.assetType.startsWith('eval-') || asset.category === 'eval' || asset.role === 'eval-judge') return 'evaluation'
  if (asset.assetType.startsWith('provider-') || asset.category === 'provider') return 'model'
  if (['system', 'context', 'ui', 'permission'].includes(asset.category) || ['permission-policy', 'sandbox-policy'].includes(asset.assetType)) return 'platform'
  return undefined
}
export function registeredAssetGroup(asset: ModelContextAsset): string {
  const value = section(asset)
  return value ? REVIEW_SECTIONS[value].label : '其他定义'
}
export function uniqueRegisteredAssets(assets: readonly ModelContextAsset[]): ModelContextAsset[] {
  return [...new Map(assets.map(asset => [asset.key, asset])).values()]
}
export function inReviewScope(asset: ModelContextAsset, scope: AssetReviewScope): boolean {
  return scope === 'all' || (scope === 'prompts' ? asset.assetType === 'prompt' : asset.assetType !== 'prompt')
}
export function filterRegisteredAssets(assets: readonly ModelContextAsset[], scope: AssetReviewScope, roleId: string, query: string): ModelContextAsset[] {
  const rank = (asset: ModelContextAsset) => { const value = section(asset); return value ? REVIEW_SECTIONS[value].priority : 90 }
  const needle = query.trim().toLocaleLowerCase()
  return uniqueRegisteredAssets(assets).filter(asset => inReviewScope(asset, scope) &&
    (!roleId || !asset.roleIds?.length || asset.roleIds.includes(roleId)) &&
    [asset.name, asset.key, asset.purpose, asset.source, ...(asset.definitions ?? []), registeredAssetBody(asset), ...asset.slots.flatMap(slot => [slot.name, slot.source])].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle),
  ).sort((a, b) => rank(a) - rank(b) || (a.purpose === '主对话语义模块编译' ? 0 : 1) - (b.purpose === '主对话语义模块编译' ? 0 : 1) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}
