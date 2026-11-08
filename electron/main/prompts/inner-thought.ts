import { composeFeaturePrompt } from './composition'

export interface InnerThoughtPromptInput {
  protagonistName: string
  protagonistBrief: string
  currentActivity?: string
  currentLocation?: string
  weather?: string
  moodSummary?: string
  triggerReason?: string
}

/** 私密内心独白与航海日记提示词：以角色私密第一人称视角记录当下的真实心声 */
export function buildInnerThoughtPrompt(input: InnerThoughtPromptInput): string {
  return composeFeaturePrompt('innerThought', {
    platformRules: '必须完全以人物私密第一人称视角（航海日记 / 心事独白）记录；这是写给自己的真实所思所感，不是公开展览的朋友圈，也不是直接对他人说的对话。真实、坦诚、有深浅不一的情绪波动。',
    featureRules: '主角在此刻安静独处、夜间看海或经历特别的一天后，随手写下了一则日记或内心独白。\n' +
      '请根据角色的核心性格、真实情感与当前生活场景，生成一段极其鲜活有灵魂的私密记录：\n' +
      '1. 私密坦诚感：这是角色的个人日记本或航海日志，可以写白天的见闻、伙伴的趣事、内心的执念、对梦想的渴望，或是对某次谈话的细细回味；\n' +
      '2. 符合独特人设：例如路飞会用直率、热血、纯真却又在独处时偶尔流露出对草帽、香克斯、伙伴与同伴羁绊的笨拙温柔，语言生动带口头禅；\n' +
      '3. 篇幅适中自然（80-250字），包含生动的场景细节（海风、星光、烤肉香味、甲板温度）。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      currentActivity: input.currentActivity || '夜间独坐瞭望塔看星星',
      currentLocation: input.currentLocation || '万里阳光号·瞭望塔',
      weather: input.weather || '夜朗星稀微风',
      moodSummary: input.moodSummary || '平静，略带思绪',
      triggerReason: input.triggerReason || '夜深人静时的日常内心反思',
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "title": "日记或独白标题（4-16字，充满生活感或诗意冒险感，如：万里阳光号的微凉海风）",\n' +
      '  "content": "日记正文（80-250字，第一人称私密叙述，生动细腻，真实自然）",\n' +
      '  "mood": "心情标签（2-6字，如：安宁想念、热血期待、心满意足）",\n' +
      '  "weather": "天气标签（2-8字，如：晴朗星空、海风微咸）",\n' +
      '  "location": "地点标签（2-12字，如：狮子头特等席）",\n' +
      '  "activity": "独白时的动作（2-12字，如：躺在甲板发呆）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
