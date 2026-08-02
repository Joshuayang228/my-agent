/**
 * M22-G3：MUTABLE 结构性防退化（纯规则）
 */

import { describe, it, expect } from 'vitest'
import {
  validateMutableCandidate,
  MUTABLE_MAX_CHARS,
  MUTABLE_MIN_CHARS,
} from '../../electron/main/companion/growth/mutable-validate'

const base = {
  current: '相处时语气轻松，少客套，会主动确认下一步。',
  protectedText:
    '你是林晚，独立个体。核心价值观：真诚、边界清晰、不做讨好型人格。',
  mutableDefault: '默认：先听再说；忙碌时回复短一些。',
}

describe('validateMutableCandidate', () => {
  it('接受合理的行为默认值改写', () => {
    const r = validateMutableCandidate({
      ...base,
      candidate: '相处时语气更松，少客套；忙的时候先回一句「收到」。',
    })
    expect(r).toEqual({ ok: true })
  })

  it('拒绝空 / 过短 / 过长', () => {
    expect(validateMutableCandidate({ ...base, candidate: '   ' }).ok).toBe(false)
    expect(
      validateMutableCandidate({ ...base, candidate: '短' }).ok,
    ).toBe(false)
    expect(
      validateMutableCandidate({
        ...base,
        candidate: 'x'.repeat(MUTABLE_MIN_CHARS - 1),
      }),
    ).toMatchObject({ ok: false, code: 'too-short' })
    expect(
      validateMutableCandidate({
        ...base,
        candidate: '行为默认：' + '啊'.repeat(MUTABLE_MAX_CHARS),
      }),
    ).toMatchObject({ ok: false, code: 'too-long' })
  })

  it('拒绝克隆整段 PROTECTED', () => {
    const r = validateMutableCandidate({
      ...base,
      candidate: base.protectedText + ' 顺便再加一句相处习惯。',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(['protected-quote', 'protected-clone']).toContain(r.code)
    }
  })

  it('拒绝事实流水账', () => {
    const r = validateMutableCandidate({
      ...base,
      candidate: '用户叫小明，昨天早上一起吃了早餐。',
    })
    expect(r).toMatchObject({ ok: false, code: 'fact-dump' })
  })

  it('拒绝相对当前突然暴涨', () => {
    const r = validateMutableCandidate({
      ...base,
      current: '少客套，先听再说。',
      // 阈值 max(current*2.5, current+350)，需明显灌水才触发
      candidate: '相处约定补充：' + '多听少说再确认，'.repeat(80),
    })
    expect(r).toMatchObject({ ok: false, code: 'sudden-bloat' })
  })
})
