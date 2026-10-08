import { describe, expect, it } from 'vitest'
import { contactFixtures, resolveContactReference } from '../../src/components/playground/ContactsExperienceCandidate'
import { TRAVEL_PREVIEWS } from '../../src/components/playground/FootprintsExperienceCandidate'

describe('通讯录候选数据', () => {
  it('双方与经历使用稳定引用，伙伴切换不串归属', () => {
    for (const owner of ['lin', 'yao']) {
      const fixture = contactFixtures(owner)
      expect(fixture.people.some(person => person.id === owner)).toBe(false)
      for (const record of [...fixture.relations, ...fixture.experiences]) {
        expect(record.ownerRoleId).toBe(owner)
        expect(fixture.people.some(person => person.id === record.personId)).toBe(true)
      }
      expect(new Set(fixture.experiences.map(item => item.id)).size).toBe(fixture.experiences.length)
    }
  })
  it('关联复用目标本体，缺失、未出发和取消记录不提供入口', () => {
    expect(resolveContactReference({ kind: 'trip', targetId: 'weekend' })).toBe(TRAVEL_PREVIEWS[0])
    for (const targetId of ['missing', 'future', 'cancelled']) expect(resolveContactReference({ kind: 'trip', targetId })).toBeUndefined()
    expect(resolveContactReference({ kind: 'moment', targetId: 'missing' })).toBeUndefined()
  })
})
