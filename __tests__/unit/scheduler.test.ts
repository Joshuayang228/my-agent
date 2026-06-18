import { describe, it, expect } from 'vitest'
import { parseCronNextRun, rowToTask } from '../../electron/main/scheduler/index'

describe('parseCronNextRun', () => {
  it('返回下一个匹配时间（明确分钟和小时）', () => {
    const from = new Date('2026-06-19T08:00:00Z').getTime()
    const result = parseCronNextRun('30 10 * * *', from)
    expect(result).not.toBeNull()

    const d = new Date(result!)
    expect(d.getMinutes()).toBe(30)
    expect(d.getHours()).toBe(10)
  })

  it('已过今天时间则跳到明天', () => {
    const from = new Date('2026-06-19T11:00:00Z').getTime()
    const result = parseCronNextRun('30 10 * * *', from)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(from)

    const d = new Date(result!)
    expect(d.getDate()).toBe(20)
  })

  it('不合法的 cron（字段不足）返回 null', () => {
    expect(parseCronNextRun('30', Date.now())).toBeNull()
    expect(parseCronNextRun('', Date.now())).toBeNull()
  })

  it('通配符 * * 返回合理的未来时间', () => {
    const from = Date.now()
    const result = parseCronNextRun('* * * * *', from)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(from - 60_000)
  })
})

describe('rowToTask', () => {
  it('正确映射数据库行到 ScheduledTask', () => {
    const row = {
      id: 'task-1',
      name: '每日提醒',
      prompt: '提醒我喝水',
      cron: '0 9 * * *',
      interval_ms: 0,
      enabled: 1,
      last_run_at: 1718700000000,
      next_run_at: 1718786400000,
      created_at: 1718600000000,
    }

    const task = rowToTask(row)

    expect(task.id).toBe('task-1')
    expect(task.name).toBe('每日提醒')
    expect(task.prompt).toBe('提醒我喝水')
    expect(task.cron).toBe('0 9 * * *')
    expect(task.intervalMs).toBeUndefined()
    expect(task.enabled).toBe(true)
    expect(task.lastRunAt).toBe(1718700000000)
    expect(task.nextRunAt).toBe(1718786400000)
    expect(task.createdAt).toBe(1718600000000)
  })

  it('enabled=0 映射为 false', () => {
    const row = {
      id: 'task-2',
      name: 't',
      prompt: 'p',
      cron: null,
      interval_ms: 60000,
      enabled: 0,
      last_run_at: null,
      next_run_at: null,
      created_at: 1718600000000,
    }

    const task = rowToTask(row)
    expect(task.enabled).toBe(false)
    expect(task.intervalMs).toBe(60000)
    expect(task.cron).toBeUndefined()
    expect(task.lastRunAt).toBeUndefined()
  })
})
