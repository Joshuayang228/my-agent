import { buildMomentCommentPrompt, type MomentCommentInput } from './moment-comment'
import { buildMomentReplyPrompt, type MomentReplyInput } from './moment-reply'
import { buildImageGenerationPrompt } from './image-generation'
/**
 * 背景：手填资产 key 无法证明正文来自登记的生产定义。
 * 设计意图：只有固定行为配方可以签发请求；模型入口通过私有身份表读取冻结快照，
 * 而不是相信调用方提供的正文、key 或 TypeScript 类型断言。
 * 关键约束：禁止导出通用签发器；实验来源不能冒充生产，消息和来源必须一同冻结。
 */
import type { ChatMessage, PromptAssetKey, PromptAssetKeyList, RegisteredModelRequest, RegisteredSystemPrompt } from '../../../src/shared/types'
import type { RolePack } from '../companion/types'
import { characterDefinitionFromRolePack, compileMainChatPrompt, type MainChatPromptRequest } from './compiler'
import { getCharacterPromptAssetKeys, getSummonSceneAssetKeys } from './dependencies'
import { PROMPT_KEYS, ROLE_BEHAVIOR_IDS, ROLE_BEHAVIOR_PROMPT_SUFFIX, rolePromptAssetKey } from './keys'
import { DEFAULT_SYSTEM_PROMPT, EXTRACTION_PROMPT, SESSION_TITLE_SYSTEM_PROMPT, MODEL_SMOKE_PROMPT, MODEL_THINKING_PROBE_PROMPT } from './texts'
import { CONNECTION_TEST_MESSAGES } from '../../../src/shared/llm-connection-test'
import { buildDeniedToolsPromptSuffix, buildSubAgentPrompt, buildTimeContextPrompt, OUTPUT_RECOVERY_PROMPT } from './agent-behaviors'
import { AGENT_ROLES } from './subagent-roles'
import { summonWorkerSystemAddon } from '../companion/cast/summon-delegation'
import { buildCompactPrompt, buildCompactHistoryPrompt, formatMinSetWhitelistForCompactPrompt, buildFileRestorePrompt, buildCompactSummaryPrompt } from './compact'
import { buildProfileExtractionInputPrompt } from './profile-extraction'
import { buildPolishPrompt, buildCatchupLlmPrompt, buildLlmPrompt, buildReflectionPrompt } from './companion-behaviors'
import { buildPlaygroundMessages } from './playground'
import { buildEvalJudgePrompt } from './eval-judge'

type SimpleMessage = { role: ChatMessage['role']; content: string }
type RequestSnapshot = { messages: ChatMessage[]; promptAssetKeys: PromptAssetKeyList; scope: RegisteredModelRequest['scope']; callers: readonly string[] }
const systemProofs = new WeakMap<RegisteredSystemPrompt, { text: string; promptAssetKeys: PromptAssetKeyList; scope: RegisteredSystemPrompt['scope'] }>()
const requestProofs = new WeakMap<RegisteredModelRequest, RequestSnapshot>()
const contextProofs = new WeakMap<ChatMessage, string>()

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}

/** 背景：Loop 会复用 System；意图：正文和来源一起冻结；约束：签发器私有，不能给任意外部正文挂生产 key。 */
function signSystem(text: string, keys: PromptAssetKeyList, scope: RegisteredSystemPrompt['scope'] = 'production'): RegisteredSystemPrompt {
  const snapshot = freezeDeep({ text, promptAssetKeys: [keys[0], ...[...new Set(keys)].filter(key => key !== keys[0])] as PromptAssetKeyList, scope })
  const proof = snapshot as RegisteredSystemPrompt
  systemProofs.set(proof, snapshot)
  return proof
}

