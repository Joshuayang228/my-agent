/**
 * 背景：子任务与权限拒绝都有固定生产指令，不能只在目录写摘要。
 * 意图：纯函数提供正文与占位模板；角色选择及权限状态仍由 Agent 层负责。
 * 约束：不导入 Agent、LLM 或存储；抽取保持原有文本与失败处理。
 */
export function buildDeniedToolsPromptSuffix(
  deniedTools: Array<{ name: string; reason: string }>,
  deniedCommands: Array<{ command: string; reason: string }> = [],
): string {
  if (deniedTools.length === 0 && deniedCommands.length === 0) return ''
  const parts: string[] = []
  if (deniedTools.length > 0) {
    const lines = deniedTools.map(d => `- ${d.name}: ${d.reason}`)
    parts.push(`[系统] 本次会话中以下工具已被拒绝。不要原样重试；请改用能实现用户目标的更安全方案，或向用户说明继续操作需要什么：\n${lines.join('\n')}`)
  }
  if (deniedCommands.length > 0) {
    const lines = deniedCommands.map(d => `- ${d.command}: ${d.reason}`)
    parts.push(`[系统] 本次会话中以下命令已被沙箱阻止。不要再次运行；请改用其他方式达成目标（更安全的命令、专用工具，或请求用户调整沙箱）：\n${lines.join('\n')}`)
  }
  return `\n\n${parts.join('\n\n')}`
}

export function buildSubAgentPrompt(roleDescription: string, boundary: string): string {
  return `你是一个专门执行任务的子 Agent，角色如下：

${roleDescription}

重要约束：
- 只专注于交给你的任务。
- 不要闲聊，也不要提出澄清问题；直接完成任务。
- 用清晰、结构化的方式返回结果。
- 如果现有工具不足以完成任务，说明还需要什么。
- 回复保持简洁、可执行。${boundary}`
}

export const OUTPUT_RECOVERY_PROMPT = '[系统] 你上一条回复因长度限制被截断，请从中断处继续。'

export function buildTimeContextPrompt(time: string, content: string): string {
  return `[当前时间: ${time}]\n${content}`
}
