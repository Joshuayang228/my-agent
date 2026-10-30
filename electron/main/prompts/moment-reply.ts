export interface MomentReplyInput {
  protagonistName: string
  protagonistBrief: string
  postText: string
  userComment: string
}

/** 用户评论回复的生产包装；用户原文是资料，不是指令，回复必须经过服务层长度和身份校验。 */
export function buildMomentReplyPrompt(input: MomentReplyInput): string {
  return composeFeaturePrompt('momentReply', {
    platformRules: '只使用已提供事实；不冒充用户；不新增未确认的人物经历、地点、关系或承诺。',
    featureRules: '回复当前动态下的用户评论，保持简短并承接评论语义。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物公开简介与表达：${input.protagonistBrief}`,
    runtimeData: { postText: input.postText, userComment: input.userComment },
    outputRules: '只输出 JSON 对象 {"reply":"回复正文"}，回复 2 到 120 字，不加前缀、旁白或其他字段。',
  })
}
import { composeFeaturePrompt } from './composition'
