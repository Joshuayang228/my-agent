/**
 * LLM SSE fixture 回放（M17 G2）
 *
 * 把 OpenAI 兼容的 `data: {...}` 行解析为与 streamChat 相同的 chunk 形状，
 * 供单测 / eval 确定性回放，无需真实网络。
 */

export type ReplayChunk =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; argumentsDelta?: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number }

export interface ReplayResult {
  content: string | null
  toolCalls: Array<{ id: string; name: string; arguments: string }>
  usage: { promptTokens: number; completionTokens: number } | null
  stopReason?: string
}

/** 将多行 SSE 文本拆成 data payload（忽略空行与 [DONE]） */
export function parseSseDataLines(sseText: string): string[] {
  const out: string[] = []
  for (const raw of sseText.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6)
    if (data === '[DONE]') continue
    out.push(data)
  }
  return out
}

/**
 * 回放 OpenAI chat.completion.chunk 风格 SSE。
 * 与 electron/main/llm/index.ts 中 OpenAI 流解析逻辑对齐（简化版）。
 */
export async function* replayOpenAiSse(sseText: string): AsyncGenerator<ReplayChunk, ReplayResult> {
  let contentAcc = ''
  const toolCallsAcc = new Map<number, { id: string; name: string; arguments: string }>()
  let usage: { promptTokens: number; completionTokens: number } | null = null
  let stopReason: string | undefined

  for (const data of parseSseDataLines(sseText)) {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(data) as Record<string, unknown>
    } catch {
      continue
    }

    const u = parsed.usage as Record<string, number> | undefined
    if (u) {
      usage = {
        promptTokens: (u.prompt_tokens ?? 0) > 0 ? u.prompt_tokens : (usage?.promptTokens ?? 0),
        completionTokens:
          (u.completion_tokens ?? 0) > 0 ? u.completion_tokens : (usage?.completionTokens ?? 0),
      }
    }

    const choices = parsed.choices as Array<Record<string, unknown>> | undefined
    if (!choices?.length) continue

    const finishReason = choices[0].finish_reason as string | undefined
    if (finishReason) stopReason = finishReason

    const delta = choices[0].delta as Record<string, unknown> | undefined
    if (!delta) continue

    const textContent = delta.content as string | undefined
    if (textContent) {
      contentAcc += textContent
      yield { type: 'text', content: textContent }
    }

    const reasoning = delta.reasoning_content as string | undefined
    if (reasoning) {
      yield { type: 'thinking', content: reasoning }
    }

    const tcDeltas = delta.tool_calls as Array<Record<string, unknown>> | undefined
    if (tcDeltas) {
      for (const tcDelta of tcDeltas) {
        const index = tcDelta.index as number
        const fn = tcDelta.function as Record<string, unknown> | undefined
        const existing = toolCallsAcc.get(index)
        if (!existing) {
          const id = (tcDelta.id as string) || ''
          const name = (fn?.name as string) || ''
          const argChunk = (fn?.arguments as string) || ''
          toolCallsAcc.set(index, { id, name, arguments: argChunk })
          yield {
            type: 'tool_call_delta',
            index,
            id: id || undefined,
            name: name || undefined,
            argumentsDelta: argChunk,
          }
        } else {
          const argChunk = (fn?.arguments as string) || ''
          if (argChunk) {
            existing.arguments += argChunk
            yield { type: 'tool_call_delta', index, argumentsDelta: argChunk }
          }
        }
      }
    }
  }

  if (usage) {
    yield { type: 'usage', promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
  }

  return {
    content: contentAcc || null,
    toolCalls: Array.from(toolCallsAcc.values()).map(tc => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
    usage,
    stopReason,
  }
}
