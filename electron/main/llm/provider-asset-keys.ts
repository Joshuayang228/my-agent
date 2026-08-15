/** 模型 Provider 生产资产稳定 key。 */
export const PROVIDER_ASSET_KEYS = {
  openai: 'provider-capability:openai',
  anthropic: 'provider-capability:anthropic',
  gemini: 'provider-capability:gemini',
  autoDetection: 'provider-policy:auto-detection',
  auxThinking: 'provider-policy:aux-thinking',
  contextWindow: 'provider-policy:context-window',
  visionFallback: 'provider-policy:vision-fallback',
  sequentialFailover: 'provider-policy:sequential-failover',
} as const
