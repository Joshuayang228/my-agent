import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldProfileHeader } from '../../src/components/world/WorldProfileHeader'

describe('world profile status display', () => {
  it('defaults to narrative text and exposes a numeric toggle', () => {
    const html = renderToStaticMarkup(createElement(WorldProfileHeader, {
      profile: {
        name: '路飞',
        description: '自由、直率。',
        statusSummary: '心情不错，和你越来越有默契',
        statusMetrics: { mood: 82, energy: 64, socialNeed: 70, relationshipSignal: 12, relationshipPhase: 'rapport' },
      },
    }))
    expect(html).toContain('心情不错，和你越来越有默契')
    expect(html).toContain('看数字')
    expect(html).not.toContain('心情 82/100')
  })
})
