/**
 * M24-G2：Moment 润色绑定 event + 规则回退
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

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
  validatePolishedMomentText,
  resolveMomentText,
  formatMomentText,
} = await import('../../electron/main/companion/life/moment-polish').then(async (polish) => {
  const format = await import('../../electron/main/companion/life/moment-format')
  return { ...polish, formatMomentText: format.formatMomentText }
})

const { chatComplete } = await import('../../electron/main/llm/index')

const baseEvent = {
  id: 'e1',
  roleId: 'lin',
  scheduledAt: Date.UTC(2026, 7, 2, 12, 0),
  status: 'published' as const,
  type: 'moment',
  dayScriptId: null,
  payload: {
    activity: '午饭散步',
    mood: '放松',
    location: '附近街道',
    theme: '轻快的一天',
  },
}

describe('validatePolishedMomentText', () => {
  const rule = '午饭散步（放松） · 附近街道'

  it('接受锚定活动的短句', () => {
    expect(
      validatePolishedMomentText('午饭散步，街道风挺舒服。', {
        activity: '午饭散步',
        location: '附近街道',
        ruleText: rule,
      }),
    ).toContain('午饭散步')
  })

  it('拒绝引入新地点', () => {
    expect(
      validatePolishedMomentText('午饭后溜去咖啡馆坐坐。', {
        activity: '午饭散步',
        location: '附近街道',
        ruleText: rule,
      }),
    ).toBeNull()
  })

  it('拒绝空 / JSON', () => {
    expect(validatePolishedMomentText('', {
      activity: 'a', location: 'b', ruleText: rule,
    })).toBeNull()
    expect(validatePolishedMomentText('{"x":1}', {
      activity: '午饭散步', location: '附近街道', ruleText: rule,
    })).toBeNull()
  })
})

describe('resolveMomentText', () => {
  beforeEach(() => {
    vi.mocked(chatComplete).mockReset()
  })

  it('无 preferLlm 走规则底稿', async () => {
    const r = await resolveMomentText(baseEvent)
    expect(r.source).toBe('rule')
    expect(r.text).toBe(formatMomentText(baseEvent))
    expect(chatComplete).not.toHaveBeenCalled()
  })

  it('LLM 成功则用润色文案', async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce('午饭散步，附近街道风很轻。')
    const r = await resolveMomentText(baseEvent, {
      preferLlm: true,
      llmConfig: { apiKey: 'k', baseUrl: 'http://x', model: 'm' },
    })
    expect(r.source).toBe('llm')
    expect(r.text).toContain('午饭散步')
  })

  it('LLM 校验失败回退规则', async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce('突然飞去海边蹦迪。')
    const r = await resolveMomentText(baseEvent, {
      preferLlm: true,
      llmConfig: { apiKey: 'k', baseUrl: 'http://x', model: 'm' },
    })
    expect(r.source).toBe('rule')
    expect(r.text).toBe(formatMomentText(baseEvent))
  })
})
