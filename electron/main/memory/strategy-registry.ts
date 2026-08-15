/**
 * 记忆策略生产资产注册表。
 *
 * 背景：Prompt 注册表只能说明“模型看到了什么”，还不能说明记忆为什么提取、去重、召回或淘汰。
 * 设计意图：从记忆生产模块导出既有常量与纯函数事实，生成只读策略资产，不把用户记忆正文带入目录。
 * 关键约束：注册表不是第二套配置；运行逻辑继续读取原模块事实，策略目录只用于来源追踪和 Debug 审阅。
 */

import type { ModelContextAsset } from '../../../src/shared/types'
import { PROFILE_EXTRACTION_CATEGORIES, PROFILE_EXTRACTION_INTERVAL_MS, PROFILE_EXTRACTION_MAX_RECENT_MESSAGES, PROFILE_EXTRACTION_MIN_USER_MESSAGES } from '../agent/profile-extractor'
import { planCitationCorrection } from './citation-correct'
import { FEEDBACK_MEMORY_LIMIT, MEMORY_SEMANTIC_DEDUP_THRESHOLD } from '../storage/memory-store'
import { DEFAULT_VECTOR_RECALL_MIN_SCORE, DEFAULT_VECTOR_RECALL_TOP_K, MAX_CONVERSATION_VECTORS, MEMORY_STALE_THRESHOLD_DAYS } from './vector-store'
import { modelContextFingerprint } from '../prompts/fingerprint'
import { MEMORY_STRATEGY_ASSET_KEYS } from './asset-keys'
export { MEMORY_STRATEGY_ASSET_KEYS } from './asset-keys'

const STRATEGY_VERSION = '1.0.0'


function jsonContent(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function preview(content: string, max = 420): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact
}

function strategyAsset(input: {
  key: string
  name: string
  purpose: string
  role: string
  source: string
  content: string
  dependencies: string[]
}): ModelContextAsset {
  return {
    key: input.key,
    id: input.key,
    name: input.name,
    category: 'memory',
    purpose: input.purpose,
    role: input.role,
    desc: '记忆策略的生产事实与边界；不包含用户记忆正文。',
    source: input.source,
    sourcePath: input.source,
    version: STRATEGY_VERSION,
    fingerprint: modelContextFingerprint(input.content),
    fingerprintKind: 'content',
    assetType: 'memory-strategy',
    ownership: 'builtin',
    contentKind: 'data',
    mode: 'static',
    locale: 'zh-CN',
    locales: { 'zh-CN': { template: input.content } },
    slots: [],
    status: 'active',
    dependencies: input.dependencies,
    preview: preview(input.content),
    content: input.content,
    dynamic: false,
  }
}

function correctionPlanSummary() {
  return {
    existingSqliteWithReplacement: planCitationCorrection(true, '替换后的事实'),
    existingVectorOnlyWithReplacement: planCitationCorrection(false, '替换后的事实'),
    existingSqliteWithoutReplacement: planCitationCorrection(true),
    missingWithoutReplacement: planCitationCorrection(false),
  }
}

/**
 * 构建记忆策略目录。
 *
 * 背景：Debug 需要看到记忆行为的门槛与分支，但不能读取用户数据库来生成静态目录。
 * 设计意图：每项资产直接读取 profile / storage / vector / correction 模块的导出事实。
 * 关键约束：返回的新对象只用于展示；修改目录项不会改变记忆运行逻辑。
 */
