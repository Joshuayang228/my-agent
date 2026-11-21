import { composeFeaturePrompt } from './composition'

export interface ProactiveGreetingInput {
  roleName: string
  roleBrief: string
  momentText: string
}

/** 主动消息只基于已发布动态生成，防止把未验证记忆包装成紧急提醒。 */
export function buildProactiveGreetingPrompt(input: ProactiveGreetingInput): string {
  return composeFeaturePrompt('proactiveGreeting', {
    platformRules: '只基于已发布动态自然开口；不制造紧急感、不催促回复、不编造未提供的用户隐私或人物经历。禁止客服腔与套话（如“早安呀亲爱的”“祝你今天愉快”“记得多喝水哦”）。',
    featureRules: '顺着刚发生的这条生活动态，像朋友随手发来的一句轻打招呼，自然、短促、不粘人。',
    characterAdapter: `roleName：${input.roleName}\nroleBrief（人物简介只用于保持语气与身份一致）：${input.roleBrief}`,
    runtimeData: { momentText: input.momentText },
    outputRules: '只输出 JSON 对象 {"greeting":"问候正文"}，正文 2 到 80 字，不加前缀或其他字段。',
  })
}
