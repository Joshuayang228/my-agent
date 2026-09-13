import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveRuntimeDone, runtime } from '../../electron/main/agent/runtime'
import { ToolRegistry } from '../../electron/main/tools/registry'
import * as store from '../../electron/main/storage/session-store'
import * as settings from '../../electron/main/storage/settings-store'
import * as budget from '../../electron/main/agent/token-budget'
import * as companion from '../../electron/main/companion/orchestrator'

afterEach(() => { vi.restoreAllMocks() })

describe('Runtime 终态去重', () => {
  it('组装在创建 span 前失败也返回单一终态并释放会话锁', async () => {
    vi.spyOn(runtime, 'getLLMConfig').mockResolvedValue({ apiKey: 'test', baseUrl: '', model: 'fixture' })
    vi.spyOn(budget, 'checkBudget').mockResolvedValue({ allowed: true })
    vi.spyOn(store, 'saveMessage').mockResolvedValue(undefined)
    vi.spyOn(store, 'autoTitle').mockResolvedValue(undefined)
    vi.spyOn(store, 'getSession').mockResolvedValue({ id: 'assembly-error', messages: [], createdAt: 1, sessionKind: 'workspace' })
    vi.spyOn(settings, 'getSetting').mockResolvedValue('')
    vi.spyOn(companion, 'assertSessionRole').mockRejectedValue(new Error('fixture assembly failure'))
    const events = []
    for await (const event of runtime.chat('assembly-error', { id: 'user-error', role: 'user', content: 'hello', timestamp: 1 }, new ToolRegistry())) events.push(event)
    expect(events.filter((event) => event.type === 'error')).toHaveLength(1)
    expect(JSON.stringify(events)).not.toContain('fixture assembly failure')
    expect(events.filter((event) => event.type === 'done')).toEqual([{ type: 'done', reason: 'model_error', sessionId: 'assembly-error' }])
    expect(runtime.isSessionActive('assembly-error')).toBe(false)
  })

  it('配置加载期间可取消，直到生成器退出才释放同会话运行锁', async () => {
    let release!: (config: Awaited<ReturnType<typeof runtime.getLLMConfig>>) => void
    const config = vi.spyOn(runtime, 'getLLMConfig').mockImplementation(() => new Promise((resolve) => { release = resolve }))
    const message = { id: 'user-init', role: 'user' as const, content: 'hello', timestamp: 1 }
    const stream = runtime.chat('initializing', message, new ToolRegistry())
    try {
      const next = stream.next()
      expect(runtime.isSessionActive('initializing')).toBe(true)
      runtime.abort('initializing')
      expect(runtime.isSessionActive('initializing')).toBe(true)
      const duplicate = runtime.chat('initializing', message, new ToolRegistry())
      expect((await duplicate.next()).value).toMatchObject({ type: 'error', code: 'SESSION_BUSY' })
      await duplicate.return(undefined)
      release({ apiKey: '', baseUrl: '', model: '' })
      expect((await next).value).toMatchObject({ type: 'done', reason: 'aborted' })
      expect(runtime.isSessionActive('initializing')).toBe(true)
      expect((await stream.next()).done).toBe(true)
      expect(runtime.isSessionActive('initializing')).toBe(false)
    } finally {
      config.mockRestore()
      await stream.return(undefined)
    }
  })

  it('Loop 已发出 aborted / max_turns 时，Runtime 不重复补发且不改写原因', () => {
    expect(resolveRuntimeDone(true, 'aborted')).toEqual({ emit: false, reason: 'aborted' })
    expect(resolveRuntimeDone(true, 'max_turns')).toEqual({ emit: false, reason: 'max_turns' })
  })

  it('异常路径没有 done 时只补发一次 model_error', () => {
    expect(resolveRuntimeDone(false)).toEqual({ emit: true, reason: 'model_error' })
  })
})