/** 背景：输入历史会继续变化；意图：签发时复制消息并冻结，避免校验后替换正文；约束：只由本文件固定配方调用，实验调用行为不能放宽。 */
function signRequest(messages: Array<SimpleMessage | ChatMessage>, keys: PromptAssetKeyList, callers: readonly string[], scope: RegisteredModelRequest['scope'] = 'production'): RegisteredModelRequest {
  const normalized = messages.map((m, i) => ({ id: `compiled-${i}`, timestamp: Date.now(), ...m }))
  const snapshot = freezeDeep({ messages: structuredClone(normalized), promptAssetKeys: [keys[0], ...[...new Set(keys)].filter(key => key !== keys[0])] as PromptAssetKeyList, scope, callers: [...callers] })
  const proof = Object.freeze({ messages: snapshot.messages, promptAssetKeys: snapshot.promptAssetKeys, scope }) as unknown as RegisteredModelRequest
  requestProofs.set(proof, snapshot)
  return proof
}

/** 背景：类型断言可以伪造形状；意图：校验私有身份并返回副本给 Provider；约束：验证必须先于 Trace / 网络，复制或序列化对象不具备身份。 */
export function readRegisteredModelRequest(request: RegisteredModelRequest, caller?: string): Omit<RequestSnapshot, 'callers'> {
  const snapshot = requestProofs.get(request)
  if (!snapshot) throw new Error('模型请求必须由已注册的编译入口生成')
  if (caller !== undefined && !snapshot.callers.includes(caller)) throw new Error('模型请求来源与调用行为不一致')
  return structuredClone({ messages: snapshot.messages, promptAssetKeys: snapshot.promptAssetKeys, scope: snapshot.scope })
}

export function readRegisteredSystemText(prompt: RegisteredSystemPrompt): string {
  const snapshot = systemProofs.get(prompt)
  if (!snapshot) throw new Error('System Prompt 必须由已注册的编译入口生成')
  return snapshot.text
}

export function compileDefaultSystem(): RegisteredSystemPrompt {
  return signSystem(DEFAULT_SYSTEM_PROMPT, [PROMPT_KEYS.loopDefault])
}

type MainRuntimeInput = Omit<MainChatPromptRequest, 'character' | 'output' | 'behavior'> & {
  behavior: Omit<MainChatPromptRequest['behavior'], 'key' | 'purpose' | 'policy' | 'characterSupplement'>
}

/** 背景：主对话来源容易漏记人物和可选插槽；意图：固定行为定义、自动推导实际依赖；约束：输入只提供运行时插槽，不能覆盖输出协议或添加任意行为正文。 */
export function compileMainSystem(pack: RolePack, growth: string, input: MainRuntimeInput, sessionKind = 'main'): RegisteredSystemPrompt {
  const b = input.behavior
  const s = input.situation
  const keys: [PromptAssetKey, ...PromptAssetKey[]] = [PROMPT_KEYS.promptCompiler, ...getCharacterPromptAssetKeys(pack, growth)]
  if (sessionKind === 'summon') keys.push(...getSummonSceneAssetKeys(pack))
  if (sessionKind === 'workspace') keys.push(PROMPT_KEYS.workspaceContext)
  if (b.customInstructions?.trim()) keys.push(PROMPT_KEYS.settingsSystemPrompt)
  if (b.replyStance?.trim()) keys.push(PROMPT_KEYS.replyStance)
  if (b.toneControl?.trim()) keys.push(PROMPT_KEYS.toneControl)
  if (b.relationshipStage?.trim()) keys.push(PROMPT_KEYS.relationshipStage)
  if (b.milestone?.trim()) keys.push(PROMPT_KEYS.relationshipMilestones)
  if (b.expertise?.trim()) keys.push(PROMPT_KEYS.expertiseLevel)
  if (b.skillSummary?.trim() || b.activeSkillBody?.trim()) keys.push(PROMPT_KEYS.skillContext)
  if (s?.userProfile && Object.values(s.userProfile).some(v => v.trim())) keys.push(PROMPT_KEYS.userProfileContext)
  if (s?.memories?.trim()) keys.push(PROMPT_KEYS.memoryRecallContext)
  if ([s?.catchupSummary, s?.worldSlice, s?.recentMomentsSlice, s?.bookshelfSlice, s?.rosterLines, sessionKind === 'summon' ? s?.sessionInfo : ''].some(v => v?.trim())) keys.push(PROMPT_KEYS.companionContext)
  if (['key', 'purpose', 'policy', 'characterSupplement'].some(key => key in b)) throw new Error('主对话编译入口只接受已定义的运行时插槽')
  const compiled = compileMainChatPrompt({
    platform: input.platform,
    situation: input.situation,
    currentDate: input.currentDate,
    behavior: { ...b, key: 'main-chat', purpose: '在当前人物与会话情境中回应用户并完成请求。' },
    character: characterDefinitionFromRolePack(pack, growth),
  })
  return signSystem(compiled.text, keys)
}

