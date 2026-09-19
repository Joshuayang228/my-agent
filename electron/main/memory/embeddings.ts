/**
 * Embedding 适配器
 *
 * 复用用户已配置的 OpenAI 兼容 API 来生成文本向量。
 * 仅适用于提供兼容 /embeddings 端点且支持所选嵌入模型的服务。
 */

import type { LLMConfig } from '../../../src/shared/types'

const DEFAULT_MODEL = 'text-embedding-3-small'
const DEFAULT_DIMENSIONS = 1536

// 端点失败可能临时发生，也不能封禁其他连接；每次调用独立请求，
// 重试节奏由索引 worker 等调用方控制，适配器不缓存永久不可用状态。

export interface EmbeddingResult {
  vector: number[]
  model: string
  tokenCount: number
}

export async function createEmbedding(
  text: string,
  config: LLMConfig,
  embeddingModel?: string,
  signal?: AbortSignal,
): Promise<EmbeddingResult> {
  const model = embeddingModel || DEFAULT_MODEL
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  const response = await fetch(`${baseUrl}/embeddings`, {
    signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding API error (${response.status}): ${error}`)
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>
    model: string
    usage: { prompt_tokens: number; total_tokens: number }
  }

  if (!data.data?.[0]?.embedding) {
    throw new Error('Invalid embedding response: no embedding data')
  }

  return {
    vector: data.data[0].embedding,
    model: data.model,
    tokenCount: data.usage?.total_tokens ?? 0,
  }
}

export async function createEmbeddings(
  texts: string[],
  config: LLMConfig,
  embeddingModel?: string,
): Promise<EmbeddingResult[]> {
  const model = embeddingModel || DEFAULT_MODEL
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      input: texts,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding API error (${response.status}): ${error}`)
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>
    model: string
    usage: { prompt_tokens: number; total_tokens: number }
  }

  return data.data
    .sort((a, b) => a.index - b.index)
    .map(d => ({
      vector: d.embedding,
      model: data.model,
      tokenCount: Math.ceil((data.usage?.total_tokens ?? 0) / texts.length),
    }))
}

export function getDimensions(model?: string): number {
  if (!model || model.includes('text-embedding-3-small')) return DEFAULT_DIMENSIONS
  if (model.includes('text-embedding-3-large')) return 3072
  if (model.includes('text-embedding-ada')) return 1536
  return DEFAULT_DIMENSIONS
}
