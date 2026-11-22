import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldProfileHeader } from '../../src/components/world/WorldProfileHeader'
import { WorldJournalPanel } from '../../src/components/world/WorldJournalPanel'
import { WorldKeepsakesPanel } from '../../src/components/world/WorldKeepsakesPanel'
import { GiftGivingModal } from '../../src/components/world/GiftGivingModal'

describe('World Frontend Polish（顶栏与新 Tab 去数值化与克制交互）', () => {
  it('WorldProfileHeader 仅展示自然语言状态，不暴露「看数字」或裸 RPG 数值条', () => {
    const html = renderToStaticMarkup(createElement(WorldProfileHeader, {
      profile: {
        name: '路飞',
        description: '自由、直率。',
        statusSummary: '心情不错，和你越来越有默契',
        statusMetrics: { mood: 82, energy: 64, socialNeed: 70, relationshipSignal: 12, relationshipPhase: 'rapport' },
      },
    }))
    expect(html).toContain('心情不错，和你越来越有默契')
    expect(html).not.toContain('看数字')
    expect(html).not.toContain('心情 82/100')
    expect(html).not.toContain('关系信号')
  })

  it('WorldJournalPanel 保持纯粹日记册视图，不再渲染脆弱心境卡片', () => {
    const html = renderToStaticMarkup(createElement(WorldJournalPanel, {
      roleId: 'luffy',
      previewThoughts: [],
    }))
    expect(html).toContain('还没有日记')
    expect(html).not.toContain('flex-1 items-center justify-center p-8')
    expect(html).not.toContain('vulnerability-card')
    expect(html).not.toContain('今晚甲板很宁静')
  })

  it('WorldKeepsakesPanel 为只读礼物柜，展示「送出的礼物」与「收到的礼物」且无手动送礼/索取按钮', () => {
    const html = renderToStaticMarkup(createElement(WorldKeepsakesPanel, { roleId: 'luffy' }))
    expect(html).toContain('送出的礼物')
    expect(html).toContain('收到的礼物')
    expect(html).not.toContain('赠送礼物')
    expect(html).not.toContain('索取信物')
    expect(html).not.toContain('现在送出第一份心意')
  })

  it('GiftGivingModal 不暴露饱腹/心情/体力加值数字，具备 dialog 无障碍语义', () => {
    const html = renderToStaticMarkup(createElement(GiftGivingModal, {
      roleId: 'luffy',
      isOpen: true,
      onClose: () => {},
      previewAvailableGifts: [{
        key: 'roasted-meat',
        name: '带骨大肉',
        category: 'food',
        description: '刚出炉的热腾腾烤肉。',
        iconName: 'Utensils',
        vitalsBuff: { satiety: 25, mood: 20, energy: 15 },
      }],
    }))
    expect(html).toContain('role="dialog"')
    expect(html).toContain('带骨大肉')
    expect(html).not.toContain('饱腹+25')
    expect(html).not.toContain('心情+20')
    expect(html).not.toContain('体力+15')
  })
})
