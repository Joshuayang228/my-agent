/**
 * 面板尺寸持久化（右坞 / 侧栏可拖分界）
 *
 * 背景：固定 260/380 无法兼顾双屏与窄窗；尺寸应跨重启保留。
 * 设计意图：localStorage 存数值，读写带 clamp，避免拖没。
 * 关键约束：仅渲染进程；键名统一 layout.* 前缀。
 */

import { useCallback, useState } from 'react'

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function readPersistedNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null || raw === '') return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

export function writePersistedNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch { /* ignore quota */ }
}

/** React state + localStorage，变更即落盘 */
export function usePersistedNumber(
  key: string,
  fallback: number,
  bounds: { min: number; max: number },
): [number, (next: number | ((prev: number) => number)) => void] {
  const [value, setValue] = useState(() =>
    clamp(readPersistedNumber(key, fallback), bounds.min, bounds.max),
  )

  const setPersisted = useCallback(
    (next: number | ((prev: number) => number)) => {
      setValue((prev) => {
        const raw = typeof next === 'function' ? next(prev) : next
        const v = clamp(raw, bounds.min, bounds.max)
        writePersistedNumber(key, v)
        return v
      })
    },
    [key, bounds.min, bounds.max],
  )

  return [value, setPersisted]
}

export const LAYOUT_KEYS = {
  sidebarWidth: 'layout.sidebarWidth',
  rightDockWidth: 'layout.rightDockWidth',
  fileTreeRatio: 'layout.fileTreeRatio',
  reviewListRatio: 'layout.reviewListRatio',
} as const

export const LAYOUT_BOUNDS = {
  sidebarWidth: { min: 200, max: 420, fallback: 260 },
  rightDockWidth: { min: 280, max: 720, fallback: 380 },
  fileTreeRatio: { min: 0.2, max: 0.75, fallback: 0.42 },
  reviewListRatio: { min: 0.2, max: 0.75, fallback: 0.4 },
} as const
