/**
 * 收到心意礼物回响提示词（Gift Reaction Prompt）。
 *
 * 背景：用户向角色赠送礼物后，角色依据自身性格与偏好做出自然的第一人称回应并留痕主会话。
 * 设计意图：去掉浮夸的套话与过满的情绪形容，让回应贴合角色真实偏好并接住用户的附言。
 * 关键约束：纯提示词组装纯函数；严格遵循 composeFeaturePrompt 契约与 JSON 输出结构。
 */

import { composeFeaturePrompt } from './composition'

export interface GiftReactionPromptInput {
  protagonistName: string
  protagonistBrief: string
  giftName: string
  giftDescription: string
  userNote?: string
  affinity: 'favorite' | 'liked' | 'neutral'
}

/** 收到心意礼物回响提示词：生成贴合角色偏好的第一人称自然致谢 */
export function buildGiftReactionPrompt(input: GiftReactionPromptInput): string {
  const affinityHint =
    input.affinity === 'favorite'
      ? '正好戳中角色最喜欢的东西，一眼就藏不住高兴'
      : input.affinity === 'liked'
        ? '角色很喜欢这份礼物，心里暖暖的'
        : '角色觉得有点意外或新鲜，但很领情这份心意'

  return composeFeaturePrompt('giftReaction', {
    platformRules: '完全以角色第一人称口语表达；像当面接过朋友递来的礼物时的第一句反应，真实自然，禁止浮夸表演、连串感叹号或客套话。',
    featureRules: '用户刚刚送了角色一份礼物。\n' +
      `1. 贴合喜好程度：${affinityHint}；\n` +
      '2. 如果用户写了附言，自然顺着接一句，不机械复读原话；\n' +
      '3. 篇幅 25-85 字，利落真诚。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      giftName: input.giftName,
      giftDescription: input.giftDescription,
      userNote: input.userNote || '（没有附言）',
      affinity: input.affinity,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "reactionText": "第一人称收到礼物的自然回应（25-85字）",\n' +
      '  "emotion": "简短情绪词（2-6字，如 开心、惊喜、暖心）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
