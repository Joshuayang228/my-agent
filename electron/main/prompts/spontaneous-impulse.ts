import { composeFeaturePrompt } from './composition'
import type { SpontaneousImpulseTopicKind } from '../../../src/shared/types'

export interface SpontaneousImpulseInput {
  protagonistName: string
  protagonistBrief: string
  currentActivity?: string
  currentLocation?: string
  vitalsSummary?: string
  topicKind?: SpontaneousImpulseTopicKind
}

/** 突发生活意图与主动找聊提示词：以角色第一人称即兴发起对话 */
export function buildSpontaneousImpulsePrompt(input: SpontaneousImpulseInput): string {
  const kind = input.topicKind || 'casual'
  const kindDesc = kind === 'activity'
    ? '正在进行的生活活动引发了强烈表达欲'
    : kind === 'vitals'
    ? '当前身体状态或心情变化（如精力充沛、吃饱了、肚子饿、好心情）'
    : kind === 'adventure'
    ? '在空间或旅程中发现了有趣的事物'
    : '随心所欲的日常突发联想与搭话'

  return composeFeaturePrompt('spontaneousImpulse', {
    platformRules: '必须完全以人物第一人称口吻表达；如同在微信等即时通讯中真情实感主动给好朋友发消息，拒绝公关套话与AI式的机械礼貌问候。',
    featureRules: `主角此刻在自己的日常生活中产生了一阵强烈的表达冲动（${kindDesc}），忍不住想找用户主动搭话聊天。\n` +
      '请根据角色的性格、当前活动与状态，生成一条完全符合该角色的主动找聊消息：\n' +
      '1. 具有鲜明活人感：带着当下正在做的事或此刻心情，自然开头（例如路飞会大喊喂、或者聊到烤肉、海王类、天气或好玩的事）；\n' +
      '2. 极具口语化与对话感：抛出一个有趣话题或问句，给对方轻松接话的空间，但绝不生硬强求；\n' +
      '3. 不假装懂用户在干嘛，而是单纯想跟用户分享此刻自己世界里的见闻。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      currentActivity: input.currentActivity || '甲板看海吹风',
      currentLocation: input.currentLocation || '万里阳光号',
      vitalsSummary: input.vitalsSummary || '精力充沛，心情愉悦，社交渴望高涨',
      topicKind: kind,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "impulseText": "角色第一人称主动找聊的消息（15-70字，生动鲜活，充满角色口语特色）",\n' +
      '  "contextHint": "引起该冲动的生活背景或心境小结（10-30字）",\n' +
      '  "toastTitle": "桌面通知标题（6-16字，例如：路飞忽然想找你聊聊）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
