import { composeFeaturePrompt } from './composition'

export interface CultureReviewInput {
  protagonistName: string
  protagonistBrief: string
  targetName: string
  cultureType: 'reading' | 'film' | 'music'
  userQuote?: string
  userReason?: string
}

/** 文化体验感想与交流话头提示词：基于已知材料或体验生成不端架子的第一人称感受 */
export function buildCultureReviewPrompt(input: CultureReviewInput): string {
  const typeLabel = input.cultureType === 'reading' ? '读完书籍' : input.cultureType === 'film' ? '看完影视' : '听完音乐'
  return composeFeaturePrompt('cultureReview', {
    platformRules: '完全以角色第一人称口语表达；只谈已知材料与真实感受，不装影评人/书评家，禁止空洞赞美、鸡汤总结或编造未读过的情节。',
    featureRules: `角色刚刚${typeLabel}《${input.targetName}》。请按角色本色生成：\n` +
      '1. 真实感想（reviewText）：有具体感受、有态度，合胃口就直说哪里有意思，不合胃口也可以坦率吐槽；\n' +
      '2. 聊天话头（chatOpener）：下次见到用户时顺嘴想聊的一句开场白，自然不刻意；\n' +
      '3. 是否发圈（shouldPostMoment）：真觉得有东西想分享再设为 true，并写一句不带广告味的短文案（momentText）。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      targetName: input.targetName,
      cultureType: input.cultureType,
      userQuote: input.userQuote || '无引用',
      userReason: input.userReason || '用户推荐',
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "reviewText": "第一人称真实感想（20-120字，不端架子）",\n' +
      '  "chatOpener": "下次聊天顺嘴提一句的话头（10-60字，自然口语）",\n' +
      '  "shouldPostMoment": true 或 false,\n' +
      '  "momentText": "朋友圈短文案（shouldPostMoment 为 true 时 10-80 字，否则为空）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
