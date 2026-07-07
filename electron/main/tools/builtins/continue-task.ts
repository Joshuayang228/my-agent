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
  description: `Continue an existing sub-agent with a follow-up message. The sub-agent retains its full conversation history and context from the previous run.

**When to use (Alice Ch.6 continue vs spawn):**
- The sub-agent's prior context is directly relevant to the new task (e.g., it researched the files you now want it to modify)
- Correcting a failure or extending recent work (it has the error context)
- Giving a specific implementation spec after it finished research

**When NOT to use (spawn a new delegate_task instead):**
- The new task is unrelated to what the sub-agent did before
- You want a fresh perspective (e.g., a verifier shouldn't carry implementation assumptions)
- The first approach was completely wrong (wrong context pollutes retry)

**Important:** Your message must be self-contained with everything the sub-agent needs — include file paths, line numbers, specific instructions. The sub-agent can see its own history but NOT your conversation with the user.`,
  parameters: {
    type: 'object',
    properties: {
      agent_id: {
        type: 'string',
        description: 'The agent ID returned by a previous delegate_task call',
      },
      message: {
        type: 'string',
        description: 'The follow-up message/instruction to send to the sub-agent. Be specific and self-contained.',
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

    if (!agentId?.trim()) return '[Error] agent_id is required'
    if (!message?.trim()) return '[Error] message is required'

    const result = await continueSubAgent(agentId, message, toolContext?.signal)

    const header = result.success ? '✅ Sub-agent continued' : '❌ Sub-agent continue failed'
    const meta = result.toolsUsed.length > 0
      ? `\nTools used: ${result.toolsUsed.join(', ')} (${result.iterations} iterations)`
      : ''

    return `${header}${meta}\nAgent ID: ${agentId}\n\n${result.content}`
  },
})
