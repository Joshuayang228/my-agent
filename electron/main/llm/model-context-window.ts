/**
 * 模型上下文窗口的保守启发式。
 *
 * 背景：上下文压缩需要一个稳定预算，但 GPT / o 系列、DeepSeek、Qwen 等型号的窗口会随代际变化，
 * 硬编码具体型号容易过时并导致超限；Claude 多代稳定在 200K，Gemini 1.5 起稳定在 1M 级。
 * 设计意图：只登记跨代际较稳定的家族；Gemini 即使部分型号可达 2M 也保守取 1M，其余统一回退
 * 120K。宁可略早压缩，也不冒险误判窗口后收到 413；实际服务端限制仍以 API 反压为准。
 * 关键约束：有效窗口会扣除 8K 输出预留，并设置 16K 下限；这里是本项目压缩策略的代码事实，
 * 不代表厂商实时规格、价格或具体型号能力承诺。
 */

export const DEFAULT_MAX_TOKENS = 120_000
export const OUTPUT_RESERVE_TOKENS = 8_000
export const MIN_EFFECTIVE_CONTEXT_TOKENS = 16_000

export const MODEL_CONTEXT_WINDOWS: ReadonlyArray<{ prefix: string; window: number }> = [
  { prefix: 'claude-', window: 200_000 },
  { prefix: 'gemini-', window: 1_000_000 },
]

/**
 * 推断供压缩阈值使用的有效上下文窗口。
 *
 * 背景：调用方只需要可用输入预算，不应重复处理家族匹配和输出预留。
 * 设计意图：按已知家族匹配后统一扣除预留；未知或空模型名走同一保守回退。
 * 关键约束：返回值是压缩预算而非厂商声明的原始 Context Window。
 */
export function getEffectiveContextWindow(model?: string): number {
  if (!model) return DEFAULT_MAX_TOKENS
  const normalized = model.toLowerCase()
  for (const { prefix, window } of MODEL_CONTEXT_WINDOWS) {
    if (normalized.includes(prefix)) {
      return Math.max(window - OUTPUT_RESERVE_TOKENS, MIN_EFFECTIVE_CONTEXT_TOKENS)
    }
  }
  return DEFAULT_MAX_TOKENS
}
