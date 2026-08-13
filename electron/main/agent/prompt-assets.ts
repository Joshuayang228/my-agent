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
import { DEFAULT_SYSTEM_PROMPT } from './loop'
import { DEFAULT_PLAYGROUND_SYSTEM } from './playground'
import { EXTRACTION_PROMPT } from './profile-extractor'
import { loadUniverseManifest, tryReadRoleText } from '../companion/identity/loader'

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
    sourcePath: 'electron/main/agent/loop.ts',
    content: DEFAULT_SYSTEM_PROMPT,
  }),
  staticAsset({
    id: 'playground-default',
    name: 'Playground 默认试验指令',
    category: 'system',
    purpose: 'Playground 隔离试跑',
    role: 'playground',
    desc: '对话试验 System 为空时使用；免伴侣上下文与工具。',
    sourcePath: 'electron/main/agent/playground.ts',
    content: DEFAULT_PLAYGROUND_SYSTEM,
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
    sourcePath: 'electron/main/agent/profile-extractor.ts',
    content: EXTRACTION_PROMPT,
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

function roleAssetKey(roleId: string, suffix: string): string {
  return `role-${roleId}-${suffix.replace(/[^a-z0-9]+/gi, '-')}`
}

function loadRoleAssets(): Array<PromptAsset & { content: string }> {
  try {
    const manifest = loadUniverseManifest()
    const assets: Array<PromptAsset & { content: string }> = []
    for (const roleId of manifest.protagonistIds) {
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
    return assets
  } catch {
    return []
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
 * 关键约束：未知 key 被忽略，调用方可根据实际组装结果筛选；正文脱敏由更上层负责。
 */
export function getPromptAssetTraces(keys?: readonly string[]): PromptAssetTrace[] {
  const assets = getPromptAssets()
  const wanted = keys ? new Set(keys) : undefined
  return assets
    .filter((asset) => !wanted || wanted.has(asset.key))
    .map(({ key, purpose, role, source, version, locale, mode, slots }) => ({
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
