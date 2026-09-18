import { describe, expect, it } from 'vitest'
import { CONNECTION_PRESETS, connectionDraftForSource, providerSource, sameConnectionEndpoint, validConnectionDraft } from '../../src/shared/model-connection-form'
import { PROVIDER_PRESETS } from '../../src/shared/provider-presets'

describe('model connection form', () => {
  it('五类来源从同一预设注册表派生，保留候选的默认入口', () => {
    for (const source of ['official', 'coding', 'relay', 'local'] as const) {
      const draft = connectionDraftForSource(source)
      expect(validConnectionDraft(draft)).toBe(true)
      expect(draft.apiKey).toBe('')
      expect(PROVIDER_PRESETS.find((item) => item.providerId === draft.presetId)?.baseUrl).toBe(draft.baseUrl)
      expect(providerSource(CONNECTION_PRESETS.find((item) => item.providerId === draft.presetId)!)).toBe(source)
    }
    expect(connectionDraftForSource('relay').presetId).toBe('openrouter')
    expect(connectionDraftForSource('local', 'lmstudio').name).toBe('LM Studio')
    expect(CONNECTION_PRESETS.some((item) => item.providerId === 'miyang')).toBe(false)
  })
  it('自定义填写实际协议，拒绝空白、无效地址与错组预设', () => {
    const custom = connectionDraftForSource('custom')
    expect(validConnectionDraft(custom)).toBe(false)
    expect(validConnectionDraft({ ...custom, name: 'custom', baseUrl: 'https://example.test', provider: 'gemini' })).toBe(true)
    expect(validConnectionDraft({ ...custom, name: 'custom', baseUrl: 'file:///tmp' })).toBe(false)
    expect(validConnectionDraft({ ...connectionDraftForSource('relay'), presetId: 'openai' })).toBe(false)
  })
  it('凭据绑定包含协议与端点路径，尾斜线归一而非仅比较域名', () => {
    const source = { baseUrl: 'https://example.test/v1/', provider: 'openai' }
    expect(sameConnectionEndpoint(source, { ...source, baseUrl: 'https://example.test/v1' })).toBe(true)
    expect(sameConnectionEndpoint(source, { ...source, baseUrl: 'https://example.test/other' })).toBe(false)
    expect(sameConnectionEndpoint(source, { ...source, provider: 'anthropic' })).toBe(false)
  })
})
