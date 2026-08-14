/**
 * 伙伴与人格生产资产注册表。
 *
 * 背景：Role Pack 的 manifest、profile、默认世界、场景和生活 starter 会影响伙伴行为，
 *       但它们不是同一份 Prompt，不能复制进 Prompt 注册表作为第二事实源。
 * 设计意图：读取真实 companion loader / life starter 工厂，转换成 Debug 统一目录使用的
 *       ModelContextAsset 描述；Prompt 正文仍由现有 Prompt 注册表负责。
 * 关键约束：只读、不访问运行时数据库、不把当前 world state 或用户资产混入静态目录。
 */

import type { ModelContextAsset } from '../../../src/shared/types'
import type { RolePack } from './types'
import { getStarterAssetDefinitions } from './life/assets'
import { CAST_SCENES, loadCastScenePrompt } from './cast/scene-prompts'
import {
  listAvailableRoleIds,
  loadRolePack,
  loadUniverseManifest,
  tryReadRoleText,
} from './identity/loader'
import { modelContextFingerprint } from '../prompts/fingerprint'
import { createLogger } from '../utils/logger'

const DEFAULT_UNIVERSE = 'default'
const log = createLogger('CompanionAssetRegistry')

function jsonContent(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function preview(content: string, max = 420): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact
}

function sourceForRole(roleId: string, fileName: string, universeId = DEFAULT_UNIVERSE): string {
  return `role-pack://${universeId}/roles/${roleId}/${fileName}`
}

/**
 * 将一个真实伙伴来源转换为统一资产描述。
 *
 * 背景：Debug 需要跨 Prompt / JSON / 生活常量使用同一套来源与指纹字段。
 * 设计意图：只转换元数据和正文，不缓存 loader 结果，也不参与生产组装。
 * 关键约束：稳定 key 由各领域 builder 决定；目录项始终只读且缺省为 active。
 */
function makeCompanionAsset(input: {
  key: string
  name: string
  purpose: string
  role: string
  description: string
  source: string
  version: string
  assetType: ModelContextAsset['assetType']
  contentKind: ModelContextAsset['contentKind']
  content: string
  mode?: ModelContextAsset['mode']
  slots?: ModelContextAsset['slots']
  ownership?: ModelContextAsset['ownership']
  derivedFrom?: string
  dependencies?: string[]
}): ModelContextAsset {
  const mode = input.mode ?? 'static'
  return {
    key: input.key,
    id: input.key,
    name: input.name,
    category: 'companion',
    purpose: input.purpose,
    role: input.role,
    desc: input.description,
    source: input.source,
    sourcePath: input.source,
    version: input.version,
    fingerprint: modelContextFingerprint(input.content),
    fingerprintKind: 'content',
    assetType: input.assetType,
    ownership: input.ownership ?? 'role-pack',
    contentKind: input.contentKind,
    mode,
    locale: 'zh-CN',
    locales: { 'zh-CN': { template: input.content } },
    slots: input.slots ?? [],
    status: 'active',
    derivedFrom: input.derivedFrom,
    dependencies: input.dependencies ?? [],
    preview: preview(input.content),
    content: input.content,
    dynamic: mode === 'dynamic',
  }
}

/** Role manifest 是其他伙伴资产的根依赖，版本跟随 universe manifest。 */
function buildManifestAsset(universeId: string, roleId: string, rolePack: RolePack, universeVersion: number): ModelContextAsset {
  const content = jsonContent({
    id: rolePack.id,
    name: rolePack.name,
    description: rolePack.description,
    canBeProtagonist: rolePack.canBeProtagonist,
    asideStyle: rolePack.asideStyle,
  })
  return makeCompanionAsset({
    key: `companion:${universeId}:${roleId}:manifest`,
    name: `伙伴清单 · ${rolePack.name}`,
    purpose: 'Role Pack 的身份入口、展示名称与主角资格',
    role: `role-pack:${roleId}`,
    description: rolePack.description,
    source: sourceForRole(roleId, 'manifest.json', universeId),
    version: `universe-${universeVersion}`,
    assetType: 'companion-manifest',
    contentKind: 'data',
    content,
  })
}

/** 可选结构化资产缺失时不生成占位项，避免把中性默认值伪装成角色事实。 */
function buildOptionalJsonAsset(input: {
  universeId: string
  roleId: string
  rolePack: RolePack
  value: unknown | undefined
  fileName: string
  keySuffix: 'profile' | 'world-default'
  name: string
  purpose: string
  assetType: 'companion-profile' | 'companion-world'
  universeVersion: number
}): ModelContextAsset | null {
  if (!input.value) return null
  const content = jsonContent(input.value)
  const schemaVersion = (input.value as { schemaVersion?: number }).schemaVersion ?? 1
  return makeCompanionAsset({
    key: `companion:${input.universeId}:${input.roleId}:${input.keySuffix}`,
    name: `${input.name} · ${input.rolePack.name}`,
    purpose: input.purpose,
    role: `role-pack:${input.roleId}`,
    description: input.rolePack.description,
    source: sourceForRole(input.roleId, input.fileName, input.universeId),
    version: `schema-${schemaVersion}/universe-${input.universeVersion}`,
    assetType: input.assetType,
    contentKind: 'data',
    content,
    dependencies: [`companion:${input.universeId}:${input.roleId}:manifest`],
  })
}

