import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage, RegisteredModelRequest, RegisteredSystemPrompt } from '../../src/shared/types'
import { streamChat, chatComplete, type StreamChatOptions } from '../../electron/main/llm/index'
import { setLLMTraceSink } from '../../electron/main/utils/tracer'
import {
  compileAgentRequest, compileDefaultSystem, compileEvalSystem,
  compileContextMessage, compileTitleRequest, compilePlaygroundRequest,
  compileMainSystem, compileSubagentSystem, readRegisteredModelRequest,
  readRegisteredSystemText, compileModelProbeRequest,
} from '../../electron/main/prompts/registered-request'
import { loadRolePack } from '../../electron/main/companion/identity/loader'
import { PROMPT_KEYS } from '../../electron/main/prompts/keys'
import { DEFAULT_SYSTEM_PROMPT } from '../../electron/main/prompts/texts'
import { compressContext } from '../../electron/main/agent/context-manager'

const config = { apiKey: 'test-key', baseUrl: 'https://example.test/v1', model: 'test-model' }
const message = (role: ChatMessage['role'], content: string, id: string = role): ChatMessage => ({ id, role, content, timestamp: 0 })
const agentRequest = (messages = [message('system', DEFAULT_SYSTEM_PROMPT, 'system'), message('user', '你好')]) => compileAgentRequest({ systemPrompt: compileDefaultSystem(), messages, deniedTools: [], deniedCommands: [] })
async function consume(options: StreamChatOptions) { for await (const _event of streamChat(options)) { /* 完整消费统一入口 */ } }