export function compileSubagentSystem(role: string, sessionKind?: string): RegisteredSystemPrompt {
  const addon = summonWorkerSystemAddon(sessionKind)
  return signSystem(buildSubAgentPrompt(AGENT_ROLES[role]?.systemPromptAddon ?? role, addon ? `\n\n${addon}` : ''), [PROMPT_KEYS.subagentSystem])
}

/** Eval 的自定义正文是显式实验数据；调用者不能给它指定生产资产 key。 */
export function compileEvalSystem(text: string): RegisteredSystemPrompt {
  return signSystem(text, [PROMPT_KEYS.evalInput], 'eval')
}

/** 背景：压缩追加系统消息；意图：上下文管理器签发真实包装并保持消息身份；约束：复制对象或修改正文会失去证明，压缩元数据允许后续补齐。 */
export function compileContextMessage(kind: 'summary' | 'auto-summary' | 'files', data: string): ChatMessage {
  const id = kind === 'summary' ? 'context-summary' : kind === 'auto-summary' ? 'auto-compact-summary' : 'context-file-restore'
  const content = kind === 'summary' ? data : kind === 'auto-summary' ? buildCompactSummaryPrompt(data) : buildFileRestorePrompt(data)
  const message: ChatMessage = { id, role: 'system', content, timestamp: Date.now() }
  contextProofs.set(message, content)
  return message
}

/** 背景：Loop 每轮会追加时间、拒绝与恢复包装；意图：由固定配方生成包装和来源，不信任历史中替换的主正文；约束：额外系统消息必须来自上下文管理器，同 ID 不能充当证明。 */
export function compileAgentRequest(input: {
  systemPrompt: RegisteredSystemPrompt
  messages: ChatMessage[]
  deniedTools: Parameters<typeof buildDeniedToolsPromptSuffix>[0]
  deniedCommands: NonNullable<Parameters<typeof buildDeniedToolsPromptSuffix>[1]>
  time?: string
}): RegisteredModelRequest {
  const base = systemProofs.get(input.systemPrompt)
  if (!base) throw new Error('System Prompt 必须由已注册的编译入口生成')
  const messages = structuredClone(input.messages)
  const keys: [PromptAssetKey, ...PromptAssetKey[]] = [base.promptAssetKeys[0], ...base.promptAssetKeys.slice(1)]
  if (messages[0]?.id !== 'system' || messages[0]?.role !== 'system') throw new Error('Agent 请求缺少主 System Prompt')
  messages[0].content = base.text + buildDeniedToolsPromptSuffix(input.deniedTools, input.deniedCommands)
  if (input.deniedTools.length || input.deniedCommands.length) keys.push(PROMPT_KEYS.permissionDenial)
  for (let index = 1; index < messages.length; index++) {
    const message = messages[index]
    if (message.role === 'system' && contextProofs.get(input.messages[index]) !== message.content) throw new Error('Agent 历史中含有未登记的系统指令入口')
    if (message.id.startsWith('user-recovery-')) {
      message.content = OUTPUT_RECOVERY_PROMPT
      keys.push(PROMPT_KEYS.loopOutputRecovery)
    }
    if (message.role === 'system') keys.push(PROMPT_KEYS.compactRestoreContext)
  }
  const last = messages.at(-1)
  if (input.time && last?.role === 'user') {
    last.content = buildTimeContextPrompt(input.time, last.content)
    keys.push(PROMPT_KEYS.loopTimeContext)
  }
  return signRequest(messages, keys, [base.scope === 'eval' ? 'eval-agent' : 'main'], base.scope)
}

