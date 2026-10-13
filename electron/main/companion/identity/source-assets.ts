/** 人物来源资产的纯注册投影；Prompt 与伙伴目录共用，避免重复身份。 */
import type { ModelContextAsset } from '../../../../src/shared/types'
import type { RolePack } from '../types'
import { listAvailableRoleIds, loadRolePack, loadUniverseManifest } from './loader'
import { modelContextFingerprint } from '../../prompts/fingerprint'
const DEFAULT_UNIVERSE = 'default'

export function jsonContent(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function preview(content: string, max = 420): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact
}

export function sourceForRole(roleId: string, fileName: string, universeId = DEFAULT_UNIVERSE): string {
  return `role-pack://${universeId}/roles/${roleId}/${fileName}`
}

/**
 * 将一个真实伙伴来源转换为统一资产描述。
 *
 * 背景：Debug 需要跨 Prompt / JSON / 生活常量使用同一套来源与指纹字段。
 * 设计意图：只转换元数据和正文，不缓存 loader 结果，也不参与生产组装。
 * 关键约束：稳定 key 由各领域 builder 决定；目录项始终只读且缺省为 active。
 */
export function makeCompanionAsset(input: {
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


export function getRoleSourceAssetCatalog(universeId = DEFAULT_UNIVERSE): ModelContextAsset[] {
  const universe = loadUniverseManifest(universeId)
  return listAvailableRoleIds(universeId).flatMap(roleId => {
    const rolePack = loadRolePack(roleId, universeId)
    const profile = buildOptionalJsonAsset({
      universeId, roleId, rolePack, value: rolePack.profile, fileName: 'profile.json', keySuffix: 'profile',
      name: '人物档案', purpose: '角色稳定人物事实与表达基线', assetType: 'companion-profile', universeVersion: universe.version,
    })
    const world = buildOptionalJsonAsset({
      universeId, roleId, rolePack, value: rolePack.worldDefaults, fileName: 'world.default.json', keySuffix: 'world-default',
      name: '默认世界', purpose: '角色出厂生活世界事实，不覆盖运行态位置与近况', assetType: 'companion-world', universeVersion: universe.version,
    })
    return [buildManifestAsset(universeId, roleId, rolePack, universe.version), ...profile ? [profile] : [], ...world ? [world] : []]
  })
}
