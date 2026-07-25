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
  description: `Use this tool to think through a problem before acting — especially when following complex rules or analyzing tool results.

This tool has ZERO side effects: it does NOT read files, make network calls, or change any state. Your reasoning stays internal and is NOT shown to the user.

When to use:
- Before executing a sensitive action: verify sandbox permissions, check user preferences
- After receiving tool results: organize findings before the next tool call
- When policy or preferences conflict: reason through the right approach

When NOT to use:
- Simple, clear-cut actions you already know how to handle
- When you just need to do it — don't overthink routine tasks

Format: write a brief structured reasoning (what you know, what you're checking, what you'll do next).`,

  parameters: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: 'Structured reasoning: current situation, what you\'re verifying, next action.',
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
    // 零副作用：只把思考原文返回，loop 里的 tool_end 事件会记录它
    return `[think] ${args.thought as string}`
  },
})
