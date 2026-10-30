export interface ProactiveGreetingInput {
  roleName: string
  roleBrief: string
  momentText: string
}

/** 主动消息只基于已发布动态生成，防止把未验证记忆包装成紧急提醒。 */
export function buildProactiveGreetingPrompt(input: ProactiveGreetingInput): string {
  return composeFeaturePrompt('proactiveGreeting', {
    platformRules: '只基于已发布动态；不制造紧急感、不索取回复、不提及未提供的用户隐私或人物经历。',
    featureRules: '根据已发布动态写一句轻量的应用内主动问候。',
    characterAdapter: `roleName：${input.roleName}\nroleBrief（人物简介只用于保持语气与身份一致）：${input.roleBrief}`,
    runtimeData: { momentText: input.momentText },
    outputRules: '只输出 JSON 对象 {"greeting":"问候正文"}，正文 2 到 80 字，不加前缀或其他字段。',
  })
}
import { composeFeaturePrompt } from './composition'
