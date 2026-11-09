/**
 * 宿主作息与现实关怀触达提示词（Host Care Prompt）
 *
 * 背景：角色不仅生活在自己的航海世界中，更应当敏锐感知用户的现实劳逸状态；
 * 当检测到用户连续高强度久坐（专注敲代码超2小时）或深夜 1-4 点仍未入眠时，
 * 角色以真诚活泼的第一人称口吻向用户发出富有同伴温情的休息或劝睡关怀。
 *
 * 设计意图：
 * 1. 结合角色人设（如路飞式大咧咧喊吃肉活动伸懒腰、或是深夜嘟囔揉眼劝睡），打破冷冰冰的打卡闹钟感；
 * 2. 根据关怀类别（久坐疲劳、深夜熬夜、工位久别归来）自适应调整语气与建议小动作；
 * 3. 产出的关怀文案将直接推入角色主会话，实现虚实共振的真切在场陪伴。
 *
 * 关键约束：
 * - 纯提示词组装纯函数，无网络或主进程依赖；
 * - 严格遵循 composeFeaturePrompt 平台四层契约规范；
 * - 关怀必须真诚、温暖、不油腻、不带有命令或心理说教语气。
 */

import { composeFeaturePrompt } from './composition'

export interface HostCarePromptInput {
  protagonistName: string
  protagonistBrief: string
  kind: 'fatigue_break' | 'late_night_sleep' | 'welcome_back'
  continuousActiveMinutes: number
}

/** 宿主作息与现实关怀触达提示词：在用户连续专注或深夜工作时，以第一人称口吻生成真诚有温度的同伴关切 */
export function buildHostCarePrompt(input: HostCarePromptInput): string {
  const kindHint =
    input.kind === 'fatigue_break'
      ? `用户已经连续坐在电脑前高强度专注工作了约 ${input.continuousActiveMinutes} 分钟，几乎没怎么起身活动。角色应当大声但关心地催促用户站起来伸懒腰、去倒杯水或吃点好吃的补充能量。`
      : input.kind === 'late_night_sleep'
        ? '现在已经是深夜甚至凌晨时分，用户还在电脑前敲击键盘忙碌。角色揉着惺忪睡眼，虽然困倦但依然心疼用户，劝用户赶紧盖好被子睡觉，别把身体累坏了。'
        : '用户离开工位很久之后刚刚回到电脑前。角色开心热情地迎接用户归来，问候一声，打气开工。'

  return composeFeaturePrompt('hostCare', {
    platformRules: '必须完全以人物第一人称口吻表达；这是同伴对现实中相处伙伴的由衷关怀，自然亲切、富有同伴义气与生活温度，坚决杜绝机械说教或客服腔。',
    featureRules: '检测到用户的现实作息与工作状态触发了健康关怀：\n' +
      `关怀情境：${kindHint}\n` +
      '请根据角色的核心人设、口头禅与性格风格，生成一段即时聊天中的温馨第一人称关怀：\n' +
      '1. 篇幅 30-80 字，口语化、生动活泼，像身边的真人同伴转过头来看向你时说出的体贴话；\n' +
      '2. 附带一个轻量级的人性化建议小动作（如“站起来转两圈活动肩膀”、“喝大口温水”、“赶紧合上电脑钻进被窝”）。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      kind: input.kind,
      continuousActiveMinutes: input.continuousActiveMinutes,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "careMessage": "角色第一人称关怀发言（30-80字，口语鲜活，充满人设个性与同伴体温）",\n' +
      '  "suggestedAction": "建议的一个简单小动作（如：站起来活动伸伸懒腰、去喝一杯温水、合上屏幕睡觉）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
