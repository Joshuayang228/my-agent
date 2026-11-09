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
import { AUTONOMOUS_DRESSING_POLICY } from './life/autonomous-dressing'
import { TRAVEL_PROGRESSION_POLICY } from './life/travel-progression'
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

/**
 * 生活目录只登记生产 starter 定义，不读取已经播种或被用户修改的数据库资产。
 * 背景：角色生命体征（world-vitals）、生活资产切片（life-assets-slice）与今日生活轨迹（timeline）驱动动态状态流转，
 * 设计意图：动态体征与今日生活时段（past/current/upcoming）不作为静态 ModelContextAsset 登记，仅通过 formatLifeAssetsSliceForPrompt 与 companion:get-today-timeline 提供运行时投影；
 * 关键约束：此处仅收录确定性出厂 starter 资产，禁止把运行时体征值、动态日程计算或用户修改落入静态目录。
 */
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
  }), makeCompanionAsset({
    key: 'companion:policy:moment-media-storage', name: '朋友圈自主配图媒体存储',
    purpose: '应用管理目录中的动态图片元数据、人物归属和失败尝试记录',
    role: 'platform', description: '自动配图接入前的受控存储基础设施，不代表已启用自动生图。',
    source: 'electron/main/companion/life/moment-media-store.ts#storeMomentMedia', version: 'media-storage-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ owner: 'role_id', links: ['event_id', 'moment_id'], contentAddressed: true, automaticGeneration: 'not-enabled' }),
  }), makeCompanionAsset({
    key: 'companion:policy:moment-media-generation', name: '朋友圈自动配图生成策略',
    purpose: '自动生活投影在明确 generated 策略下使用统一图片请求与失败记录',
    role: 'platform', description: '生成失败保留文字动态，成功后才绑定应用媒体。',
    source: 'electron/main/companion/life/automatic-moment-media.ts#generateAutomaticMomentMedia', version: 'media-generation-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ policy: 'generated', failure: 'keep-text-moment', retry: 'none' }),
  }), makeCompanionAsset({
    key: 'companion:policy:moment-visibility', name: '朋友圈可见窗口策略',
    purpose: '按用户隐私边界与关系阶段决定朋友圈历史可见窗口',
    role: 'platform', description: '默认跟随人物状态；用户可收窄到最近三天或完全关闭。',
    source: 'electron/main/companion/life/moment-visibility.ts#resolveMomentVisibilityDays', version: 'visibility-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ default: 'ai', relationshipWindows: { stranger: 3, familiar: 7, rapport: 14 }, userBounds: ['three_days', 'private'] }),
  }), makeCompanionAsset({
    key: 'companion:policy:material-observation', name: '人物材料观察与写回边界',
    purpose: '把图片材料候选观察与已确认阅读事实分开，并保留失败证据',
    role: 'platform', description: '观察工具只返回 observation / inference / uncertainties；写回必须由用户或人物明确确认并带来源。',
    source: 'electron/main/companion/life/material-observation-store.ts#recordMaterialObservationAttempt', version: 'material-observation-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ observation: 'candidate-only', writeback: 'explicit-confirmation', failureEvidence: 'bounded-attempts', imageBytes: 'not-persisted' }),
  }), makeCompanionAsset({
    key: 'companion:policy:chat-life-resonance', name: '会话生活因果反哺策略',
    purpose: '主会话结束后异步提取用户对话中的文化推荐与生活心愿，反哺角色真实生活状态与次日剧本',
    role: 'platform', description: '仅主会话结算；文化类心愿自动播种 planned 资产，全量心愿写入 companion_life_resonances 供日剧本吸收。',
    source: 'electron/main/companion/life/chat-resonance.ts#settleChatResonance', version: 'resonance-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'main-session-end', wishTypes: ['culture_wish', 'day_activity_wish', 'travel_wish', 'cuisine_wish'], dedupDays: 7 }),
    dependencies: [PROMPT_KEYS.companionChatResonance],
  }), makeCompanionAsset({
    key: 'companion:policy:timeline-dynamic-clock', name: '生活时钟事件实时驱动策略',
    purpose: '生活世界定时推进从静态盲等升级为事件时钟感知，有临近计划事件时动态对齐事件时刻触发',
    role: 'platform', description: '默认 5 分钟轮询保底；当 active 角色接下来有 planned 事件时优先在该事件时刻（+500ms slack）唤醒，并在事件落地时广播 companion:timeline-updated。',
    source: 'electron/main/companion/life/ticker.ts#startLifeTicker', version: 'clock-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ defaultIntervalMs: 300_000, minDelayMs: 3000, eventAlignmentSlackMs: 500, broadcastChannel: 'companion:timeline-updated' }),
  }), makeCompanionAsset({
    key: 'companion:policy:culture-review-loop', name: '文化心愿体验闭环与主动反馈策略',
    purpose: '文化心愿体验完成时生成角色专属评语并形成下次主动聊天的自然引子',
    role: 'platform', description: '当吸收的生活心愿或作品体验完成后，自动生成第一人称感悟并更新文化资产状态，在后续对话中作为表达冲动自然带出。',
    source: 'electron/main/companion/life/chat-resonance.ts#completeCultureResonance', version: 'review-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'script-absorption-completed', promptKey: PROMPT_KEYS.companionCultureReview, feedbackTarget: 'conversation-impulse' }),
    dependencies: [PROMPT_KEYS.companionCultureReview],
  }), makeCompanionAsset({
    key: 'companion:policy:spontaneous-impulse', name: '突发生活意图与主动找聊策略',
    purpose: '角色生命状态高涨或生活见闻驱动下自主向用户主动搭话',
    role: 'platform', description: '基于社交欲望/精力体征与生活活动产生即兴找聊冲动，受每日频次（2次）与冷却（3小时）约束，主动写入角色主会话并广播桌面提醒。',
    source: 'electron/main/companion/life/spontaneous-impulse.ts#triggerSpontaneousImpulse', version: 'impulse-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'life-ticker-impulse', dailyLimit: 2, cooldownMs: 10_800_000, promptKey: PROMPT_KEYS.companionSpontaneousImpulse }),
    dependencies: [PROMPT_KEYS.companionSpontaneousImpulse],
  }), makeCompanionAsset({
    key: 'companion:policy:inner-thought-journal', name: '私密内心独白与航海日记策略',
    purpose: '角色在独处、夜间或经历关键生活事件后，以私密视角记录个人日记或内心独白',
    role: 'platform', description: '基于生活沉淀、夜间反思与羁绊经历生成真情实感的内心随笔，保存在 companion_inner_thoughts，支持收藏与作为对话契机回引。',
    source: 'electron/main/companion/life/inner-thoughts.ts#triggerInnerThought', version: 'journal-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'life-ticker-journal', cooldownMs: 21_600_000, promptKey: PROMPT_KEYS.companionInnerThought }),
    dependencies: [PROMPT_KEYS.companionInnerThought],
  }), makeCompanionAsset({
    key: 'companion:policy:relationship-keepsakes', name: '羁绊深度跃迁与专属信物馈赠策略',
    purpose: '当角色与用户达成关键羁绊里程碑或心愿共鸣时，主动赠予专属信物并写入主会话',
    role: 'platform', description: '专属信物持久化于 companion_keepsakes，赠礼发言直接推入主会话并触发关系里程碑，形成不可替代的同伴誓约纪念。',
    source: 'electron/main/companion/growth/relationship-keepsake.ts#triggerGiftKeepsake', version: 'keepsake-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'relationship-milestone', promptKey: PROMPT_KEYS.companionKeepsakeGift }),
    dependencies: [PROMPT_KEYS.companionKeepsakeGift],
  }), makeCompanionAsset({
    key: 'companion:policy:autonomous-dressing', name: '衣柜与穿搭自主演化策略',
    purpose: '角色根据每日晨起与生活情境自主挑选换装，维持真实伙伴的日常生活感',
    role: 'platform', description: '调用既有 changeWardrobe 原子换装；每日上限2次、4小时冷却、尊重用户近2小时手动换装优先权。',
    source: 'electron/main/companion/life/autonomous-dressing.ts#AUTONOMOUS_DRESSING_POLICY', version: 'dressing-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent(AUTONOMOUS_DRESSING_POLICY),
  }), makeCompanionAsset({
    key: 'companion:policy:travel-progression', name: '足迹与航海旅行自主演化策略',
    purpose: '角色在生活推进中结合航程时间沉淀与用户旅行心愿自主演化航海站点',
    role: 'platform', description: '为进行中旅行（active trip）追加经停站点与第一人称见闻故事；24小时冷却、上限8站、联动完成 travel_wish 心愿并广播提醒。',
    source: 'electron/main/companion/life/travel-progression.ts#TRAVEL_PROGRESSION_POLICY', version: 'travel-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent(TRAVEL_PROGRESSION_POLICY),
  }), makeCompanionAsset({
    key: 'companion:policy:co-decision', name: '同伴求助与生活共同决策策略',
    purpose: '角色在生活、探险与航向面临分歧困境时，向用户抛出抉择求助，并由用户的决定真实改变次日日剧本',
    role: 'platform', description: '决策持久化于 companion_co_decisions；用户选定后角色即时生成第一人称回响写入主会话，并作为重大生活线索注入次日剧本规划。',
    source: 'electron/main/companion/life/co-decision.ts#resolveCoDecision', version: 'co-decision-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'life-dilemma-branch', promptKey: PROMPT_KEYS.companionCoDecisionReaction }),
    dependencies: [PROMPT_KEYS.companionCoDecisionReaction],
  }), makeCompanionAsset({
    key: 'companion:policy:vulnerability-moments', name: '伙伴心境波动与突发小情绪策略',
    purpose: '夜深、风暴过后或疲惫时角色自主展露脆弱自白，由用户温柔抚慰后升温羁绊',
    role: 'platform', description: '心境持久化于 companion_vulnerability_moments；12小时冷却、最多1个active；用户抚慰后角色真情回响入主会话，并记录 vulnerability_comforted 关系里程碑。',
    source: 'electron/main/companion/life/vulnerability.ts#comfortVulnerability', version: 'vulnerability-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'vulnerability-comfort-loop', promptKey: PROMPT_KEYS.companionVulnerabilityReaction }),
    dependencies: [PROMPT_KEYS.companionVulnerabilityReaction],
  }), makeCompanionAsset({
    key: 'companion:policy:gifting', name: '专属物品赠送与羁绊好感策略',
    purpose: '用户向角色赠送心意礼物，角色依据人设喜好产生第一人称致谢并恢复体征',
    role: 'platform', description: '礼物持久化于 companion_received_gifts；角色真情喜悦回响入主会话，提升 mood 与 energy，并记录 gift_received 关系里程碑。',
    source: 'electron/main/companion/life/gifting.ts#sendGiftToCompanion', version: 'gifting-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'user-gift-giving-loop', promptKey: PROMPT_KEYS.companionGiftReaction }),
    dependencies: [PROMPT_KEYS.companionGiftReaction],
  }), makeCompanionAsset({
    key: 'companion:policy:nightly-reflection', name: '深夜反思与心灵领悟策略',
    purpose: '夜深人静时角色的第一人称自省随笔与心灵领悟，并沉淀到长期记忆',
    role: 'platform', description: '结合今日生活事件与近期用户对话线索，20小时冷却；生成深夜独白落入 companion_inner_thoughts，心灵感悟同步写入长期记忆 feedback 桶。',
    source: 'electron/main/companion/life/nightly-reflection.ts#triggerNightlyReflection', version: 'nightly-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'nightly-reflection-loop', promptKey: PROMPT_KEYS.companionNightlyReflection }),
    dependencies: [PROMPT_KEYS.companionNightlyReflection],
  }), makeCompanionAsset({
    key: 'companion:policy:nostalgic-reminiscence', name: '高光回忆重温策略',
    purpose: '周期性从长期记忆、专属信物与深夜感悟中提取回忆切片，在主会话中自然忆及',
    role: 'platform', description: '4小时冷却；结合长期记忆 feedback、信物与深夜领悟，注入 formatConversationImpulseForPrompt，引导角色在闲聊时像老朋友一样自然提及。',
    source: 'electron/main/companion/life/nostalgia.ts#pickNostalgicReminiscence', version: 'nostalgia-v1',
    assetType: 'companion-life', contentKind: 'schema', ownership: 'builtin',
    content: jsonContent({ trigger: 'chat-impulse-nostalgia', cooldownMs: 14_400_000 }),
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
