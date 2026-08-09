/**
 * 对话内 debugMode 纯函数（M32-G7）。
 *
 * 背景：全页 Debug/Playground 与聊天叠加是两码事；叠加层开关与展示计算需可单测。
 * 调用方：App 聊天底栏、ConversationDebugOverlay、settings 读写。
 */

export function parseConversationDebugMode(value: string | undefined | null): boolean {
  return value === 'true' || value === '1'
}

/** 上下文占用比；maxTokens≤0 时返回 0（无预算则不画危险色）。 */
export function tokenUsageRatio(
  promptTokens: number,
  completionTokens: number,
  maxTokens: number,
): number {
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) return 0
  const used = Math.max(0, promptTokens) + Math.max(0, completionTokens)
  return Math.min(1, used / maxTokens)
}

export function formatTokenK(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(Math.round(n))
  return `${(n / 1000).toFixed(1)}k`
}

export function formatDuration(ms: number | undefined): string {
  if (!Number.isFinite(ms) || ms == null || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export interface ConversationDebugEvent {
  time: number
  type: string
  detail: string
}

export type ConversationDebugCallStatus = 'running' | 'success' | 'error'

export interface ConversationDebugCall {
  id: string
  startedAt: number
  finishedAt?: number
  durationMs?: number
  model: string
  caller?: string
  status: ConversationDebugCallStatus
  promptTokens: number
  completionTokens: number
  toolCount?: number
  toolNames: string[]
  error?: string
}

function parseUsage(detail: string): { promptTokens: number; completionTokens: number } {
  const match = detail.match(/in:(\d+)\s+out:(\d+)/)
  return {
    promptTokens: match ? Number(match[1]) : 0,
    completionTokens: match ? Number(match[2]) : 0,
  }
}

function parseToolName(detail: string): string {
  return detail.match(/^[^ (→]+/)?.[0] ?? detail
}

/**
 * 将已有 AgentStreamEvent 日志压缩为 Alice 风格的 LLM 调用链。
 *
 * 背景：对话侧栏需要帮助用户判断一次请求调用了几轮模型，而不是重复展示
 *       text/thinking 等高频流式事件；全量事件仍由全页 Debug Console 保留。
 *
 * 策略：usage 作为一次模型响应的结束标记，tool_start/tool_end 挂到最近一次
 *       调用；下一段 text/thinking 或 usage 开始新的调用。当前事件契约没有
 *       独立的 llm_start/end，因此耗时是从首个可见事件到 usage/error 的近似值。
 *
 * 调用方：ConversationDebugAside 渲染前的派生数据计算。
 *
 * 边界：没有 usage 的失败请求仍保留为 error；没有任何事件时返回空数组；
 *       malformed usage 文案按 0 tokens 降级，不阻塞侧栏渲染。
 */
export function buildConversationDebugCalls(
  events: ConversationDebugEvent[],
  model: string,
): ConversationDebugCall[] {
  const calls: ConversationDebugCall[] = []
  let current: ConversationDebugCall | null = null
  let sequence = 0
  const modelName = model.trim() || '未知模型'

  const startCall = (time: number): ConversationDebugCall => {
    const call: ConversationDebugCall = {
      id: `call-${++sequence}`,
      startedAt: time,
      model: modelName,
      status: 'running',
      promptTokens: 0,
      completionTokens: 0,
      toolNames: [],
    }
    calls.push(call)
    current = call
    return call
  }

  const ensureRunning = (time: number): ConversationDebugCall =>
    current?.status === 'running' ? current : startCall(time)

  const finish = (call: ConversationDebugCall, time: number, status: ConversationDebugCallStatus) => {
    call.finishedAt = time
    call.durationMs = Math.max(0, time - call.startedAt)
    call.status = status
  }

  for (const event of events) {
    if (event.type === 'text' || event.type === 'thinking' || event.type === 'tool_call_delta') {
      ensureRunning(event.time)
      continue
    }

    if (event.type === 'usage') {
      const call = ensureRunning(event.time)
      const usage = parseUsage(event.detail)
      call.promptTokens = usage.promptTokens
      call.completionTokens = usage.completionTokens
      finish(call, event.time, 'success')
      continue
    }

    if (event.type === 'tool_start' || event.type === 'tool_end') {
      const call = current ?? startCall(event.time)
      const toolName = parseToolName(event.detail)
      if (toolName && !call.toolNames.includes(toolName)) call.toolNames.push(toolName)
      continue
    }

    if (event.type === 'error') {
      const call = ensureRunning(event.time)
      call.error = event.detail
      finish(call, event.time, 'error')
      continue
    }

    const lastCall = calls[calls.length - 1]
    if (event.type === 'done' && lastCall?.status === 'running') {
      finish(lastCall, event.time, 'success')
    }
  }

  return calls
}
