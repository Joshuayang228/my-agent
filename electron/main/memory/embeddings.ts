/**
 * Embedding 适配器
 *
 * 复用用户已配置的 OpenAI 兼容 API 来生成文本向量。
 * 支持 OpenAI / DeepSeek / 任何兼容 /v1/embeddings 端点的服务。
 */

import { createLogger } from '../utils/logger'
import type { LLMConfig } from '../../../src/shared/types'

const log = createLogger('Embeddings')

const DEFAULT_MODEL = 'text-embedding-3-small'
const DEFAULT_DIMENSIONS = 1536

let embeddingUnavailable = false

export interface EmbeddingResult {
  vector: number[]
  model: string
  tokenCount: number
}

export async function createEmbedding(
  text: string,
  config: LLMConfig,
  embeddingModel?: string,
): Promise<EmbeddingResult> {
  if (embeddingUnavailable) {
    throw new Error('Embedding API previously unavailable, skipping')
  }
  const model = embeddingModel || DEFAULT_MODEL
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  })

  if (!response.ok) {
    if (response.status === 404) {
      embeddingUnavailable = true
      log.info('Embedding endpoint not available for this provider, vector features disabled')
    }
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
  if (embeddingUnavailable) {
    throw new Error('Embedding API previously unavailable, skipping')
  }
  const model = embeddingModel || DEFAULT_MODEL
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
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
