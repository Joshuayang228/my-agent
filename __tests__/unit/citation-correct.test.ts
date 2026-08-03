/**
 * M29-G2：本轮引用纠错计划
 */
import { describe, expect, it } from 'vitest'
import { planCitationCorrection } from '../../electron/main/memory/citation-correct'

describe('planCitationCorrection', () => {
  it('无改正：有 SQLite → 删库（含向量）', () => {
    expect(planCitationCorrection(true)).toEqual({
      action: 'delete',
      sqlite: true,
      vector: true,
    })
  })

  it('无改正：仅向量 hit → 只删向量', () => {
    expect(planCitationCorrection(false)).toEqual({
      action: 'delete',
      sqlite: false,
      vector: true,
    })
  })

  it('改正：有 SQLite → update', () => {
    expect(planCitationCorrection(true, '正确内容')).toEqual({
      action: 'update-sqlite',
    })
  })

  it('改正：无 SQLite → 删向量并记 fact', () => {
    expect(planCitationCorrection(false, ' 正确 ')).toEqual({
      action: 'replace-as-fact',
    })
  })

  it('空白改正视为删除路径', () => {
    expect(planCitationCorrection(false, '   ').action).toBe('delete')
  })
})
