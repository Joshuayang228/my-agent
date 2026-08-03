/**
 * Chat 流式 Callback 通道类型（对照灵犀 callback.go）。
 *
 * reasoning / content / tool 各有 Start → Progress → Complete；
 * UI 与 apply 函数共用此相位，避免 App 里一个大 switch 搅在一起。
 */

export type CallbackPhase = 'idle' | 'active' | 'complete'

export interface ReasoningChunk {
  content: string
}

export interface ReasoningCallbackState {
  phase: CallbackPhase
  chunks: ReasoningChunk[]
}

export interface ToolCallbackItem {
  callId: string
  name: string
  args: Record<string, unknown>
  /** pending=Start(解析参数) running=Progress done|error=Complete */
  status: 'pending' | 'running' | 'done' | 'error'
  result?: string
  streamingArgs?: string
  collapsed?: boolean
}

export function toolItemPhase(status: ToolCallbackItem['status']): CallbackPhase {
  if (status === 'done' || status === 'error') return 'complete'
  if (status === 'pending' || status === 'running') return 'active'
  return 'idle'
}

export function reasoningPhase(chunks: ReasoningChunk[], streaming: boolean): CallbackPhase {
  if (chunks.length === 0) return 'idle'
  return streaming ? 'active' : 'complete'
}
