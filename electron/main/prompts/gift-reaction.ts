/**
 * 收到心意礼物喜悦回响提示词（Gift Reaction Prompt）
 *
 * 背景：同伴关系是双向流动的；用户在日常陪伴中主动向角色馈赠心意礼物，
 * 角色收到不同礼物时依据人设喜好产生生动、鲜活、充满活人感的第一人称即时致谢与喜悦反应。
 *
 * 设计意图：
 * 1. 结合角色人设、口头禅与性格风格，针对不同礼物（尤其特定角色喜好的专属礼物如大肉）展现真实情绪反应；
 * 2. 呼应用户的赠礼附言，若用户写了贴心寄语，角色在回复中自然承接并真诚感谢；
 * 3. 产出的回响将直接推入角色主会话，实现会话留痕与陪伴互动。
 *
 * 关键约束：
 * - 纯提示词组装纯函数，无网络或主进程依赖；
 * - 严格遵循 composeFeaturePrompt 平台四层契约规范；
 * - 严格规范 JSON 返回格式，便于运行时安全解析。
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

/** 收到心意礼物喜悦回响提示词：在用户赠送礼物后，以角色第一人称生成惊喜、感激与专属活人感回响 */
export function buildGiftReactionPrompt(input: GiftReactionPromptInput): string {
  const affinityHint =
    input.affinity === 'favorite'
      ? '角色对这个礼物极度狂喜与由衷热爱（例如路飞收到大肉会两眼放光、兴奋大叫、迫不及待大嚼特嚼）'
      : input.affinity === 'liked'
        ? '角色对这个礼物感到非常开心、惊喜并倍加珍惜'
        : '角色虽然有些新奇或意外，但依然真诚感谢用户的贴心心意'

  return composeFeaturePrompt('giftReaction', {
    platformRules: '必须完全以人物第一人称口吻表达；这是角色亲手收到用户赠送的礼物后的第一反应，喜悦自然，充满鲜活的人设温度与互动感。',
    featureRules: '用户刚刚向角色赠送了一份心意礼物。\n' +
      '请根据角色的核心人设、说话风格、对礼物的喜好程度以及用户附带的赠礼寄语，生成一段在即时聊天会话中发出的第一人称感谢与喜悦回响：\n' +
      `1. 贴合礼物喜好：${affinityHint}；\n` +
      '2. 若用户有留言附言，必须自然呼应用户的寄语（例如如果用户说“辛苦啦”，角色会说“看到你送的这个，一点都不累了！”）；\n' +
      '3. 篇幅 30-90 字，口语化、活人感，像伙伴当面接过礼物时惊喜跃动的欢声笑语。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      giftName: input.giftName,
      giftDescription: input.giftDescription,
      userNote: input.userNote || '（默默微笑着将礼物递给了你）',
      affinity: input.affinity,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "reactionText": "角色第一人称即时喜悦回响（30-90字，口语鲜活，充满人设个性与收到礼物的喜悦）",\n' +
      '  "emotion": "收到礼物后的情绪状态（如 狂喜、感动、惊喜、温暖）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
