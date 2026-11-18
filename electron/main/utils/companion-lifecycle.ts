let lifecycle = new AbortController()

export function captureCompanionLifecycle(): AbortSignal {
  return lifecycle.signal
}

/**
 * 背景：人物或世界观可能在旧请求等待模型时发生切换，甚至先切走再切回。
 * 设计意图：每次切换使该代所有在途执行失效，即使角色 ID 最终相同也能区分。
 * 关键约束：先发布新代，再中止旧代，取消回调取得的是新代信号。
 */
export function invalidateCompanionLifecycle(): void {
  const previous = lifecycle
  lifecycle = new AbortController()
  previous.abort(new DOMException('人物世界运行范围已变更。', 'AbortError'))
}
