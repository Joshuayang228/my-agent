import { describe, expect, it } from 'vitest'
import { clamp } from '../../src/shared/panel-layout'

describe('panel-layout clamp', () => {
  it('夹在上下界内', () => {
    expect(clamp(100, 200, 420)).toBe(200)
    expect(clamp(500, 200, 420)).toBe(420)
    expect(clamp(300, 200, 420)).toBe(300)
  })
})
