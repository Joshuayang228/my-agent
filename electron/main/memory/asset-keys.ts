/** 记忆策略生产资产稳定 key。 */
export const MEMORY_STRATEGY_ASSET_KEYS = {
  profileExtraction: 'memory-strategy:profile-extraction',
  semanticDeduplication: 'memory-strategy:semantic-deduplication',
  feedbackBucket: 'memory-strategy:feedback-bucket',
  vectorRecall: 'memory-strategy:vector-recall',
  vectorLifecycle: 'memory-strategy:vector-lifecycle',
  citationCorrection: 'memory-strategy:citation-correction',
} as const
