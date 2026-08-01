/**
 * 流式会话探针（打破 companion ↔ agent 循环依赖）
 *
 * 背景：Orchestrator 切换主角时需知道是否有进行中的 chat 流，但 companion 层不能 import agent/。
 * 意图：由 runtime 启动时注册探针；requestSwitch 只读此模块。
 * 约束：未注册时视为无活跃流（测试/早启动安全）。
 */

let streamingProbe: (() => boolean) | null = null

export function registerStreamingProbe(probe: () => boolean): void {
  streamingProbe = probe
}

export function isStreamingActive(): boolean {
  return streamingProbe?.() ?? false
}
