/**
 * logger 测试（M07 G4 日志落盘）
 *
 * 重点测纯函数 selectExpiredLogs（轮转保留逻辑）+ createLogger 在无 electron 环境的降级。
 * 落盘本身依赖 electron app.getPath('logs')，测试环境拿不到 → 应降级为仅 console 不崩。
 */
import { describe, it, expect, vi } from 'vitest'
import { createLogger, selectExpiredLogs, setLogLevel } from '../../electron/main/utils/logger'

describe('G4: selectExpiredLogs 日志轮转保留', () => {
  it('文件数不超过 maxDays 时不删', () => {
    const files = ['agent-2026-07-01.log', 'agent-2026-07-02.log']
    expect(selectExpiredLogs(files, 7)).toEqual([])
  })

  it('超过 maxDays 时删最旧的（字典序=时间序）', () => {
    const files = [
      'agent-2026-07-01.log',
      'agent-2026-07-02.log',
      'agent-2026-07-03.log',
    ]
    // maxDays=2，超 1 个，删最旧的 07-01
    expect(selectExpiredLogs(files, 2)).toEqual(['agent-2026-07-01.log'])
  })

  it('乱序输入也能正确按日期选出最旧的', () => {
    const files = [
      'agent-2026-07-03.log',
      'agent-2026-07-01.log',
      'agent-2026-07-02.log',
    ]
    expect(selectExpiredLogs(files, 1)).toEqual(['agent-2026-07-01.log', 'agent-2026-07-02.log'])
  })

  it('忽略非日志文件（只认 agent-YYYY-MM-DD.log 格式）', () => {
    const files = ['agent-2026-07-01.log', 'README.md', 'other.txt', '.DS_Store']
    // 只有 1 个合法日志，maxDays=7 → 不删
    expect(selectExpiredLogs(files, 7)).toEqual([])
  })

  it('恰好等于 maxDays 时不删', () => {
    const files = ['agent-2026-07-01.log', 'agent-2026-07-02.log']
    expect(selectExpiredLogs(files, 2)).toEqual([])
  })
})

describe('G4: createLogger 无 electron 环境降级', () => {
  it('无 electron app 时不崩，正常 console 输出', () => {
    setLogLevel('debug')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('TestModule')

    // 这些调用会尝试落盘（拿不到 app → 降级），不应抛错
    expect(() => log.info('test message')).not.toThrow()
    expect(() => log.error('error with data', { code: 500 })).not.toThrow()
    expect(spy).toHaveBeenCalled()

    spy.mockRestore()
  })

  it('低于全局级别的日志被过滤', () => {
    setLogLevel('warn')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('TestModule')

    log.debug('should be filtered')
    log.info('should be filtered')
    expect(spy).not.toHaveBeenCalled()

    log.warn('should appear')
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockRestore()
    setLogLevel('info')  // 复原
  })
})
