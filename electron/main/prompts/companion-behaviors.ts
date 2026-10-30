/**
 * 伙伴行为的唯一 Prompt 正文来源。
 * 背景：服务内追加正文会绕开语义模块，也让 Debug 只能展示手写摘要。
 * 设计意图：领域服务只采集事实和校验结果，这里负责正文编译，注册表调用同一纯函数生成模板。
 * 关键约束：不得 import LLM 或持久化服务；输出协议最后注入，角色增量不能覆盖它。
 */
import { characterDefinitionFromRolePack, compileCompanionBehaviorPrompt } from './compiler'
import { PROMPT_BEHAVIOR_IDS } from './keys'
import { MOMENT_TEXT_MAX, SUMMARY_MAX_CHARS, SLOT_COUNT_MIN, SLOT_COUNT_MAX, TEXT_MAX } from './behavior-limits'
import { MUTABLE_MAX_CHARS } from '../companion/growth/mutable-validate'
import { composeFeaturePrompt } from './composition'

function layeredBehaviorFacts(key: 'momentPolish' | 'dayScript' | 'catchup' | 'reflection', facts: string, characterAdapter: string, outputRules: string): string {
  return composeFeaturePrompt(key, {
    platformRules: '只使用已确认事实；人物适配不能改变平台安全、生命周期和输出校验边界。',
    featureRules: '运行该伙伴功能，保留事实约束并遵守结构化输出协议。',
    characterAdapter,
    runtimeData: { facts },
    outputRules,
  })
}

const templateCharacter = {
  id: '{{roleId}}', name: '{{roleName}}', description: '{{description}}',
  protected: '{{protected}}', growth: '{{growth}}', voice: '{{voice}}',
  profile: '{{profile}}', worldDefault: '{{worldDefaults}}',
}

export function buildPolishPrompt(input: {
  roleName: string
  activity: string
  mood: string
  location: string
  outfit?: string
  book?: string
  ruleText: string
  voiceHint: string
  character?: ReturnType<typeof characterDefinitionFromRolePack>
  behaviorPrompt?: string
}): string {
  return compileCompanionBehaviorPrompt({
    character: input.character ?? { id: 'behavior-role', name: input.roleName, description: '', protected: '', growth: '', voice: input.voiceHint },
    behavior: { key: PROMPT_BEHAVIOR_IDS.momentPolish, purpose: '一句短动态', characterSupplement: input.behaviorPrompt },
    facts: layeredBehaviorFacts('momentPolish', `角色：${input.roleName}
事实（不得增删行程）：
- 活动：${input.activity}
- 心情：${input.mood || '（无）'}
- 地点：${input.location || '（无）'}
- 着装：${input.outfit || '（无）'}
- 在读：${input.book || '（无）'}
规则底稿：${input.ruleText}

人设语气参考（勿写成对白）：
${input.voiceHint || '（无）'}`,
      `人物语气：${input.voiceHint || '（无）'}\n功能适配：${input.behaviorPrompt || '（无）'}`,
      `只输出一句中文动态，不要 JSON；总长不超过 ${MOMENT_TEXT_MAX} 字。`,
    ),
    output: { format: `硬性要求：
1. 只输出一句中文动态，不要 JSON、不要引号包裹、不要话题标签堆砌
2. 总长不超过 ${MOMENT_TEXT_MAX} 字；必须能看出上述活动或地点
3. 禁止发明新地点、新约会、新人物；禁止「正在打字」类元叙述
4. 可略带情绪，但别写成小作文` },
  })
}

