/**
 * Prompt 资产目录的唯一运行时来源。
 *
 * 背景：Debug 需要回答“本次系统实际使用了什么 Prompt”，而不是只展示一组手写目录项。
 * 设计意图：注册表直接引用生产常量、Role Pack 和真实组装器来源；用稳定 key、用途、角色、版本
 * 与动态插槽描述资产，未来可在同一资产对象下扩展独立语言版本。
 * 关键约束：当前生产 locale 固定为 zh-CN；动态资产不在此复制一份运行时正文，Playground 只能载入隔离副本。
 */

import type {
  PromptAsset,
  PromptAssetMode,
  PromptAssetTrace,
  PromptSlot,
} from '../../../src/shared/types'
import { DEFAULT_PLAYGROUND_SYSTEM, DEFAULT_SYSTEM_PROMPT, EXTRACTION_PROMPT } from './texts'
import { listAvailableRoleIds, tryReadRoleText } from '../companion/identity/loader'

const PROMPT_LOCALE = 'zh-CN'
const DEFAULT_PROMPT_VERSION = '1.0.0'

type PromptAssetInput = {
  id: string
  name: string
  category: PromptAsset['category']
  desc: string
  sourcePath: string
  purpose?: string
  role?: string
  version?: string
  mode?: PromptAssetMode
  locale?: string
  slots?: PromptSlot[]
  preview?: string
  content?: string
  dynamic?: boolean
}

