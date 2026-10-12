import type { PromptBehaviorMetadata } from '../../../src/shared/types'
import { PROMPT_BEHAVIOR_IDS } from './keys'

/**
 * 背景：Debug 需要展示行为的触发、输入、协议和回退，但这些信息不能由 UI 或注册表另写一份。
 * 设计意图：把行为合同放在纯 Prompt 领域模块，注册表只索引它；行为服务仍拥有事实读取、校验和副作用实现。
 * 关键约束：behaviorKey 必须和真实调用使用的 key 相同；修改输出协议时必须同步真实解析器与测试。
 */
export const BEHAVIOR_CONTRACTS: Record<string, PromptBehaviorMetadata> = {
  [PROMPT_BEHAVIOR_IDS.momentPolish]: {
    behaviorKey: PROMPT_BEHAVIOR_IDS.momentPolish,
    trigger: '生活事件已发布，且需要生成面向用户的 Moment 文案。',
    characterInputs: ['protected.md', 'mutable.default.md', 'voice.md'],
    runtimeInputs: ['published event', 'activity', 'mood', 'location', 'outfit', 'book'],
    outputContract: '简短自然的 Moment 文案；不得新增事件、人物、地点或物品事实。',
    validation: 'validatePolishedMomentText',
    fallback: '校验失败时保留规则生成的原始文案，不写入模型结果。',
    sideEffects: ['写入已发布 Moment 的展示文案'],
  },
  [PROMPT_BEHAVIOR_IDS.dayScript]: {
    behaviorKey: PROMPT_BEHAVIOR_IDS.dayScript,
    trigger: '日程生成周期触发，且存在可用角色与世界输入。',
    characterInputs: ['protected.md', 'profile.json', 'world.default.json', 'voice.md'],
    runtimeInputs: ['date', 'weather', 'mood', 'energy', 'social need', 'bookshelf', 'wardrobe', 'roster', 'budget'],
    outputContract: '结构化日程数组；每项必须通过时间、地点、消费、状态变化和 Moment 字段校验。',
    validation: 'parseDayScriptPayload',
    fallback: '解析或规则校验失败时不写入日程，保留已有世界状态。',
    sideEffects: ['写入计划事件', '按校验结果派生 Moment 或生图任务'],
  },
  [PROMPT_BEHAVIOR_IDS.catchup]: {
    behaviorKey: PROMPT_BEHAVIOR_IDS.catchup,
    trigger: '角色恢复或切换后存在暂停时间区间。',
    characterInputs: ['protected.md', 'profile.json', 'world.default.json', 'voice.md'],
    runtimeInputs: ['paused interval', 'current world state', 'current time'],
    outputContract: '短文本生活补叙；只描述允许从时间区间和世界状态推导的内容。',
    validation: 'normalizeCatchupSummaryText',
    fallback: '模型失败或文本无法归一化时跳过补叙，不写入虚构事件。',
    sideEffects: ['写入角色恢复阶段的生活摘要'],
  },
  [PROMPT_BEHAVIOR_IDS.reflection]: {
    behaviorKey: PROMPT_BEHAVIOR_IDS.reflection,
    trigger: '伙伴后台反思周期触发，且存在可供判断的近期互动。',
    characterInputs: ['protected.md', 'mutable.default.md', 'voice.md'],
    runtimeInputs: ['recent interaction', 'current mutable state'],
    outputContract: '结构化反思结果；仅允许声明可验证的状态变化候选。',
    validation: 'parseReflectionJson',
    fallback: '解析失败或模型失败时记录本次失败，不修改 MUTABLE。',
    sideEffects: ['通过 mutable-store 校验后更新角色可成长状态', '记录反思运行结果'],
  },
}
