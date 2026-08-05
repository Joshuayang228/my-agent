import { describe, expect, it } from 'vitest'
import { isWorldView, worldTabFromView } from '../../src/components/shell/WorldHub'

describe('WorldHub helpers', () => {
  it('isWorldView 覆盖口袋与子页', () => {
    expect(isWorldView('world')).toBe(true)
    expect(isWorldView('moments')).toBe(true)
    expect(isWorldView('assets')).toBe(true)
    expect(isWorldView('cast')).toBe(true)
    expect(isWorldView('shelf')).toBe(true)
    expect(isWorldView('chat')).toBe(false)
    expect(isWorldView('debug')).toBe(false)
  })

  it('worldTabFromView 默认朋友圈', () => {
    expect(worldTabFromView('world')).toBe('moments')
    expect(worldTabFromView('shelf')).toBe('shelf')
    expect(worldTabFromView('chat')).toBe('moments')
  })
})
