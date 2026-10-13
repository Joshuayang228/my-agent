import type { ChatMessage } from '../../../src/shared/types'
/** 压缩摘要唯一生产模板；调用方提供字数预算和关系白名单，目录使用同一函数展开占位符。 */
export function buildCompactPrompt(wordLimit: number | string, minSetSection: string): string {
  return `你正在为一个持续进行的对话生成压缩摘要。摘要将替换早期对话历史，供 AI 继续任务时参考。

请严格按以下结构化格式输出（每节简明扼要，缺失的节写「无」）：

## 当前任务
[用一句话说明用户的核心目标]

## 已完成步骤
[按顺序列出已完成的关键操作，无则写「无」]

## 当前状态
[进展到哪一步，遇到什么问题，无则写「无」]

## 下一步计划
[接下来应该做什么，无则写「无」]

## 关键上下文
[必须记住的信息：文件路径、变量名、配置值、用户偏好等，无则写「无」]

${minSetSection}

用中文回答，总字数控制在 ${wordLimit} 字以内。只输出上述结构，不要额外说明。`
}

export const RELATIONSHIP_MINSET_WHITELIST = [
  '称呼与沟通偏好',
  '进行中的共同约定',
  '未完成的情感锚点（用户要求先别提/别问的事）',
] as const

/** 写入压缩 instruction 的白名单说明（给摘要 LLM） */
export function formatMinSetWhitelistForCompactPrompt(): string {
  const bullets = RELATIONSHIP_MINSET_WHITELIST.map((w) => `- ${w}`).join('\n')
  return `## 关系最小集（必须保留）
以下类别若在对话中出现，必须写入本节，禁止省略或改写成「无」：
${bullets}
若原文没有则写「无」。不要编造未出现的关系事实。`
}


export function buildFileRestorePrompt(content: string): string {
  return `[压缩后文件恢复 — 以下是压缩前最近读取的文件内容，避免重复读取]\n\n${content}`
}

export function buildCompactSummaryPrompt(content: string): string {
  return `[自动压缩——完整对话摘要]\n${content}`
}

export function buildCompactHistoryPrompt(messages: ChatMessage[]): string {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => {
      if (m.role === 'tool') return `[工具结果] ${m.content.slice(0, 200)}`
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return `[助手调用了： ${m.toolCalls.map(tc => tc.name).join(', ')}]`
      }
      return `[${m.role === 'user' ? '用户' : '助手'}] ${m.content.slice(0, 300)}`
    })
    .join('\n')
    .slice(0, 6000)
}
