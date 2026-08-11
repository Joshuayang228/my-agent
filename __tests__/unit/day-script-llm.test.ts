/**
 * M23-G1：日剧本 LLM 解析 / 回退
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(),
}))

const {
  generateDayScript,
  parseDayScriptPayload,
  resolveDayScript,
  __test,
} = await import('../../electron/main/companion/life/script-generator')

const { chatComplete } = await import('../../electron/main/llm/index')

describe('parseDayScriptPayload', () => {
  it('接受合法 JSON', () => {
    const p = parseDayScriptPayload({
      theme: '咖啡馆小日子',
      slots: [
        { hour: 8, minute: 0, activity: '起床', mood: '迷糊', location: '家', type: 'activity' },
        { hour: 9, minute: 30, activity: '早餐', mood: '平静', location: '家', type: 'moment' },
        { hour: 12, minute: 0, activity: '午饭', mood: '放松', location: '附近街道', type: 'moment' },
        { hour: 15, minute: 0, activity: '做事', mood: '认真', location: '工位', type: 'activity' },
        { hour: 20, minute: 0, activity: '回家', mood: '困倦', location: '家', type: 'activity' },
      ],
    }, '2026-08-02')
    expect(p?.theme).toBe('咖啡馆小日子')
    expect(p?.date).toBe('2026-08-02')
    expect(p?.slots).toHaveLength(5)
    expect(p?.slots.some((s) => s.type === 'moment')).toBe(true)
  })

  it('槽位过少 / 缺 theme → null', () => {
    expect(parseDayScriptPayload({ theme: '', slots: [] }, '2026-08-02')).toBeNull()
    expect(parseDayScriptPayload({
      theme: 'x',
      slots: [
        { hour: 8, minute: 0, activity: 'a', mood: 'm', location: 'l', type: 'activity' },
      ],
    }, '2026-08-02')).toBeNull()
  })

  it('从带杂质的字符串提取 JSON', () => {
    const p = parseDayScriptPayload(
      '好的\n{"theme":"安静","slots":[' +
        '{"hour":8,"minute":0,"activity":"起床","mood":"静","location":"家","type":"activity"},' +
        '{"hour":10,"minute":0,"activity":"窗边","mood":"静","location":"家","type":"moment"},' +
        '{"hour":13,"minute":0,"activity":"午饭","mood":"松","location":"家","type":"activity"},' +
        '{"hour":16,"minute":0,"activity":"写字","mood":"专注","location":"工位","type":"activity"},' +
        '{"hour":21,"minute":0,"activity":"静坐","mood":"困","location":"家","type":"moment"}' +
        ']}',
      '2026-08-02',
    )
    expect(p?.theme).toBe('安静')
    expect(p?.slots.length).toBeGreaterThanOrEqual(__test.SLOT_COUNT_MIN)
  })
})

describe('resolveDayScript', () => {
  beforeEach(() => {
    vi.mocked(chatComplete).mockReset()
  })

  it('无 preferLlm 时走哈希且稳定', async () => {
    const a = await resolveDayScript('lin', '2026-08-02')
    const b = await resolveDayScript('lin', '2026-08-02')
    expect(a.source).toBe('hash')
    expect(a.payload).toEqual(b.payload)
    expect(a.payload).toEqual(generateDayScript('lin', '2026-08-02'))
    expect(chatComplete).not.toHaveBeenCalled()
  })

  it('人物故事未定时，小航哈希回退使用中性默认池', async () => {
    const result = await resolveDayScript('hang', '2026-08-11')
    const text = result.payload.slots.map((slot) => `${slot.activity}@${slot.location}`).join('|')
    expect(result.source).toBe('hash')
    expect(result.payload.slots.every((slot) => slot.location === '未设定')).toBe(true)
    expect(text).not.toMatch(/临湾|海堤|旧街|码头|船笛|通勤|工位|咖啡馆|在家|宅家/)
  })

  it('LLM 成功则采用模型主题', async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(JSON.stringify({
      theme: 'LLM定制主题',
      slots: [
        { hour: 8, minute: 0, activity: '起床列清单', mood: '清醒', location: '家', type: 'activity' },
        { hour: 9, minute: 0, activity: '早餐短动态', mood: '平静', location: '家', type: 'moment' },
        { hour: 12, minute: 30, activity: '午饭快走', mood: '放松', location: '附近街道', type: 'moment' },
        { hour: 15, minute: 0, activity: '收尾一件事', mood: '认真', location: '工位', type: 'activity' },
        { hour: 19, minute: 0, activity: '咖啡馆笔记', mood: '沉稳', location: '咖啡馆', type: 'moment' },
        { hour: 21, minute: 0, activity: '复盘', mood: '平和', location: '家', type: 'activity' },
      ],
    }))
    const r = await resolveDayScript('lin', '2026-08-02', {
      preferLlm: true,
      llmConfig: { apiKey: 'k', baseUrl: 'http://x', model: 'm' },
    })
    expect(r.source).toBe('llm')
    expect(r.payload.theme).toBe('LLM定制主题')
    expect(r.payload.slots[0].activity).toContain('起床')
  })

  it('LLM 失败回退哈希', async () => {
    vi.mocked(chatComplete).mockRejectedValueOnce(new Error('boom'))
    const r = await resolveDayScript('zhou', '2026-08-02', {
      preferLlm: true,
      llmConfig: { apiKey: 'k', baseUrl: 'http://x', model: 'm' },
    })
    expect(r.source).toBe('hash')
    expect(r.payload).toEqual(generateDayScript('zhou', '2026-08-02'))
  })

  it('小航 LLM 日剧本收到故事待定边界', async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(JSON.stringify({
      theme: '中性测试日',
      slots: [
        { hour: 8, minute: 30, activity: '确认今天的一件事', mood: '清醒', location: '未设定', type: 'activity' },
        { hour: 10, minute: 0, activity: '做一个小版本', mood: '专注', location: '未设定', type: 'moment' },
        { hour: 12, minute: 30, activity: '午间休息', mood: '松弛', location: '未设定', type: 'moment' },
        { hour: 16, minute: 0, activity: '整理资料', mood: '平静', location: '未设定', type: 'activity' },
        { hour: 19, minute: 0, activity: '收尾复盘', mood: '稳定', location: '未设定', type: 'moment' },
      ],
    }))
    await resolveDayScript('hang', '2026-08-11', {
      preferLlm: true,
      llmConfig: { apiKey: 'k', baseUrl: 'http://x', model: 'm' },
    })
    const request = vi.mocked(chatComplete).mock.calls[0][0]
    const prompt = String(request.messages[0].content)
    expect(prompt).toContain('人物故事尚未确定')
    expect(prompt).toContain('当前不声明城市、家乡或长期生活地点')
    expect(prompt).not.toMatch(/临湾|海堤|旧港|码头/)
  })
})
