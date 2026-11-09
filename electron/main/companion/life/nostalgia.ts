/**
 * 角色高光回忆重温引擎（Nostalgic Reminiscence Engine）
 *
 * 背景：长期记忆库（memories“我们之间”）、深夜心灵感悟与信物羁绊如果不被主动唤起，
 * 就会沉睡在数据库底层，只有用户搜索时才被动调出，缺乏真人朋友“睹物思人/偶然忆及”的温度。
 *
 * 设计意图：
 * 1. 在主会话提示词装配前夕（orchestrator.ts），周期性检索历史深度记忆候选；
 * 2. 候选来源三位一体：长期记忆 feedback、专属信物 keepsakes、深夜反思日记 epiphany；
 * 3. 严格的频次保护（默认 4 小时冷却），避免每次对话都像祥林嫂一样复读过去；
 * 4. 将高光回忆作为生活切片话头注入 Prompt（formatConversationImpulseForPrompt），
 *    引导角色在闲聊开场或合适契机自然带出“对了，想起之前你说的……”或“看到海风就想起那天……”，
 *    展现跨越时间的长久陪伴感。
 */

import { listFeedbackForRole } from '../../storage/memory-store'
import { listKeepsakes } from '../growth/relationship-keepsake'
import { listInnerThoughts } from './inner-thoughts'
import { createLogger } from '../../utils/logger'
import { recordAssetUsage } from '../../utils/asset-usage'
import type { CompanionNostalgiaItem } from '../../../../src/shared/types'

const log = createLogger('NostalgicReminiscence')

export const NOSTALGIA_COOLDOWN_MS = 4 * 3600 * 1000 // 4 小时冷却

// 记录各角色上次触发回忆重温的时间戳
const lastReminiscedByRole = new Map<string, number>()

export function _resetNostalgiaState(): void {
  lastReminiscedByRole.clear()
}

export function getLastReminiscedAt(roleId: string): number | undefined {
  return lastReminiscedByRole.get(roleId)
}

export async function pickNostalgicReminiscence(
  roleId: string,
  now = Date.now(),
  opts?: { force?: boolean; sourceKind?: 'memory_feedback' | 'keepsake' | 'epiphany' },
): Promise<CompanionNostalgiaItem | null> {
  const lastTime = lastReminiscedByRole.get(roleId)
  if (!opts?.force && lastTime && now - lastTime < NOSTALGIA_COOLDOWN_MS) {
    return null
  }

  const candidates: CompanionNostalgiaItem[] = []

  // 1. 记忆中的 feedback（我们之间的默契或深夜感悟）
  try {
    const feedbacks = await listFeedbackForRole(roleId, 8)
    for (const mem of feedbacks) {
      if (mem.content.startsWith('[深夜感悟]')) {
        const quote = mem.content.replace('[深夜感悟]', '').trim()
        candidates.push({
          sourceKind: 'epiphany',
          text: `前几天夜里你在日记写下的心声：“${quote}”`,
          timestamp: mem.createdAt,
        })
      } else if (mem.content.length > 5) {
        candidates.push({
          sourceKind: 'memory_feedback',
          text: `你曾记在心里的两人默契：“${mem.content.slice(0, 80)}”`,
          timestamp: mem.createdAt,
        })
      }
    }
  } catch (err) {
    log.warn('Failed to query feedback memories for nostalgia', { roleId, error: String(err) })
  }

  // 2. 拥有的专属信物
  try {
    const keepsakes = await listKeepsakes(roleId)
    for (const item of keepsakes) {
      candidates.push({
        sourceKind: 'keepsake',
        text: `你赠予对方的珍贵信物【${item.name}】（寄托着“${item.giftReason}”）`,
        timestamp: item.acquiredAt,
      })
    }
  } catch (err) {
    log.warn('Failed to query keepsakes for nostalgia', { roleId, error: String(err) })
  }

  // 3. 收藏的内心独白或带有感悟的随笔
  try {
    const thoughts = await listInnerThoughts(roleId, 6)
    for (const thought of thoughts) {
      if (thought.thoughtType === 'nightly_reflection' && thought.epiphany) {
        candidates.push({
          sourceKind: 'epiphany',
          text: `前几天夜里你在日记写下的心声：“${thought.epiphany}”`,
          timestamp: thought.createdAt,
        })
      }
    }
  } catch (err) {
    log.warn('Failed to query inner thoughts for nostalgia', { roleId, error: String(err) })
  }

  if (candidates.length === 0) {
    return null
  }

  const pool = opts?.sourceKind
    ? candidates.filter((c) => c.sourceKind === opts.sourceKind)
    : candidates

  const selectedPool = pool.length > 0 ? pool : candidates

  // 根据当前时间选定一条候选（保证短期内同一小时内命中一致，跨时间自然轮换）
  const index = Math.floor(now / (3600 * 1000)) % selectedPool.length
  const selected = selectedPool[index]

  lastReminiscedByRole.set(roleId, now)

  void recordAssetUsage({
    assetKey: 'companion:policy:nostalgic-reminiscence',
    relation: 'used',
    usageKind: 'memory-operation',
    status: 'success',
    metadata: { roleId, sourceKind: selected.sourceKind, candidateCount: candidates.length },
  })

  log.info('Picked nostalgic reminiscence item', { roleId, sourceKind: selected.sourceKind, text: selected.text })
  return selected
}
