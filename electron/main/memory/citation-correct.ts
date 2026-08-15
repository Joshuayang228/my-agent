/**
 * 本轮引用记忆一键纠错（M29-G2）
 *
 * 背景：芯片能指认还不够——用户说「记错了」必须真删库，口头道歉不够。
 * 意图：按 id 双写清理（SQLite 有则删/改；向量始终清）；改正时可写入新 fact。
 * 约束：不调 LLM；companion/agent 不互相 import；纯 plan 函数可单测。
 */

import { addMemory, deleteMemory, getMemory, updateMemory } from '../storage/memory-store'
import { removeFromVectorStore } from './vector-store'
import { recordAssetUsage } from '../utils/asset-usage'
import { MEMORY_STRATEGY_ASSET_KEYS } from './asset-keys'

export type CitationCorrectPlan =
  | { action: 'delete'; sqlite: boolean; vector: boolean }
  | { action: 'update-sqlite' }
  | { action: 'replace-as-fact' }

/**
 * 决定纠错动作（纯函数）。
 * replacement 有值 → 有 SQLite 则 update，否则删向量并记一条 fact；
 * 无 replacement → 有 SQLite 则 deleteMemory（含向量），否则只删向量。
 */
export function planCitationCorrection(
  hasSqlite: boolean,
  replacement?: string,
): CitationCorrectPlan {
  const text = replacement?.trim()
  if (text) {
    return hasSqlite ? { action: 'update-sqlite' } : { action: 'replace-as-fact' }
  }
  return { action: 'delete', sqlite: hasSqlite, vector: true }
}

export interface CorrectCitationResult {
  ok: true
  action: 'deleted' | 'updated' | 'replaced'
  id: string
  /** 改正写入时新 fact 的 id */
  newId?: string
}

/**
 * 执行本轮引用纠错。
 * 调用方：IPC memory:correct-citation；UI 芯片「记错了 / 改正」。
 */
function recordCorrection(action: string): void {
  void recordAssetUsage({
    assetKey: MEMORY_STRATEGY_ASSET_KEYS.citationCorrection,
    relation: 'used', usageKind: 'memory-operation', status: 'success',
    metadata: { operation: action, checkedCount: 1, correctedCount: 1 },
  })
}

export async function correctCitedMemory(
  id: string,
  opts?: { replacement?: string },
): Promise<CorrectCitationResult | { ok: false; error: string }> {
  const memId = (id || '').trim()
  if (!memId) return { ok: false, error: 'memory id is required' }

  const existing = await getMemory(memId)
  const plan = planCitationCorrection(Boolean(existing), opts?.replacement)

  if (plan.action === 'update-sqlite') {
    await updateMemory(memId, opts!.replacement!.trim())
    recordCorrection('update')
    return { ok: true, action: 'updated', id: memId }
  }

  if (plan.action === 'replace-as-fact') {
    await removeFromVectorStore(memId)
    const entry = await addMemory('fact', opts!.replacement!.trim())
    recordCorrection('replace')
    return { ok: true, action: 'replaced', id: memId, newId: entry.id }
  }

  // delete
  if (plan.sqlite) {
    await deleteMemory(memId)
  } else {
    await removeFromVectorStore(memId)
  }
  recordCorrection('delete')
  return { ok: true, action: 'deleted', id: memId }
}

export const __test = { planCitationCorrection }
