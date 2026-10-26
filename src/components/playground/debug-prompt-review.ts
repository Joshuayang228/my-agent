import type { ModelContextAssetType, PromptBehaviorMetadata } from '../../shared/types'
import { DEBUG_ASSET_FIXTURES, type DebugAssetFixture } from './debug-asset-fixtures'

export const REVIEW_TYPE_LABELS: Record<ModelContextAssetType, string> = {
  prompt: '提示词', 'tool-schema': '工具定义', skill: '技能', 'eval-judge': '模型裁判',
  'eval-case': '验收输入', 'eval-grader': '判定规则', 'companion-manifest': '人物清单',
  'companion-profile': '人物档案', 'companion-world': '默认世界', 'companion-scene': '人物场景',
  'companion-life': '生活资产', 'memory-strategy': '记忆策略', 'permission-policy': '权限策略',
  'sandbox-policy': '沙箱策略', 'provider-capability': '模型能力', 'provider-policy': '模型策略',
  'provider-preset': '连接预设', 'subagent-role': '子任务角色',
}

export interface ReviewAsset extends DebugAssetFixture {
  reviewSection?: 'conversation' | 'identity' | 'growth' | 'world' | 'memory' | 'tools' | 'evaluation' | 'model' | 'platform'
  reviewPriority?: number
  purpose?: string
  body?: string | null
  definitions?: readonly string[]
  slotSources?: Readonly<Record<string, string>>
  slotLabels?: Readonly<Record<string, string>>
  slotExamples?: Readonly<Record<string, string>>
  behavior?: PromptBehaviorMetadata
}

/** 背景：审阅需覆盖没有固定正文的动态定义；意图：仅扩展隔离样张，不导入生产 Prompt；约束：所有 key 和行为内容都是 demo，不能签发模型请求。 */
export const PROMPT_REVIEW_ASSETS: readonly ReviewAsset[] = [
  ...DEBUG_ASSET_FIXTURES.map((asset): ReviewAsset => ({
    ...asset,
    ...(asset.key === 'demo.prompt.main' ? {
      reviewSection: 'conversation', reviewPriority: 0,
      preview: '【隔离模板演示】\n和用户共同整理一份虚构旅行计划。\n表达方式：{{role_voice}}\n已知情境：{{life_context}}\n可用能力：{{tool_environment}}',
      purpose: '组织人物表达、生活情境和工具环境，帮助用户整理旅行计划。',
      definitions: ['demo/compiler.ts#compileTravelPrompt'],
      slotSources: { role_voice: '样张人物表达', life_context: '样张生活切片', tool_environment: '样张工具清单' },
      slotLabels: { role_voice: '人物怎样说话', life_context: '已确认的近期生活信息', tool_environment: '本轮可用的工具能力' },
      slotExamples: { role_voice: '温和、直接，先给简短结论。', life_context: '暂无已确认的近期生活信息。', tool_environment: '仅可读取用户已提供的旅行资料。' },
      behavior: {
        behaviorKey: 'demo.travel', trigger: '用户请求整理旅行计划。',
        characterInputs: ['表达基线'], runtimeInputs: ['用户提供的日期与地点', '工具环境'],
        outputContract: '给出可调整的旅行安排；没有依据的地点保留为待确认。',
        validation: '由样张规则检查日期与地点是否齐全。', fallback: '资料不足时说明缺少什么。',
        sideEffects: ['无；此样张不会发送模型请求或写入会话。'],
      },
    } : asset.key === 'demo.prompt.identity' ? { reviewSection: 'identity', purpose: '保持样张人物的稳定身份与表达边界。' }
      : asset.key === 'demo.prompt.growth' ? { reviewSection: 'growth', purpose: '提供已确认的表达偏好，不改写身份与历史事实。' } : {}),
  })),
  {
    key: 'demo.prompt.runtime', label: '会话情境组装', assetType: 'prompt', group: '平台 / 行为',
    reviewSection: 'platform',
    kind: '模板', roles: [], version: '样张 v1', fingerprint: 'demo:runtime', ownership: '平台',
    source: 'demo/context.ts#buildSessionContextPrompt', definitions: ['demo/context.ts#buildSessionContextPrompt'],
    summary: '没有固定正文的动态组装定义。', purpose: '按本次会话的已知事实生成情境区块。',
    preview: '由组装器生成；目录不保存本次插槽值。', body: null, slots: ['session_facts'], slotSources: { session_facts: '样张会话事实' },
  },
]

