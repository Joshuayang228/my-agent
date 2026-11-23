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
    ? `用户（我）正在回复「${input.replyToActorName}」此前在评论区的发言。`
    : `用户（我）在主角「${input.protagonistName}」的动态下发表了新评论。`
  const castDesc = input.castContext ? `\n在场可选回复人物：\n${input.castContext}` : ''

  return composeFeaturePrompt('momentReply', {
    platformRules: '只使用已提供事实；不冒充用户；不新增未确认的人物经历、地点、关系或承诺。回复要像真实朋友圈评论区的随口接话，简短、口语、有性格，禁止写小作文或客服式礼貌回复。',
    featureRules: `根据动态正文与最新互动（${targetDesc}），人物自主决定是否回复，以及隔多久回复。规则：\n` +
      '1. 自主决定是否回复（shouldReply: true/false）：如果是提问、分享、打趣或特定人物相关，人物有意愿回应；若是纯无意义字符/占位输入（如「ll」「1」「...」「test」）或已自然完结，必须返回 shouldReply: false，禁止硬凑回复。\n' +
      `2. 严格区分「动态作者（${input.protagonistName}）」与「评论者（用户/我）」：最终回复会直接展示为「<回复者> 回复 @我」，说话对象必须是发表 userComment 的用户本人，绝不能错把用户当成发动态的「${input.protagonistName}」去吐槽或追问动态里的行为。\n` +
      `3. 自主决定由谁回复（responderId / responderName / actorType）：用户评论动态且未点名/回复某位配角时，应由主角「${input.protagonistName}」（protagonist）回应用户；仅当用户明确回复某位配角（replyTo 为该配角）或评论中直接提到该配角时，才由该配角（cast）回应用户。\n` +
      '4. 自主决定延迟时间（delaySeconds: 5 到 60 的整数）：根据人物性格与情境设定延迟秒数（急躁 5-12 秒，常态 15-35 秒，慢热 40-60 秒），不要写死固定秒数。',
    characterAdapter: `动态作者（主角）：${input.protagonistName}\n人物公开简介与表达：${input.protagonistBrief}${castDesc}`,
    runtimeData: {
      postAuthor: input.protagonistName,
      postText: input.postText,
      commenter: '用户（我）',
      userComment: input.userComment,
      replyTo: input.replyToActorName || `${input.protagonistName}的动态本身`,
      existingComments: input.recentComments || '无',
    },
    outputRules: '只输出 JSON 对象 {"reply":"回复正文"} 或自主决策扩展对象 {"shouldReply":true/false,"responderId":"角色ID","responderName":"姓名","actorType":"protagonist|cast","reply":"回复正文","delaySeconds":5..60,"reason":"理由"}，回复 2 到 120 字，不加前缀、旁白或其他字段。若 shouldReply 为 false，reply 可为空，delaySeconds 为 0。',
  })
}
