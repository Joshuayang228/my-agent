import { composeFeaturePrompt } from './composition'

export interface NightlyReflectionPromptInput {
  protagonistName: string
  protagonistBrief: string
  currentActivity?: string
  currentLocation?: string
  weather?: string
  todayEventsSummary?: string
  recentUserChatSummary?: string
}

export const NIGHTLY_REFLECTION_SYSTEM_PROMPT =
  '以角色第一人称记录夜深安静时的真实复盘与一句话沉淀；克制、真诚、有体温，禁止煽情套话和鸡汤格言。'

/**
 * 深夜反思与沉淀提示词组装器。
 *
 * 背景：角色在深夜独处时回看今天的经历与互动，写下一篇安静的随笔，并提炼一句真正值得记住的相处感悟写入长期记忆。
 * 设计意图：去掉空泛抒情词，要求锚定今天真实发生的线索，输出自然克制的第一人称正文与一句可沉淀的 epiphany。
 * 关键约束：纯中文输出，严格符合 JSON 结构，不得编造今天未发生的对话或事件。
 */
export function buildNightlyReflectionUserPrompt(input: NightlyReflectionPromptInput): string {
  return composeFeaturePrompt('nightlyReflection', {
    platformRules: NIGHTLY_REFLECTION_SYSTEM_PROMPT,
    featureRules:
      '夜深安静下来，角色一个人回想今天发生的事与聊过的话题：\n' +
      '1. 只基于已提供的今日事件与聊天线索展开，不凭空编造未发生的长谈；\n' +
      '2. 写出白天的喧闹退去后心里真正留下来的那一点触动，口吻贴合角色本色，不端文艺腔；\n' +
      '3. 在 epiphany 字段提炼一句真正记在心里的短句（20-60字），具体实在，不写放之四海而皆准的大道理；\n' +
      '4. 正文 100-220 字，自然收尾。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      currentLocation: input.currentLocation || '当前居所',
      currentActivity: input.currentActivity || '夜里安静坐一会儿',
      weather: input.weather || '夜风微凉',
      todayEventsSummary: input.todayEventsSummary || '平常的一天',
      recentUserChatSummary: input.recentUserChatSummary || '暂无特别对话记录',
    },
    outputRules:
      '只输出一个合法的 JSON 对象，格式为：\n' +
      '{\n' +
      '  "title": "简短标题（4-16字）",\n' +
      '  "content": "日记正文（100-220字，第一人称真诚叙述）",\n' +
      '  "epiphany": "一句具体实在的心得沉淀（20-60字）",\n' +
      '  "mood": "心情标签（2-6字）",\n' +
      '  "weather": "天气标签（2-8字）",\n' +
      '  "location": "地点标签（2-12字）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
