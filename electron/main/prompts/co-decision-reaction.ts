import { composeFeaturePrompt } from './composition'

export interface CoDecisionReactionPromptInput {
  protagonistName: string
  protagonistBrief: string
  decisionTitle: string
  dilemma: string
  selectedOptionLabel: string
  selectedOptionDesc?: string
}

/** 同伴抉择回响提示词：在用户作出重大选择后，以角色第一人称生成兴奋生动的即时回响 */
export function buildCoDecisionReactionPrompt(input: CoDecisionReactionPromptInput): string {
  return composeFeaturePrompt('coDecisionReaction', {
    platformRules: '必须完全以人物第一人称口吻表达；这是同伴替你做出抉择后的即时欢呼与坚定执行回响，生动亲切，带着角色特有的情绪波动。',
    featureRules: '角色此前向用户提出了一个生活或航行中的纠结困境，用户刚刚替角色作出了明确的抉择。\n' +
      '请根据角色的核心性格、说话风格及用户做出的决定，生成一段在即时聊天会话中发出的第一人称即时反应：\n' +
      '1. 充满角色鲜活性：例如路飞会大笑、兴奋叫喊、拉着同伴立刻照做，豪迈且百分百信任对方的选择；\n' +
      '2. 回应具体选项：提到用户所选的内容，表达“太棒了！就这么办！”的爽快与对明天的期待；\n' +
      '3. 篇幅 30-90 字，口语化、活人感，像真实朋友发来的即时消息。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      decisionTitle: input.decisionTitle,
      dilemma: input.dilemma,
      selectedOptionLabel: input.selectedOptionLabel,
      selectedOptionDesc: input.selectedOptionDesc || '',
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "reactionText": "角色第一人称即时回响（30-90字，口语鲜活，充满人设感）",\n' +
      '  "chatMessage": "直接推入主会话作为assistant消息的发言（同上，支持生动标点与语气词）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
