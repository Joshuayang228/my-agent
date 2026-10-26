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
  purpose?: string
  body?: string | null
  definitions?: readonly string[]
  slotSources?: Readonly<Record<string, string>>
  behavior?: PromptBehaviorMetadata
}

/** 背景：审阅需覆盖没有固定正文的动态定义；意图：仅扩展隔离样张，不导入生产 Prompt；约束：所有 key 和行为内容都是 demo，不能签发模型请求。 */
export const PROMPT_REVIEW_ASSETS: readonly ReviewAsset[] = [
  ...DEBUG_ASSET_FIXTURES.map((asset): ReviewAsset => ({
    ...asset,
    ...(asset.key === 'demo.prompt.main' ? {
      purpose: '组织人物表达、生活情境和工具环境，帮助用户整理旅行计划。',
      definitions: ['demo/compiler.ts#compileTravelPrompt'],
      slotSources: { role_voice: '样张人物表达', life_context: '样张生活切片', tool_environment: '样张工具清单' },
      behavior: {
        behaviorKey: 'demo.travel', trigger: '用户请求整理旅行计划。',
        characterInputs: ['表达基线'], runtimeInputs: ['用户提供的日期与地点', '工具环境'],
        outputContract: '给出可调整的旅行安排；没有依据的地点保留为待确认。',
        validation: '由样张规则检查日期与地点是否齐全。', fallback: '资料不足时说明缺少什么。',
        sideEffects: ['无；此样张不会发送模型请求或写入会话。'],
      },
    } : asset.key === 'demo.prompt.identity' ? { purpose: '保持样张人物的稳定身份与表达边界。' }
      : asset.key === 'demo.prompt.growth' ? { purpose: '提供已确认的表达偏好，不改写身份与历史事实。' } : {}),
  })),
  {
    key: 'demo.prompt.runtime', label: '会话情境组装', assetType: 'prompt', group: '平台 / 行为',
    kind: '模板', roles: [], version: '样张 v1', fingerprint: 'demo:runtime', ownership: '平台',
    source: 'demo/context.ts#buildSessionContextPrompt', definitions: ['demo/context.ts#buildSessionContextPrompt'],
    summary: '没有固定正文的动态组装定义。', purpose: '按本次会话的已知事实生成情境区块。',
    preview: '由组装器生成；目录不保存本次插槽值。', body: null, slots: ['session_facts'], slotSources: { session_facts: '样张会话事实' },
  },
]

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
  return uniqueReviewAssets(assets).filter(asset =>
    (scope === 'all' || (scope === 'prompts' ? asset.assetType === 'prompt' : asset.assetType !== 'prompt')) &&
    (role === 'all' || !asset.roles.length || asset.roles.includes(role)) &&
    (shape === 'all' || reviewShape(asset) === shape) &&
    [asset.label, asset.key, asset.group, asset.purpose, asset.source, ...(asset.definitions ?? []),
      reviewBody(asset), ...asset.slots].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle),
  )
}
