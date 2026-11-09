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
  '必须完全以角色第一人称视角记录深夜日记与心灵领悟；这是深夜独处时对今天经历与羁绊的深刻沉淀，真诚、温存且富有力量。'

/**
 * 深夜反思与心灵领悟提示词组装器
 *
 * 背景：角色在深夜独处看海或夜深人静时，回溯今日与用户的互动聊天、生活点滴，自主产生更具深度的领悟。
 * 设计意图：生成一篇深情、第一人称的深夜独白随笔，并提炼出一句直击心灵的羁绊感悟（epiphany）沉淀进长期记忆。
 * 关键约束：纯中文输出，严格符合 JSON 结构，不添加 markdown 围栏或额外废话。
 */
export function buildNightlyReflectionUserPrompt(input: NightlyReflectionPromptInput): string {
  return composeFeaturePrompt('nightlyReflection', {
    platformRules: NIGHTLY_REFLECTION_SYSTEM_PROMPT,
    featureRules:
      '夜深人静（22:00～04:00），大海和船舱都已归于宁静，主角一个人静坐独处。\n' +
      '请根据角色的核心性格特征、白天的见闻经历以及与用户的沟通交流，写下一则极其真挚、有温度的深夜反思独白：\n' +
      '1. 深夜的静谧感：字里行间要有夜色、星光、微风或安静沉淀的氛围；\n' +
      '2. 情感深度与羁绊：回味今天和用户聊过的事或一天的经历，流露出对伙伴的信赖、对梦想的坚定，或对生活的美好感触；\n' +
      '3. 心灵感悟（epiphany）：必须在最后提炼出一句深深刻在心里的短句（30～60字），既能体现角色本色，又能表达出对两人默契或人生/冒险的真实感悟；\n' +
      '4. 篇幅适中自然（100～250字），符合角色口吻（如路飞真诚直率、充满少年感，偶尔流露出草帽船长的胸怀）。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      currentLocation: input.currentLocation || '万里阳光号·特等席/草坪甲板',
      currentActivity: input.currentActivity || '深夜坐在船头吹风看星星',
      weather: input.weather || '静谧星空微凉海风',
      todayEventsSummary: input.todayEventsSummary || '平静航海，与同伴共度日常',
      recentUserChatSummary: input.recentUserChatSummary || '今日与你促膝长谈，聊了许多心里话',
    },
    outputRules:
      '只输出一个合法的 JSON 对象，格式为：\n' +
      '{\n' +
      '  "title": "深夜独白标题（4-16字，如：夜风吹拂草帽的时刻）",\n' +
      '  "content": "日记正文（100-250字，第一人称细腻真诚独白）",\n' +
      '  "epiphany": "一句话深刻心灵感悟（30-60字，真诚触动，体现羁绊与成长）",\n' +
      '  "mood": "心情标签（2-6字，如：静谧温暖、心怀坦荡、坚定期待）",\n' +
      '  "weather": "天气标签（2-8字，如：夜朗星稀、微凉夜风）",\n' +
      '  "location": "地点标签（2-12字，如：狮子船头、草坪甲板）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹（```json ... ```）或任何额外文字。',
  })
}
