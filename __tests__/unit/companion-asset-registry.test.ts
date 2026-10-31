import { describe, expect, it, vi } from 'vitest'
import { modelContextFingerprint } from '../../electron/main/prompts/fingerprint'
import { MOMENT_COMMENT_POLICY } from '../../electron/main/prompts/moment-comment'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/my-agent-test' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const { getCompanionAssetCatalog } = await import('../../electron/main/companion/asset-registry')
const { getStarterAssetDefinitions } = await import('../../electron/main/companion/life/assets')
const { loadRoleProfile } = await import('../../electron/main/companion/identity/loader')

describe('伙伴生产资产目录', () => {
  it('评论策略读取真实生成与解析共用边界，不复制另一份参数', () => {
    const asset = getCompanionAssetCatalog().find(asset => asset.key === 'companion:policy:moment-comment')
    expect(JSON.parse(asset!.content!)).toEqual(MOMENT_COMMENT_POLICY)
    expect(asset?.dependencies).toEqual(['companion-moment-comment'])
  })
  it('经历库搜索策略明确本地优先且不自动晋升记忆', () => {
    const asset = getCompanionAssetCatalog().find(item => item.key === 'companion:policy:continuity-search')
    expect(JSON.parse(asset!.content!)).toMatchObject({ localFirst: true, autoPromote: false, candidateStatus: 'external_candidate' })
  })
  it('为全部可加载角色生成稳定且唯一的清单、场景和生活资产', () => {
    const assets = getCompanionAssetCatalog()
    expect(assets.find(asset => asset.key === 'companion:default:canon-main-sagas')?.content).toContain('阿拉巴斯坦篇')
    expect(assets.find(asset => asset.key === 'companion:default:canon-cast-index')?.content).toContain('托尼托尼·乔巴')
    const keys = assets.map((asset) => asset.key)

    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('companion:default:hang:manifest')
    expect(keys).toContain('companion:default:hang:profile')
    expect(keys).toContain('companion:default:hang:world-default')
    expect(keys).toContain('companion:default:ayu:scene:display')
    expect(keys.some((key) => key.startsWith('companion:default:lin:life:wardrobe:'))).toBe(false)

    for (const asset of assets) {
      expect(asset.category).toBe('companion')
      expect(asset.status).toBe('active')
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
      expect(asset.content).toBeTruthy()
      expect(asset.source).toBe(asset.sourcePath)
    }
  })

  it('人物档案指纹来自真实 profile，缺失可选文件时不虚构资产', () => {
    const assets = getCompanionAssetCatalog()
    const profile = loadRoleProfile('hang')
    const profileAsset = assets.find((asset) => asset.key === 'companion:default:hang:profile')

    expect(profile).toBeDefined()
    expect(profileAsset?.content).toBe(JSON.stringify(profile, null, 2))
    expect(profileAsset?.fingerprint).toBe(modelContextFingerprint(JSON.stringify(profile, null, 2)))
    expect(assets.some((asset) => asset.key === 'companion:default:ayu:profile')).toBe(false)
    expect(assets.some((asset) => asset.key === 'companion:default:ayu:world-default')).toBe(false)
  })

  it('区分文件场景和 Role Pack 派生场景，并保留依赖关系', () => {
    const assets = getCompanionAssetCatalog()
    const fileScene = assets.find((asset) => asset.key === 'companion:default:ayu:scene:display')
    const derivedScene = assets.find((asset) => asset.key === 'companion:default:hang:scene:display')

    expect(fileScene).toMatchObject({
      mode: 'static',
      source: 'role-pack://default/roles/ayu/scenes/display.md',
    })
    expect(derivedScene).toMatchObject({
      mode: 'dynamic',
      source: 'electron/main/companion/cast/scene-prompts.ts#defaultCastScenePrompt',
      derivedFrom: 'companion:default:hang:manifest',
    })
    expect(derivedScene?.dependencies).toContain('companion:default:hang:manifest')
  })

  it('未确认生活设定不生成生产资产，目录与初始化定义一致', () => {
    for (const role of ['lin', 'zhou', 'xia', 'hang', 'ayu']) {
      expect(getStarterAssetDefinitions(role)).toEqual([])
      expect(getCompanionAssetCatalog().some(asset => asset.key.startsWith('companion:default:' + role + ':life:'))).toBe(false)
    }
  })

  it('路飞衣柜由首个 Role Pack 的 starter 定义提供基础衣物', () => {
    const starters = getStarterAssetDefinitions('luffy').filter(item => item.kind === 'wardrobe')
    expect(starters.map(item => item.key)).toEqual(['red-vest', 'blue-shorts', 'deck-sandals'])
    expect(starters.every(item => item.payload.seededFrom === 'role-pack:luffy')).toBe(true)
    expect(starters.map(item => item.payload.category)).toEqual(['top', 'bottom', 'shoes'])
  })

  it('路飞关系弧线登记为同源生产资产并保留伙伴依赖', () => {
    const asset = getCompanionAssetCatalog().find(asset => asset.key === 'companion:default:luffy:relations')
    expect(asset).toMatchObject({
      source: 'role-pack://default/relations.json',
      assetType: 'companion-life',
      contentKind: 'data',
      dependencies: ['companion:default:luffy:manifest'],
    })
    expect(asset?.content).toContain('先听完提醒')
  })

  it('经历库登记篇章、事件和人物视角，外部搜索不混入本地 canon', () => {
    const assets = getCompanionAssetCatalog()
    expect(assets.find(asset => asset.key === 'companion:default:canon-arc-skypiea-enel')?.content).toContain('艾尼路篇章')
    expect(assets.find(asset => asset.key === 'companion:default:canon-events-skypiea')?.content).toContain('黄金钟')
    expect(assets.find(asset => asset.key === 'companion:default:luffy:continuity')?.content).toContain('canon')
    expect(assets.find(asset => asset.key === 'companion:default:luffy:character-view')?.content).toContain('enel-conflict')
    expect(assets.find(asset => asset.key === 'companion:default:zoro:character-view')?.content).toContain('skypiea-enel')
  })
})
