/**
 * 人物世界切面（阴影/投影）与 15 维活人感因子统一注册表（单一事实源）。
 *
 * 背景：受 Companion 底层生活引擎影响的切面分布于人物世界（9 面）与 Chat（3 面：
 * 氛围壁纸、语气与小声蛐蛐 aside、主动消息），此前映射关系分散在各业务文件，
 * 难以在架构层与 Debug 中全局核对“哪个切面受哪些因子驱动、走哪条门控、有哪些 AI 工具入口”。
 * 设计意图：在 Companion Core `projections/` 层建立唯一声明式注册表，供 Debug 资产目录、
 * 架构门禁测试与后续扩展（如新切面或新插件）共享同一真相；不复制正文或业务逻辑。
 * 关键约束：所有 backendSources / frontendSources 必须是仓库真实路径，toolNames 必须匹配
 * builtinTools，promptKeys 必须来自 PROMPT_KEYS；由 companion-surface-registry.test.ts 静态锁死。
 */

import { PROMPT_KEYS, type CorePromptAssetKey } from '../../../prompts/keys'

export type LifeFactorLayer = 'inner' | 'relationship' | 'world' | 'rhythm' | 'expression'

export type LifeFactorKey =
  | 'vitals'
  | 'dynamic_status_tags'
  | 'emotion_memory'
  | 'relationship_stage'
  | 'user_vibe'
  | 'host_presence'
  | 'open_loops'
  | 'recent_experience'
  | 'cast_resonance'
  | 'chat_resonance'
  | 'world_asset_state'
  | 'rhythm_weather'
  | 'interaction_gap'
  | 'calendar_milestones'
  | 'anti_repetition'

export interface LifeFactorDescriptor {
  key: LifeFactorKey
  layer: LifeFactorLayer
  label: string
  status: 'active' | 'reserved'
  source: string
}

export type CompanionWorldReadView = 'timeline' | 'moments' | 'assets' | 'journal' | 'gifts' | 'contacts'

export interface CompanionProjectionSurface {
  id: string
  domain: 'world' | 'chat'
  name: string
  description: string
  /** 人物世界切面在 companion_read_world 中对应的读取视图，由架构门禁校验全覆盖 */
  readView?: CompanionWorldReadView
  factors: readonly LifeFactorKey[]
  gatingPolicies: readonly string[]
  toolNames: readonly string[]
  promptKeys: readonly CorePromptAssetKey[]
  backendSources: readonly string[]
  frontendSources: readonly string[]
}

export const LIFE_FACTOR_CATALOG: readonly LifeFactorDescriptor[] = [
  { key: 'vitals', layer: 'inner', label: '生命体征（心情/精力/社交欲）', status: 'active', source: 'electron/main/companion/core/state/runtime-state.ts' },
  { key: 'dynamic_status_tags', layer: 'inner', label: '动态状态标签（忙碌/疲惫/靠岸中）', status: 'active', source: 'electron/main/companion/life/life-context-snapshot.ts' },
  { key: 'emotion_memory', layer: 'inner', label: '伙伴主观情感记忆', status: 'active', source: 'electron/main/companion/life/nightly-reflection.ts' },
  { key: 'relationship_stage', layer: 'relationship', label: '双向关系阶段（初识/熟悉/默契）', status: 'active', source: 'electron/main/companion/growth/relationship-stage.ts' },
  { key: 'user_vibe', layer: 'relationship', label: '用户近期状态与眼色', status: 'active', source: 'electron/main/companion/life/life-context-snapshot.ts' },
  { key: 'host_presence', layer: 'relationship', label: '现实作息锚点（专注疲劳/深夜熬夜）', status: 'active', source: 'electron/main/companion/life/host-presence.ts' },
  { key: 'open_loops', layer: 'relationship', label: '短期挂念与盼头（Open Loops）', status: 'active', source: 'electron/main/companion/life/life-context-snapshot.ts' },
  { key: 'recent_experience', layer: 'world', label: '近期生活经历与活跃航程', status: 'active', source: 'electron/main/companion/life/script-generator.ts' },
  { key: 'cast_resonance', layer: 'world', label: '同伴社交圈动态（卡司互动）', status: 'active', source: 'electron/main/companion/life/moment-comment-service.ts' },
  { key: 'chat_resonance', layer: 'world', label: '聊天心愿反哺（种草书影音/美食/地点）', status: 'active', source: 'electron/main/companion/life/chat-resonance.ts' },
  { key: 'world_asset_state', layer: 'world', label: '世界事实与物品状态（穿着/在读/物件）', status: 'active', source: 'electron/main/companion/life/assets.ts' },
  { key: 'rhythm_weather', layer: 'rhythm', label: '环境与时间节律（时段/天气/周末）', status: 'active', source: 'electron/main/companion/life/life-context-snapshot.ts' },
  { key: 'interaction_gap', layer: 'rhythm', label: '互动时间间隔感', status: 'active', source: 'electron/main/companion/life/life-context-snapshot.ts' },
  { key: 'calendar_milestones', layer: 'rhythm', label: '特殊日子与纪念锚点（预留插槽）', status: 'reserved', source: 'electron/main/companion/growth/milestones.ts' },
  { key: 'anti_repetition', layer: 'expression', label: '表达新鲜度与近期发圈避重', status: 'active', source: 'electron/main/companion/life/life-context-snapshot.ts' },
] as const

