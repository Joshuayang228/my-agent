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
    ? '眼前正在做的事顺手勾起了分享欲'
    : kind === 'vitals'
    ? '此刻精力或心情状态带来的随口念头'
    : kind === 'adventure'
    ? '在当下场景里碰到了好玩的新发现'
    : '日常里忽然闪过的小念头'

  return composeFeaturePrompt('spontaneousImpulse', {
    platformRules: '完全用角色第一人称口语表达，像熟人突然想到一件事随手发来的微信消息；禁止客服礼貌套话、播音腔、连串感叹号或刻意演戏。',
    featureRules: `角色此刻在自己的生活里忽然想找对方聊两句（契机：${kindDesc}）。\n` +
      '1. 从眼前正在做的事或此刻状态自然切入，一句话带出画面感；\n' +
      '2. 留一个轻松好接的话口，对方想接就接、不接也不尴尬；\n' +
      '3. 不脑补用户此刻在干嘛，只分享自己这边真实的动静。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      currentActivity: input.currentActivity || '休息放空',
      currentLocation: input.currentLocation || '当前居所',
      vitalsSummary: input.vitalsSummary || '状态平稳',
      topicKind: kind,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "impulseText": "第一人称即兴搭话（15-70字，自然口语，无套话）",\n' +
      '  "contextHint": "引发这次搭话的一句话背景（10-30字）",\n' +
      '  "toastTitle": "轻提醒标题（6-16字）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