describe('注册编译请求的模型边界', () => {
  const fetch = vi.fn()
  const started = vi.fn()
  beforeEach(() => {
    fetch.mockReset()
    started.mockReset()
    vi.stubGlobal('fetch', fetch)
    setLLMTraceSink({ onLLMStart: started, onLLMEnd: () => {} })
  })
  afterEach(() => { vi.unstubAllGlobals(); setLLMTraceSink() })

  it.each([
    {},
    { messages: [], promptAssetKeys: [PROMPT_KEYS.loopDefault], scope: 'production' },
    { ...agentRequest() },
    structuredClone(agentRequest()),
  ])('伪造、复制或序列化对象不具有签发身份', async (request) => {
    await expect(consume({ config, caller: 'main', request: request as RegisteredModelRequest })).rejects.toThrow('编译入口')
    expect(fetch).not.toHaveBeenCalled()
    expect(started).not.toHaveBeenCalled()
  })

  it.each(['messages', 'promptAssetKeys', 'promptlessReason'])('即使带有真实 request，也拒绝附带旧字段 %s', async (field) => {
    const options = { config, caller: 'main', request: agentRequest(), [field]: field === 'promptlessReason' ? '绕过' : [] }
    await expect(consume(options as StreamChatOptions)).rejects.toThrow('不接受原始消息')
    await expect(chatComplete(options as StreamChatOptions)).rejects.toThrow('不接受原始消息')
    expect(fetch).not.toHaveBeenCalled()
    expect(started).not.toHaveBeenCalled()
  })

  it('请求签发后不能替换正文、key，输入和读取副本的修改不会改变真实请求', () => {
    const input = [message('system', DEFAULT_SYSTEM_PROMPT, 'system'), message('user', '原始问题')]
    const request = agentRequest(input)
    input[1].content = '后来修改'
    const snapshot = readRegisteredModelRequest(request, 'main')
    snapshot.messages[1].content = '读取副本修改'
    expect(() => { request.messages[1].content = '强改正文' }).toThrow()
    expect(() => { (request.promptAssetKeys as unknown as string[]).push('假的 key') }).toThrow()
    expect(readRegisteredModelRequest(request, 'main').messages[1].content).toBe('原始问题')
  })

  it('实验和标题配方不能冒充主对话；调用行为不一致时未发网络请求', async () => {
    const evalRequest = compileAgentRequest({ systemPrompt: compileEvalSystem('实验指令'), messages: [message('system', '实验指令', 'system')], deniedTools: [], deniedCommands: [] })
    for (const request of [compilePlaygroundRequest({ systemPrompt: '实验指令', userPrompt: '你好' }), evalRequest, compileTitleRequest('你好', '你好')]) {
      await expect(consume({ config, caller: 'main', request })).rejects.toThrow('来源与调用行为不一致')
    }
    expect(fetch).not.toHaveBeenCalled()
    expect(started).not.toHaveBeenCalled()
  })

  it('未注册人物来源在模型入口失败关闭，不创建 LLM Trace 或发请求', async () => {
    const pack = { ...loadRolePack('luffy'), id: 'unregistered-role' }
    const systemPrompt = compileMainSystem(pack, pack.mutableDefault, { platform: { toolNames: [] }, behavior: {}, currentDate: '2026-10-13' })
    const request = compileAgentRequest({ systemPrompt, messages: [message('system', systemPrompt.text, 'system')], deniedTools: [], deniedCommands: [] })
    await expect(consume({ config, caller: 'main', request })).rejects.toThrow('未注册')
    expect(fetch).not.toHaveBeenCalled()
    expect(started).not.toHaveBeenCalled()
  })

  it('主 System 来源无法用字符串或结构复制冒充', () => {
    expect(() => readRegisteredSystemText('任意正文' as unknown as RegisteredSystemPrompt)).toThrow('编译入口')
    expect(() => compileAgentRequest({ systemPrompt: { ...compileDefaultSystem() }, messages: [], deniedTools: [], deniedCommands: [] })).toThrow('编译入口')
  })

  it('压缩恢复需要真实来源证明，同 ID 的伪造消息及正文修改均被拒绝', () => {
    const first = message('system', DEFAULT_SYSTEM_PROMPT, 'system')
    expect(() => agentRequest([first, message('system', '任意系统指令', 'context-summary')])).toThrow('未登记')
    const restored = compileContextMessage('files', '实际文件内容')
    const request = agentRequest([first, restored, message('user', '继续')])
    expect(request.promptAssetKeys).toContain(PROMPT_KEYS.compactRestoreContext)
    expect(request.messages[1].content).toContain('实际文件内容')
    restored.content = '替换恢复指令'
    expect(() => agentRequest([first, restored])).toThrow('未登记')
  })

  it('主系统正文和恢复指令由配方固定生成，时间与拒绝策略来源自动附加', () => {
    const request = compileAgentRequest({ systemPrompt: compileDefaultSystem(), messages: [message('system', '企图替换稳定正文', 'system'), message('user', '继续', 'user-recovery-1')], deniedTools: [{ name: 'file_write', reason: '用户拒绝' }], deniedCommands: [], time: '09:30' })
    expect(request.messages[0].content).toContain(DEFAULT_SYSTEM_PROMPT)
    expect(request.messages[0].content).not.toContain('企图替换稳定正文')
    expect(request.messages[1].content).toContain('[当前时间: 09:30]')
    expect(request.promptAssetKeys).toEqual([PROMPT_KEYS.loopDefault, PROMPT_KEYS.toolResultSafety, PROMPT_KEYS.permissionDenial, PROMPT_KEYS.loopOutputRecovery, PROMPT_KEYS.loopTimeContext])
  })

  it('主对话不接受额外行为正文插槽，诊断配方不接受未知种类', () => {
    const pack = loadRolePack('luffy')
    expect(() => compileMainSystem(pack, pack.mutableDefault, { platform: { toolNames: [] }, behavior: { policy: '额外指令' } as never, currentDate: '2026-10-13' })).toThrow('已定义的运行时插槽')
    expect(() => compileModelProbeRequest('arbitrary' as 'smoke')).toThrow('未知模型诊断')
    expect(readRegisteredSystemText(compileSubagentSystem('researcher'))).toContain('子 Agent')
    expect(compileEvalSystem('实验正文').scope).toBe('eval')
  })

  it('真实上下文压缩保持摘要和文件恢复的编译身份，可继续组成模型请求', async () => {
    const history: ChatMessage[] = [message('system', DEFAULT_SYSTEM_PROMPT, 'system')]
    for (let i = 0; i < 40; i++) history.push(message(i % 2 ? 'assistant' : 'user', '对话内容'.repeat(500), `history-${i}`))
    const result = await compressContext(history, { maxTokens: 2000 })
    expect(result.some(m => m.id === 'context-summary' || m.id === 'auto-compact-summary')).toBe(true)
    expect(agentRequest(result).promptAssetKeys).toContain(PROMPT_KEYS.compactRestoreContext)
    expect(fetch).not.toHaveBeenCalled()
  })
})
