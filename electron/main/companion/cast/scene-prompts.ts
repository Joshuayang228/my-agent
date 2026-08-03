/**
 * NPC / 卡司多场景 Prompt（M26-G3）
 *
 * 背景：同一人在名册展示、召唤闲聊、帮忙干活时语气与边界不同，不宜只塞一份 summary。
 * 意图：按 scene=display|interact|execute 解析 `roles/{id}/scenes/{scene}.md`；缺省用 Pack 派生。
 * 约束：display 永不含 protected；interact/execute 可进召唤 sessionInfo，仍不改 active / 不 tick。
 */

import { loadRolePack, tryReadRoleText } from '../identity/loader'

export type CastScene = 'display' | 'interact' | 'execute'

export const CAST_SCENES: CastScene[] = ['display', 'interact', 'execute']

const SCENE_TITLE: Record<CastScene, string> = {
  display: '展示',
  interact: '互动',
  execute: '执行',
}

function clip(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/**
 * 无 scenes 文件时的派生底稿（主角/NPC 通用）。
 */
export function defaultCastScenePrompt(
  roleId: string,
  scene: CastScene,
  universeId = 'default',
): string {
  const pack = loadRolePack(roleId, universeId)
  switch (scene) {
    case 'display':
      return clip(`${pack.name}：${pack.description || pack.summary}`, 120)
    case 'interact':
      return clip(
        pack.summary ||
          `${pack.name}正在和用户短聊。保持本人语气，别抢活跃主角的人生戏份，别编造未发生的行程。`,
        280,
      )
    case 'execute':
      return clip(
        `${pack.name}若帮忙查资料或改代码：先确认目标与范围，做事干脆；结果交给自己用角色语气转述。` +
          `不要假装成匿名工具人丢掉人设，也不要把子 Agent 说成另一个朋友。`,
        280,
      )
    default:
      return ''
  }
}

/**
 * 加载场景文案：文件优先，否则 defaultCastScenePrompt。
 */
export function loadCastScenePrompt(
  roleId: string,
  scene: CastScene,
  universeId = 'default',
): string {
  const fromFile = tryReadRoleText(roleId, `scenes/${scene}.md`, universeId)
  if (fromFile && fromFile.trim()) return fromFile.trim()
  return defaultCastScenePrompt(roleId, scene, universeId)
}

/** 展示场景短句（名册 / 卡片；控制长度） */
export function loadCastDisplayLine(
  roleId: string,
  universeId = 'default',
): string {
  return clip(loadCastScenePrompt(roleId, 'display', universeId), 100)
}

/**
 * 召唤子会话注入块（互动 + 执行）。
 * 主角也可有；NPC 无文件时走默认派生。
 */
export function formatSummonSceneBlock(
  roleId: string,
  universeId = 'default',
): string {
  const interact = loadCastScenePrompt(roleId, 'interact', universeId)
  const execute = loadCastScenePrompt(roleId, 'execute', universeId)
  return [
    `【场景·${SCENE_TITLE.interact}】`,
    interact,
    `【场景·${SCENE_TITLE.execute}】`,
    execute,
  ].join('\n')
}

export const __test = {
  SCENE_TITLE,
  clip,
}
