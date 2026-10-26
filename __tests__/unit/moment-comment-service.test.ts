import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanionEvent } from '../../electron/main/companion/types'
import type { LLMConfig } from '../../src/shared/types'
const model = vi.hoisted(() => vi.fn())
vi.mock('../../electron/main/llm/index', () => ({ chatComplete: model }))
import { deriveCastInteractions } from '../../electron/main/companion/life/moment-interactions'
import { parseMomentComment, resolveCastInteractions } from '../../electron/main/companion/life/moment-comment-service'

const roster = [{ otherId: 'friend', otherName: '朋友', relationType: 'friend', text: '公开资料：喜欢散步' }]
const config = { apiKey: 'test', baseUrl: 'https://example.invalid', model: 'test' } as LLMConfig
function eventWithComment(): CompanionEvent {
  for (let i = 0; i < 100; i++) {
    const event: CompanionEvent = { id: `comment-${i}`, roleId: 'lin', type: 'moment', status: 'published', scheduledAt: 1700000000000, dayScriptId: null, payload: { location: '公园', activity: '约朋友散步' } }
    if (deriveCastInteractions(event, { roster }).some(item => item.kind === 'comment')) return event
  }
  throw new Error('No deterministic comment fixture')
}
describe('已发布动态的 NPC 评论生成', () => {
  beforeEach(() => model.mockReset())
  it('接入已签发请求，只替换文字并保留评论者与同框', async () => {
    model.mockResolvedValue('{"comment":"公园的光线真好，下次一起走走。"}')
    const event = eventWithComment()
    const original = deriveCastInteractions(event, { roster })
    const result = await resolveCastInteractions(event, { roster, preferLlm: true, llmConfig: config, postText: '今天在公园散步' })
    expect(model).toHaveBeenCalledTimes(1)
    expect(model.mock.calls[0][0].request.promptAssetKeys).toContain('companion-moment-comment')
    expect(JSON.stringify(model.mock.calls[0][0].request)).toContain('公开资料：喜欢散步')
    expect(result.map(({ kind, castId }) => ({ kind, castId }))).toEqual(original.map(({ kind, castId }) => ({ kind, castId })))
    expect(result.find(item => item.kind === 'comment')).toMatchObject({ text: '公园的光线真好，下次一起走走。' })
  })
  it('未启用、缺配置、未发布都不调用模型', async () => {
    const event = eventWithComment()
    for (const options of [{}, { preferLlm: true }, { llmConfig: config }]) {
      expect(await resolveCastInteractions(event, { roster, postText: '公园散步', ...options })).toEqual(deriveCastInteractions(event, { roster }))
    }
    expect(await resolveCastInteractions({ ...event, status: 'planned' }, { roster, postText: '公园散步', preferLlm: true, llmConfig: config })).toEqual([])
    expect(model).not.toHaveBeenCalled()
  })
  it('超长、结构错误或模型失败均保留原评论，不重试', async () => {
    const event = eventWithComment()
    const expected = deriveCastInteractions(event, { roster })
    for (const raw of ['不是 JSON', JSON.stringify({ comment: '字'.repeat(81) }), '{"comment":"你好","actor":"user"}']) {
      model.mockResolvedValueOnce(raw)
      expect(await resolveCastInteractions(event, { roster, postText: '散步', preferLlm: true, llmConfig: config })).toEqual(expected)
    }
    model.mockRejectedValueOnce(new Error('offline'))
    expect(await resolveCastInteractions(event, { roster, postText: '散步', preferLlm: true, llmConfig: config })).toEqual(expected)
    expect(model).toHaveBeenCalledTimes(4)
    expect(parseMomentComment('{"comment":"<script>"}')).toBeNull()
  })
})
