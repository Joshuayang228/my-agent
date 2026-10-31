import { describe, expect, it } from 'vitest'
import { builtinTools } from '../../electron/main/tools/builtins'
import { getCompanionAssetCatalog } from '../../electron/main/companion/asset-registry'
import { getStarterAssetDefinitions } from '../../electron/main/companion/life/assets'
import { loadRelations, loadRolePack, loadUniverseManifest, listAvailableRoleIds } from '../../electron/main/companion/identity/loader'
import { getPromptAssets } from '../../electron/main/prompts/registry'
import { PROMPT_KEYS } from '../../electron/main/prompts/keys'

describe('路飞全旅程生产验收矩阵', () => {
  it('唯一主角、身份、世界和基础行为来自真实 Role Pack', () => {
    const manifest = loadUniverseManifest()
    const pack = loadRolePack('luffy')

    expect(manifest.defaultProtagonistId).toBe('luffy')
    expect(manifest.protagonistIds).toEqual(['luffy'])
    expect(manifest.castIds).toEqual(['zoro', 'nami', 'usopp', 'sanji'])
    expect(listAvailableRoleIds()).toContain('luffy')
    expect(pack.name).toBe('路飞')
    expect(pack.protected).toContain('伙伴')
    expect(Object.keys(pack.behaviorPrompts)).toEqual(expect.arrayContaining(['moment-polish', 'day-script', 'catchup', 'reflection']))
    expect(pack.worldDefaults?.home.shortName).toBe('千里阳光号')
    expect(pack.worldDefaults?.possessions.some(item => item.name === '草帽')).toBe(true)
  })

  it('关系、生活资产、Chat 工具、Prompt 与 Debug 目录共同覆盖人物旅程', () => {
    const relations = loadRelations().edges.filter(edge => edge.from === 'luffy' || edge.to === 'luffy')
    expect(relations.map(edge => edge.from === 'luffy' ? edge.to : edge.from)).toEqual(expect.arrayContaining(['zoro', 'nami', 'usopp', 'sanji']))
    expect(relations.every(edge => edge.arc && edge.arc.bond && edge.arc.friction && edge.arc.repair && edge.arc.growthSignal)).toBe(true)

    const starters = getStarterAssetDefinitions('luffy')
    expect(starters.some(item => item.kind === 'home' && item.name === '千里阳光号')).toBe(true)
    expect(starters.some(item => item.kind === 'wardrobe' && item.name === '轻便红色背心')).toBe(true)
    expect(starters.some(item => item.kind === 'wardrobe' && item.name === '深蓝短裤')).toBe(true)
    expect(starters.some(item => item.kind === 'wardrobe' && item.name === '甲板凉鞋')).toBe(true)

    expect(builtinTools.map(tool => tool.name)).toEqual(expect.arrayContaining([
      'image_generate', 'companion_post_moment', 'companion_comment_moment', 'companion_create_asset', 'companion_character_draft', 'companion_switch_universe',
    ]))
    const prompts = getPromptAssets().map(asset => asset.key)
    expect(prompts).toEqual(expect.arrayContaining([
      PROMPT_KEYS.momentComment, PROMPT_KEYS.momentReply, PROMPT_KEYS.proactiveGreeting,
      PROMPT_KEYS.imageGeneration, PROMPT_KEYS.profileExtraction, PROMPT_KEYS.companionReflection,
    ]))

    const companionAssets = getCompanionAssetCatalog().map(asset => asset.key)
    expect(companionAssets).toEqual(expect.arrayContaining([
      'companion:default:luffy:manifest',
      'companion:default:luffy:profile',
      'companion:default:luffy:world-default',
      'companion:default:luffy:relations',
    ]))
  })
})
