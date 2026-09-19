/**
 * Embedding 适配器
 *
 * 复用用户已配置的 OpenAI 兼容 API 来生成文本向量。
 * 仅适用于提供兼容 /embeddings 端点且支持所选嵌入模型的服务。
 */

import { createHash } from 'node:crypto'
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

/**
 * 背景：不同端点 / 模型生成的向量不可直接比较，聊天模型名也不等于嵌入模型名。
 * 意图：从实际请求端点与嵌入模型生成空间指纹，不在索引里保存端点或凭据。
 * 约束：默认模型与请求共用常量；密钥轮换不改变空间，服务暗中换模型仍需独立重建。
 */
export function getEmbeddingSpaceKey(config: LLMConfig, embeddingModel?: string): string {
  return createHash('sha256').update(JSON.stringify([
    config.baseUrl.replace(/\/+$/, ''), embeddingModel || DEFAULT_MODEL,
  ])).digest('hex')
}

/**
 * 背景：同一请求模型别名也可能返回不同模型或维度。
 * 意图：索引写入和查询共用同一身份字段，交给 Vectra 在相似度计算前过滤。
 * 约束：缺少身份的旧索引不得猜测兼容；响应未报告模型时使用实际请求模型。
 */
export function getEmbeddingMetadata(config: LLMConfig, result: EmbeddingResult, embeddingModel?: string) {
  return {
    embeddingSpace: getEmbeddingSpaceKey(config, embeddingModel),
    embeddingModel: result.model || embeddingModel || DEFAULT_MODEL,
    embeddingDimensions: result.vector.length,
  }
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