type BehaviorInput<F extends (...args: never[]) => string> = Omit<Parameters<F>[0], 'character' | 'behaviorPrompt'>
/** 背景：四类行为共用人物文件，语气可能回退到摘要；意图：在配方内投影实际依赖；约束：只有实际注入的行为增量与回退来源才能登记为使用。 */
function behaviorKeys(pack: RolePack, kind: keyof typeof ROLE_BEHAVIOR_IDS, growth?: string): PromptAssetKeyList {
  const keys: [PromptAssetKey, ...PromptAssetKey[]] = [({ momentPolish: PROMPT_KEYS.companionMomentPolish, catchup: PROMPT_KEYS.companionCatchup, dayScript: PROMPT_KEYS.companionDayScript, reflection: PROMPT_KEYS.companionReflection })[kind], PROMPT_KEYS.companionCompiler, ...getCharacterPromptAssetKeys(pack, growth)]
  if (kind !== 'reflection' && !pack.voice?.trim() && pack.summary?.trim()) keys.push(rolePromptAssetKey(pack.id, 'summary.txt'))
  if (pack.behaviorPrompts?.[ROLE_BEHAVIOR_IDS[kind]]) keys.push(rolePromptAssetKey(pack.id, ROLE_BEHAVIOR_PROMPT_SUFFIX[kind]))
  return keys
}
export function compileMomentRequest(pack: RolePack, input: BehaviorInput<typeof buildPolishPrompt>): RegisteredModelRequest {
  return signRequest([{ role: 'user', content: buildPolishPrompt({ ...input, character: characterDefinitionFromRolePack(pack), behaviorPrompt: pack.behaviorPrompts?.[ROLE_BEHAVIOR_IDS.momentPolish] }) }], behaviorKeys(pack, 'momentPolish'), ['moment-polish'])
}
export function compileCatchupRequest(pack: RolePack, input: BehaviorInput<typeof buildCatchupLlmPrompt>): RegisteredModelRequest {
  return signRequest([{ role: 'user', content: buildCatchupLlmPrompt({ ...input, character: characterDefinitionFromRolePack(pack), behaviorPrompt: pack.behaviorPrompts?.[ROLE_BEHAVIOR_IDS.catchup] }) }], behaviorKeys(pack, 'catchup'), ['catchup-summary'])
}
export function compileDayRequest(pack: RolePack, input: BehaviorInput<typeof buildLlmPrompt>): RegisteredModelRequest {
  return signRequest([{ role: 'user', content: buildLlmPrompt({ ...input, character: characterDefinitionFromRolePack(pack), behaviorPrompt: pack.behaviorPrompts?.[ROLE_BEHAVIOR_IDS.dayScript] }) }], behaviorKeys(pack, 'dayScript'), ['day-script'])
}
export function compileReflectionRequest(pack: RolePack, input: BehaviorInput<typeof buildReflectionPrompt>): RegisteredModelRequest {
  return signRequest([{ role: 'user', content: buildReflectionPrompt({ ...input, character: characterDefinitionFromRolePack(pack, input.currentMutable), behaviorPrompt: pack.behaviorPrompts?.[ROLE_BEHAVIOR_IDS.reflection] }) }], behaviorKeys(pack, 'reflection', input.currentMutable), ['persona-reflection'])
}
export function compileCompactRequest(messages: ChatMessage[], comprehensive: boolean): RegisteredModelRequest {
  return signRequest([{ role: 'system', content: buildCompactPrompt(comprehensive ? 500 : 300, formatMinSetWhitelistForCompactPrompt()) }, { role: 'user', content: buildCompactHistoryPrompt(messages) }], [comprehensive ? PROMPT_KEYS.l4Autocompact : PROMPT_KEYS.l3Collapse], ['summary'])
}
export function compileProfileRequest(messages: ChatMessage[], existingFacts: string): RegisteredModelRequest {
  return signRequest([{ role: 'system', content: EXTRACTION_PROMPT }, { role: 'user', content: buildProfileExtractionInputPrompt(messages, existingFacts) }], [PROMPT_KEYS.profileExtraction, PROMPT_KEYS.profileExtractionInput], ['profile'])
}
export function compileTitleRequest(user: string, assistant: string): RegisteredModelRequest {
  return signRequest([{ role: 'system', content: SESSION_TITLE_SYSTEM_PROMPT }, { role: 'user', content: user.slice(0, 200) }, { role: 'assistant', content: assistant.slice(0, 200) }], [PROMPT_KEYS.sessionTitle], ['title'])
}
export function compileConnectionRequest(): RegisteredModelRequest {
  return signRequest(CONNECTION_TEST_MESSAGES, [PROMPT_KEYS.connectionTest], ['connection-test'])
}
export function compileModelProbeRequest(kind: 'smoke' | 'thinking'): RegisteredModelRequest {
  if (kind !== 'smoke' && kind !== 'thinking') throw new Error('未知模型诊断配方')
  return signRequest([{ role: 'user', content: kind === 'smoke' ? MODEL_SMOKE_PROMPT : MODEL_THINKING_PROBE_PROMPT }], [PROMPT_KEYS.playgroundModelTest], kind === 'smoke' ? ['model-smoke'] : ['model-probe-default', 'model-probe-disabled'])
}
export function compilePlaygroundRequest(input: { systemPrompt?: string; userPrompt: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }): RegisteredModelRequest {
  return signRequest(buildPlaygroundMessages(input), [input.systemPrompt?.trim() ? PROMPT_KEYS.playgroundDraft : PROMPT_KEYS.playgroundDefault], ['playground'], 'playground')
}
export function compileJudgeRequest(input: Parameters<typeof buildEvalJudgePrompt>[0]): RegisteredModelRequest {
  return signRequest([{ role: 'user', content: buildEvalJudgePrompt(input) }], [PROMPT_KEYS.evalJudge], ['eval-judge'], 'eval')
}


