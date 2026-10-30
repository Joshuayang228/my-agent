import type { PromptDomain } from '../../../src/shared/types'

/**
 * 功能 Prompt 合同的结构化事实源。
 *
 * 背景：单个功能的通用协议、人物适配和运行时资料容易在不同构造器中漂移，新增人物时会复制整条 Prompt。
 * 设计意图：先把功能目的、输入边界、人物可覆盖范围和输出 / 回退契约登记为稳定元数据，再由组合器读取正文构造器；不把完整自然语言正文复制到合同表。
 * 关键约束：合同只描述通用功能协议，不能包含具体人物事实；人物适配不能覆盖平台约束、输出校验或权限边界；新增合同必须有真实消费者和对应测试。
 */
export interface PromptFeatureContract {
  key: string
  name: string
  domain: PromptDomain
  purpose: string
  staticInputs: readonly string[]
  runtimeInputs: readonly string[]
  overrideBoundary: readonly string[]
  output: string
  fallback: string
  consumers: readonly string[]
}

const contract = (value: PromptFeatureContract): PromptFeatureContract => Object.freeze({
  ...value,
  staticInputs: Object.freeze([...value.staticInputs]),
  runtimeInputs: Object.freeze([...value.runtimeInputs]),
  overrideBoundary: Object.freeze([...value.overrideBoundary]),
  consumers: Object.freeze([...value.consumers]),
})

export const PROMPT_FEATURE_CONTRACTS = Object.freeze({
  momentReply: contract({
    key: 'feature:moment-reply', name: '朋友圈评论回复', domain: 'social',
    purpose: '根据已发布动态和用户评论生成当前人物的简短回应。',
    staticInputs: ['平台事实边界', '评论回复输出协议'],
    runtimeInputs: ['人物公开简介', '动态正文', '用户评论', '关系阶段（可选）'],
    overrideBoundary: ['表达语气', '回应直接度', '对关系的表达方式'],
    output: 'JSON 对象 {"reply":"2 到 120 字"}，不得附加旁白或其他字段。',
    fallback: '缺输入、模型失败或解析不合约时保留用户评论，不写入主角回复。',
    consumers: ['electron/main/companion/life/moments.ts#addMomentCommentForRole'],
  }),
  proactiveGreeting: contract({
    key: 'feature:proactive-greeting', name: '主动问候', domain: 'proactive',
    purpose: '根据已发布动态生成轻量应用内问候。',
    staticInputs: ['投递防打扰策略', '主动消息输出协议'],
    runtimeInputs: ['人物公开简介', '已发布动态正文', '日期与投递门闸'],
    overrideBoundary: ['关心方式', '称呼与语气', '人物表达能量'],
    output: 'JSON 对象 {"greeting":"2 到 80 字"}，不索取回复。',
    fallback: '投递决定不受模型影响；模型失败或输出不合约时回退确定性问候。',
    consumers: ['electron/main/companion/life/proactive-greeting.ts#maybeProactiveGreeting'],
  }),
  imageGeneration: contract({
    key: 'feature:image-generation', name: '人物生图', domain: 'visual',
    purpose: '根据用户描述和已确认视觉资料生成图片请求。',
    staticInputs: ['图片协议', '文件与权限边界', '人物视觉字段'],
    runtimeInputs: ['用户图片描述', '当前人物外观', '绑定衣物 / 场景 / 目标资产'],
    overrideBoundary: ['外观呈现', '服装风格', '人物构图偏好'],
    output: '图片模型请求；必须保留用户描述，不能凭空加入人物经历或现实位置。',
    fallback: '请求失败、取消或归属变化时不发布图片引用，清理本次生成结果。',
    consumers: ['electron/main/tools/builtins/image-generate.ts#imageGenerateTool'],
  }),
  profileExtraction: contract({
    key: 'feature:profile-extraction', name: '用户画像提炼', domain: 'memory',
    purpose: '从近期用户对话中提取有原话证据的新用户事实。',
    staticInputs: ['用户主体边界', '敏感信息规则', '画像输出协议'],
    runtimeInputs: ['用户与助手近期对话', '已知用户事实'],
    overrideBoundary: ['提炼后的表达分类', '人物反馈的解释方式'],
    output: '结构化画像候选；每项必须带用户主体与原话证据。',
    fallback: '缺少用户原话、主体不明或校验失败时不写入画像。',
    consumers: ['electron/main/agent/profile-extractor.ts#maybeExtractProfile'],
  }),
} as const)

export type PromptFeatureContractKey = keyof typeof PROMPT_FEATURE_CONTRACTS

export function getPromptFeatureContract(key: PromptFeatureContractKey): PromptFeatureContract {
  return PROMPT_FEATURE_CONTRACTS[key]
}

export function listPromptFeatureContracts(): PromptFeatureContract[] {
  return Object.values(PROMPT_FEATURE_CONTRACTS)
}
