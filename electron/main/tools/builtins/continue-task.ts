/**
 * continue_task 工具 — 对已有子 Agent 追加消息续跑（Coordinator continue 机制）。
 *
 * 对应 CC 的 SendMessage：不新建子 Agent，而是继续已有实例的上下文。
 * 场景：研究子 Agent 跑完→父 Agent 综合→给同一个子 Agent 下达实现指令（它已有研究上下文）。
 *
 * Alice Ch.6 continue vs spawn 判据：
 * - 上下文重叠高（研究者已读过要改的文件）→ continue
 * - 上下文重叠低（全新方向 / 验证者不该带实现假设）→ 新 delegate_task
 */
import { buildTool } from '../builder'
import { continueSubAgent } from '../../agent/subagent-registry'

export const continueTaskTool = buildTool({
  name: 'continue_task',
  description: "向已有子 Agent 发送后续消息并继续任务。子 Agent 会保留上一次运行的完整对话历史和上下文。\n\n适用场景（Alice Ch.6：continue 与 spawn 的区别）：\n- 子 Agent 上一次的上下文与新任务直接相关，例如它已经研究过现在要修改的文件\n- 修正失败或扩展最近完成的工作，因为它已经掌握错误上下文\n- 子 Agent 完成研究后，再给出具体实现要求\n\n不适用场景（应新建 delegate_task）：\n- 新任务与子 Agent 之前完成的工作无关\n- 需要全新视角，例如验证者不应携带实现阶段的假设\n- 第一次方案完全错误，旧上下文会污染重试\n\n重要：后续消息必须自包含，提供子 Agent 所需的文件路径、行号和具体指令。子 Agent 能看到自己的历史，但看不到你与用户的对话。",
  parameters: {
    type: 'object',
    properties: {
      agent_id: {
        type: 'string',
        description: "上一次 delegate_task 调用返回的 Agent ID。",
      },
      message: {
        type: 'string',
        description: "发送给子 Agent 的后续消息或指令；必须具体且自包含。",
      },
    },
    required: ['agent_id', 'message'],
  },
  metadata: {
    isReadOnly: true,
    isConcurrencySafe: true,
    longRunning: true,  // continue 也跑完整子 Agent 循环，跳过 30s 超时
  },
  execute: async (args, toolContext) => {
    const agentId = args.agent_id as string
    const message = args.message as string

    if (!agentId?.trim()) return '[错误] 必须提供 agent_id'
    if (!message?.trim()) return '[错误] 必须提供 message'

    const result = await continueSubAgent(agentId, message, toolContext?.signal)

    const header = result.success ? '✅ 子 Agent 已继续执行' : '❌ 子 Agent 继续执行失败'
    const meta = result.toolsUsed.length > 0
      ? `\n使用工具：${result.toolsUsed.join(', ')}（${result.iterations} 次迭代）`
      : ''

    return `${header}${meta}\nAgent ID：${agentId}\n\n${result.content}`
  },
})
