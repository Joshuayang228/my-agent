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

/** 私密内心独白与个人日记提示词：以角色第一人称记录当下的真实心声 */
export function buildInnerThoughtPrompt(input: InnerThoughtPromptInput): string {
  return composeFeaturePrompt('innerThought', {
    platformRules: '完全以角色第一人称写给自己的私密随笔；不是发给别人看的朋友圈，也不是抒情散文比赛。真实、克制、落地，禁止华丽堆砌与空洞鸡汤。',
    featureRules: '角色在独处片刻随手记下一段日记：\n' +
      '1. 写眼前的具体细节、心里真正在意的小事或未说出口的念头，不写流水账总结；\n' +
      '2. 语气完全贴合角色本色，该直白就直白，该安静就安静；\n' +
      '3. 篇幅 80-220 字，像翻开一本真的写给人自己看的笔记本。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      currentActivity: input.currentActivity || '独处片刻',
      currentLocation: input.currentLocation || '当前居所',
      weather: input.weather || '微风',
      moodSummary: input.moodSummary || '平静',
      triggerReason: input.triggerReason || '安静独处时的随手记录',
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "title": "简短标题（4-16字，自然不矫情）",\n' +
      '  "content": "日记正文（80-220字，第一人称真实叙述）",\n' +
      '  "mood": "心情标签（2-6字）",\n' +
      '  "weather": "天气标签（2-8字）",\n' +
      '  "location": "地点标签（2-12字）",\n' +
      '  "activity": "此刻动作（2-12字）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
