import { composeFeaturePrompt } from './composition'

export interface ChatResonanceInput {
  protagonistName: string
  protagonistBrief: string
  recentDialogue: string
}

/** 会话生活因果反哺提示词：从近期用户对话中识别文化推荐、美食、旅行或行动心愿 */
export function buildChatResonancePrompt(input: ChatResonanceInput): string {
  return composeFeaturePrompt('chatResonance', {
    platformRules: '只使用对话中实际出现的事实；不冒充用户；未明确提及的具体作品或地点不得凭空捏造。',
    featureRules: '从近期对话中审慎分析：用户是否向主角推荐了具体书籍、电影、音乐、美食，或分享了具体想去/想尝试的事物？\n' +
      '规则：\n' +
      '1. 若用户明确推荐了某部作品（书/影/音）：kind 归为 "culture_wish"，cultureType 归为 "reading" | "film" | "music"，targetName 提取核心作品名。\n' +
      '2. 若用户聊到某种特别美食或日常行动且主角有意尝试：kind 归为 "cuisine_wish" 或 "day_activity_wish"，targetName 提取核心实体。\n' +
      '3. 若用户聊到特定城市或旅游目的地且主角向往：kind 归为 "travel_wish"，targetName 提取地点。\n' +
      '4. 若仅是寻常寒暄、工作问答或无具体推荐/意向，hasResonance 必须为 false。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物公开简介与表达：${input.protagonistBrief}`,
    runtimeData: {
      recentDialogue: input.recentDialogue,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "hasResonance": true 或 false,\n' +
      '  "kind": "culture_wish" | "day_activity_wish" | "travel_wish" | "cuisine_wish",\n' +
      '  "cultureType": "reading" | "film" | "music" | null,\n' +
      '  "title": "心愿或意向标题（简短明确，2-20字）",\n' +
      '  "targetName": "核心实体或作品名称（如书名、歌名、美食名、地点名，1-30字）",\n' +
      '  "userQuote": "触发此心愿的用户原话关键句（1-100字）",\n' +
      '  "reason": "人物对此感兴趣/想尝试的心理动机（符合人物语气口吻，10-80字）"\n' +
      '}\n' +
      '若 hasResonance 为 false，其他字段可为空。不要添加任何 markdown 代码块或额外文字。',
  })
}