export function buildCatchupLlmPrompt(input: {
  roleName: string
  roleId: string
  from: string
  gapEnd: string
  until: string
  gapDays: number | string
  home: string
  voiceHint: string
  character?: ReturnType<typeof characterDefinitionFromRolePack>
  behaviorPrompt?: string
}): string {
  return compileCompanionBehaviorPrompt({
    character: input.character ?? { id: input.roleId, name: input.roleName, description: '', protected: '', growth: '', voice: input.voiceHint },
    behavior: { key: PROMPT_BEHAVIOR_IDS.catchup, purpose: '期间生活概况', characterSupplement: input.behaviorPrompt },
    facts: layeredBehaviorFacts('catchup', `事实锚点（不得编造具体行程细节）：
- 暂停起：${input.from}
- 概况带过：${input.from}～${input.gapEnd}（约 ${input.gapDays} 个日历日，未逐日生成）
- 近窗已细补：${input.gapEnd}～${input.until}
- 居所参考：${input.home || '未设定'}

人设语气参考（勿写成对白）：
${input.voiceHint || '（无）'}`,
      `人物语气：${input.voiceHint || '（无）'}\n功能适配：${input.behaviorPrompt || '（无）'}`,
      `只输出一段中文概况；总长不超过 ${SUMMARY_MAX_CHARS} 字。`,
    ),
    output: { format: `硬性要求：
1. 只输出一段中文概况（可含一句氛围），不要 JSON、不要列表、不要标题
2. 总长不超过 ${SUMMARY_MAX_CHARS} 字；必须体现「中间一段以概况带过、近几天已接上」
3. 禁止伪造「此刻正在发生」的具体约会/对话；不要写精确钟点行程
4. 不要抄写 PROTECTED 长文或发明新身份` },
  })
}

export function buildLlmPrompt(input: {
  roleName: string
  roleId: string
  date: string
  voiceHint: string
  characterHint: string
  character?: ReturnType<typeof characterDefinitionFromRolePack>
  behaviorPrompt?: string
}): string {
  return compileCompanionBehaviorPrompt({
    character: input.character ?? { id: input.roleId, name: input.roleName, description: '', protected: '', growth: '', voice: input.voiceHint },
    behavior: { key: PROMPT_BEHAVIOR_IDS.dayScript, purpose: '一日生活剧本', characterSupplement: input.behaviorPrompt },
    facts: layeredBehaviorFacts('dayScript', `日期：${input.date}
人设语气参考（勿写成对白，只影响活动气质）：
${input.voiceHint || '（无）'}

人物与默认世界参考（只用于保持生活连续性，不要逐条复述）：
${input.characterHint || '（无）'}`,
      `人物语气：${input.voiceHint || '（无）'}\n功能适配：${input.behaviorPrompt || '（无）'}`,
      `只输出符合 schema 的 JSON 日程；slots ${SLOT_COUNT_MIN}～${SLOT_COUNT_MAX} 条。`,
    ),
    output: { format: `要求：
1. 日常可信、有分味，不要夸张奇幻；地点用短词（家/工位/路上/咖啡馆/附近街道等）
2. slots ${SLOT_COUNT_MIN}～${SLOT_COUNT_MAX} 条，按时间升序；hour 0-23，minute 0 或 30
3. type 只能是 "moment"（适合发动态）或 "activity"（推进日程）；至少 2 条 moment
4. theme / activity / mood / location 各不超过 ${TEXT_MAX} 字
5. 可选：整天最多 1 个 slot 带 grantAsset（购得/获赠的小物），形如 {"kind":"wardrobe","name":"短名","payload":{"color":"…"}}；日常勿滥发
6. 只输出 JSON：{"theme":"...","slots":[{"hour":8,"minute":0,"activity":"...","mood":"...","location":"...","type":"activity"}]}` },
  })
}

