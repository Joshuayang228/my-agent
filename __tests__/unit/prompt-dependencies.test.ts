import { describe, expect, it } from 'vitest'
import { listAvailableRoleIds, loadRolePack } from '../../electron/main/companion/identity/loader'
import { getCharacterPromptAssetKeys, getSummonSceneAssetKeys } from '../../electron/main/prompts/dependencies'
import { getPromptAssets, resolvePromptAssetTraces } from '../../electron/main/prompts/registry'
import { PROMPT_KEYS, rolePromptAssetKey } from '../../electron/main/prompts/keys'

describe('实际人物 Prompt 依赖', () => {
  it('全部真实人物与召唤来源都有已注册 key', () => {
    for (const id of listAvailableRoleIds()) {
      const pack = loadRolePack(id)
      expect(resolvePromptAssetTraces([...getCharacterPromptAssetKeys(pack), ...getSummonSceneAssetKeys(pack)]).unknownKeys).toEqual([])
    }
  })

  it('成长覆盖不误报默认文件，缺失可选档案不虚构依赖', () => {
    const pack = loadRolePack('ayu')
    const keys = getCharacterPromptAssetKeys(pack, '本轮已保存的成长状态')
    expect(keys).toContain(PROMPT_KEYS.companionMutableState)
    expect(keys).not.toContain(rolePromptAssetKey(pack.id, 'mutable.default.md'))
    expect(keys).not.toContain(rolePromptAssetKey(pack.id, 'profile.json'))
    expect(keys).not.toContain(rolePromptAssetKey(pack.id, 'world.default.json'))
  })

  it('派生场景不冒充文件，结构化来源保持原有 canonical key', () => {
    const keys = getSummonSceneAssetKeys(loadRolePack('hang'))
    expect(keys).not.toContain(rolePromptAssetKey('hang', 'scenes/interact.md'))
    expect(rolePromptAssetKey('hang', 'profile.json')).toBe('companion:default:hang:profile')
    expect(getPromptAssets().filter(asset => asset.key === 'companion:default:hang:profile')).toHaveLength(1)
  })
})
