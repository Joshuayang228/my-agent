import type { ImageAttachment } from '../../../src/shared/types'

/**
 * 背景：图片材料可能被人物用于阅读记录，但看图结果不能直接变成生活事实。
 * 设计意图：先要求模型只输出可核对观察、推断和不确定性，写回仍由独立工具完成。
 * 关键约束：图片是运行时输入；来源标签只描述材料边界，不允许模型补造书名、页码或经历。
 */
export function buildMaterialObservationPrompt(input: { source: string; image: ImageAttachment }): string {
  return [
    '你是人物材料观察器。请只分析随消息附带的图片材料，不要把聊天上下文或文件名当作图片事实。',
    `材料来源范围：${input.source.trim().slice(0, 300) || '未说明'}。`,
    '输出严格 JSON：{"observation":"图片中可以直接核对的内容","inference":"基于观察的有限推断，可为空","uncertainties":["无法确认的内容"]}。',
    'observation 只写看得见的文字、版式、物体或明确关系；inference 必须与 observation 分开，不得冒充原文。',
    '看不清、无法确认或缺少上下文时写入 uncertainties；不要猜书名、作者、页码、人物经历或情绪。',
  ].join('\n')
}
