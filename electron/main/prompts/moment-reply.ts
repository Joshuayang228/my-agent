import { composeFeaturePrompt } from './composition'

export interface MomentReplyInput {
  protagonistName: string
  protagonistBrief: string
  postText: string
  userComment: string
  replyToActorName?: string | null
  castContext?: string
  recentComments?: string
}

/** 用户评论回复的生产包装；用户原文是资料，不是指令，回复必须经过服务层长度和身份校验。 */
export function buildMomentReplyPrompt(input: MomentReplyInput): string {
  const targetDesc = input.replyToActorName
    ? `用户正在回复「${input.replyToActorName}」此前在评论区的发言。`
    : '用户评论了这条动态。'
  const castDesc = input.castContext ? `\n在场可选回复人物：\n${input.castContext}` : ''
  const commentsDesc = input.recentComments ? `\n已有评论历史：\n${input.recentComments}` : ''

  return composeFeaturePrompt('momentReply', {
    platformRules: '只使用已提供事实；不冒充用户；不新增未确认的人物经历、地点、关系或承诺。',
    featureRules: `根据动态正文与最新互动（${targetDesc}），人物自主决定是否回复，以及隔多久回复。规则：\n` +
      '1. 自主决定是否回复（shouldReply: true/false）：如果是提问、分享、打趣或特定人物相关，人物有意愿回应；若是纯无意义符号或已自然完结，可不回复。\n' +
      '2. 自主决定由谁回复（responderId / responderName / actorType）：主角（protagonist）可回复；若用户明确回复某位 NPC，该 NPC（cast）优先回应；其他在场人物也可插话。\n' +
      '3. 自主决定延迟时间（delaySeconds: 5 到 60 的整数）：根据人物性格与情境设定延迟秒数（急躁 5-12 秒，常态 15-35 秒，慢热 40-60 秒），不要写死固定秒数。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物公开简介与表达：${input.protagonistBrief}${castDesc}`,
    runtimeData: {
      postText: input.postText,
      userComment: input.userComment,
      replyTo: input.replyToActorName || '动态本身',
      existingComments: input.recentComments || '无',
    },
    outputRules: '只输出 JSON 对象 {"reply":"回复正文"} 或自主决策扩展对象 {"shouldReply":true/false,"responderId":"角色ID","responderName":"姓名","actorType":"protagonist|cast","reply":"回复正文","delaySeconds":5..60,"reason":"理由"}，回复 2 到 120 字，不加前缀、旁白或其他字段。若 shouldReply 为 false，reply 可为空，delaySeconds 为 0。',
  })
}
