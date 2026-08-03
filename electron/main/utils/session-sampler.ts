/**
 * Session-based 确定性采样（可观测预算）。
 *
 * 背景：全量 span 在长会话下撑满 MAX_SPANS；需要按会话整收/整丢，避免半截调用树。
 * 策略：对 sessionId 做 sha256 → [0,1) 分位，与 sampleRate 比较；同会话结果恒定。
 * 对照：灵犀 observability/session_sampler.go。
 * 约束：无 sessionId 时默认采样（保留 system/startup 类 span）；rate 钳制在 [0,1]。
 * 调用方：tracer.startSpan；测试可通过 setTraceSampleRate 覆盖。
 * 边界：rate≥1 全收；rate≤0 仅保留无 session 的 span。
 */

import { createHash } from 'node:crypto'

let sampleRate = parseInitialRate()

function parseInitialRate(): number {
  const raw = process.env.MY_AGENT_TRACE_SAMPLE_RATE
  if (raw === undefined || raw.trim() === '') return 1
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  return clampRate(n)
}

function clampRate(rate: number): number {
  if (rate <= 0) return 0
  if (rate >= 1) return 1
  return rate
}

/** 当前采样率（1 = 全收，默认） */
export function getTraceSampleRate(): number {
  return sampleRate
}

/** 设置采样率；供设置页/测试。返回钳制后的值。 */
export function setTraceSampleRate(rate: number): number {
  sampleRate = clampRate(rate)
  return sampleRate
}

/**
 * 将会话 ID 映射到 [0, 1) 的稳定分位。
 */
export function sessionSampleBucket(sessionId: string): number {
  const digest = createHash('sha256').update(sessionId, 'utf8').digest()
  const n = digest.readUInt32BE(0)
  return n / 0x1_0000_0000
}

/**
 * 是否记录该会话的 span。
 * - 无 sessionId → true（不误伤无会话埋点）
 * - 有 sessionId → bucket < sampleRate
 */
export function shouldSampleSession(sessionId: string | undefined | null): boolean {
  if (sampleRate >= 1) return true
  const id = typeof sessionId === 'string' ? sessionId.trim() : ''
  if (!id) return true
  if (sampleRate <= 0) return false
  return sessionSampleBucket(id) < sampleRate
}
