import { describe, expect, it } from 'vitest'
import { getPromptAssets } from '../../electron/main/agent/prompt-assets'

describe('debug prompt assets', () => {
  it('目录来自生产注册表且包含静态与动态 Prompt', () => {
    const assets = getPromptAssets()
    expect(assets.length).toBeGreaterThanOrEqual(5)
    expect(assets.some((asset) => asset.id === 'loop-default' && asset.content?.includes('乐于助人的 AI 助手'))).toBe(true)
    expect(assets.some((asset) => asset.id === 'system-layers' && asset.dynamic)).toBe(true)
    for (const asset of assets) {
      expect(asset.id).toBeTruthy()
      expect(asset.sourcePath).toBeTruthy()
    }
  })
})
