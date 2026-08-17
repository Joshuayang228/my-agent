import { describe, expect, it } from 'vitest'
import { clamp, LAYOUT_BOUNDS } from '../../src/shared/panel-layout'

describe('panel-layout clamp', () => {
  it('夹在上下界内', () => {
    expect(clamp(100, LAYOUT_BOUNDS.sidebarWidth.min, LAYOUT_BOUNDS.sidebarWidth.max)).toBe(216)
    expect(clamp(500, LAYOUT_BOUNDS.sidebarWidth.min, LAYOUT_BOUNDS.sidebarWidth.max)).toBe(320)
    expect(clamp(248, LAYOUT_BOUNDS.sidebarWidth.min, LAYOUT_BOUNDS.sidebarWidth.max)).toBe(248)
  })
})
