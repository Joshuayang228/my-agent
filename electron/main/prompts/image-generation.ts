import { composeFeaturePrompt } from './composition'

/** 图片协议的固定包装；真实图片描述仍是本轮数据，不在目录保存或伪装为人物设定。 */
export function buildImageGenerationPrompt(description: string, visualAnchor = ''): string {
  return composeFeaturePrompt('imageGeneration', {
    platformRules: '遵循图片权限、保存路径和归属校验；未提供的人物身份、经历和现实位置不能被补写。图片中不要擅自加入说明文字。',
    featureRules: '根据用户明确描述生成图片，遵循其中已提供的主体、构图与风格。',
    characterAdapter: visualAnchor.trim() ? `已确认的人物外观锚点（只用于保持外观一致）：\n${visualAnchor.trim()}` : '',
    runtimeData: { description },
    outputRules: '输出图片模型请求；图片描述必须保留，人物锚点只能用于外观一致性。',
  })
}
