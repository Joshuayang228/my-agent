import type { ToolDefinition } from '../../../src/shared/types'

const HEADLESS_BLOCKED_TOOLS = new Set(['shell_exec', 'delegate_task', 'continue_task'])

/**
 * 判断后台定时任务是否可以自动批准工具。
 *
 * 背景：Headless 运行没有可交互的用户确认窗口，任何误判都会把定时任务变成无人值守
 * 的文件、Git 或子 Agent 执行入口。设计意图：只自动批准明确声明为只读且不具备继续
 * 其他 Agent / 扩大副作用能力的工具；其余工具宁可让任务失败，也不把确认默认为允许。
 * 关键约束：`isReadOnly` 只是工具元数据，不允许覆盖显式的高风险工具黑名单。
 */
export function shouldAutoApproveHeadlessTool(
  toolName: string,
  tool: Pick<ToolDefinition, 'metadata'> | undefined,
): boolean {
  if (!tool || HEADLESS_BLOCKED_TOOLS.has(toolName)) return false
  return tool.metadata.isReadOnly === true && tool.metadata.isDestructive !== true
}

export const __test = { HEADLESS_BLOCKED_TOOLS }
