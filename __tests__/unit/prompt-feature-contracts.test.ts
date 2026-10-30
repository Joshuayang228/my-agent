import { describe, expect, it } from 'vitest'
import { listPromptFeatureContracts, PROMPT_FEATURE_CONTRACTS } from '../../electron/main/prompts/feature-contracts'

describe('功能 Prompt 合同', () => {
  it('四个首批功能合同具备完整输入、覆盖边界、输出、回退和消费者', () => {
    expect(Object.keys(PROMPT_FEATURE_CONTRACTS)).toEqual(['momentReply', 'proactiveGreeting', 'imageGeneration', 'profileExtraction', 'momentPolish', 'dayScript', 'catchup', 'reflection'])
    for (const item of listPromptFeatureContracts()) {
      expect(item.key).toMatch(/^feature:/)
      expect(item.purpose).not.toBe('')
      expect(item.staticInputs.length).toBeGreaterThan(0)
      expect(item.runtimeInputs.length).toBeGreaterThan(0)
      expect(item.overrideBoundary.length).toBeGreaterThan(0)
      expect(item.output).not.toBe('')
      expect(item.fallback).not.toBe('')
      expect(item.consumers.length).toBeGreaterThan(0)
    }
  })
})
