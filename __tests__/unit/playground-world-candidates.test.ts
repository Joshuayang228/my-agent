import { describe, expect, it } from 'vitest'
import { UI_COMPONENT_REGISTRY } from '../../src/shared/ui-component-registry'
import { PRODUCT_EXPERIENCE_REGISTRY } from '../../src/shared/product-experience-registry'
import { JournalExperienceCandidate } from '../../src/components/playground/JournalExperienceCandidate'
import { KeepsakesExperienceCandidate } from '../../src/components/playground/KeepsakesExperienceCandidate'

describe('Playground World Candidates (航海日记与专属信物)', () => {
  it('UI 组件注册表登记了日记与信物的隔离样张组件', () => {
    const journalComp = UI_COMPONENT_REGISTRY['layout.journal-experience-candidate']
    expect(journalComp).toBeDefined()
    expect(journalComp.category).toBe('layout')
    expect(journalComp.status).toBe('playground')
    expect(journalComp.sourcePath).toBe('src/components/playground/JournalExperienceCandidate.tsx')
    expect(journalComp.stories).toContain('日记清单')
    expect(journalComp.stories).toContain('星标收藏')
    expect(journalComp.stories).toContain('空日记本')

    const keepsakesComp = UI_COMPONENT_REGISTRY['layout.keepsakes-experience-candidate']
    expect(keepsakesComp).toBeDefined()
    expect(keepsakesComp.category).toBe('layout')
    expect(keepsakesComp.status).toBe('playground')
    expect(keepsakesComp.sourcePath).toBe('src/components/playground/KeepsakesExperienceCandidate.tsx')
    expect(keepsakesComp.stories).toContain('信物展架')
    expect(keepsakesComp.stories).toContain('长名称与寄语')
    expect(keepsakesComp.stories).toContain('空信物架')
  })

  it('产品体验注册表（experience.world）纳管了两个样张组件源文件与体验组成部分', () => {
    const worldExperience = PRODUCT_EXPERIENCE_REGISTRY['experience.world']
    expect(worldExperience).toBeDefined()
    expect(worldExperience.sourcePaths).toContain('src/components/playground/JournalExperienceCandidate.tsx')
    expect(worldExperience.sourcePaths).toContain('src/components/playground/KeepsakesExperienceCandidate.tsx')
    expect(worldExperience.experienceParts).toContain('航海日记 / 心事独白')
    expect(worldExperience.experienceParts).toContain('专属信物')
  })

  it('组件函数导出真实可用且符合 React 函数组件约定', () => {
    expect(typeof JournalExperienceCandidate).toBe('function')
    expect(typeof KeepsakesExperienceCandidate).toBe('function')
  })
})
