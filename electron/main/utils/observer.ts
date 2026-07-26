/**
 * Observer 接口（M14）— 监控与业务解耦。
 * 对照灵犀 observability/observer.go：OnLLMStart/End、OnToolStart/End。
 * 默认实现桥接到现有 tracer span。
 */

import { startSpan, type SpanCaller, type SpanHandle } from './tracer'

export interface ObserverLLMStart {
  name: string
  caller: SpanCaller
  parentId?: string
  attributes?: Record<string, unknown>
}

export interface ObserverToolStart {
  name: string
  caller?: SpanCaller
  parentId?: string
  attributes?: Record<string, unknown>
}

export interface AgentObserver {
  onLLMStart(info: ObserverLLMStart): SpanHandle
  onLLMEnd(handle: SpanHandle, ok: boolean, error?: string): void
  onToolStart(info: ObserverToolStart): SpanHandle
  onToolEnd(handle: SpanHandle, ok: boolean, error?: string): void
}

/** 基于 tracer 的默认 Observer */
export class TracerObserver implements AgentObserver {
  onLLMStart(info: ObserverLLMStart): SpanHandle {
    return startSpan(
      info.name,
      info.caller,
      'llm_request',
      info.parentId,
      info.attributes ?? {},
    )
  }

  onLLMEnd(handle: SpanHandle, ok: boolean, error?: string): void {
    handle.end(ok ? 'ok' : 'error', error)
  }

  onToolStart(info: ObserverToolStart): SpanHandle {
    return startSpan(
      info.name,
      info.caller ?? 'tool',
      'tool',
      info.parentId,
      info.attributes ?? {},
    )
  }

  onToolEnd(handle: SpanHandle, ok: boolean, error?: string): void {
    handle.end(ok ? 'ok' : 'error', error)
  }
}

/** 组合扇出：Start 正序，End 逆序（灵犀 CompositeObserver） */
export class CompositeObserver implements AgentObserver {
  constructor(private observers: AgentObserver[]) {}

  onLLMStart(info: ObserverLLMStart): SpanHandle {
    const handles = this.observers.map(o => o.onLLMStart(info))
    return this.wrap(handles)
  }

  onLLMEnd(handle: SpanHandle, ok: boolean, error?: string): void {
    const handles = (handle as SpanHandle & { _children?: SpanHandle[] })._children ?? [handle]
    for (let i = handles.length - 1; i >= 0; i--) {
      this.observers[i]?.onLLMEnd(handles[i], ok, error)
    }
  }

  onToolStart(info: ObserverToolStart): SpanHandle {
    const handles = this.observers.map(o => o.onToolStart(info))
    return this.wrap(handles)
  }

  onToolEnd(handle: SpanHandle, ok: boolean, error?: string): void {
    const handles = (handle as SpanHandle & { _children?: SpanHandle[] })._children ?? [handle]
    for (let i = handles.length - 1; i >= 0; i--) {
      this.observers[i]?.onToolEnd(handles[i], ok, error)
    }
  }

  private wrap(handles: SpanHandle[]): SpanHandle {
    const primary = handles[0] ?? startSpan('noop', 'system', 'interaction')
    ;(primary as SpanHandle & { _children?: SpanHandle[] })._children = handles
    return primary
  }
}

let defaultObserver: AgentObserver = new TracerObserver()

export function getObserver(): AgentObserver {
  return defaultObserver
}

export function setObserver(observer: AgentObserver): void {
  defaultObserver = observer
}