export const COMPANION_PROJECTION_SURFACES: readonly CompanionProjectionSurface[] = [
  // ── 人物世界 9 大切面 ──
  {
    id: 'surface.world.today-timeline',
    domain: 'world',
    name: '今日轨迹（日剧本与因果重排）',
    description: '每日动态排期与体征耗竭后的日内休养重排，是所有生活事件的时间轴源头。',
    readView: 'timeline',
    factors: ['vitals', 'dynamic_status_tags', 'relationship_stage', 'user_vibe', 'host_presence', 'open_loops', 'recent_experience', 'chat_resonance', 'rhythm_weather', 'anti_repetition'],
    gatingPolicies: ['replan.ts#replanRemainingSlots'],
    toolNames: ['companion_read_world'],
    promptKeys: [PROMPT_KEYS.companionDayScript, PROMPT_KEYS.companionReplanSlots],
    backendSources: ['electron/main/companion/life/script-generator.ts', 'electron/main/companion/life/replan.ts', 'electron/main/companion/life/timeline.ts'],
    frontendSources: ['src/components/world/WorldTodayTimeline.tsx'],
  },
  {
    id: 'surface.world.moments',
    domain: 'world',
    name: '朋友圈（动态投影与关系可见窗口）',
    description: '由生活事件与 Chat 工具投影的社交动态，受关系可见天数（3/7/14天）、体征节流、冷却上限与自动配图约束。',
    readView: 'moments',
    factors: ['vitals', 'dynamic_status_tags', 'relationship_stage', 'user_vibe', 'recent_experience', 'cast_resonance', 'world_asset_state', 'rhythm_weather', 'interaction_gap', 'anti_repetition'],
    gatingPolicies: ['life-gating.ts#evaluateLifeActionGating', 'moment-visibility.ts#resolveMomentVisibilityDays'],
    toolNames: ['companion_post_moment', 'companion_comment_moment', 'companion_read_world', 'companion_take_photo', 'image_generate'],
    promptKeys: [PROMPT_KEYS.companionMomentPolish, PROMPT_KEYS.momentComment, PROMPT_KEYS.momentReply, PROMPT_KEYS.imageGeneration, PROMPT_KEYS.companionImageDirector],
    backendSources: ['electron/main/companion/life/moments.ts', 'electron/main/companion/life/moment-polish.ts', 'electron/main/companion/life/moment-visibility.ts', 'electron/main/companion/life/automatic-moment-media.ts'],
    frontendSources: ['src/components/MomentsPanel.tsx', 'src/components/world/MomentImageGrid.tsx'],
  },
  {
    id: 'surface.world.wardrobe',
    domain: 'world',
    name: '衣柜与穿搭',
    description: '管理角色衣物资产与当前穿着，支持生活引擎上下文自动换装、界面手动换装与 Chat 换装工具，并同步反馈到主对话与朋友圈配图。',
    readView: 'assets',
    factors: ['recent_experience', 'world_asset_state', 'rhythm_weather'],
    gatingPolicies: ['autonomous-dressing.ts#shouldPerformContextualDressing'],
    toolNames: ['companion_change_wardrobe', 'companion_create_asset', 'companion_read_world', 'image_generate'],
    promptKeys: [PROMPT_KEYS.imageGeneration],
    backendSources: ['electron/main/companion/life/assets.ts', 'electron/main/companion/life/autonomous-dressing.ts'],
    frontendSources: ['src/components/world/WorldLivingContent.tsx', 'src/components/world/WardrobeCategoryIcons.tsx'],
  },
  {
    id: 'surface.world.journal',
    domain: 'world',
    name: '日记、深夜反思与脆弱心境',
    description: '承载角色私密独白、深夜深层反思（回写长期记忆）与脆弱时刻卡片，受关系阶段门控防交浅言深。',
    readView: 'journal',
    factors: ['vitals', 'emotion_memory', 'relationship_stage', 'recent_experience', 'rhythm_weather'],
    gatingPolicies: ['life-gating.ts#evaluateLifeActionGating'],
    toolNames: ['companion_read_world'],
    promptKeys: [PROMPT_KEYS.companionInnerThought, PROMPT_KEYS.companionNightlyReflection, PROMPT_KEYS.companionVulnerabilityReaction],
    backendSources: ['electron/main/companion/life/inner-thoughts.ts', 'electron/main/companion/life/nightly-reflection.ts', 'electron/main/companion/life/vulnerability.ts'],
    frontendSources: ['src/components/world/WorldJournalPanel.tsx', 'src/components/world/VulnerabilityCard.tsx'],
  },
  {
    id: 'surface.world.culture',
    domain: 'world',
    name: '文化角与书架',
    description: '管理书影音展游体验与带来源的阅读笔记，打通聊天种草播种、图片材料观察与自动第一人称感想生成。',
    readView: 'assets',
    factors: ['chat_resonance', 'open_loops', 'world_asset_state'],
    gatingPolicies: [],
    toolNames: ['companion_create_asset', 'companion_observe_material', 'companion_add_reading_note', 'companion_read_world', 'image_generate'],
    promptKeys: [PROMPT_KEYS.materialObservation, PROMPT_KEYS.companionCultureReview, PROMPT_KEYS.companionChatResonance],
    backendSources: ['electron/main/companion/life/assets.ts', 'electron/main/companion/life/chat-resonance.ts', 'electron/main/companion/life/material-observation-store.ts'],
    frontendSources: ['src/components/world/WorldCultureGallery.tsx'],
  },
  {
    id: 'surface.world.home',
    domain: 'world',
    name: '家居与物件陈列',
    description: '展示居所经典空间与有意义的随身象征物（如草帽），支持资产创建、配图挂载与备份恢复。',
    readView: 'assets',
    factors: ['world_asset_state'],
    gatingPolicies: [],
    toolNames: ['companion_create_asset', 'companion_read_world', 'image_generate'],
    promptKeys: [PROMPT_KEYS.worldAssetImageDraft],
    backendSources: ['electron/main/companion/life/assets.ts'],
    frontendSources: ['src/components/world/WorldHomeGallery.tsx'],
  },
  {
    id: 'surface.world.footprints',
    domain: 'world',
    name: '足迹与航程演化',
    description: '记录过往旅程与进行中航段，按冷却、体征节流与旅行心愿自主推进新经停站点。',
    readView: 'assets',
    factors: ['vitals', 'recent_experience', 'chat_resonance', 'world_asset_state'],
    gatingPolicies: ['life-gating.ts#evaluateLifeActionGating', 'travel-progression.ts#shouldProgressTravelJourney'],
    toolNames: ['companion_create_asset', 'companion_read_world', 'image_generate'],
    promptKeys: [],
    backendSources: ['electron/main/companion/life/travel-progression.ts', 'electron/main/companion/life/assets.ts'],
    frontendSources: ['src/components/world/WorldTravelGallery.tsx'],
  },
  {
    id: 'surface.world.keepsakes',
    domain: 'world',
    name: '礼物柜（送出与收到的礼物）',
    description: '伙伴的只读礼物陈列柜，展示伙伴送出的纪念礼物与通过聊天收到的礼物回响，所有赠礼由主会话自然触发。',
    readView: 'gifts',
    factors: ['vitals', 'relationship_stage', 'emotion_memory', 'recent_experience'],
    gatingPolicies: [],
    toolNames: ['companion_receive_gift', 'companion_read_world'],
    promptKeys: [PROMPT_KEYS.companionGiftReaction, PROMPT_KEYS.companionKeepsakeGift],
    backendSources: ['electron/main/companion/life/gifting.ts', 'electron/main/companion/growth/relationship-keepsake.ts'],
    frontendSources: ['src/components/world/WorldKeepsakesPanel.tsx'],
  },
  {
    id: 'surface.world.contacts',
    domain: 'world',
    name: '通讯录与卡司名册',
    description: '展示同船伙伴关系弧线、忙闲状态与临时召唤短聊入口，保持与主角生活引擎隔离。',
    readView: 'contacts',
    factors: ['cast_resonance', 'relationship_stage'],
    gatingPolicies: [],
    toolNames: ['companion_read_world'],
    promptKeys: [PROMPT_KEYS.companionContext],
    backendSources: ['electron/main/companion/cast/contacts.ts', 'electron/main/companion/cast/availability.ts', 'electron/main/companion/cast/roster.ts'],
    frontendSources: ['src/components/world/WorldContactsPanel.tsx', 'src/components/world/WorldContactsGallery.tsx'],
  },
  // ── Chat 主界面 3 大投影切面 ──
  {
    id: 'surface.chat.backdrop',
    domain: 'chat',
    name: 'Chat 主页氛围壁纸与角色视觉',
    description: '根据角色封面（支持用户/AI覆写与恢复默认）、场景位置与开关呈现低干扰氛围背景，并在世界顶栏同步。',
    factors: ['rhythm_weather', 'recent_experience', 'world_asset_state'],
    gatingPolicies: ['visual-overrides.ts#saveRoleVisualOverride'],
    toolNames: ['companion_take_photo', 'image_generate'],
    promptKeys: [PROMPT_KEYS.imageGeneration, PROMPT_KEYS.companionImageDirector],
    backendSources: ['electron/main/companion/identity/visual-overrides.ts', 'electron/main/companion/identity/loader.ts'],
    frontendSources: ['src/components/CompanionSceneBackdrop.tsx', 'src/components/world/WorldProfileHeader.tsx'],
  },
  {
    id: 'surface.chat.voice-and-aside',
    domain: 'chat',
    name: 'Chat 对话语气与小声蛐蛐（aside）',
    description: '将稳定身份、可变偏好、关系阶段、体征、高光回忆与生活话头装配进主对话 Prompt，动态收放语气与 aside 频率。',
    factors: ['vitals', 'dynamic_status_tags', 'emotion_memory', 'relationship_stage', 'user_vibe', 'open_loops', 'recent_experience', 'world_asset_state', 'interaction_gap'],
    gatingPolicies: ['relationship-stage.ts#resolveRelationshipStage'],
    toolNames: ['companion_read_world', 'companion_post_moment', 'companion_change_wardrobe'],
    promptKeys: [PROMPT_KEYS.toneControl, PROMPT_KEYS.relationshipStage, PROMPT_KEYS.companionContext, PROMPT_KEYS.companionMutableState, PROMPT_KEYS.companionReflection],
    backendSources: ['electron/main/companion/orchestrator.ts', 'electron/main/companion/growth/relationship-stage.ts', 'electron/main/companion/life/nostalgia.ts'],
    frontendSources: ['src/App.tsx'],
  },
  {
    id: 'surface.chat.proactive',
    domain: 'chat',
    name: 'Chat 主动消息与现实关怀',
    description: '统一受每日主动打扰预算、勿扰时段、体征与关系门控约束的早安问候、即兴搭话与宿主专注/熬夜关怀。',
    factors: ['vitals', 'relationship_stage', 'user_vibe', 'host_presence', 'open_loops', 'rhythm_weather', 'interaction_gap'],
    gatingPolicies: ['proactive-budget.ts#runAutomaticProactiveAction', 'life-gating.ts#evaluateLifeActionGating'],
    toolNames: [],
    promptKeys: [PROMPT_KEYS.proactiveGreeting, PROMPT_KEYS.companionSpontaneousImpulse, PROMPT_KEYS.companionHostCare],
    backendSources: ['electron/main/companion/life/proactive-greeting.ts', 'electron/main/companion/life/spontaneous-impulse.ts', 'electron/main/companion/life/host-presence.ts', 'electron/main/companion/application/proactive-budget.ts'],
    frontendSources: ['src/App.tsx'],
  },
] as const

/**
 * 从人物世界 9 大切面注册表自动派生的只读视图列表（单一事实源）。
 * companion_read_world 工具的 view 枚举直接引用此常量，新增世界切面时不会遗漏 AI 读取能力。
 */
export const COMPANION_WORLD_READ_VIEWS: readonly CompanionWorldReadView[] = Array.from(
  new Set(
    COMPANION_PROJECTION_SURFACES
      .filter((s): s is CompanionProjectionSurface & { readView: CompanionWorldReadView } => s.domain === 'world' && Boolean(s.readView))
      .map((s) => s.readView),
  ),
)

export function getCompanionProjectionSurfaceSummary() {
  return {
    factorCount: LIFE_FACTOR_CATALOG.length,
    surfaceCount: COMPANION_PROJECTION_SURFACES.length,
    worldSurfaces: COMPANION_PROJECTION_SURFACES.filter((s) => s.domain === 'world').map((s) => s.id),
    chatSurfaces: COMPANION_PROJECTION_SURFACES.filter((s) => s.domain === 'chat').map((s) => s.id),
    factors: LIFE_FACTOR_CATALOG,
    surfaces: COMPANION_PROJECTION_SURFACES,
  }
}
