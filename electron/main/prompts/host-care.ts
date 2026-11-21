/**
 * 宿主作息与现实关怀提示词（Host Care Prompt）。
 *
 * 背景：当检测到用户连续专注过久或深夜仍在活跃时，角色以第一人称自然提醒休息或早点睡。
 * 设计意图：去掉闹钟式打卡感与说教腔，保持短句、口语、克制、不油腻的同伴关切。
 * 关键约束：纯提示词组装纯函数；严格遵循 composeFeaturePrompt 平台四层契约与 JSON 输出格式。
 */

import { composeFeaturePrompt } from './composition'

export interface HostCarePromptInput {
  protagonistName: string
  protagonistBrief: string
  kind: 'fatigue_break' | 'late_night_sleep' | 'welcome_back'
  continuousActiveMinutes: number
}

/** 宿主作息与现实关怀提示词：在用户连续专注或深夜工作时，生成自然不油腻的第一人称提醒 */
export function buildHostCarePrompt(input: HostCarePromptInput): string {
  const kindHint =
    input.kind === 'fatigue_break'
      ? `用户已经连续盯着屏幕忙了约 ${input.continuousActiveMinutes} 分钟。随口提醒对方起来活动一下、喝口水或喘口气，不要像健康闹钟一样念经。`
      : input.kind === 'late_night_sleep'
        ? '现在已经很晚了，用户还在忙。轻声但实在地劝对方差不多收尾去睡，不说教、不端长辈架子。'
        : '用户离开一会儿刚回来。顺口打个招呼，轻松自然，不夸张客套。'

  return composeFeaturePrompt('hostCare', {
    platformRules: '完全以角色第一人称口语表达；真诚、自然、不油腻，禁止命令口吻、打卡闹钟腔或客服式模板关怀。',
    featureRules: `情境：${kindHint}\n` +
      '1. 篇幅 25-75 字，像坐旁边的熟人随口递来的一句实在提醒；\n' +
      '2. 附带一个顺手能做的小动作建议（如“站起来晃两圈”“喝口水”“合上电脑去睡”）。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      kind: input.kind,
      continuousActiveMinutes: input.continuousActiveMinutes,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "careMessage": "第一人称关怀提醒（25-75字，口语自然）",\n' +
      '  "suggestedAction": "一个顺手的小动作建议（4-16字）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