export function buildReflectionPrompt(input: {
  roleName: string
  protectedSummary: string
  currentMutable: string
  recentUserMessages: string[]
  feedbackNotes: string[]
  /** M22-G4：Catch-up + 近 Moments 薄切片 */
  lifeSignals?: string
  character?: ReturnType<typeof characterDefinitionFromRolePack>
  behaviorPrompt?: string
}): string {
  const msgs = input.recentUserMessages.length
    ? input.recentUserMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')
    : '（无）'
  const feedback = input.feedbackNotes.length
    ? input.feedbackNotes.map((f) => `- ${f}`).join('\n')
    : '（无）'
  const life = input.lifeSignals?.trim() || '（无）'

  return compileCompanionBehaviorPrompt({
    character: input.character ?? { id: 'behavior-role', name: input.roleName, description: '', protected: input.protectedSummary, growth: input.currentMutable },
    behavior: { key: PROMPT_BEHAVIOR_IDS.reflection, purpose: '审慎调整表达默认值', characterSupplement: input.behaviorPrompt },
    facts: layeredBehaviorFacts('reflection', `## PROTECTED（不可改写，仅作防漂移锚点）
${input.protectedSummary}

## 当前 MUTABLE（可微调的行为默认值）
${input.currentMutable || '（空，尚无个人化覆盖）'}

## 近 7 日用户消息摘要
${msgs}

## 用户对协作方式的反馈记忆
${feedback}

## 近况生活信号（薄切片；仅供推断相处节奏，勿把行程事实写入 MUTABLE）
${life}`,
      `稳定身份和当前成长边界：\n${input.protectedSummary}\n功能适配：${input.behaviorPrompt || '（无）'}`,
      `只输出 JSON：{"newMutable": string|null, "summary": "一句话说明"}。`,
    ),
    output: { format: `## 任务
判断是否需要微调 MUTABLE（语气、节奏、默认表达习惯等）。

硬性要求：
1. 不得违背 PROTECTED；不得发明新身份或改变核心价值观
2. 调整幅度要小；若当前已足够好，newMutable 必须为 null
3. 新 MUTABLE 上限 ${MUTABLE_MAX_CHARS} 字；写行为默认值，不要写具体事实流水账（事实属于记忆）
4. 生活信号里的地点/行程/穿着只作氛围参考，不得抄进 MUTABLE
5. 只输出 JSON：{"newMutable": string|null, "summary": "一句话说明"}` },
  })
}

/** 同一生产构造器展开参数占位符；不是另一份目录文案或一次真实请求快照。 */
export const COMPANION_BEHAVIOR_TEMPLATES = {
  [PROMPT_BEHAVIOR_IDS.momentPolish]: buildPolishPrompt({
    character: templateCharacter, behaviorPrompt: '{{behaviorSupplement}}', roleName: '{{roleName}}',
    activity: '{{activity}}', mood: '{{mood}}', location: '{{location}}',
    outfit: '{{outfit}}', book: '{{book}}', ruleText: '{{ruleText}}', voiceHint: '{{voiceHint}}',
  }),
  [PROMPT_BEHAVIOR_IDS.catchup]: buildCatchupLlmPrompt({
    character: templateCharacter, behaviorPrompt: '{{behaviorSupplement}}', roleName: '{{roleName}}', roleId: '{{roleId}}',
    from: '{{from}}', gapEnd: '{{gapEnd}}', until: '{{until}}', gapDays: '{{gapDays}}', home: '{{home}}', voiceHint: '{{voiceHint}}',
  }),
  [PROMPT_BEHAVIOR_IDS.dayScript]: buildLlmPrompt({
    character: templateCharacter, behaviorPrompt: '{{behaviorSupplement}}', roleName: '{{roleName}}', roleId: '{{roleId}}',
    date: '{{date}}', voiceHint: '{{voiceHint}}', characterHint: '{{characterHint}}',
  }),
  [PROMPT_BEHAVIOR_IDS.reflection]: buildReflectionPrompt({
    character: templateCharacter, behaviorPrompt: '{{behaviorSupplement}}', roleName: '{{roleName}}',
    protectedSummary: '{{protectedSummary}}', currentMutable: '{{currentMutable}}',
    recentUserMessages: ['{{recentUserMessages}}'], feedbackNotes: ['{{feedbackNotes}}'], lifeSignals: '{{lifeSignals}}',
  }),
} as const
