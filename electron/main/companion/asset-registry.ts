/**
 * 伙伴与人格生产资产注册表。
 *
 * 背景：Role Pack 的 manifest、profile、默认世界、场景和生活 starter 会影响伙伴行为，
 *       但它们不是同一份 Prompt，不能复制进 Prompt 注册表作为第二事实源。
 * 设计意图：读取真实 companion loader / life starter 工厂，转换成 Debug 统一目录使用的
 *       ModelContextAsset 描述；Prompt 正文仍由现有 Prompt 注册表负责。
 * 关键约束：只读、不访问运行时数据库、不把当前 world state 或用户资产混入静态目录。
 */

import { PROACTIVE_DELIVERY_POLICY } from '../../../src/shared/proactive-evidence'
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
import { getRoleSourceAssetCatalog, makeCompanionAsset, jsonContent, preview, sourceForRole } from './identity/source-assets'
import { createLogger } from '../utils/logger'

const DEFAULT_UNIVERSE = 'default'
const log = createLogger('CompanionAssetRegistry')

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
    const worldDerived = item.kind === 'home' || item.kind === 'footprint'
    const label = { wardrobe: '衣柜', bookshelf: '书架', culture: '文化角', home: '住所', furniture: '家具', footprint: '常去地点' }[item.kind]
    return makeCompanionAsset({
      key: `companion:${universeId}:${roleId}:life:${item.kind}:${item.key}`,
      name: `生活资产 · ${rolePack.name} · ${item.name}`,
      purpose: `角色${label}的生产 starter 定义`,
      role: `role-pack:${roleId}`,
      description: rolePack.description,
      source: worldDerived ? sourceForRole(roleId, 'world.default.json', universeId) : 'electron/main/companion/life/assets.ts#starter-definitions',
      version: 'starter-v1',
      assetType: 'companion-life',
      contentKind: 'static',
      content,
      ownership: 'builtin',
      dependencies: [`companion:${universeId}:${roleId}:manifest`, ...(worldDerived ? [`companion:${universeId}:${roleId}:world-default`] : [])],
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
  const assets: ModelContextAsset[] = [...getRoleSourceAssetCatalog(universeId), makeCompanionAsset({
    key: 'companion:policy:proactive-delivery', name: '主动问候投递策略',
    purpose: '已有生活动态的应用内提醒；人物每日先预留名额，失败或缺回执不自动重发，呈现不等于已读',
    role: 'platform', description: '投递资源与回执边界',
    source: 'src/shared/proactive-evidence.ts#PROACTIVE_DELIVERY_POLICY', version: 'delivery-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin', content: jsonContent(PROACTIVE_DELIVERY_POLICY),
  })]
  for (const roleId of listAvailableRoleIds(universeId)) {
    try {
      const rolePack = loadRolePack(roleId, universeId)
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
