/**
 * M25 旁路：书架 Assemble 薄切片 + Moment 可读引用
 */
import { describe, expect, it } from 'vitest'
import {
  formatBookshelfSliceForPrompt,
  shouldAttachBookshelfRef,
} from '../../electron/main/companion/life/assets'
import { formatMomentText } from '../../electron/main/companion/life/moment-format'
import { buildSystemPrompt } from '../../electron/main/agent/prompt-builder'

describe('formatBookshelfSliceForPrompt', () => {
  it('空柜返回空串', () => {
    expect(formatBookshelfSliceForPrompt([])).toBe('')
  })

  it('列出书名与作者，并禁止编造', () => {
    const slice = formatBookshelfSliceForPrompt([
      {
        id: 'bookshelf:lin:a',
        roleId: 'lin',
        kind: 'bookshelf',
        name: '匠人',
        payload: { author: '森博嗣', note: '做事的分寸' },
        acquiredAt: 1,
        sourceEventId: null,
      },
    ])
    expect(slice).toContain('《匠人》')
    expect(slice).toContain('森博嗣')
    expect(slice).toContain('勿宣称未列出的书')
  })
})

describe('shouldAttachBookshelfRef', () => {
  it('读相关活动挂书', () => {
    expect(shouldAttachBookshelfRef({ activity: '夜读半小时', seed: 1 })).toBe(true)
  })

  it('家中按 seed 稀疏挂书', () => {
    expect(shouldAttachBookshelfRef({ activity: '发呆', location: '家', seed: 4 })).toBe(true)
    expect(shouldAttachBookshelfRef({ activity: '发呆', location: '家', seed: 1 })).toBe(false)
  })
})

describe('formatMomentText book ref', () => {
  it('可附在读书名', () => {
    const text = formatMomentText(
      {
        id: 'e1',
        roleId: 'lin',
        scheduledAt: 1,
        status: 'published',
        type: 'moment',
        dayScriptId: 'd',
        payload: { activity: '夜读', mood: '静', location: '家' },
      },
      { outfitName: '米色针织开衫', bookName: '匠人' },
    )
    expect(text).toContain('穿着米色针织开衫')
    expect(text).toContain('在读匠人')
  })
})

describe('Assemble Bookshelf', () => {
  it('注入 ## Bookshelf', () => {
    const prompt = buildSystemPrompt({
      persona: {
        id: 'lin',
        name: '小林',
        description: 't',
        protected: 'P',
        mutable: 'M',
      },
      toolNames: [],
      bookshelfSlice: '书架上现有（已入库，勿宣称未列出的书）：\n- 《匠人》',
    })
    expect(prompt).toContain('## Bookshelf')
    expect(prompt).toContain('《匠人》')
  })
})
