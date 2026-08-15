import { appendFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',  // cyan
  info: '\x1b[32m',   // green
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
}

const RESET = '\x1b[0m'

let globalLevel: LogLevel = process.env.LOG_LEVEL as LogLevel || 'info'

export function setLogLevel(level: LogLevel): void {
  globalLevel = level
}

// ── 文件落盘（G4）──
// 只在 Electron 主进程可用；测试/无 app 环境自动降级为仅 console。

/** 保留最近多少天的日志文件，超出删最旧 */
const MAX_LOG_DAYS = 7

let logDir: string | null = null
let logDirResolved = false

/**
 * 惰性解析日志目录。首次写日志时调用一次。
 * 拿不到 electron app（测试环境 / app 未 ready）时返回 null，落盘降级为跳过。
 */
function resolveLogDir(): string | null {
  if (logDirResolved) return logDir
  logDirResolved = true
  try {
    // 动态 require 避免测试环境静态 import electron 崩溃
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    const dir = join(app.getPath('logs'), 'my-agent')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    logDir = dir
    cleanupOldLogs(dir)
  } catch {
    logDir = null  // 无 app：仅 console，不落盘
  }
  return logDir
}

/** 当前日期的日志文件名 agent-YYYY-MM-DD.log */
function currentLogFile(dir: string): string {
  const date = new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
  return join(dir, `agent-${date}.log`)
}

/**
 * 纯函数：从日志文件名列表选出需删除的（超过 maxDays 的最旧的）。
 * 文件名含日期，字典序 = 时间序。便于测试，不碰文件系统。
 */
export function selectExpiredLogs(files: string[], maxDays: number = MAX_LOG_DAYS): string[] {
  const logs = files.filter(f => /^agent-\d{4}-\d{2}-\d{2}\.log$/.test(f)).sort()
  if (logs.length <= maxDays) return []
  return logs.slice(0, logs.length - maxDays)
}

/** 删除超过 MAX_LOG_DAYS 的旧日志文件 */
function cleanupOldLogs(dir: string): void {
  try {
    const expired = selectExpiredLogs(readdirSync(dir))
    for (const f of expired) {
      unlinkSync(join(dir, f))
    }
  } catch { /* 清理失败不影响写日志 */ }
}

/** 写一行到当天日志文件（纯文本，无 ANSI 颜色码） */
function writeToFile(line: string): void {
  const dir = resolveLogDir()
  if (!dir) return
  try {
    appendFileSync(currentLogFile(dir), line + '\n', 'utf-8')
  } catch { /* 落盘失败不影响 console 输出 */ }
}

const SENSITIVE_KEY_PATTERN = /^(?:api[-_]?key|apikey|access[-_]?token|accesstoken|auth(?:orization)?|bearer|client[-_]?secret|clientsecret|credential|password|refresh[-_]?token|refreshtoken|secret|token)$/i
const SENSITIVE_VALUE_PATTERN = /(?:Bearer\s+|sk-(?:ant-)?|gh[pousr]_|github_pat_|xox[baprs]-)[A-Za-z0-9._~+/=-]{8,}/gi
const SENSITIVE_URL_PARAM_PATTERN = /([?&](?:api[-_]?key|access[-_]?token|token|secret|password)=)[^&#\s"']+/gi

/** 只用于日志关联，不可逆推出原文的短指纹。 */
export function hashForLog(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16)
}

/**
 * 脱敏日志字段，避免 console 和落盘日志成为凭据泄漏路径。
 *
 * 背景：日志会同时输出到开发者控制台和本地文件，工具参数、LLM 错误和 MCP
 * 返回值都可能意外携带 API key 或 token。
 * 策略：敏感字段名直接替换，普通字符串再扫描常见凭据前缀；递归处理数组和对象。
 * 约束：只接收 JSON-like 数据，不修改调用方对象；循环引用由占位文本收敛。
 * 调用方：createLogger 的 console 与文件输出入口。
 * 边界情况：undefined、BigInt、循环引用和序列化失败均不抛错。
 */
export function sanitizeLogData(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]'
  if (typeof value === 'string') return value
    .replace(SENSITIVE_VALUE_PATTERN, '[REDACTED]')
    .replace(SENSITIVE_URL_PARAM_PATTERN, '$1[REDACTED]')
  if (typeof value === 'bigint') return `${value}n`
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (Array.isArray(value)) return value.map(item => sanitizeLogData(item, undefined, seen))

  const result: Record<string, unknown> = {}
  for (const [childKey, childValue] of Object.entries(value)) {
    result[childKey] = sanitizeLogData(childValue, childKey, seen)
  }
  return result
}

export function createLogger(module: string) {
  function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[globalLevel]) return

    const time = new Date().toISOString().slice(11, 23)
    const color = LEVEL_COLORS[level]
    const prefix = `${color}[${time}] [${level.toUpperCase()}] [${module}]${RESET}`
    // console 与落盘必须使用同一份脱敏数据，避免只保护文件日志而泄漏到开发者控制台。
    const safeMessage = message
      .replace(SENSITIVE_VALUE_PATTERN, '[REDACTED]')
      .replace(SENSITIVE_URL_PARAM_PATTERN, '$1[REDACTED]')
    const safeData = data ? sanitizeLogData(data) as Record<string, unknown> : undefined
    // 落盘用无颜色前缀
    const plainPrefix = `[${time}] [${level.toUpperCase()}] [${module}]`

    if (safeData && Object.keys(safeData).length > 0) {
      console.log(`${prefix} ${safeMessage}`, safeData)
      writeToFile(`${plainPrefix} ${safeMessage} ${safeStringify(safeData)}`)
    } else {
      console.log(`${prefix} ${safeMessage}`)
      writeToFile(`${plainPrefix} ${safeMessage}`)
    }
  }

  return {
    debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log('info', msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),
  }
}

/** 安全序列化 data —— 处理循环引用/BigInt 等，落盘不因序列化失败而抛错 */
function safeStringify(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data)
  } catch {
    return '[unserializable]'
  }
}
