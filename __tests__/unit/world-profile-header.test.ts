import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldProfileHeader } from '../../src/components/world/WorldProfileHeader'
import { VulnerabilityCard } from '../../src/components/world/VulnerabilityCard'
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

  it('VulnerabilityCard 正式态无活跃心事时静默隐藏，不占顶部空框也不剧透触发机制', () => {
    const prodHtml = renderToStaticMarkup(createElement(VulnerabilityCard, { roleId: 'luffy' }))
    expect(prodHtml).toBe('')
    expect(prodHtml).not.toContain('今晚甲板很宁静')

    const previewEmptyHtml = renderToStaticMarkup(createElement(VulnerabilityCard, {
      roleId: 'luffy',
      previewVulnerability: null,
    }))
    expect(previewEmptyHtml).toContain('此刻很平静')
    expect(previewEmptyHtml).not.toContain('今晚甲板很宁静')
  })

  it('WorldKeepsakesPanel 正式态不显示「索取信物」按钮', () => {
    const html = renderToStaticMarkup(createElement(WorldKeepsakesPanel, { roleId: 'luffy' }))
    expect(html).not.toContain('索取信物')
    expect(html).toContain('赠送礼物')
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
