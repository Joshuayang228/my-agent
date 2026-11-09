/**
 * 日内计划槽位自适应重排提示词（Replan Slots Prompt）
 *
 * 背景：日剧本如果静态生成后不随生理突变调整，容易出现“上午大病虚脱、下午剧烈探险”的离散割裂感；
 * 角色在遭遇生理透支（精力枯竭）、脆弱小情绪或突发抉择时，需自适应调整当日剩余未发生的槽位。
 *
 * 设计意图：
 * 1. 结合角色人设、诱因与剩余时间槽，自适应将原有剧烈活动转换为符合当前状态的休养、调理、安心放空或同伴照料；
 * 2. 保持时间槽的时钟（hour, minute）不变，只替换 activity、mood 与 location，确保时间线平滑推进；
 * 3. 产出的调整槽位将落盘至 companion_events 并附带 causedBy 因果标签，在后续朋友圈与对话中实现叙事因果承接。
 *
 * 关键约束：
 * - 纯提示词组装纯函数，无网络或主进程依赖；
 * - 严格遵循 composeFeaturePrompt 平台四层契约规范；
 * - 严格规范 JSON 数组输出格式，便于运行时安全解析与逐槽位替换。
 */

import { composeFeaturePrompt } from './composition'

export interface ReplanSlotsPromptInput {
  protagonistName: string
  protagonistBrief: string
  trigger: string
  reason: string
  slotsToReplan: Array<{
    hour: number
    minute: number
    originalActivity: string
  }>
}

/** 日内计划槽位自适应重排提示词：在角色遭遇重大生理或心理突变后，自适应重新编排当日剩余槽位 */
export function buildReplanSlotsPrompt(input: ReplanSlotsPromptInput): string {
  const triggerHint =
    input.trigger === 'vitals_exhaustion'
      ? '角色当前精力严重枯竭透支，极度疲惫虚弱，后续活动必须全部调整为静养、包扎休息、喝热汤滋补、睡觉或被同伴照顾，绝不能再进行高强度体力消耗。'
      : input.trigger === 'vulnerability'
        ? '角色当前陷入情绪低谷、思念故人或疲惫迷茫的脆弱心境，后续活动适度偏向安静独处、看海吹风、凝视信物或听同伴温暖声音，避免喧闹浮躁。'
        : '因突发重大决策或情境改变，后续活动需顺理成章地承接该决策的准备与后续行动。'

  return composeFeaturePrompt('replanSlots', {
    platformRules: '必须完全符合人物设定；重编排的活动应当与突变原因具备严密的因果关系，体现身体与心境的自愈过程。',
    featureRules: '角色今日原本安排的日常日程因突发状况需要自适应调整。\n' +
      `突变诱因：${input.reason}\n` +
      `调整指导原则：${triggerHint}\n` +
      '请为给定的每个待调整时间槽重新设计符合当前自愈/休养状态的活动（activity）、当时心情（mood）与地点（location）。\n' +
      '要求活动自然真实、生活化、具备因果自洽感（例如喝乔巴煮的草药汤、在甲板阴凉处裹毯子睡觉等）。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      trigger: input.trigger,
      reason: input.reason,
      slots: input.slotsToReplan,
    },
    outputRules: '只输出 JSON 数组，每个元素对应一个调整后的时间槽，格式为：\n' +
      '[\n' +
      '  {\n' +
      '    "hour": 对应原时间槽的小时(数字),\n' +
      '    "minute": 对应原时间槽的分钟(数字),\n' +
      '    "activity": "自适应调整后的活动短句（如：在船舱阴凉处裹着毯子沉沉睡去）",\n' +
      '    "mood": "调整后的心情词（如：疲惫恢复中）",\n' +
      '    "location": "调整后的地点（如：船舱/医务室）"\n' +
      '  }\n' +
      ']\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
