/**
 * 生产资产运行证据的轻量分发器。
 *
 * 背景：LLM、Tool、Memory 与 Sandbox 需要关联生产资产，但不能反向依赖 Storage / Debug。
 * 设计意图：业务层只上报稳定 key 和 allowlist 元数据；主进程注入解析器与持久化 Sink。
 * 关键约束：未知 key、解析失败或写盘失败只告警，不阻断 Agent 主链路；禁止传入正文对象。
 */

import { randomUUID } from 'node:crypto'
import type {
  AgentAssetUsageEvidence,
  AgentAssetUsageKind,
  AgentAssetUsageMetadataValue,
  AgentAssetUsageRelation,
  AgentAssetUsageStatus,
  ModelContextAsset,
} from '../../../src/shared/types'
import { createLogger } from './logger'
import { getTraceContext } from './trace-context'

const log = createLogger('AssetUsage')
const MAX_METADATA_KEYS = 24
const MAX_STRING_LENGTH = 240
const MAX_ARRAY_LENGTH = 32

export interface AgentAssetUsageInput {
  assetKey: string
  relation: AgentAssetUsageRelation
  usageKind: AgentAssetUsageKind
  spanId?: string
  parentSpanId?: string
  interactionSpanId?: string
  sessionId?: string
  occurredAt?: number
  status: AgentAssetUsageStatus
  metadata?: Record<string, unknown>
}

export interface AssetUsageSink {
  record(evidence: AgentAssetUsageEvidence): void | Promise<void>
  recordMany?(evidence: AgentAssetUsageEvidence[]): void | Promise<void>
}

type AssetResolver = (key: string) => ModelContextAsset | undefined | Promise<ModelContextAsset | undefined>

let sink: AssetUsageSink | null = null
let resolver: AssetResolver | null = null
let fallbackCounter = 0

export function setAssetUsageSink(next?: AssetUsageSink): void {
  sink = next ?? null
}

export function setAssetUsageResolver(next?: AssetResolver): void {
  resolver = next ?? null
}

function normalizeMetadataValue(value: unknown): AgentAssetUsageMetadataValue | undefined {
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH)
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => item.slice(0, MAX_STRING_LENGTH))
  }
  return undefined
}

/** 只保留证据类型允许的扁平 primitive，拒绝 args、正文和任意嵌套对象。 */
export function sanitizeAssetUsageMetadata(input?: Record<string, unknown>): Record<string, AgentAssetUsageMetadataValue> {
  if (!input) return {}
  const output: Record<string, AgentAssetUsageMetadataValue> = {}
  for (const [key, value] of Object.entries(input).slice(0, MAX_METADATA_KEYS)) {
    const normalized = normalizeMetadataValue(value)
    if (normalized !== undefined) output[key.slice(0, 80)] = normalized
  }
  return output
}

async function buildEvidence(input: AgentAssetUsageInput): Promise<AgentAssetUsageEvidence | null> {
  if (!resolver) return null
  const key = input.assetKey.trim()
  if (!key) return null
  let asset: ModelContextAsset | undefined
  try {
    asset = await resolver(key)
  } catch (error) {
    log.warn('Asset usage resolver failed', { key, error: error instanceof Error ? error.message : String(error) })
    return null
  }
  if (!asset) {
    log.warn('Unknown asset usage key', { key, usageKind: input.usageKind })
    return null
  }
  const trace = getTraceContext()
  const occurredAt = input.occurredAt ?? Date.now()
  const spanId = input.spanId?.trim() || trace.interactionSpanId || `asset-runtime-${++fallbackCounter}-${occurredAt.toString(36)}`
  return {
    id: randomUUID(), assetKey: asset.key, assetName: asset.name, assetType: asset.assetType,
    assetVersion: asset.version, assetFingerprint: asset.fingerprint, relation: input.relation,
    usageKind: input.usageKind,
    ...(input.sessionId?.trim() || trace.sessionId ? { sessionId: input.sessionId?.trim() || trace.sessionId } : {}),
    ...(input.interactionSpanId?.trim() || trace.interactionSpanId ? { interactionSpanId: input.interactionSpanId?.trim() || trace.interactionSpanId } : {}),
    spanId,
    ...(input.parentSpanId?.trim() ? { parentSpanId: input.parentSpanId.trim() } : {}),
    occurredAt, status: input.status, metadata: sanitizeAssetUsageMetadata(input.metadata),
  }
}

/** 记录一次真实运行与生产资产的关联；调用方可 await，也可 fire-and-forget。 */
export async function recordAssetUsage(input: AgentAssetUsageInput): Promise<void> {
  if (!sink) return
  const evidence = await buildEvidence(input)
  if (!evidence) return
  try { await sink.record(evidence) } catch (error) {
    log.warn('Asset usage sink failed', { key: input.assetKey, error: error instanceof Error ? error.message : String(error) })
  }
}

/** 批量解析并一次写盘，避免单次 LLM 请求的多个 Tool schema 触发多次数据库 export。 */
export async function recordAssetUsages(inputs: AgentAssetUsageInput[]): Promise<void> {
  if (!sink || inputs.length === 0) return
  const resolved = (await Promise.all(inputs.map(buildEvidence))).filter((item): item is AgentAssetUsageEvidence => Boolean(item))
  if (resolved.length === 0) return
  try {
    if (sink.recordMany) await sink.recordMany(resolved)
    else await Promise.all(resolved.map((item) => sink!.record(item)))
  } catch (error) {
    log.warn('Asset usage batch sink failed', { count: resolved.length, error: error instanceof Error ? error.message : String(error) })
  }
}
