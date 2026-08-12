/**
 * 关系里程碑（M30-G1）
 *
 * 背景：第一次换角/反思/默契等值得偶尔回调，但做成成就榜会绑架体验。
 * 意图：每角色每种里程碑只记一次；产出短 toast + Prompt 薄提示。
 * 约束：无积分/无进度条；不调 LLM；写入 settings JSON；失败静默。
 */

import { BrowserWindow } from 'electron'
import * as settings from '../../storage/settings-store'

export type MilestoneKind =
  | 'first_role_switch'
  | 'first_reflection'
  | 'first_rapport'

export interface RelationshipMilestone {
  kind: MilestoneKind
  roleId: string
  at: number
}

export interface MilestoneRecordResult {
  recorded: boolean
  milestone?: RelationshipMilestone
  toast?: string
  promptHint?: string
}

const SETTINGS_KEY = 'companionMilestonesByRole' as const

const META: Record<
  MilestoneKind,
  { toast: (name: string) => string; promptHint: string }
> = {
  first_role_switch: {
    toast: (name) => `第一次切到${name}——换视角继续，不是重开人生`,
    promptHint:
      '里程碑·第一次换到此主角：可轻提换视角，勿刷「成就解锁」口吻。',
  },
  first_reflection: {
    toast: (name) => `${name}第一次写入相处默契（反思）——可偶尔回调，勿炫耀等级`,
    promptHint:
      '里程碑·第一次反思写入：默契开始沉淀；回调要有据，勿成就绑架。',
  },
  first_rapport: {
    toast: (name) => `与${name}的相处进入更熟的阶段——自然即可，勿假装老友多年`,
    promptHint:
      '里程碑·首次进入默契密度：可更自然，仍尊重边界与事实。',
  },
}

type Store = Record<string, MilestoneKind[]>

function parseStore(raw: string): Store {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Store = {}
    for (const [roleId, kinds] of Object.entries(parsed as Record<string, unknown>)) {
      if (!roleId || !Array.isArray(kinds)) continue
      out[roleId] = kinds.filter(
        (k): k is MilestoneKind =>
          k === 'first_role_switch' ||
          k === 'first_reflection' ||
          k === 'first_rapport',
      )
    }
    return out
  } catch {
    return {}
  }
}

async function loadStore(): Promise<Store> {
  return parseStore(await settings.getSetting(SETTINGS_KEY))
}

async function saveStore(store: Store): Promise<void> {
  await settings.setSetting(SETTINGS_KEY, JSON.stringify(store))
}

/** 列出某角色已达成的里程碑种类（测试/IPC） */
export async function listMilestoneKinds(roleId: string): Promise<MilestoneKind[]> {
  const id = roleId.trim()
  if (!id) return []
  const store = await loadStore()
  return [...(store[id] || [])]
}

/**
 * 尝试记录里程碑；已存在则 recorded=false。
 * roleDisplayName 仅用于 toast 文案。
 */
export async function tryRecordMilestone(
  roleId: string,
  kind: MilestoneKind,
  opts?: { roleDisplayName?: string; now?: number },
): Promise<MilestoneRecordResult> {
  const id = roleId.trim()
  if (!id) return { recorded: false }

  const store = await loadStore()
  const existing = store[id] || []
  if (existing.includes(kind)) {
    return { recorded: false }
  }

  const at = opts?.now ?? Date.now()
  store[id] = [...existing, kind]
  await saveStore(store)

  const name = (opts?.roleDisplayName || id).trim() || id
  const meta = META[kind]
  const milestone: RelationshipMilestone = { kind, roleId: id, at }
  return {
    recorded: true,
    milestone,
    toast: meta.toast(name),
    promptHint: meta.promptHint,
  }
}

/** 组装进 Prompt 的薄切片（最多 3 条，反成就绑架） */
export function formatMilestonesForPrompt(kinds: MilestoneKind[]): string {
  if (!kinds.length) return ''
  const lines = kinds.slice(0, 3).map((k) => `- ${META[k].promptHint}`)
  return [
    '关系里程碑（只可偶尔回调，绝不能游戏化）：',
    ...lines,
  ].join('\n')
}

export async function getMilestonePromptHint(roleId: string): Promise<string | undefined> {
  const kinds = await listMilestoneKinds(roleId)
  const text = formatMilestonesForPrompt(kinds)
  return text || undefined
}

export function broadcastMilestone(payload: {
  roleId: string
  kind: MilestoneKind
  toast: string
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('companion:milestone', payload)
  }
}

/**
 * 记录并在首次达成时广播 toast。
 * 调用方：换角 / 反思成功 / 首次 rapport。
 */
export async function recordAndBroadcastMilestone(
  roleId: string,
  kind: MilestoneKind,
  opts?: { roleDisplayName?: string },
): Promise<MilestoneRecordResult> {
  const result = await tryRecordMilestone(roleId, kind, opts)
  if (result.recorded && result.toast) {
    broadcastMilestone({
      roleId: roleId.trim(),
      kind,
      toast: result.toast,
    })
  }
  return result
}

export const __test = { SETTINGS_KEY, META, parseStore, formatMilestonesForPrompt }
