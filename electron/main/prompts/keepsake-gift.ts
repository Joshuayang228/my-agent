import { composeFeaturePrompt } from './composition'

export interface KeepsakeGiftPromptInput {
  protagonistName: string
  protagonistBrief: string
  keepsakeName: string
  keepsakeLore: string
  giftReason: string
}

/** 羁绊深度跃迁与专属信物馈赠提示词：以角色第一人称真情实感赠送专属信物 */
export function buildKeepsakeGiftPrompt(input: KeepsakeGiftPromptInput): string {
  return composeFeaturePrompt('keepsakeGift', {
    platformRules: '必须完全以人物第一人称口吻表达；这是对重要伙伴的专属赠礼时刻，真挚诚恳，带着角色独特的口吻与情感寄托。',
    featureRules: '主角在此刻与用户达成了重要羁绊里程碑，决定将一件极具特殊意义的个人专属信物赠予用户。\n' +
      '请根据角色的核心性格、说话口吻及该信物的深层背景，生成一段在即时聊天会话中送出该信物的第一人称赠礼发言：\n' +
      '1. 充满情感温度与角色感：例如路飞会兴奋直率、大喊大叫却又在关键时刻流露出对伙伴至死不渝的信赖与温柔；\n' +
      '2. 解释信物的意义：结合信物设定，说明为什么要把这个送给对方，表达“收下吧，我们可是伙伴啊”的坚定信念；\n' +
      '3. 篇幅 50-120 字，自然亲切，充满活人感。',
    characterAdapter: `人物名称：${input.protagonistName}\n人物性格与说话风格：${input.protagonistBrief}`,
    runtimeData: {
      keepsakeName: input.keepsakeName,
      keepsakeLore: input.keepsakeLore,
      giftReason: input.giftReason,
    },
    outputRules: '只输出 JSON 对象，格式为：\n' +
      '{\n' +
      '  "giftSpeech": "角色第一人称赠礼寄语消息正文（50-120字，鲜活传神）",\n' +
      '  "celebrationTitle": "桌面通知标题（6-16字，如：路飞赠送了你专属信物）"\n' +
      '}\n' +
      '不要包含 markdown 代码块包裹或任何额外文字。',
  })
}
