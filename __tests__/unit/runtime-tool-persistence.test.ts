import { afterEach, describe, expect, it, vi } from 'vitest'
import { runtime } from '../../electron/main/agent/runtime'
import * as loop from '../../electron/main/agent/loop'
import { ToolRegistry } from '../../electron/main/tools/registry'
import * as store from '../../electron/main/storage/session-store'
import * as settings from '../../electron/main/storage/settings-store'
import * as budget from '../../electron/main/agent/token-budget'
import * as companion from '../../electron/main/companion/orchestrator'
import * as relationship from '../../electron/main/companion/growth/relationship-stage'
import * as configFactory from '../../electron/main/llm/aux-config'
import { loadRolePack } from '../../electron/main/companion/identity/loader'
import type { AgentStreamEvent, ChatMessage } from '../../src/shared/types'

afterEach(() => { vi.restoreAllMocks() })

const image = { id: 'a'.repeat(64), path: '/workspace/images/result.png', mimeType: 'image/png' as const, width: 2, height: 2, byteLength: 80 }
const result: AgentStreamEvent = { type: 'tool_end', callId: 'generate-1', name: 'image_generate', result: '已生成图片', generatedImages: [image] }

function prepare(saveTool: (message: ChatMessage) => Promise<void>, images?: ChatMessage['images']) {
  vi.spyOn(runtime, 'getLLMConfig').mockResolvedValue({ apiKey: 'test', baseUrl: '', model: 'fixture' })
  vi.spyOn(budget, 'checkBudget').mockResolvedValue({ allowed: true })
  vi.spyOn(store, 'saveMessage').mockImplementation(async (_sessionId, message) => {
    if (message.role === 'tool') await saveTool(message)
  })
  vi.spyOn(store, 'autoTitle').mockResolvedValue(undefined)
  vi.spyOn(store, 'getSession').mockResolvedValue({ id: 'image-order', messages: [], createdAt: 1, sessionKind: 'workspace' })
  vi.spyOn(settings, 'getSetting').mockResolvedValue('')
  vi.spyOn(companion, 'assertSessionRole').mockResolvedValue({ assembleRoleId: 'lin', activeRoleId: 'lin', mismatch: false })
  const pack = loadRolePack('lin')
  vi.spyOn(companion, 'loadRoleAssembleInput').mockResolvedValue({ pack, mutableBody: pack.mutableDefault })
  vi.spyOn(relationship, 'resolveRelationshipStageForRole').mockRejectedValue(new Error('fixture: no relationship context'))
  vi.spyOn(loop, 'agentLoop').mockImplementation(async function* () {
    yield result
    yield { type: 'done', reason: 'aborted' }
  })
  return runtime.chat('image-order', { id: 'user-image', role: 'user', content: '生成图片', timestamp: 1, images }, new ToolRegistry())
}

describe('Runtime 工具结果持久化与发布顺序', () => {
  it('附图消息继续使用主对话配置，不读取生图用途或凭据', async () => {
    const stream = prepare(async () => {}, [{ dataUrl: 'data:image/png;base64,fixture', mimeType: 'image/png' }])
    vi.mocked(runtime.getLLMConfig).mockRestore()
    const main = vi.spyOn(configFactory, 'loadMainLLMConfig').mockResolvedValue({ model: 'main-vision', apiKey: 'main-key', baseUrl: 'https://main.test' })
    const generation = vi.spyOn(configFactory, 'loadImageGenerationConfig')
    for await (const _event of stream) { /* 消费完整 Runtime 流以验证实际装配入口。 */ }
    expect(main).toHaveBeenCalledOnce()
    expect(generation).not.toHaveBeenCalled()
    expect(vi.mocked(loop.agentLoop).mock.calls[0][0].config).toMatchObject({ model: 'main-vision', apiKey: 'main-key', baseUrl: 'https://main.test' })
  })
  it('存储完成后才发布 tool_end，消费事件时图片引用已可读取', async () => {
    let release!: () => void
    let started!: () => void
    const saving = new Promise<void>((resolve) => { started = resolve })
    const stored = new Map<string, ChatMessage>()
    const stream = prepare(async (message) => {
      started()
      await new Promise<void>((resolve) => { release = resolve })
      stored.set(message.toolCallId!, message)
    })
    let published = false
    const next = stream.next().then((event) => { published = true; return event })
    try {
      // 旧实现会先发布事件，根本不会开始保存；race 直接暴露这个顺序差异。
      expect(await Promise.race([saving.then(() => 'saving'), next.then(() => 'published')])).toBe('saving')
      expect(published).toBe(false)
      release()
      expect((await next).value).toMatchObject(result)
      expect(stored.get('generate-1')?.generatedImages).toEqual([image])
    } finally {
      release?.()
      await stream.return(undefined)
    }
  })

  it('保存失败时不发布成功工具结果，返回单一失败终态并释放会话锁', async () => {
    const stream = prepare(async () => { throw new Error('private storage failure') })
    const events: AgentStreamEvent[] = []
    for await (const event of stream) events.push(event)
    expect(events.some((event) => event.type === 'tool_end')).toBe(false)
    expect(events.filter((event) => event.type === 'error')).toHaveLength(1)
    expect(JSON.stringify(events)).not.toContain('private storage failure')
    expect(events.filter((event) => event.type === 'done')).toEqual([{ type: 'done', reason: 'model_error', sessionId: 'image-order' }])
    expect(runtime.isSessionActive('image-order')).toBe(false)
  })
})
