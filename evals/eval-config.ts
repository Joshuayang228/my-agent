/**
 * Eval 运行配置。
 *
 * 背景：Electron 主进程会在启动时加载项目 `.env`，但 Vitest 直接运行 Eval 时不会经过
 *       Electron 入口，导致远程验收无法复用已有 DeepSeek 配置。
 * 设计意图：在 Eval 边界集中加载 `.env`、解析 real/mock 模式和 pass^k，避免各场景自行
 *       读取环境变量或静默降级。
 * 关键约束：只判断 Key 是否存在，不返回或记录 Key 内容；real 模式缺 Key 必须显式失败。
 */

import { config as loadDotenv } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type EvalMode = 'mock' | 'real'

const evalDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(evalDir, '..')

let envLoaded = false

export function loadEvalEnvironment(): void {
  if (envLoaded) return
  loadDotenv({ path: path.join(projectRoot, '.env'), quiet: true })
  envLoaded = true
}

export function getEvalMode(fallback: EvalMode = 'mock'): EvalMode {
  loadEvalEnvironment()
  const raw = (process.env.EVAL_MODE || fallback).trim().toLowerCase()
  if (raw === 'mock' || raw === 'real') return raw
  throw new Error(`EVAL_MODE 只支持 mock 或 real，当前值为 ${raw || '(empty)'}`)
}

export function hasEvalApiKey(): boolean {
  loadEvalEnvironment()
  return Boolean((process.env.TEST_LLM_API_KEY || process.env.LLM_API_KEY || '').trim())
}

export function getEvalPassK(defaultValue = 3): number {
  loadEvalEnvironment()
  const raw = process.env.EVAL_PASS_K?.trim()
  if (!raw) return defaultValue
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error(`EVAL_PASS_K 必须是 1–10 的整数，当前值为 ${raw}`)
  }
  return value
}

export function getEvalModelInfo(): {
  baseUrl: string
  model: string
  hasApiKey: boolean
} {
  loadEvalEnvironment()
  return {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4o',
    hasApiKey: hasEvalApiKey(),
  }
}

export const __test = {
  resetEnvironmentState() {
    envLoaded = false
  },
}
