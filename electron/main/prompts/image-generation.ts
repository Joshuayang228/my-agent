import { composeFeaturePrompt } from './composition'

/**
 * 通用图片生成提示词包装。
 *
 * 背景：所有生图工具与自主朋友圈配图共享同一基础质量与边界约束；人物外观锚点与参考图只作一致性依据，不伪装为新经历。
 * 设计意图：明确画面构图、光线氛围、无多余文字水印以及角色外观/穿着一致性约束，提升出图审美与稳定性。
 * 关键约束：保持纯中文协议；不篡改用户明确给出的主体与风格；未提供的人物经历与现实位置不得擅自补写。
 */
export function buildImageGenerationPrompt(description: string, visualAnchor = ''): string {
  return composeFeaturePrompt('imageGeneration', {
    platformRules: '遵循图片权限、保存路径和归属校验；未提供的人物身份、经历和现实位置不得补写。除非画面描述明确要求，否则不要在图中生成文字、水印、边框或聊天界面。',
    featureRules: '根据已提供的画面描述生成自然、完整、构图舒展的高质感画面：光线与色调统一，主体清晰，环境细节有生活呼吸感，避免廉价塑料感、过度锐化或生硬摆拍。',
    characterAdapter: visualAnchor.trim()
      ? `已确认的人物外观锚点（含当前穿着，严格保持角色长相、发型、标志物与服装一致；若同时附带参考垫图，优先对齐参考图的画风与五官特征）：\n${visualAnchor.trim()}`
      : '',
    runtimeData: { description },
    outputRules: '输出图片模型请求；完整保留核心画面描述，人物锚点仅用于外观与风格一致性。',
  })
}
