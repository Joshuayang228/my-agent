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

export interface ImageDirectorPromptInput {
  roleName: string
  artStyle: string
  appearanceAnchor?: string
  description: string
  category: string
  compositionGuide: string
  includeCharacter: boolean
  timeLabel: string
  moodSummary?: string
  currentOutfit?: string
  availableRooms?: ReadonlyArray<{ id: string; name: string }>
}

/**
 * 角色生图「绘画导演」扩写提示词。
 *
 * 背景：直接把 10~30 字的简短生活描述扔给生图模型容易出图平淡、光线单调或动作呆板；
 * 由辅助 LLM 充当美术导演，结合时段光线、心情、穿着与构图方向扩写为画面感更强的提示词，
 * 同时判断该场景是否对应角色的某个固定房间以及最合适的画幅比例。
 * 设计意图：纯中文结构化 JSON 输出，明确区分“主角出镜”与“纯食物/风景/静物无人物”两类镜头，
 * 绝不编造未提供的新角色或画中文字。
 * 关键约束：仅输出合法 JSON 对象，不带 Markdown 代码块或额外解释。
 */
export function buildImageDirectorPrompt(input: ImageDirectorPromptInput): string {
  return composeFeaturePrompt('imageDirector', {
    platformRules: '不得编造未提供的其他人物身份，不得在画面要求中加入文字、水印、气泡或手机边框；严格遵守 includeCharacter 标志，当为 false 时画面中绝不出现主角人物。',
    featureRules: '你是一位审美细腻的插画与摄影美术导演。请把简短的场景描述扩写成 80~180 字、画面感饱满的中文生图提示词：补足当前时段的自然光线、景别构图、环境材质、人物自然动作与神情（而非呆板直视镜头）。同时从可用房间列表中判断是否命中某个房间 ID，并选择最合适的画幅比例（1:1 / 3:4 / 4:3 / 16:9 / 9:16）。',
    characterAdapter: [
      `角色名：${input.roleName}`,
      `统一画风：${input.artStyle}`,
      input.includeCharacter && input.appearanceAnchor ? `已确认外观与穿着：${input.appearanceAnchor}` : '本镜头不出现主角人物，聚焦食物、风景或氛围静物。',
      `构图方向：${input.compositionGuide}`,
    ].join('\n'),
    runtimeData: {
      description: input.description,
      category: input.category,
      includeCharacter: input.includeCharacter,
      timeLabel: input.timeLabel,
      moodSummary: input.moodSummary || '',
      currentOutfit: input.currentOutfit || '',
      availableRooms: input.availableRooms ?? [],
    },
    outputRules: '只输出一个纯 JSON 对象：{"prompt":"扩写后的中文绘画提示词","homeRoom":"命中的房间id或null","aspectRatio":"1:1|3:4|4:3|16:9|9:16"}',
  })
}