export function getMemoryStrategyAssetCatalog(): ModelContextAsset[] {
  return [
    strategyAsset({
      key: MEMORY_STRATEGY_ASSET_KEYS.profileExtraction,
      name: '记忆策略 · 用户画像提取',
      purpose: '决定何时从近期对话提取长期用户信息',
      role: 'profile-extractor',
      source: 'electron/main/agent/profile-extractor.ts',
      dependencies: ['profile-extraction'],
      content: jsonContent({
        minUserMessages: PROFILE_EXTRACTION_MIN_USER_MESSAGES,
        maxRecentMessages: PROFILE_EXTRACTION_MAX_RECENT_MESSAGES,
        intervalMs: PROFILE_EXTRACTION_INTERVAL_MS,
        validCategories: [...PROFILE_EXTRACTION_CATEGORIES],
        duplicateCheck: '写入前按同类记忆进行文本相似度去重',
      }),
    }),
    strategyAsset({
      key: MEMORY_STRATEGY_ASSET_KEYS.semanticDeduplication,
      name: '记忆策略 · 语义去重',
      purpose: '避免相同或近似事实重复写入记忆库',
      role: 'memory-store',
      source: 'electron/main/storage/memory-store.ts',
      dependencies: [],
      content: jsonContent({
        similarityThreshold: MEMORY_SEMANTIC_DEDUP_THRESHOLD,
        defaultScope: '同一 category 全局去重',
        feedbackScope: 'feedback 按 roleId 分桶；旧的无 roleId 反馈不注入角色反思',
        comparison: '二元组 Jaccard 字符相似度',
      }),
    }),
    strategyAsset({
      key: MEMORY_STRATEGY_ASSET_KEYS.feedbackBucket,
      name: '记忆策略 · 伙伴反馈分桶',
      purpose: '避免对某个伙伴的反馈串入其他伙伴',
      role: 'memory-store',
      source: 'electron/main/storage/memory-store.ts',
      dependencies: ['companion-context'],
      content: jsonContent({
        category: 'feedback',
        roleIdRequiredOnWrite: true,
        defaultReadLimit: FEEDBACK_MEMORY_LIMIT,
        legacyUnscopedFeedback: '不注入任何角色反思',
      }),
    }),
    strategyAsset({
      key: MEMORY_STRATEGY_ASSET_KEYS.vectorRecall,
      name: '记忆策略 · 向量召回',
      purpose: '决定语义检索命中哪些记忆并如何进入主 Prompt',
      role: 'vector-store',
      source: 'electron/main/memory/vector-store.ts',
      dependencies: ['memory-recall-context', 'embedding-input'],
      content: jsonContent({
        topK: DEFAULT_VECTOR_RECALL_TOP_K,
        minScore: DEFAULT_VECTOR_RECALL_MIN_SCORE,
        excludeSqliteMirrorIds: 'mem-*',
        staleThresholdDays: MEMORY_STALE_THRESHOLD_DAYS,
        filePathMemory: '使用前必须通过 file_read 或 code_search 验证路径仍存在',
      }),
    }),
    strategyAsset({
      key: MEMORY_STRATEGY_ASSET_KEYS.vectorLifecycle,
      name: '记忆策略 · 向量生命周期',
      purpose: '控制对话向量的容量与淘汰边界',
      role: 'vector-store',
      source: 'electron/main/memory/vector-store.ts',
      dependencies: ['embedding-input'],
      content: jsonContent({
        conversationVectorLimit: MAX_CONVERSATION_VECTORS,
        eviction: '只淘汰 conversation 类，按 timestamp 从旧到新淘汰',
        structuredMemoryEviction: 'identity / preference / fact / workflow / voice 不自动淘汰',
      }),
    }),
    strategyAsset({
      key: MEMORY_STRATEGY_ASSET_KEYS.citationCorrection,
      name: '记忆策略 · 引用纠错与删除',
      purpose: '决定用户说“记错了”时更新、替换还是删除',
      role: 'citation-correct',
      source: 'electron/main/memory/citation-correct.ts',
      dependencies: ['memory-recall-context'],
      content: jsonContent({
        branches: correctionPlanSummary(),
        replacement: '有替换文本时优先保留可追踪的更新 / 替换结果',
        emptyReplacement: '没有替换文本时删除 SQLite 与向量副本',
      }),
    }),
  ]
}

export const __test = { jsonContent, preview, correctionPlanSummary }
