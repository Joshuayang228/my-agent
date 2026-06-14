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

export function createLogger(module: string) {
  function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[globalLevel]) return

    const time = new Date().toISOString().slice(11, 23)
    const color = LEVEL_COLORS[level]
    const prefix = `${color}[${time}] [${level.toUpperCase()}] [${module}]${RESET}`

    if (data && Object.keys(data).length > 0) {
      console.log(`${prefix} ${message}`, data)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }

  return {
    debug: (msg: string, data?: Record<string, unknown>) => log('debug', msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log('info', msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log('warn', msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log('error', msg, data),
  }
}