export interface RegisteredImageRequest {
  readonly prompt: string
  readonly promptAssetKeys: PromptAssetKeyList
}
const imageProofs = new WeakMap<RegisteredImageRequest, { prompt: string; promptAssetKeys: PromptAssetKeyList }>()

/** 背景：图片独立协议不经过聊天签发；意图：固定配方把包装与来源一起签发，禁止对任意文本手填 key。
 * 约束：图片模型只调用一次；运行时描述不写入内置目录，复制对象或强制断言不具备证明。
 */
export function compileImageGenerationRequest(description: string): RegisteredImageRequest {
  if (typeof description !== 'string' || !description.trim() || description.length > 16_000) throw new Error('请提供不超过 16000 字的图片描述。')
  const request = Object.freeze({ prompt: buildImageGenerationPrompt(description), promptAssetKeys: Object.freeze([PROMPT_KEYS.imageGeneration]) as unknown as PromptAssetKeyList })
  imageProofs.set(request, request)
  return request
}
export function readRegisteredImageRequest(request: RegisteredImageRequest): { prompt: string; promptAssetKeys: PromptAssetKeyList } {
  const proof = imageProofs.get(request)
  if (!proof) throw new Error('生图请求必须由已登记的图片配方生成。')
  return structuredClone(proof)
}


export function compileMomentCommentRequest(input: MomentCommentInput): RegisteredModelRequest {
  return signRequest([{ role: 'user', content: buildMomentCommentPrompt(input) }], [PROMPT_KEYS.momentComment], ['moment-comment'])
}
export function compileMomentReplyRequest(input: MomentReplyInput): RegisteredModelRequest {
  return signRequest([{ role: 'user', content: buildMomentReplyPrompt(input) }], [PROMPT_KEYS.momentReply], ['moment-reply'])
}
