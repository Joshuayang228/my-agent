/** 图片协议的固定包装；真实图片描述仍是本轮数据，不在目录保存或伪装为人物设定。 */
export function buildImageGenerationPrompt(description: string): string {
  return `请根据以下明确描述生成图片。遵循描述中已提供的主体、构图与风格；未提供的人物身份和经历不要当成已知事实，图片中不要擅自加入说明文字。\n\n图片描述：\n${description}`
}
