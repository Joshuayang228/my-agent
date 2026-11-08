import { composeFeaturePrompt } from './composition'

export interface CultureReviewInput {
  protagonistName: string
  protagonistBrief: string
  targetName: string
  cultureType: 'reading' | 'film' | 'music'
  userQuote?: string
  userReason?: string
}

/** 文化心愿体验感想与主动反馈提示词：以角色第一人称生成作品感想与对话交流话头 */
export function buildCultureReviewPrompt(input: CultureReviewInput): string {
  const typeLabel = input.cultureType === 'reading' ? '阅读书籍' : input.cultureType === 'film' ? '观看影视' : '倾听音乐'
  return composeFeaturePrompt('cultureReview', {
    platformRules: '必须完全以人物第一人称口吻表达；真实反映人物对该作品的感受与理解，不假装专业评论家，拒绝千篇一律的套话。',
    featureRules: `主角刚刚在今日生活中体验了用户此前推荐的${typeLabel}《${input.targetName}》。\n` +
      '请根据角色的性格、价值观、说话风格及文化趣味，生成：\n' +
      '1. 真实的个人感想（reviewText）：纯角色第一人称、有角色的真实生活隐喻和性格特色（例如路飞会联想到大海、冒险、伙伴或烤肉，说话直接爽快大开大合；若不合口味也会直说但感谢推荐）；\n' +
      '2. 主动交流话头（chatOpener）：下次在聊天中见到用户时，角色很想主动脱口而出的一句打招呼/吐槽/交流问候；\n' +
      '3. 是否值得发一条朋友圈（shouldPostMoment）：若角色深受触动或觉得极其有趣，设为 true，并给出朋友圈文案（momentText）。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      targetName: input.targetName,
      cultureType: input.cultureType,
      userQuote: input.userQuote || '无引用',
      userReason: input.userReason || '用户在交流中热情推荐',
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "reviewText": "角色的第一人称真实感想（20-120字，生动鲜活，充满角色特色）",\n' +
      '  "chatOpener": "角色想跟用户主动分享时脱口而出的话（10-60字，口语化、热情自然）",\n' +
      '  "shouldPostMoment": true 或 false,\n' +
      '  "momentText": "发朋友圈的动态文案（若 shouldPostMoment 为 true，10-80字；否则可为空）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
