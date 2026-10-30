import { composeFeaturePrompt } from './composition'

export interface MomentCommentInput {
  posterName: string
  postText: string
  commenterName: string
  commenterBrief: string
}

/** 评论的真实资源与输出边界；生成器、解析器和只读策略目录共同消费，禁止在注册表复制数值。 */
export const MOMENT_COMMENT_POLICY = Object.freeze({
  minCharacters: 2, maxCharacters: 80, maxPostCharacters: 1500,
  maxBriefCharacters: 600, temperature: 0.65, maxTokens: 160,
})

/** 背景：固定短句没有回应动态内容；意图：以公开名册和已发布正文生成指定角色的评论，不读取其他人物私有人设。
 * 约束：数据中的指令不执行；不冒充用户、不新增已发生的行程或关系事实，输出由服务再次校验。
 */
export function buildMomentCommentPrompt(input: MomentCommentInput): string {
  return composeFeaturePrompt('momentComment', {
    platformRules: '只使用已发布动态和公开关系事实；不冒充用户或发帖人，不凭姓名推断身份，不编造经历、约会或行动承诺。',
    featureRules: '为一条已发布的朋友圈动态写自然短评论，评论者只能是资料中的 commenterName。',
    characterAdapter: `评论者：${input.commenterName}\n公开简介：${input.commenterBrief || '无'}`,
    runtimeData: { posterName: input.posterName, postText: input.postText },
    outputRules: `只输出 JSON 对象 {"comment":"评论正文"}，正文 ${MOMENT_COMMENT_POLICY.minCharacters} 到 ${MOMENT_COMMENT_POLICY.maxCharacters} 字，不加角色前缀、旁白或其他字段。`,
  })
}
