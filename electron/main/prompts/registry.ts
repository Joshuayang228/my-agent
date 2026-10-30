import { extractTemplatePlaceholders } from '../../../src/shared/prompt-template'
import { buildMomentCommentPrompt } from './moment-comment'
import { buildMomentReplyPrompt } from './moment-reply'
import { buildProactiveGreetingPrompt } from './proactive-greeting'
import { formatRoleAppearanceForImagePrompt } from '../companion/identity/profile'
import { buildImageGenerationPrompt } from './image-generation'
import { buildImageDraftPrompt, buildWorldAssetImageDraftPrompt } from '../../../src/shared/request-draft-prompts'
/**
 * Prompt 资产目录的唯一运行时来源。
 *
 * 背景：Debug 需要回答“本次系统实际使用了什么 Prompt”，而不是只展示一组手写目录项。
 * 设计意图：注册表直接引用生产常量、Role Pack 和真实组装器来源；用稳定 key、用途、角色、版本
 * 与动态插槽描述资产，未来可在同一资产对象下扩展独立语言版本。
 * 关键约束：当前生产 locale 固定为 zh-CN；动态资产不在此复制一份运行时正文，Playground 只能载入隔离副本。
 */

import type {
  ModelContextAssetType,
  ModelContextContentKind,
  ModelContextOwnership,
  PromptAsset,
  PromptAssetKey,
  PromptAssetMode,
  PromptBehaviorMetadata,
  PromptAssetTrace,
  PromptSlot,
  PromptDomain,
} from '../../../src/shared/types'
import {
  DEFAULT_PLAYGROUND_SYSTEM,
  DEFAULT_SYSTEM_PROMPT,
  EXTRACTION_PROMPT,
  MODEL_SMOKE_PROMPT,
  MODEL_THINKING_PROBE_PROMPT,
  SESSION_TITLE_SYSTEM_PROMPT,
} from './texts'
import { EVAL_JUDGE_TEMPLATE } from './eval-judge'
import { modelContextFingerprint } from './fingerprint'
import { BEHAVIOR_CONTRACTS } from './behavior-contracts'
import { COMPANION_BEHAVIOR_TEMPLATES } from './companion-behaviors'
import { buildWorkspaceContextPrompt, buildSummonContextPrompt } from './runtime-context'
import { buildProfileExtractionInputPrompt } from './profile-extraction'
import { buildSubAgentPrompt, buildDeniedToolsPromptSuffix, OUTPUT_RECOVERY_PROMPT, buildTimeContextPrompt } from './agent-behaviors'
import { buildCompactPrompt, formatMinSetWhitelistForCompactPrompt, buildFileRestorePrompt, buildCompactSummaryPrompt, buildCompactHistoryPrompt } from './compact'
import { MAIN_CHAT_TEMPLATE, MAIN_CHAT_TEMPLATE_SLOTS, COMPANION_COMPILER_TEMPLATE } from './compiler'
import { PROMPT_KEYS, rolePromptAssetKey, type RolePromptSuffix } from './keys'
import { CONNECTION_TEST_MESSAGES } from '../../../src/shared/llm-connection-test'
import { getRoleSourceAssetCatalog } from '../companion/identity/source-assets'
import { listAvailableRoleIds, tryReadRoleText } from '../companion/identity/loader'
import { PROMPT_FEATURE_CONTRACTS } from './feature-contracts'

const PROMPT_LOCALE = 'zh-CN'
const DEFAULT_PROMPT_VERSION = '1.0.0'