function clip(text: string, max = 420): string {
  const normalized = text.trim()
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

/**
 * 将旧目录项归一化为结构化资产，保留现有 id/sourcePath 兼容字段。
 *
 * 背景：Prompt 目录最初只有展示字段，不能让每个调用点继续手写 key、版本和 locale。
 * 设计意图：在注册表入口一次性补齐结构化元数据，避免 Debug、测试和生产目录出现分叉。
 * 关键约束：默认只注册 zh-CN；动态资产不伪造固定模板正文，静态资产才把 content 放入 locale 模板。
 */
function normalizeAsset(input: PromptAssetInput): PromptAsset & { content?: string } {
  const mode: PromptAssetMode = input.mode ?? (input.dynamic ? 'dynamic' : 'static')
  const locale = input.locale ?? PROMPT_LOCALE
  const content = input.content
  return {
    ...input,
    key: input.id,
    purpose: input.purpose ?? input.name,
    role: input.role ?? input.category,
    source: input.sourcePath,
    sourcePath: input.sourcePath,
    version: input.version ?? DEFAULT_PROMPT_VERSION,
    mode,
    locale,
    locales: {
      [locale]: {
        ...(mode === 'static' && content !== undefined ? { template: content } : {}),
      },
    },
    slots: input.slots ?? [],
    dynamic: mode === 'dynamic',
  }
}

function staticAsset(input: PromptAssetInput & { content: string }): PromptAsset & { content: string } {
  return normalizeAsset({ ...input, preview: clip(input.content) }) as PromptAsset & { content: string }
}

function dynamicAsset(input: PromptAssetInput): PromptAsset & { content?: string } {
  return normalizeAsset({ ...input, mode: 'dynamic', dynamic: true })
}

const CORE_PROMPT_ASSETS: readonly (PromptAsset & { content?: string })[] = [
  dynamicAsset({
    id: 'system-layers',
    name: 'System Prompt 四层实装（L1–L4）',
    category: 'system',
    purpose: '主对话 System 四层组装',
    role: 'system',
    desc: '主对话由 buildSystemPrompt 组装；具体一轮结果请在 Debug 或「载入当前实装」查看。',
    sourcePath: 'electron/main/agent/prompt-builder.ts',
    preview: 'L1 人格 · L2 能力/行为 · L3 记忆与世界 · L4 动态',
    slots: [
      { name: 'persona', source: 'rolePackToPromptParts', lifecycle: '每次装配' },
      { name: 'toolNames', source: 'ToolRegistry', lifecycle: '每次装配' },
      { name: 'userProfile', source: 'memory-store', lifecycle: '按需注入' },
      { name: 'companionContext', source: 'companion orchestrator', lifecycle: '按需注入' },
      { name: 'sessionInfo', source: 'settings.systemPrompt', lifecycle: '会话 / 设置变更' },
      { name: 'dynamicState', source: 'runtime context', lifecycle: '每轮装配' },
    ],
  }),
  staticAsset({
    id: 'loop-default',
    name: 'Loop 默认 System（无人格时）',
    category: 'system',
    purpose: 'Agent Loop 兜底 System',
    role: 'system',
    desc: 'Agent Loop 未注入自定义 system 时的兜底指令。',
    sourcePath: 'electron/main/prompts/texts.ts',
    content: DEFAULT_SYSTEM_PROMPT,
  }),
  staticAsset({
    id: 'playground-default',
    name: 'Playground 默认试验指令',
    category: 'system',
    purpose: 'Playground 隔离试跑',
    role: 'playground',
    desc: '对话试验 System 为空时使用；免伴侣上下文与工具。',
    sourcePath: 'electron/main/prompts/texts.ts',
    content: DEFAULT_PLAYGROUND_SYSTEM,
  }),
  dynamicAsset({
    id: 'playground-draft',
    name: 'Playground 自定义草稿',
    category: 'system',
    purpose: 'Playground 隔离自定义 Prompt',
    role: 'playground',
    desc: '开发者在对话试验中临时输入的 System 草稿，不写入生产设置。',
    sourcePath: 'electron/main/agent/playground.ts',
    preview: '正文来自本次 Playground 输入；只在隔离试跑中生效。',
    slots: [{ name: 'systemPrompt', source: 'Playground draft', lifecycle: '每次试跑' }],
  }),
  dynamicAsset({
    id: 'playground-model-test',
    name: 'Playground 模型能力探测',
    category: 'ui',
    purpose: '模型连通与 Thinking 能力探测',
    role: 'playground-model-test',
    desc: '模型测试页用于 smoke test 与 thinking.disabled 对比的短提示。',
    sourcePath: 'electron/main/agent/playground-model-test.ts',
    preview: '短文本探测，不注入主会话人格、记忆或工具。',
    slots: [{ name: 'probePrompt', source: 'model test runner', lifecycle: '每次探测' }],
  }),
  dynamicAsset({
    id: 'l3-collapse',
    name: 'L3 Collapse 摘要指令',
    category: 'context',
    purpose: '中段上下文压缩',
    role: 'context-manager',
    desc: '上下文中段压缩时动态生成的结构化摘要指令。',
    sourcePath: 'electron/main/agent/context-manager.ts',
    preview: '当前任务 · 已完成步骤 · 当前状态 · 下一步计划 · 关键上下文',
    slots: [{ name: 'conversationWindow', source: 'context-manager', lifecycle: '每次压缩' }],
  }),
  dynamicAsset({
    id: 'l4-autocompact',
    name: 'L4 AutoCompact 全量摘要',
    category: 'context',
    purpose: '超长上下文全量摘要',
    role: 'context-manager',
    desc: '超长上下文的紧急全量摘要路径，与 L3 共用摘要管线。',
    sourcePath: 'electron/main/agent/context-manager.ts',
    preview: '综合摘要模式；字数上限和上下文范围随运行状态变化。',
    slots: [{ name: 'fullConversation', source: 'context-manager', lifecycle: '每次紧急压缩' }],
  }),
  staticAsset({
    id: 'profile-extraction',
    name: '用户画像提取',
    category: 'context',
    purpose: '用户画像提取',
    role: 'profile-extractor',
    desc: '后台从近期对话提取可长期复用的用户信息。',
    sourcePath: 'electron/main/prompts/texts.ts',
    content: EXTRACTION_PROMPT,
  }),
  dynamicAsset({
    id: 'session-title',
    name: '会话标题生成',
    category: 'context',
    purpose: '新会话标题生成',
    role: 'session-store',
    desc: '根据首轮用户与助手文本生成 4–10 字中文标题。',
    sourcePath: 'electron/main/storage/session-store.ts',
    preview: '只返回短标题，不注入完整会话历史。',
    slots: [{ name: 'openingTurn', source: 'session messages', lifecycle: '新会话首轮' }],
  }),
  dynamicAsset({
    id: 'connection-test',
    name: '模型连接测试',
    category: 'ui',
    purpose: '设置页模型连接验证',
    role: 'settings',
    desc: '用固定短消息验证 Provider、Base URL、API Key 与模型是否可调用。',
    sourcePath: 'electron/main/ipc/settings.ts',
    preview: '只验证连接与最小正文返回，不进入真实会话。',
    slots: [{ name: 'connectionProbe', source: 'settings IPC', lifecycle: '每次测试' }],
  }),
  dynamicAsset({
    id: 'settings-system-prompt',
    name: '设置中的 System 补充指令',
    category: 'system',
    purpose: '主对话 L3 自定义补充',
    role: 'system',
    desc: '用户在设置中保存的自定义 System 补充，被装配进主会话上下文。',
    sourcePath: 'electron/main/storage/settings-store.ts',
    preview: '正文来自 settings.systemPrompt；Debug 调用详情可查看本次实发内容。',
    slots: [{ name: 'systemPrompt', source: 'settings.systemPrompt', lifecycle: '设置变更' }],
  }),
  dynamicAsset({
    id: 'reply-stance',
    name: '回复立场提示',
    category: 'system',
    purpose: '本轮回复立场选择',
    role: 'companion',
    desc: '按用户本轮意图选择问 / 做 / 安慰 / 推回的回复立场。',
    sourcePath: 'electron/main/agent/reply-stance.ts',
    preview: '每轮按用户消息启发式生成；不是固定 System 文案。',
    slots: [{ name: 'userMessage', source: 'reply-stance', lifecycle: '每轮消息' }],
  }),
  dynamicAsset({
    id: 'tone-control',
    name: '语气收放提示',
    category: 'system',
    purpose: '本轮语气与 aside 策略',
    role: 'companion',
    desc: '按立场、执行模式和会话种别调整语气与 aside 策略。',
    sourcePath: 'electron/main/agent/tone-control.ts',
    preview: '紧 / 软 / 中性 + aside 策略；不改变角色身份。',
    slots: [{ name: 'replyStance', source: 'reply-stance', lifecycle: '每轮消息' }],
  }),
  dynamicAsset({
    id: 'relationship-stage',
    name: '关系阶段提示',
    category: 'companion',
    purpose: '关系阶段边界注入',
    role: 'companion-growth',
    desc: '按角色关系代理指标注入陌生 / 熟悉 / 默契阶段边界。',
    sourcePath: 'electron/main/companion/growth/relationship-stage.ts',
    preview: '阶段动态计算，召唤会话强制按陌生客人处理。',
    slots: [{ name: 'relationshipStage', source: 'relationship-stage', lifecycle: '关系状态变化' }],
  }),
  dynamicAsset({
    id: 'relationship-milestones',
    name: '关系里程碑提示',
    category: 'companion',
    purpose: '关系里程碑薄提示',
    role: 'companion-growth',
    desc: '偶尔把已达成的关系里程碑作为薄提示带入主会话。',
    sourcePath: 'electron/main/companion/growth/milestones.ts',
    preview: '最多注入少量提示，避免变成成就系统。',
    slots: [{ name: 'milestoneHint', source: 'milestones', lifecycle: '按需注入' }],
  }),
  dynamicAsset({
    id: 'expertise-level',
    name: '专家度 / 解释粒度提示',
    category: 'system',
    purpose: '解释粒度调整',
    role: 'companion',
    desc: '根据用户画像和近期消息调整解释密度，不改变工具权限。',
    sourcePath: 'electron/main/agent/expertise-level.ts',
    preview: '只调讲解密度，不把专家度标签直接称呼用户。',
    slots: [{ name: 'expertiseLevel', source: 'expertise-level', lifecycle: '画像或消息变化' }],
  }),
  dynamicAsset({
    id: 'skill-context',
    name: 'Skill 上下文提示',
    category: 'system',
    purpose: 'Skill 能力上下文注入',
    role: 'skill-runtime',
    desc: '列出可用 Skill，并在 Skill 激活时注入对应操作指南。',
    sourcePath: 'electron/main/skills/registry.ts',
    preview: '可用 Skill 摘要 + 当前激活 Skill 正文。',
    slots: [
      { name: 'skillSummary', source: 'skills/registry', lifecycle: 'Skill 列表变化' },
      { name: 'activeSkillBody', source: 'skill loader', lifecycle: 'Skill 激活' },
    ],
  }),
  dynamicAsset({
    id: 'companion-context',
    name: '伙伴世界上下文片段',
    category: 'companion',
    purpose: '伙伴生活世界上下文注入',
    role: 'companion-orchestrator',
    desc: 'Catch-up、世界状态、近 Moment、书架、名册和召唤场景按角色/会话注入。',
    sourcePath: 'electron/main/companion/orchestrator.ts',
    preview: '世界态和生活切片只注入需要它们的主会话；召唤会话有独立场景块。',
    slots: [
      { name: 'catchupSummary', source: 'companion orchestrator', lifecycle: '按需注入' },
      { name: 'worldSlice', source: 'companion world state', lifecycle: '每轮装配' },
      { name: 'recentMomentsSlice', source: 'moments store', lifecycle: '按需注入' },
      { name: 'bookshelfSlice', source: 'bookshelf store', lifecycle: '按需注入' },
      { name: 'rosterLines', source: 'cast store', lifecycle: '按需注入' },
    ],
  }),
  dynamicAsset({
    id: 'companion-mutable-state',
    name: '伙伴 MUTABLE 当前状态',
    category: 'companion',
    purpose: '角色可成长状态注入',
    role: 'companion-orchestrator',
    desc: '当角色 MUTABLE 已偏离 Role Pack 默认正文时，注入当前持久化状态。',
    sourcePath: 'electron/main/companion/growth/mutable-store.ts',
    preview: '只记录来源与版本；实际状态正文保留在本次请求消息中。',
    slots: [{ name: 'mutableBody', source: 'companion mutable store', lifecycle: '角色状态变化' }],
  }),
  dynamicAsset({
    id: 'companion-background-tasks',
    name: '伙伴后台任务 Prompt',
    category: 'companion',
    purpose: '伙伴后台 LLM 任务',
    role: 'companion-background',
    desc: 'Catch-up、反思、Moment 润色和剧本生成等辅助 LLM 调用。',
    sourcePath: 'electron/main/companion/life/ + electron/main/companion/growth/',
    preview: '每个辅助任务在自身服务文件中组装，不复用主对话 System Prompt。',
    slots: [{ name: 'taskInput', source: 'companion background task', lifecycle: '每次后台任务' }],
  }),
  dynamicAsset({
    id: 'companion-reflection',
    name: '伙伴反思更新 Prompt',
    category: 'companion',
    purpose: '角色 MUTABLE 反思更新',
    role: 'companion-background',
    desc: '根据近期互动判断是否更新角色可成长状态。',
    sourcePath: 'electron/main/companion/growth/reflection-service.ts',
    preview: '输出结构化反思结果；不复用主对话 System Prompt。',
    slots: [{ name: 'reflectionInput', source: 'recent interaction', lifecycle: '每次反思' }],
  }),
  dynamicAsset({
    id: 'companion-catchup',
    name: '伙伴生活补叙 Prompt',
    category: 'companion',
    purpose: '暂停期间生活补叙',
    role: 'companion-background',
    desc: '根据角色与暂停区间生成可校验的 Catch-up 摘要。',
    sourcePath: 'electron/main/companion/life/catchup.ts',
    preview: '输出暂停期间的生活摘要，不改写主会话 Prompt。',
    slots: [{ name: 'catchupWindow', source: 'companion lifecycle', lifecycle: '恢复时' }],
  }),
  dynamicAsset({
    id: 'companion-moment-polish',
    name: '伙伴 Moment 润色 Prompt',
    category: 'companion',
    purpose: '已发布 Moment 文案润色',
    role: 'companion-background',
    desc: '在规则文案基础上按角色语气生成简短生活动态。',
    sourcePath: 'electron/main/companion/life/moment-polish.ts',
    preview: '只润色已有事件，不新增未发生的事实。',
    slots: [{ name: 'momentEvent', source: 'published life event', lifecycle: '每次发布' }],
  }),
  dynamicAsset({
    id: 'companion-day-script',
    name: '伙伴日程剧本 Prompt',
    category: 'companion',
    purpose: '角色日程剧本生成',
    role: 'companion-background',
    desc: '结合人物档案与世界默认值生成结构化日程脚本。',
    sourcePath: 'electron/main/companion/life/script-generator.ts',
    preview: '输出结构化日程载荷，后续仍需规则校验。',
    slots: [{ name: 'dayContext', source: 'role pack and world state', lifecycle: '每日生成' }],
  }),
  dynamicAsset({
    id: 'subagent-system',
    name: '子 Agent System Prompt',
    category: 'subagent',
    purpose: '子 Agent 角色与边界',
    role: 'sub-agent',
    desc: '研究、编码、分析等子任务角色描述与边界。',
    sourcePath: 'electron/main/agent/subagent.ts',
    preview: '角色预设会结合任务配置、工具集和只读性动态组装。',
    slots: [
      { name: 'taskDescription', source: 'subagent request', lifecycle: '每次子任务' },
      { name: 'toolSet', source: 'ToolRegistry', lifecycle: '每次子任务' },
    ],
  }),
  dynamicAsset({
    id: 'permission-denial',
    name: '权限拒绝后的继续策略',
    category: 'system',
    purpose: '权限拒绝后的继续策略',
    role: 'agent-loop',
    desc: '工具或命令被拒绝后注入 Loop 的替代方案提示，并在连续拒绝时停止本轮。',
    sourcePath: 'electron/main/agent/loop.ts',
    preview: '不要重试同一动作；换个方式或询问用户如何继续。',
    slots: [{ name: 'deniedTool', source: 'permission engine', lifecycle: '每次拒绝' }],
  }),
]

const ROLE_PROMPT_FILES = [
  { suffix: 'protected.md', label: 'PROTECTED 人格正文' },
  { suffix: 'mutable.default.md', label: 'MUTABLE 默认状态' },
  { suffix: 'voice.md', label: '语气补充' },
  { suffix: 'scenes/display.md', label: '展示场景' },
  { suffix: 'scenes/interact.md', label: '互动场景' },
  { suffix: 'scenes/execute.md', label: '执行场景' },
] as const

let roleAssetsCache: Array<PromptAsset & { content: string }> | undefined

function roleAssetKey(roleId: string, suffix: string): string {
  return `role-${roleId}-${suffix.replace(/[^a-z0-9]+/gi, '-')}`
}

/**
 * 读取并缓存进程生命周期内的 Role Pack Prompt 资产。
 *
 * 背景：调用级追踪发生在每次 LLM 请求前，不能为每条辅助调用重复同步扫描全部角色文件。
 * 设计意图：Role Pack 是随应用构建加载的生产资产，首次读取后复用不可变快照；开发热更新会重载模块。
 * 关键约束：加载失败返回空数组，让 core 资产和真实 LLM 调用继续工作；未知角色 key 会在 Debug 显式告警。
 */
function loadRoleAssets(): Array<PromptAsset & { content: string }> {
  if (roleAssetsCache) return roleAssetsCache
  try {
    const assets: Array<PromptAsset & { content: string }> = []
    for (const roleId of listAvailableRoleIds()) {
      for (const file of ROLE_PROMPT_FILES) {
        const content = tryReadRoleText(roleId, file.suffix)
        if (!content?.trim()) continue
        assets.push(staticAsset({
          id: roleAssetKey(roleId, file.suffix),
          name: `${roleId} · ${file.label}`,
          category: 'companion',
          purpose: `角色 Pack · ${file.label}`,
          role: roleId,
          desc: `角色 Pack 的 ${file.label}，由 Identity loader 读取。`,
          sourcePath: `electron/main/companion/universes/default/roles/${roleId}/${file.suffix}`,
          version: 'role-pack-1.0.0',
          content,
        }))
      }
    }
    roleAssetsCache = assets
    return roleAssetsCache
  } catch {
    roleAssetsCache = []
    return roleAssetsCache
  }
}

export function getPromptAssets(): Array<PromptAsset & { content?: string }> {
  return [...CORE_PROMPT_ASSETS, ...loadRoleAssets()]
}

/**
 * 提供脱离正文的资产追踪信息，供 Debug 当前装配快照和调用链使用。
 *
 * 背景：最终 Prompt 可能包含用户状态和敏感上下文，追踪信息应与正文分离。
 * 设计意图：从同一注册表投影元数据，避免 Debug 维护第二套来源 / 版本描述。
 * 关键约束：该兼容投影只返回已登记资产；调用级未知 key 必须通过 resolvePromptAssetTraces 的 unknownKeys 显式处理。
 */
export function getPromptAssetTraces(keys?: readonly string[]): PromptAssetTrace[] {
  if (keys) return resolvePromptAssetTraces(keys).assets
  return getPromptAssets().map(({ key, purpose, role, source, version, locale, mode, slots }) => ({
    key,
    purpose,
    role,
    source,
    version,
    locale,
    mode,
    slots,
  }))
}

export interface PromptAssetResolution {
  assets: PromptAssetTrace[]
  unknownKeys: string[]
}

/**
 * 按调用点声明顺序解析 Prompt 资产，并显式保留未知 key。
 *
 * 背景：真实 LLM 调用只应声明稳定 key，来源、版本和 locale 必须回到注册表解析。
 * 设计意图：去重但保留首次出现顺序，便于 Debug 还原本次组装链；未知 key 单独返回，
 *           避免注册表漏项被静默吞掉。
 * 关键约束：这里只投影元数据，不复制 Prompt 正文或动态插槽值。
 */
export function resolvePromptAssetTraces(keys: readonly string[]): PromptAssetResolution {
  const assetsByKey = new Map(getPromptAssets().map((asset) => [asset.key, asset]))
  const seen = new Set<string>()
  const assets: PromptAssetTrace[] = []
  const unknownKeys: string[] = []

  for (const key of keys) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    const asset = assetsByKey.get(key)
    if (!asset) {
      unknownKeys.push(key)
      continue
    }
    const { purpose, role, source, version, locale, mode, slots } = asset
    assets.push({ key, purpose, role, source, version, locale, mode, slots })
  }

  return { assets, unknownKeys }
}

/**
 * 根据当前 System Prompt 装配输入投影实际涉及的资产元数据。
 *
 * 背景：Debug 当前装配预览需要显示“这次为什么出现这些 Prompt”，但不能把完整正文再复制到追踪层。
 * 设计意图：稳定系统组装 key 与当前角色 Pack key 由真实注册表筛选，角色文件缺失时自动只返回存在的资产。
 * 关键约束：这里只返回来源 / 版本 / 插槽等元数据，不返回用户画像、会话内容或其他敏感动态值。
 */
export function getRuntimePromptAssetTraces(personaId: string): PromptAssetTrace[] {
  const rolePrefix = `role-${personaId}-`
  const keys = getPromptAssets()
    .filter((asset) => asset.key === 'system-layers' || asset.key.startsWith(rolePrefix))
    .map((asset) => asset.key)
  return getPromptAssetTraces(keys)
}
