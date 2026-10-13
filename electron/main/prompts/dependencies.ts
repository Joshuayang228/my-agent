import type { PromptAssetKey } from '../../../src/shared/types'
import { tryReadRoleText } from '../companion/identity/loader'
import type { RolePack } from '../companion/types'
import { PROMPT_KEYS, rolePromptAssetKey, type RolePromptSuffix } from './keys'

/**
 * 背景：目录完整不等于调用证据完整，人物档案和行为增量必须随实际注入被追踪。
 * 设计意图：由实际已加载 Pack 投影依赖，避免扫描全角色目录，把未注入文件误记为已使用。
 * 关键约束：成长覆盖登记用户态来源；可选文件只在实际存在时登记，返回稳定顺序且不携带正文。
 */
export function getCharacterPromptAssetKeys(pack: RolePack, growth = pack.mutableDefault): PromptAssetKey[] {
  const suffixes: RolePromptSuffix[] = ['manifest.json', 'protected.md']
  if (pack.voice?.trim()) suffixes.push('voice.md')
  if (pack.profile) suffixes.push('profile.json')
  if (pack.worldDefaults) suffixes.push('world.default.json')
  const keys = suffixes.map((suffix) => rolePromptAssetKey(pack.id, suffix))
  if (growth?.trim()) keys.push(growth === pack.mutableDefault ? rolePromptAssetKey(pack.id, 'mutable.default.md') : PROMPT_KEYS.companionMutableState)
  return keys
}

/** 背景：场景文件可能缺省；意图：追踪实际读到的文件；约束：派生默认不冒充文件。 */
export function getSummonSceneAssetKeys(pack: RolePack): PromptAssetKey[] {
  const keys: PromptAssetKey[] = []
  for (const suffix of ['scenes/interact.md', 'scenes/execute.md'] as const) {
    if (tryReadRoleText(pack.id, suffix)?.trim()) keys.push(rolePromptAssetKey(pack.id, suffix))
    else if (suffix === 'scenes/interact.md' && pack.summary?.trim()) keys.push(rolePromptAssetKey(pack.id, 'summary.txt'))
  }
  return keys
}