type PromptAssetInput = {
  id: PromptAssetKey
  name: string
  category: PromptAsset['category']
  domain: PromptDomain
  desc: string
  sourcePath: string
  definitions?: string[]
  dependencies?: string[]
  purpose?: string
  role?: string
  roleIds?: string[]
  roleUses?: PromptAsset['roleUses']
  version?: string
  mode?: PromptAssetMode
  locale?: string
  slots?: PromptSlot[]
  semanticInputs?: PromptSlot[]
  behavior?: PromptBehaviorMetadata
  preview?: string
  content?: string
  template?: string
  assetType?: ModelContextAssetType
  ownership?: ModelContextOwnership
  contentKind?: ModelContextContentKind
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
 * 关键约束：默认只注册 zh-CN；动态资产可登记生产模板骨架，但最终插槽值只认真实调用记录。
 */
function normalizeAsset(input: PromptAssetInput): PromptAsset & { content?: string } {
  const mode: PromptAssetMode = input.mode ?? (input.dynamic ? 'dynamic' : 'static')
  const locale = input.locale ?? PROMPT_LOCALE
  const content = input.content
  const template = input.template
  // 多分支组装器可能有模板样本未覆盖的输入；保留已登记项，同时让新增真实占位符不能从目录消失。
  const slots = new Map((input.slots ?? []).map(slot => [slot.name, slot]))
  if (template !== undefined) {
    for (const name of extractTemplatePlaceholders(template)) {
      if (!slots.has(name)) slots.set(name, { name, source: `生产组装器：${input.sourcePath}`, lifecycle: '每次装配' })
    }
  }
  const fingerprintInput = content ?? template ?? JSON.stringify({
    key: input.id,
    source: input.sourcePath,
    version: input.version ?? DEFAULT_PROMPT_VERSION,
    preview: input.preview ?? '',
    slots: input.slots ?? [],
    behavior: input.behavior ?? null,
  })
  return {
    ...input,
    status: 'active',
    key: input.id,
    purpose: input.purpose ?? input.name,
    role: input.role ?? input.category,
    source: input.sourcePath,
    sourcePath: input.sourcePath,
    version: input.version ?? DEFAULT_PROMPT_VERSION,
    fingerprint: modelContextFingerprint(fingerprintInput),
    fingerprintKind: content !== undefined || template !== undefined ? 'content' : 'structure',
    assetType: input.assetType ?? 'prompt',
    ownership: input.ownership ?? 'builtin',
    contentKind: input.contentKind ?? (content !== undefined ? 'static' : template !== undefined ? 'template' : 'runtime'),
    mode,
    locale,
    locales: {
      [locale]: {
        ...(content !== undefined || template !== undefined ? { template: content ?? template } : {}),
      },
    },
    slots: [...slots.values()],
    ...(template !== undefined ? { semanticInputs: input.semanticInputs ?? input.slots ?? [] } : {}),
    ...(input.behavior ? { behavior: input.behavior } : {}),
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
  staticAsset({
    id: PROMPT_KEYS.compositionEngine,
    domain: 'platform', name: 'Prompt 分层组合器', category: 'system', role: 'prompt-composition',
    purpose: '按平台约束、功能协议、人物适配和运行时资料的固定顺序组合请求',
    desc: '组合器只负责结构与边界，不复制功能正文或人物事实。',
    sourcePath: 'electron/main/prompts/composition.ts#composeFeaturePrompt',
    definitions: ['electron/main/prompts/composition.ts#composeFeaturePrompt'],
    content: '平台约束 → 功能协议 → 人物适配 → 运行时资料 → 输出协议。',
  }),
  ...Object.values(PROMPT_FEATURE_CONTRACTS).map((item) => dynamicAsset({
    id: item.key as PromptAssetKey,
    domain: item.domain,
    name: `功能合同 · ${item.name}`,
    category: 'system',
    role: 'feature-contract',
    purpose: item.purpose,
    desc: `通用功能协议：${item.output} 回退：${item.fallback}`,
    sourcePath: 'electron/main/prompts/feature-contracts.ts#PROMPT_FEATURE_CONTRACTS',
    definitions: ['electron/main/prompts/feature-contracts.ts#PROMPT_FEATURE_CONTRACTS'],
    template: `功能目的：${item.purpose}\n输出：${item.output}\n回退：${item.fallback}`,
    slots: [...item.staticInputs, ...item.runtimeInputs].map(name => ({ name, source: '功能合同输入', lifecycle: '功能调用时' })),
  })),
  dynamicAsset({
    id: PROMPT_KEYS.momentComment,
    domain: 'social', name: '朋友圈角色评论', category: 'companion', role: 'companion-background',
    purpose: '基于公开名册回应已发布动态', desc: '仅润色已有确定性选中的评论者，不代替用户发言；无配置或校验失败保留原短句。',
    sourcePath: 'electron/main/prompts/moment-comment.ts#buildMomentCommentPrompt',
    definitions: ['electron/main/prompts/moment-comment.ts#buildMomentCommentPrompt', 'electron/main/prompts/registered-request.ts#compileMomentCommentRequest'],
    template: buildMomentCommentPrompt({ posterName: '{{posterName}}', postText: '{{postText}}', commenterName: '{{commenterName}}', commenterBrief: '{{commenterBrief}}' }),
    slots: [{ name: 'posterName', source: '已发布动态所属角色', lifecycle: '动态发布时' }, { name: 'postText', source: '已发布动态正文', lifecycle: '动态发布时' }, { name: 'commenterName', source: '确定性评论者选择', lifecycle: '动态发布时' }, { name: 'commenterBrief', source: 'buildRosterLines 公开关系摘要', lifecycle: '动态发布时' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.imageGeneration,
    domain: 'visual', name: '图片生成描述包装', category: 'tool', role: 'image-generation',
    purpose: '约束独立图片协议中的明确描述与人物事实', desc: '图片描述是运行时资料，包装与来源由专用配方签发，不增加文本模型请求。',
    sourcePath: 'electron/main/prompts/image-generation.ts#buildImageGenerationPrompt',
    definitions: ['electron/main/prompts/image-generation.ts#buildImageGenerationPrompt', 'electron/main/prompts/registered-request.ts#compileImageGenerationRequest', 'electron/main/companion/identity/profile.ts#formatRoleAppearanceForImagePrompt'],
    template: buildImageGenerationPrompt('{{description}}', '{{visualAnchor}}'),
    slots: [{ name: 'description', source: 'image_generate.prompt', lifecycle: '每次显式生成' }, { name: 'visualAnchor', source: '当前人物 appearance 与绑定穿搭资产（可为空）', lifecycle: '每次显式生成' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.momentReply,
    domain: 'social', name: '主角回复用户评论', category: 'companion', role: 'companion-social',
    purpose: '主角回复已保存的用户评论', desc: '只回复当前动态下的用户评论；生成失败不影响用户评论写入。',
    sourcePath: 'electron/main/prompts/moment-reply.ts#buildMomentReplyPrompt',
    definitions: ['electron/main/prompts/moment-reply.ts#buildMomentReplyPrompt', 'electron/main/prompts/registered-request.ts#compileMomentReplyRequest'],
    template: buildMomentReplyPrompt({ protagonistName: '{{protagonistName}}', protagonistBrief: '{{protagonistBrief}}', postText: '{{postText}}', userComment: '{{userComment}}' }),
    slots: [{ name: 'protagonistName', source: '当前主角 Role Pack', lifecycle: '评论提交时' }, { name: 'protagonistBrief', source: '当前主角公开简介', lifecycle: '评论提交时' }, { name: 'postText', source: '已发布动态正文', lifecycle: '评论提交时' }, { name: 'userComment', source: '刚保存的用户评论', lifecycle: '评论提交时' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.proactiveGreeting, domain: 'proactive', name: '个性化主动问候', category: 'companion', role: 'proactive-message',
    purpose: '依据已发布动态生成轻量主动问候', desc: '只在既有投递门闸允许且辅助模型可用时生成；失败回退确定性提醒。',
    sourcePath: 'electron/main/prompts/proactive-greeting.ts#buildProactiveGreetingPrompt',
    definitions: ['electron/main/prompts/proactive-greeting.ts#buildProactiveGreetingPrompt', 'electron/main/prompts/registered-request.ts#compileProactiveGreetingRequest'],
    template: buildProactiveGreetingPrompt({ roleName: '{{roleName}}', roleBrief: '{{roleBrief}}', momentText: '{{momentText}}' }),
    slots: [{ name: 'roleName', source: '当前主角 Role Pack', lifecycle: '投递前' }, { name: 'roleBrief', source: '当前主角公开简介与 voice', lifecycle: '投递前' }, { name: 'momentText', source: '已发布动态正文', lifecycle: '投递前' }],
  }),
  staticAsset({
    id: PROMPT_KEYS.imageDraft,
    domain: 'visual', name: '生图请求预填', category: 'ui', role: 'user-draft',
    purpose: '用户可编辑的图片请求草稿，不自动发送', desc: '点击聊天生图按钮时填入输入框。',
    sourcePath: 'src/shared/request-draft-prompts.ts#buildImageDraftPrompt',
    definitions: ['src/shared/request-draft-prompts.ts#buildImageDraftPrompt'], content: buildImageDraftPrompt(),
  }),
  dynamicAsset({
    id: PROMPT_KEYS.worldAssetImageDraft,
    domain: 'visual', name: '人物世界配图请求预填', category: 'ui', role: 'user-draft',
    purpose: '从明确资产进入可编辑的图片请求', desc: '用户发送后才进入正常对话与工具审批。',
    sourcePath: 'src/shared/request-draft-prompts.ts#buildWorldAssetImageDraftPrompt',
    definitions: ['src/shared/request-draft-prompts.ts#buildWorldAssetImageDraftPrompt'],
    template: buildWorldAssetImageDraftPrompt({ name: '{{assetName}}', id: '{{assetId}}' }),
    slots: [{ name: 'assetName', source: 'WorldHub 当前资产名称', lifecycle: '点击生成时' }, { name: 'assetId', source: 'WorldHub 当前资产 ID', lifecycle: '点击生成时' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.evalInput,
    domain: 'evaluation',
    definitions: ['electron/main/prompts/registered-request.ts#compileEvalSystem'], name: 'Eval 外部输入', category: 'system',
    desc: 'Eval 场景提供的实验正文与消息，不冒充生产人物或行为定义。',
    sourcePath: 'electron/main/prompts/registered-request.ts#compileEvalSystem',
    ownership: 'external', preview: '实验输入由 Eval 场景提供；真实正文只属于当次实验请求，不是生产目录正文。', slots: [{ name: 'scenarioInput', source: 'Eval 场景与测试夹具', lifecycle: '每次实验' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.profileExtractionInput,
    domain: 'memory', name: '画像提取输入包装', category: 'context',
    desc: '近期对话与已知用户事实的防重复包装；事实正文是运行时数据。', sourcePath: 'electron/main/prompts/profile-extraction.ts#buildProfileExtractionInputPrompt',
    definitions: ['electron/main/prompts/profile-extraction.ts#buildProfileExtractionInputPrompt'],
    template: buildProfileExtractionInputPrompt([{ id: 'template', role: 'user', content: '{{conversation}}', timestamp: 0 }], '{{existingFacts}}'),
    slots: [{ name: 'recentConversation', source: 'profile-extractor', lifecycle: '画像提取' }],
  }),
  staticAsset({
    id: PROMPT_KEYS.loopOutputRecovery,
    domain: 'platform', name: '回复截断恢复', category: 'system',
    desc: '达到输出长度限制时请求从中断处继续。', sourcePath: 'electron/main/prompts/agent-behaviors.ts#OUTPUT_RECOVERY_PROMPT',
    definitions: ['electron/main/prompts/agent-behaviors.ts#OUTPUT_RECOVERY_PROMPT'], content: OUTPUT_RECOVERY_PROMPT,
  }),
  dynamicAsset({
    id: PROMPT_KEYS.loopTimeContext,
    domain: 'platform', name: '当前时间参考', category: 'context',
    desc: '为本轮最后一条用户消息附加当前时间参考。', sourcePath: 'electron/main/prompts/agent-behaviors.ts#buildTimeContextPrompt',
    definitions: ['electron/main/prompts/agent-behaviors.ts#buildTimeContextPrompt'], template: buildTimeContextPrompt('{{time}}', '{{userMessage}}'),
  }),
  dynamicAsset({
    id: PROMPT_KEYS.compactRestoreContext,
    domain: 'memory', name: '压缩后上下文恢复', category: 'context',
    desc: '压缩后的摘要标识和近期文件恢复包装；原始内容是运行时数据。', sourcePath: 'electron/main/prompts/compact.ts',
    definitions: ['electron/main/prompts/registered-request.ts#compileContextMessage', 'electron/main/prompts/compact.ts#buildFileRestorePrompt', 'electron/main/prompts/compact.ts#buildCompactSummaryPrompt'],
    template: [buildFileRestorePrompt('{{fileContents}}'), buildCompactSummaryPrompt('{{summary}}')].join('\n\n'),
  }),
  dynamicAsset({
    id: PROMPT_KEYS.workspaceContext,
    domain: 'conversation', name: '工作区上下文', category: 'context',
    desc: '工作区项目、主会话参考和当前查看内容；不写入长期记忆。',
    sourcePath: 'electron/main/prompts/runtime-context.ts#buildWorkspaceContextPrompt',
    definitions: ['electron/main/prompts/runtime-context.ts#buildWorkspaceContextPrompt'],
    template: buildWorkspaceContextPrompt({ project: '{{project}}', transcript: '{{transcript}}', focus: { kind: 'file', path: '{{path}}', content: '{{content}}' } }),
    slots: [{ name: 'workspace', source: 'runtime workspace context', lifecycle: '每轮装配' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.companionCompiler,
    domain: 'life',
    definitions: ['electron/main/prompts/compiler.ts#compileCompanionBehaviorPrompt', 'electron/main/companion/identity/profile.ts#formatRoleProfileForPrompt', 'electron/main/companion/identity/profile.ts#formatRoleWorldDefaultsForPrompt'], name: '伙伴行为语义编译器', category: 'companion',
    purpose: '后台行为公共平台与人物模块编译', role: 'companion-background',
    desc: '四类后台行为共享的人物、信任边界和输出模块；领域正文来自各自生产定义。',
    sourcePath: 'electron/main/prompts/compiler.ts#compileCompanionBehaviorPrompt',
    template: COMPANION_COMPILER_TEMPLATE,
    slots: [{ name: 'facts', source: '行为服务事实输入', lifecycle: '每次行为' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.promptCompiler,
    domain: 'conversation',
    definitions: ['electron/main/prompts/registered-request.ts#compileMainSystem', 'electron/main/prompts/compiler.ts#compileMainChatPrompt', 'electron/main/prompts/compiler.ts#buildPlatformModule', 'electron/main/prompts/compiler.ts#buildCharacterModules', 'electron/main/prompts/compiler.ts#buildBehaviorModule', 'electron/main/prompts/compiler.ts#buildSituationModule', 'electron/main/prompts/compiler.ts#buildOutputModule', 'electron/main/companion/identity/profile.ts#formatRoleProfileForPrompt', 'electron/main/companion/identity/profile.ts#formatRoleWorldDefaultsForPrompt'],
    name: 'System Prompt 语义编译器',
    category: 'system',
    purpose: '主对话语义模块编译',
    role: 'system',
    desc: '主对话由语义模块编译器组装；具体一轮结果请在 Debug 或「载入当前实装」查看。',
    sourcePath: 'electron/main/prompts/compiler.ts',
    template: MAIN_CHAT_TEMPLATE,
    version: '1.1.0',
    slots: MAIN_CHAT_TEMPLATE_SLOTS,
    preview: '平台规则 · 人物定义 · 人物成长 · 行为定义 · 情境上下文 · 输出契约',
    semanticInputs: [
      { name: 'character', source: 'characterDefinitionFromRolePack', lifecycle: '每次装配' },
      { name: 'toolNames', source: 'ToolRegistry', lifecycle: '每次装配' },
      { name: 'userProfile', source: 'memory-store', lifecycle: '按需注入' },
      { name: 'companionContext', source: 'companion orchestrator', lifecycle: '按需注入' },
      { name: 'sessionInfo', source: 'runtime session context', lifecycle: '会话变更' },
      { name: 'dynamicState', source: 'runtime context', lifecycle: '每轮装配' },
    ],
  }),
  staticAsset({
    id: PROMPT_KEYS.loopDefault,
    domain: 'platform',
    definitions: ['electron/main/prompts/registered-request.ts#compileDefaultSystem', 'electron/main/prompts/registered-request.ts#compileAgentRequest', 'electron/main/prompts/texts.ts#DEFAULT_SYSTEM_PROMPT'],
    name: 'Loop 默认 System（无人格时）',
    category: 'system',
    purpose: 'Agent Loop 兜底 System',
    role: 'system',
    desc: 'Agent Loop 未注入自定义 system 时的兜底指令。',
    sourcePath: 'electron/main/prompts/texts.ts',
    content: DEFAULT_SYSTEM_PROMPT,
  }),
  staticAsset({
    id: PROMPT_KEYS.playgroundDefault,
    domain: 'evaluation',
    definitions: ['electron/main/prompts/registered-request.ts#compilePlaygroundRequest', 'electron/main/prompts/texts.ts#DEFAULT_PLAYGROUND_SYSTEM'],
    name: 'Playground 默认试验指令',
    category: 'system',
    purpose: 'Playground 隔离试跑',
    role: 'playground',
    desc: '对话试验 System 为空时使用；免伴侣上下文与工具。',
    sourcePath: 'electron/main/prompts/texts.ts',
    content: DEFAULT_PLAYGROUND_SYSTEM,
  }),
  dynamicAsset({
    id: PROMPT_KEYS.playgroundDraft,
    domain: 'evaluation',
    definitions: ['electron/main/prompts/registered-request.ts#compilePlaygroundRequest'],
    ownership: 'user',
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
    id: PROMPT_KEYS.playgroundModelTest,
    domain: 'evaluation',
    definitions: ['electron/main/prompts/registered-request.ts#compileModelProbeRequest', 'electron/main/prompts/texts.ts#MODEL_SMOKE_PROMPT', 'electron/main/prompts/texts.ts#MODEL_THINKING_PROBE_PROMPT'],
    name: 'Playground 模型能力探测',
    category: 'ui',
    purpose: '模型连通与 Thinking 能力探测',
    role: 'playground-model-test',
    desc: '模型测试页用于 smoke test 与 thinking.disabled 对比的短提示。',
    sourcePath: 'electron/main/agent/playground-model-test.ts',
    preview: '短文本探测，不注入主会话人格、记忆或工具。',
    template: `Smoke：${MODEL_SMOKE_PROMPT}\nThinking Probe：${MODEL_THINKING_PROBE_PROMPT}`,
    slots: [{ name: 'probePrompt', source: 'model test runner', lifecycle: '每次探测' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.l3Collapse,
    domain: 'memory',
    definitions: ['electron/main/prompts/registered-request.ts#compileCompactRequest', 'electron/main/prompts/compact.ts#buildCompactPrompt', 'electron/main/prompts/compact.ts#formatMinSetWhitelistForCompactPrompt', 'electron/main/prompts/compact.ts#buildCompactHistoryPrompt'],
    name: 'L3 Collapse 摘要指令',
    category: 'context',
    purpose: '中段上下文压缩',
    role: 'context-manager',
    desc: '上下文中段压缩时动态生成的结构化摘要指令。',
    sourcePath: 'electron/main/prompts/compact.ts#buildCompactPrompt',
    template: buildCompactPrompt('{{wordLimit}}', formatMinSetWhitelistForCompactPrompt()) + '\n\n' + buildCompactHistoryPrompt([{ id: 'template', role: 'user', content: '{{conversation}}', timestamp: 0 }]),
    preview: '当前任务 · 已完成步骤 · 当前状态 · 下一步计划 · 关键上下文',
    slots: [{ name: 'conversationWindow', source: 'context-manager', lifecycle: '每次压缩' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.l4Autocompact,
    domain: 'memory',
    definitions: ['electron/main/prompts/registered-request.ts#compileCompactRequest', 'electron/main/prompts/compact.ts#buildCompactPrompt', 'electron/main/prompts/compact.ts#formatMinSetWhitelistForCompactPrompt', 'electron/main/prompts/compact.ts#buildCompactHistoryPrompt'],
    name: 'L4 AutoCompact 全量摘要',
    category: 'context',
    purpose: '超长上下文全量摘要',
    role: 'context-manager',
    desc: '超长上下文的紧急全量摘要路径，与 L3 共用摘要管线。',
    sourcePath: 'electron/main/prompts/compact.ts#buildCompactPrompt',
    template: buildCompactPrompt('{{wordLimit}}', formatMinSetWhitelistForCompactPrompt()) + '\n\n' + buildCompactHistoryPrompt([{ id: 'template', role: 'user', content: '{{conversation}}', timestamp: 0 }]),
    preview: '综合摘要模式；字数上限和上下文范围随运行状态变化。',
    slots: [{ name: 'fullConversation', source: 'context-manager', lifecycle: '每次紧急压缩' }],
  }),
  staticAsset({
    id: PROMPT_KEYS.profileExtraction,
    domain: 'memory',
    version: '1.1.0',
    definitions: ['electron/main/prompts/registered-request.ts#compileProfileRequest', 'electron/main/prompts/texts.ts#EXTRACTION_PROMPT'],
    name: '用户画像提取',
    category: 'context',
    purpose: '用户画像提取',
    role: 'profile-extractor',
    desc: '后台从近期对话提取可长期复用的用户信息。',
    sourcePath: 'electron/main/prompts/texts.ts',
    content: EXTRACTION_PROMPT,
  }),
  dynamicAsset({
    id: PROMPT_KEYS.userProfileContext,
    domain: 'memory',
    name: '用户画像上下文注入',
    category: 'context',
    purpose: '主对话用户画像注入',
    role: 'memory-runtime',
    desc: '把 identity / workflow / voice 用户画像切片注入主 System Prompt。',
    sourcePath: 'electron/main/storage/memory-store.ts',
    preview: '按当前主角分桶读取用户画像；最终正文只在当前装配或真实 LLM 调用中显示。',
    slots: [{ name: 'userProfile', source: 'memory-store', lifecycle: '每次主对话装配' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.memoryRecallContext,
    domain: 'memory',
    name: '向量记忆召回上下文',
    category: 'context',
    purpose: '主对话相关记忆注入',
    role: 'memory-runtime',
    desc: '将向量检索命中的记忆片段格式化后注入主 System Prompt。',
    sourcePath: 'electron/main/memory/vector-store.ts',
    preview: '只在检索命中时注入；实际记忆正文与引用在真实调用和记忆引用事件中查看。',
    slots: [{ name: 'memoryRecall', source: 'vector-store', lifecycle: '每次主对话检索' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.embeddingInput,
    domain: 'memory',
    name: 'Embedding 输入（非聊天 Prompt）',
    category: 'context',
    purpose: '记忆与查询文本向量化',
    role: 'embedding-runtime',
    desc: '原始记忆或查询文本直接发送 Embeddings API；没有独立 System 指令。',
    sourcePath: 'electron/main/memory/embeddings.ts',
    definitions: ['electron/main/memory/embeddings.ts#createEmbedding', 'electron/main/memory/embeddings.ts#createEmbeddings'],
    preview: '这是模型输入资产而非聊天 Prompt；目录不展示用户原文。',
    slots: [{ name: 'embeddingText', source: 'memory/query text', lifecycle: '每次向量化' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.sessionTitle,
    domain: 'platform',
    definitions: ['electron/main/prompts/registered-request.ts#compileTitleRequest', 'electron/main/prompts/texts.ts#SESSION_TITLE_SYSTEM_PROMPT'],
    name: '会话标题生成',
    category: 'context',
    purpose: '新会话标题生成',
    role: 'session-store',
    desc: '根据首轮用户与助手文本生成 4–10 字中文标题。',
    sourcePath: 'electron/main/storage/session-store.ts',
    template: SESSION_TITLE_SYSTEM_PROMPT,
    preview: '只返回短标题，不注入完整会话历史。',
    slots: [{ name: 'openingTurn', source: 'session messages', lifecycle: '新会话首轮' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.connectionTest,
    domain: 'platform',
    definitions: ['electron/main/prompts/registered-request.ts#compileConnectionRequest', 'src/shared/llm-connection-test.ts#CONNECTION_TEST_MESSAGES'],
    name: '模型连接测试',
    category: 'ui',
    purpose: '设置页模型连接验证',
    role: 'settings',
    desc: '用固定短消息验证 Provider、Base URL、API Key 与模型是否可调用。',
    sourcePath: 'src/shared/llm-connection-test.ts',
    template: CONNECTION_TEST_MESSAGES.map((message) => `[${message.role}] ${message.content}`).join('\n\n'),
    preview: '只验证连接与最小正文返回，不进入真实会话。',
    slots: [{ name: 'connectionProbe', source: 'settings IPC', lifecycle: '每次测试' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.settingsSystemPrompt,
    domain: 'platform',
    ownership: 'user',
    name: '设置中的 System 补充指令',
    category: 'system',
    purpose: '主对话行为补充指令',
    role: 'system',
    desc: '用户拥有的 System 补充指令，编译到行为模块；不能覆盖平台规则、稳定身份或输出协议。',
    sourcePath: 'electron/main/storage/settings-store.ts',
    preview: '正文来自 settings.systemPrompt；Debug 调用详情可查看本次实发内容。',
    slots: [{ name: 'systemPrompt', source: 'settings.systemPrompt', lifecycle: '设置变更' }],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.replyStance,
    domain: 'conversation',
    version: '1.1.0',
    definitions: ['electron/main/agent/reply-stance.ts#formatReplyStanceForPrompt'],
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
    id: PROMPT_KEYS.toneControl,
    domain: 'conversation',
    definitions: ['electron/main/agent/tone-control.ts#formatToneControlForPrompt'],
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
    id: PROMPT_KEYS.relationshipStage,
    domain: 'character',
    definitions: ['electron/main/companion/growth/relationship-stage.ts#formatRelationshipStageForPrompt', 'electron/main/companion/growth/familiarity-mix.ts#formatFamiliarityMixForPrompt'],
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
    id: PROMPT_KEYS.relationshipMilestones,
    domain: 'character',
    definitions: ['electron/main/companion/growth/milestones.ts#formatMilestonesForPrompt', 'electron/main/companion/growth/milestones.ts#getMilestonePromptHint'],
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
    id: PROMPT_KEYS.expertiseLevel,
    domain: 'conversation',
    definitions: ['electron/main/agent/expertise-level.ts#formatExpertiseLevelForPrompt'],
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
    id: PROMPT_KEYS.skillContext,
    domain: 'tools',
    definitions: ['electron/main/skills/registry.ts#buildSkillSummaryForPrompt', 'electron/main/prompts/runtime-context.ts#buildActiveSkillPrompt'],
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
    id: PROMPT_KEYS.companionContext,
    domain: 'life',
    definitions: ['electron/main/companion/life/assets.ts#formatBookshelfSliceForPrompt', 'electron/main/companion/life/moment-consistency.ts#formatRecentMomentsForPrompt', 'electron/main/companion/life/world-codec.ts#formatWorldSliceForPrompt', 'electron/main/companion/cast/roster.ts#formatRosterForPrompt', 'electron/main/companion/cast/scene-prompts.ts#defaultCastScenePrompt', 'electron/main/companion/cast/scene-prompts.ts#loadCastScenePrompt', 'electron/main/companion/cast/scene-prompts.ts#formatSummonSceneBlock', 'electron/main/companion/cast/summon-delegation.ts#summonParentDelegationHint', 'electron/main/prompts/runtime-context.ts#buildSummonContextPrompt'],
    template: buildSummonContextPrompt('{{presence}}', '{{delegation}}', '{{scene}}'),
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
      { name: 'bookshelfSlice', source: 'electron/main/companion/life/assets.ts#formatBookshelfSliceForPrompt', lifecycle: '按需注入有界摘要，资产正文独立保存' },
      { name: 'rosterLines', source: 'cast store', lifecycle: '按需注入' },
    ],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.companionMutableState,
    domain: 'character',
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
    id: PROMPT_KEYS.companionReflection,
    domain: 'memory',
    dependencies: [PROMPT_KEYS.companionCompiler],
    definitions: ['electron/main/prompts/registered-request.ts#compileReflectionRequest', 'electron/main/prompts/companion-behaviors.ts#buildReflectionPrompt'],
    name: '伙伴反思更新 Prompt',
    category: 'companion',
    purpose: '角色 MUTABLE 反思更新',
    role: 'companion-background',
    desc: '根据近期互动判断是否更新角色可成长状态。',
    sourcePath: 'electron/main/prompts/companion-behaviors.ts#buildReflectionPrompt',
    template: COMPANION_BEHAVIOR_TEMPLATES[PROMPT_KEYS.companionReflection],
    preview: '输出结构化反思结果；不复用主对话 System Prompt。',
    slots: [{ name: 'reflectionInput', source: 'recent interaction', lifecycle: '每次反思' }],
    behavior: BEHAVIOR_CONTRACTS[PROMPT_KEYS.companionReflection],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.companionCatchup,
    domain: 'life',
    dependencies: [PROMPT_KEYS.companionCompiler],
    definitions: ['electron/main/prompts/registered-request.ts#compileCatchupRequest', 'electron/main/prompts/companion-behaviors.ts#buildCatchupLlmPrompt'],
    name: '伙伴生活补叙 Prompt',
    category: 'companion',
    purpose: '暂停期间生活补叙',
    role: 'companion-background',
    desc: '根据角色与暂停区间生成可校验的 Catch-up 摘要。',
    sourcePath: 'electron/main/prompts/companion-behaviors.ts#buildCatchupLlmPrompt',
    template: COMPANION_BEHAVIOR_TEMPLATES[PROMPT_KEYS.companionCatchup],
    preview: '输出暂停期间的生活摘要，不改写主会话 Prompt。',
    slots: [{ name: 'catchupWindow', source: 'companion lifecycle', lifecycle: '恢复时' }],
    behavior: BEHAVIOR_CONTRACTS[PROMPT_KEYS.companionCatchup],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.companionMomentPolish,
    domain: 'social',
    dependencies: [PROMPT_KEYS.companionCompiler],
    definitions: ['electron/main/prompts/registered-request.ts#compileMomentRequest', 'electron/main/prompts/companion-behaviors.ts#buildPolishPrompt'],
    name: '伙伴 Moment 润色 Prompt',
    category: 'companion',
    purpose: '已发布 Moment 文案润色',
    role: 'companion-background',
    desc: '在规则文案基础上按角色语气生成简短生活动态。',
    sourcePath: 'electron/main/prompts/companion-behaviors.ts#buildPolishPrompt',
    template: COMPANION_BEHAVIOR_TEMPLATES[PROMPT_KEYS.companionMomentPolish],
    preview: '只润色已有事件，不新增未发生的事实。',
    slots: [{ name: 'momentEvent', source: 'published life event', lifecycle: '每次发布' }],
    behavior: BEHAVIOR_CONTRACTS[PROMPT_KEYS.companionMomentPolish],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.companionDayScript,
    domain: 'life',
    dependencies: [PROMPT_KEYS.companionCompiler],
    definitions: ['electron/main/prompts/registered-request.ts#compileDayRequest', 'electron/main/prompts/companion-behaviors.ts#buildLlmPrompt'],
    name: '伙伴日程剧本 Prompt',
    category: 'companion',
    purpose: '角色日程剧本生成',
    role: 'companion-background',
    desc: '结合人物档案与世界默认值生成结构化日程脚本。',
    sourcePath: 'electron/main/prompts/companion-behaviors.ts#buildLlmPrompt',
    template: COMPANION_BEHAVIOR_TEMPLATES[PROMPT_KEYS.companionDayScript],
    preview: '输出结构化日程载荷，后续仍需规则校验。',
    slots: [{ name: 'dayContext', source: 'role pack and world state', lifecycle: '每日生成' }],
    behavior: BEHAVIOR_CONTRACTS[PROMPT_KEYS.companionDayScript],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.evalJudge,
    domain: 'evaluation',
    definitions: ['electron/main/prompts/registered-request.ts#compileJudgeRequest', 'electron/main/prompts/eval-judge.ts#buildEvalJudgePrompt'],
    name: 'Eval Model Judge Prompt',
    assetType: 'eval-judge',
    category: 'eval',
    purpose: 'Persona / 行为 Eval 单次 Judge',
    role: 'eval-judge',
    desc: '用陌生用户视角逐项判断违规，输出 VIOLATION_FOUND / NOT_FOUND / UNKNOWN。',
    sourcePath: 'electron/main/prompts/eval-judge.ts',
    template: EVAL_JUDGE_TEMPLATE,
    slots: [
      { name: 'systemContext', source: 'Eval scenario', lifecycle: '每次 Judge' },
      { name: 'agentTexts', source: 'Eval transcript', lifecycle: '每次 Judge' },
      { name: 'checkList', source: 'Violation checks', lifecycle: '每次 Judge' },
    ],
  }),
  dynamicAsset({
    id: PROMPT_KEYS.subagentSystem,
    domain: 'tools',
    template: buildSubAgentPrompt('{{roleDescription}}', '{{summonBoundary}}'),
    definitions: ['electron/main/prompts/registered-request.ts#compileSubagentSystem', 'electron/main/prompts/agent-behaviors.ts#buildSubAgentPrompt', 'electron/main/agent/subagent.ts#buildSubAgentSystemPrompt', 'electron/main/companion/cast/summon-delegation.ts#summonWorkerSystemAddon'],
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
    id: PROMPT_KEYS.permissionDenial,
    domain: 'platform',
    definitions: ['electron/main/prompts/agent-behaviors.ts#buildDeniedToolsPromptSuffix'],
    template: buildDeniedToolsPromptSuffix([{ name: '{{tool}}', reason: '{{reason}}' }], [{ command: '{{command}}', reason: '{{reason}}' }]),
    name: '权限拒绝后的继续策略',
    category: 'system',
    purpose: '权限拒绝后的继续策略',
    role: 'agent-loop',
    desc: '工具或命令被拒绝后注入 Loop 的替代方案提示，并在连续拒绝时停止本轮。',
    sourcePath: 'electron/main/prompts/agent-behaviors.ts#buildDeniedToolsPromptSuffix',
    preview: '不要重试同一动作；换个方式或询问用户如何继续。',
    slots: [{ name: 'deniedTool', source: 'permission engine', lifecycle: '每次拒绝' }],
  }),
]

const ROLE_PROMPT_FILES = [
  { suffix: 'protected.md', label: 'PROTECTED 人格正文', domain: 'character' },
  { suffix: 'mutable.default.md', label: 'MUTABLE 默认状态', domain: 'character' },
  { suffix: 'voice.md', label: '语气补充', domain: 'character' },
  { suffix: 'summary.txt', label: '角色摘要', domain: 'character' },
  { suffix: 'scenes/display.md', label: '展示场景', domain: 'life' },
  { suffix: 'scenes/interact.md', label: '互动场景', domain: 'social' },
  { suffix: 'scenes/execute.md', label: '执行场景', domain: 'conversation' },
  { suffix: 'behaviors/moment-polish.md', label: 'Moment 行为补充', domain: 'social' },
  { suffix: 'behaviors/day-script.md', label: '日程行为补充', domain: 'life' },
  { suffix: 'behaviors/catchup.md', label: '补叙行为补充', domain: 'life' },
  { suffix: 'behaviors/reflection.md', label: '反思行为补充', domain: 'memory' },
] as const

let roleSourceAssetsCache: PromptAsset[] | undefined
let roleAssetsCache: Array<PromptAsset & { content: string }> | undefined

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
          id: rolePromptAssetKey(roleId, file.suffix as RolePromptSuffix),
          name: `${roleId} · ${file.label}`,
          category: 'companion',
          purpose: `角色 Pack · ${file.label}`,
          role: roleId,
          roleIds: [roleId],
          domain: file.domain,
          roleUses: [{ roleId, purpose: file.suffix === 'mutable.default.md' ? '成长与关系' : file.suffix === 'protected.md' || file.suffix === 'summary.txt' ? '身份' : file.suffix.startsWith('scenes/') ? '生活情境' : '行为' }],
          desc: `角色 Pack 的 ${file.label}，由 Identity loader 读取。`,
          sourcePath: `electron/main/companion/universes/default/roles/${roleId}/${file.suffix}`,
          version: 'role-pack-1.0.0',
          ownership: 'role-pack',
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
  return [...CORE_PROMPT_ASSETS, ...loadRoleAssets(), ...(roleSourceAssetsCache ??= getRoleSourceAssetCatalog())]
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
  return getPromptAssets().map(({ key, purpose, role, domain, source, version, fingerprint, fingerprintKind, locale, mode, slots, behavior }) => ({
    key,
    purpose,
    role,
    domain,
    source,
    version,
    fingerprint,
    fingerprintKind,
    locale,
    mode,
    slots,
    ...(behavior ? { behavior } : {}),
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
    const { purpose, role, domain, source, version, fingerprint, fingerprintKind, locale, mode, slots, behavior } = asset
    assets.push({ key, purpose, role, domain, source, version, fingerprint, fingerprintKind, locale, mode, slots, ...(behavior ? { behavior } : {}) })
  }

  return { assets, unknownKeys }
}