/** 场景文件优先；缺失时保留派生来源和依赖，方便 Debug 区分真实文件与 fallback。 */
function buildSceneAssets(universeId: string, roleId: string, rolePack: RolePack, universeVersion: number): ModelContextAsset[] {
  return CAST_SCENES.map((scene) => {
    const fileName = `scenes/${scene}.md`
    const fileContent = tryReadRoleText(roleId, fileName, universeId)
    const content = loadCastScenePrompt(roleId, scene, universeId)
    const derived = !fileContent
    return makeCompanionAsset({
      key: `companion:${universeId}:${roleId}:scene:${scene}`,
      name: `伙伴场景 · ${rolePack.name} · ${scene}`,
      purpose: `角色在${scene === 'display' ? '展示' : scene === 'interact' ? '互动' : '执行'}场景下的表达边界`,
      role: `role-pack:${roleId}`,
      description: rolePack.description,
      source: derived ? 'electron/main/companion/cast/scene-prompts.ts#defaultCastScenePrompt' : sourceForRole(roleId, fileName, universeId),
      version: `universe-${universeVersion}`,
      assetType: 'companion-scene',
      contentKind: 'static',
      content,
      mode: derived ? 'dynamic' : 'static',
      derivedFrom: derived ? `companion:${universeId}:${roleId}:manifest` : undefined,
      dependencies: [`companion:${universeId}:${roleId}:manifest`],
      slots: derived ? [{ name: 'rolePackFallback', source: 'companion/cast/scene-prompts', lifecycle: '缺少场景文件时按 Role Pack 派生' }] : [],
    })
  })
}

/** 生活目录只登记生产 starter 定义，不读取已经播种或被用户修改的数据库资产。 */
function buildLifeAssets(universeId: string, roleId: string, rolePack: RolePack): ModelContextAsset[] {
  return getStarterAssetDefinitions(roleId).map((item) => {
    const content = jsonContent({ kind: item.kind, key: item.key, name: item.name, payload: item.payload })
    return makeCompanionAsset({
      key: `companion:${universeId}:${roleId}:life:${item.kind}:${item.key}`,
      name: `生活资产 · ${rolePack.name} · ${item.name}`,
      purpose: item.kind === 'wardrobe' ? '角色衣柜的生产 starter 定义' : '角色书架的生产 starter 定义',
      role: `role-pack:${roleId}`,
      description: rolePack.description,
      source: 'electron/main/companion/life/assets.ts#starter-definitions',
      version: 'starter-v1',
      assetType: 'companion-life',
      contentKind: 'static',
      content,
      ownership: 'builtin',
      dependencies: [`companion:${universeId}:${roleId}:manifest`],
    })
  })
}

/**
 * 聚合当前宇宙的伙伴生产资产。
 *
 * 背景：Debug 需要看到所有可加载角色，而不只是当前活跃主角。
 * 设计意图：清单 / 结构化档案 / 场景 / starter 各自保持单一事实源，再统一转换为只读描述。
 * 关键约束：可选 profile / world 缺失时只不生成该项；不扫描数据库，也不生成运行态快照。
 */
export function getCompanionAssetCatalog(universeId = DEFAULT_UNIVERSE): ModelContextAsset[] {
  const universe = loadUniverseManifest(universeId)
  const assets: ModelContextAsset[] = []
  for (const roleId of listAvailableRoleIds(universeId)) {
    try {
      const rolePack = loadRolePack(roleId, universeId)
      assets.push(buildManifestAsset(universeId, roleId, rolePack, universe.version))
      const profile = rolePack.profile
      const worldDefaults = rolePack.worldDefaults
      const profileAsset = buildOptionalJsonAsset({
        universeId, roleId, rolePack, value: profile, fileName: 'profile.json', keySuffix: 'profile',
        name: '人物档案', purpose: '角色稳定人物事实与表达基线', assetType: 'companion-profile', universeVersion: universe.version,
      })
      if (profileAsset) assets.push(profileAsset)
      const worldAsset = buildOptionalJsonAsset({
        universeId, roleId, rolePack, value: worldDefaults, fileName: 'world.default.json', keySuffix: 'world-default',
        name: '默认世界', purpose: '角色出厂生活世界事实，不覆盖运行态位置与近况', assetType: 'companion-world', universeVersion: universe.version,
      })
      if (worldAsset) assets.push(worldAsset)
      assets.push(...buildSceneAssets(universeId, roleId, rolePack, universe.version))
      assets.push(...buildLifeAssets(universeId, roleId, rolePack))
    } catch (error) {
      log.warn('Failed to register companion assets', {
        universeId,
        roleId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return assets
}

export const __test = {
  jsonContent,
  preview,
  sourceForRole,
}
