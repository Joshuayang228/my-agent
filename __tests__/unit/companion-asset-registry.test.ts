import { describe, expect, it, vi } from 'vitest'
import { modelContextFingerprint } from '../../electron/main/prompts/fingerprint'

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
  it('为全部可加载角色生成稳定且唯一的清单、场景和生活资产', () => {
    const assets = getCompanionAssetCatalog()
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
})