const REVIEW_SECTIONS = {
  conversation: { label: '主对话与表达', priority: 10 }, identity: { label: '人物身份', priority: 20 },
  growth: { label: '成长与关系', priority: 30 }, world: { label: '世界与生活', priority: 40 },
  memory: { label: '记忆', priority: 50 }, tools: { label: '工具与技能', priority: 60 },
  evaluation: { label: '验收', priority: 70 }, model: { label: '模型配置', priority: 80 },
  platform: { label: '平台规则与上下文', priority: 100 },
} as const
function reviewSection(asset: ReviewAsset): keyof typeof REVIEW_SECTIONS | undefined {
  if (asset.reviewSection) return asset.reviewSection
  if (asset.roles.length) return ['companion-world', 'companion-scene', 'companion-life'].includes(asset.assetType) ? 'world' : 'identity'
  if (['tool-schema', 'skill', 'subagent-role'].includes(asset.assetType)) return 'tools'
  if (asset.assetType.startsWith('eval-')) return 'evaluation'
  if (asset.assetType.startsWith('provider-')) return 'model'
  if (asset.assetType === 'memory-strategy') return 'memory'
  if (['permission-policy', 'sandbox-policy'].includes(asset.assetType)) return 'platform'
  return undefined
}
export function reviewGroup(asset: ReviewAsset): string {
  const section = reviewSection(asset)
  return section ? REVIEW_SECTIONS[section].label : '其他定义'
}
/** 背景：加载顺序不能代表人物审阅的重要性；意图：按显式用途排序，平台支撑项后置。
 * 约束：仅改变候选目录，不改变生产注册、编译或注入顺序；未知用途不猜成主对话，同级按稳定 key 排序。
 */
export function sortReviewAssets(assets: readonly ReviewAsset[]): ReviewAsset[] {
  const rank = (asset: ReviewAsset) => { const section = reviewSection(asset); return section ? REVIEW_SECTIONS[section].priority : 90 }
  return [...assets].sort((a, b) => rank(a) - rank(b) || (a.reviewPriority ?? 100) - (b.reviewPriority ?? 100) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

export type ReviewScope = 'prompts' | 'other' | 'all'
export function reviewBody(asset: ReviewAsset): string | null {
  return asset.body === null ? null : asset.body ?? asset.preview
}
export function reviewShape(asset: ReviewAsset): string {
  return asset.body === null ? '动态组装' : asset.kind === '模板' ? '模板' : asset.kind === '常量' ? '静态正文' : '结构内容'
}
export function uniqueReviewAssets(assets: readonly ReviewAsset[]): ReviewAsset[] {
  return [...new Map(assets.map(asset => [asset.key, asset])).values()]
}
export function filterReviewAssets(assets: readonly ReviewAsset[], scope: ReviewScope, role: string, shape: string, query: string): ReviewAsset[] {
  const needle = query.trim().toLocaleLowerCase()
  return sortReviewAssets(uniqueReviewAssets(assets)).filter(asset =>
    (scope === 'all' || (scope === 'prompts' ? asset.assetType === 'prompt' : asset.assetType !== 'prompt')) &&
    (role === 'all' || !asset.roles.length || asset.roles.includes(role)) &&
    (shape === 'all' || reviewShape(asset) === shape) &&
    [asset.label, asset.key, asset.group, asset.purpose, asset.source, ...(asset.definitions ?? []),
      reviewBody(asset), ...asset.slots].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle),
  )
}
