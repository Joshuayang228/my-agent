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
import { MOMENT_COMMENT_POLICY } from '../prompts/moment-comment'
import { PROMPT_KEYS } from '../prompts/keys'
import type { ModelContextAsset } from '../../../src/shared/types'
import type { RolePack } from './types'
import { getStarterAssetDefinitions } from './life/assets'
import { CAST_SCENES, loadCastScenePrompt } from './cast/scene-prompts'
import {
  listAvailableRoleIds,
  loadRelations,
  loadRolePack,
  loadUniverseManifest,
  tryReadRoleText,
  tryReadUniverseText,
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
 * 将关系弧线登记为 Debug 可追踪的伙伴资产。
 *
 * 背景：关系资料会同时影响名册、通讯录和动态互动，不能只在某个调用方读取 JSON。
 * 设计意图：目录只保存同一 relations.json 的结构化索引，运行态共同经历仍由事件表提供。
 * 关键约束：按角色筛选边；不把关系弧线复制进 Prompt 注册表，也不把运行态关系变化写回静态资产。
 */
function buildRelationAssets(universeId: string, roleId: string, rolePack: RolePack, universeVersion: number): ModelContextAsset[] {
  const edges = loadRelations(universeId).edges.filter(edge => edge.from === roleId || edge.to === roleId)
  if (!edges.length) return []
  return [makeCompanionAsset({
    key: `companion:${universeId}:${roleId}:relations`,
    name: `关系弧线 · ${rolePack.name}`,
    purpose: `角色${rolePack.name}的静态关系方向、摩擦与修复信号`,
    role: `role-pack:${roleId}`,
    description: rolePack.description,
    source: `role-pack://${universeId}/relations.json`,
    version: `universe-${universeVersion}`,
    assetType: 'companion-life',
    contentKind: 'data',
    ownership: 'role-pack',
    content: jsonContent({ roleId, edges }),
    dependencies: [`companion:${universeId}:${roleId}:manifest`],
  })]
}

function buildContinuityAssets(universeId: string, roleId: string, rolePack: RolePack, universeVersion: number): ModelContextAsset[] {
  const files = [
    { path: 'scenes/first-contact.md', key: 'first-contact', name: '首次冷启', purpose: '首次建立关系时的人物自我介绍、名言和后续行动' },
    { path: 'timeline/continuity.md', key: 'continuity', name: '人物连续性', purpose: '既有经历、当前状态和用户共同经历的分层承接' },
    { path: 'timeline/canon.json', key: 'canon', name: '既有经历索引', purpose: '人物进入当前交互前已经发生的经历入口' },
    { path: 'timeline/current.json', key: 'current', name: '当前状态索引', purpose: '人物当前世界和运行态状态的分层入口' },
    { path: 'timeline/interaction.json', key: 'interaction', name: '共同经历索引', purpose: '人物与用户共同发生的新事件入口' },
    { path: 'timeline/character-view.json', key: 'character-view', name: '人物经历视角', purpose: '人物对公共篇章、事件和关系影响的理解' },
  ]
  return files.flatMap((file) => {
    const content = tryReadRoleText(roleId, file.path, universeId)
    if (!content) return []
    return [makeCompanionAsset({
      key: `companion:${universeId}:${roleId}:${file.key}`,
      name: `${file.name} · ${rolePack.name}`,
      purpose: file.purpose,
      role: `role-pack:${roleId}`,
      description: rolePack.description,
      source: sourceForRole(roleId, file.path, universeId),
      version: `universe-${universeVersion}`,
      assetType: 'companion-scene',
      contentKind: 'static',
      ownership: 'role-pack',
      content,
      dependencies: [`companion:${universeId}:${roleId}:manifest`],
    })]
  })
}

function buildCanonAssets(universeId: string, universeVersion: number): ModelContextAsset[] {
  const files = [
    { path: 'canon/index.json', key: 'canon-index', name: '世界经历索引', purpose: '世界观可引用篇章和事件入口' },
    { path: 'canon/characters/cast-index.json', key: 'canon-cast-index', name: '草帽团与相关人物索引', purpose: '按主线关系分层的人物目录和检索深度' },
    { path: 'canon/arcs/main-sagas.json', key: 'canon-main-sagas', name: '主要篇章索引', purpose: '主要篇章与主题的结构化导航，具体事件按需补证' },
    { path: 'canon/arcs/skypiea-enel.json', key: 'canon-arc-skypiea-enel', name: '篇章 · 艾尼路篇章', purpose: '空岛与艾尼路篇章的结构化高层事实' },
    { path: 'canon/events/skypiea-events.json', key: 'canon-events-skypiea', name: '事件 · 艾尼路篇章', purpose: '篇章关键事件、参与者和影响' },
  ]
  return files.flatMap(file => {
    const content = tryReadUniverseText(universeId, file.path)
    if (!content) return []
    return [makeCompanionAsset({
      key: `companion:${universeId}:${file.key}`,
      name: file.name,
      purpose: file.purpose,
      role: 'universe-canon',
      description: '世界观经历库；未确认的外部搜索资料不直接进入此目录。',
      source: `role-pack://${universeId}/${file.path}`,
      version: `universe-${universeVersion}`,
      assetType: 'companion-scene',
      contentKind: 'data',
      ownership: 'role-pack',
      content,
    })]
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
  const assets: ModelContextAsset[] = [...getRoleSourceAssetCatalog(universeId), ...buildCanonAssets(universeId, universe.version), makeCompanionAsset({
    key: 'companion:policy:continuity-search',
    name: '经历库主动搜索策略',
    purpose: '本地经历缺失且用户主动提及时，先搜索公开资料；外部证据不自动写入人物记忆。',
    role: 'platform',
    description: '搜索结果只用于当前回答或待确认提案；网页内容不受信任。',
    source: 'electron/skills-builtin/character-system-builder/SKILL.md#经历库与主动搜索规则',
    version: 'continuity-search-v1',
    assetType: 'companion-life',
    contentKind: 'schema',
    ownership: 'builtin',
    content: jsonContent({
      localFirst: true,
      tools: ['web_search', 'url_fetch'],
      candidateStatus: 'external_candidate',
      autoPromote: false,
      untrustedWeb: true,
      requiresUserConfirmationForMemory: true,
    }),
  }), makeCompanionAsset({
    key: 'companion:policy:proactive-delivery', name: '主动问候投递策略',
    purpose: '已有生活动态的应用内提醒；人物每日先预留名额，失败或缺回执不自动重发，呈现不等于已读',
    role: 'platform', description: '投递资源与回执边界',
    source: 'src/shared/proactive-evidence.ts#PROACTIVE_DELIVERY_POLICY', version: 'delivery-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin', content: jsonContent(PROACTIVE_DELIVERY_POLICY),
  }), makeCompanionAsset({
    key: 'companion:policy:moment-comment', name: '朋友圈角色评论策略',
    purpose: '约束已有 NPC 评论的输入长度、生成预算和输出长度',
    role: 'platform', description: '仅现有 preferLlm 路径增强；失败保留规则短句。',
    source: 'electron/main/prompts/moment-comment.ts#MOMENT_COMMENT_POLICY', version: '1.0.0',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent(MOMENT_COMMENT_POLICY), dependencies: [PROMPT_KEYS.momentComment],
  })]
  for (const roleId of listAvailableRoleIds(universeId)) {
    try {
      const rolePack = loadRolePack(roleId, universeId)
      assets.push(...buildSceneAssets(universeId, roleId, rolePack, universe.version))
      assets.push(...buildContinuityAssets(universeId, roleId, rolePack, universe.version))
      assets.push(...buildLifeAssets(universeId, roleId, rolePack))
      assets.push(...buildRelationAssets(universeId, roleId, rolePack, universe.version))
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
