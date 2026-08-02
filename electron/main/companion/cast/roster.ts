/**
 * Universe Cast — 名册浅注入与召唤摘要（W5）
 *
 * 背景：主对话只许注入「你与 X 的关系」短句 + summary，禁止塞入其他角色全文 protected。
 * 意图：buildRosterLines / loadCastBrief；召唤可取摘要，不启用其 LifeEngine。
 * 约束：不 import agent/；NPC 可不在 protagonistIds。
 */

import { loadRelations, loadRolePack, loadUniverseManifest } from '../identity/loader'
import type { RolePack } from '../types'

const TYPE_LABELS: Record<string, string> = {
  colleague: '同事',
  friend: '朋友',
  family: '家人',
  mentor: '前辈',
  rival: '对手',
  acquaintance: '相识',
}

export interface RosterLine {
  otherId: string
  otherName: string
  relationType: string
  text: string
}

export interface CastBrief {
  id: string
  name: string
  description: string
  summary: string
  canBeProtagonist: boolean
  /** 召唤用：不含 protected 全文 */
  summonHint: string
}

function typeLabel(type: string): string {
  return TYPE_LABELS[type] || type
}

/**
 * 以 activeRoleId 为视角，从 relations 生成名册短句。
 * 只用对方 name + summary + edge.note，绝不拼对方 protected。
 */
export function buildRosterLines(
  activeRoleId: string,
  universeId = 'default',
): RosterLine[] {
  const { edges } = loadRelations(universeId)
  const lines: RosterLine[] = []

  for (const edge of edges) {
    let otherId: string | null = null
    if (edge.from === activeRoleId) otherId = edge.to
    else if (edge.to === activeRoleId) otherId = edge.from
    if (!otherId) continue

    let other: RolePack
    try {
      other = loadRolePack(otherId, universeId)
    } catch {
      continue
    }

    const rel = typeLabel(edge.type)
    const detail = (edge.note || other.summary || other.description).trim()
    const text = `你与${other.name}（${rel}）：${detail}`
    lines.push({
      otherId: other.id,
      otherName: other.name,
      relationType: edge.type,
      text,
    })
  }

  return lines
}

/** 拼成 Prompt 注入块（无边时返回空串） */
export function formatRosterForPrompt(lines: RosterLine[]): string {
  if (!lines.length) return ''
  return [
    '以下是你认识的人（名册摘要，不是他们的完整人设；不要假装成为他们）：',
    ...lines.map((l) => `- ${l.text}`),
  ].join('\n')
}

/**
 * 召唤用摘要：可装载非 active pack 的浅层信息，不含 protected，不启用生活世界。
 */
export function loadCastBrief(roleId: string, universeId = 'default'): CastBrief {
  const pack = loadRolePack(roleId, universeId)
  const manifest = loadUniverseManifest(universeId)
  const isProtagonist = manifest.protagonistIds.includes(roleId)
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    summary: pack.summary,
    canBeProtagonist: pack.canBeProtagonist && isProtagonist,
    summonHint: pack.summary || pack.description,
  }
}

/** 列出与 active 有边的卡司（浅层） */
export function listRelatedCast(
  activeRoleId: string,
  universeId = 'default',
): CastBrief[] {
  const lines = buildRosterLines(activeRoleId, universeId)
  const seen = new Set<string>()
  const out: CastBrief[] = []
  for (const line of lines) {
    if (seen.has(line.otherId)) continue
    seen.add(line.otherId)
    out.push(loadCastBrief(line.otherId, universeId))
  }
  return out
}
