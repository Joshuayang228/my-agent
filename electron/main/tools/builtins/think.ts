/**
 * Think Tool — 零副作用推理工具（M2 gap-audit + Anthropic Article 2）
 *
 * 和 extended thinking 的区别：
 * - Extended thinking：在回复前深度思考（模型内部）
 * - Think Tool：在工具调用链中间插入，收到工具结果后明确停下来反思
 *
 * 适用场景（Anthropic 建议）：
 * 1. 政策密集环境——遵循用户偏好 / 权限规则前先验证
 * 2. 顺序决策——确认上一步结果再决定下一步
 * 3. 工具输出分析——收到工具结果后整理信息再行动
 *
 * 特性：
 * - 零副作用：不读文件、不调网络、不改状态
 * - thoughts 不直接展示给用户（只出现在 tool_end 事件里，DevPanel 可见）
 * - maxResultSizeChars = Infinity：永不落盘（内容是自己的推理文本）
 *
 * 来源：Anthropic 内部评测，带领域示例的 think prompt 在航空客服场景提升 54%。
 * 价值：长工具链中保持一致性 + 遵循复杂规则不出错（对照 M9 用户偏好遵循）。
 */

import { buildTool } from '../builder'

export const thinkTool = buildTool({
  name: 'think',
  description: "在行动前使用此工具梳理问题，尤其适合遵循复杂规则或分析工具结果。\n\n该工具零副作用：不会读取文件、访问网络或改变任何状态。推理保留在内部，不直接展示给用户。\n\n适用场景：\n- 执行敏感操作前，验证沙箱权限和用户偏好\n- 收到工具结果后，在下一次调用前整理发现\n- 策略或偏好发生冲突时，推理正确处理方式\n\n不适用场景：\n- 已经明确如何处理的简单操作\n- 只需要直接执行的常规任务，不要过度思考\n\n格式：写一段简短、结构化的推理，包括已知情况、正在验证的内容和下一步行动。",

  parameters: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: "结构化思考：当前情况、正在验证的内容和下一步行动。",
      },
    },
    required: ['thought'],
  },

  metadata: {
    isReadOnly: true,
    isDestructive: false,
    isConcurrencySafe: true,
  },

  // 永不落盘：内容就是推理文字，不需要持久化
  maxResultSizeChars: Infinity,

  execute: async (args) => {
    if (typeof args.thought !== 'string' || !args.thought.trim() || args.thought.length > 20_000) return '错误：思考内容为空或过长'
    // 零副作用：只把思考原文返回，loop 里的 tool_end 事件会记录它
    return `[think] ${args.thought}`
  },
})
