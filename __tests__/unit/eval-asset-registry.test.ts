import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/my-agent-test' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const { getEvalCaseGraderAssetCatalog } = await import('../../evals/asset-registry')
const { EVAL_SCENARIOS, REGISTERED_EVAL_SCENARIOS } = await import('../../evals/scenario-registry')

describe('Eval Case / Grader 生产资产目录', () => {
  it('普通 Scenario 使用唯一注册表并覆盖 F/P/B/C 全部 23 个场景', () => {
    const ids = EVAL_SCENARIOS.map((scenario) => scenario.id)

    expect(ids).toEqual([
      'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08',
      'P01', 'P02', 'P03', 'P04', 'P05', 'P06',
      'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07',
      'C01', 'C02',
    ])
    expect(new Set(ids).size).toBe(ids.length)
    expect(REGISTERED_EVAL_SCENARIOS.every((item) => item.source.startsWith('evals/scenarios/'))).toBe(true)
  })

  it('登记普通与 Skill Case，并为每个实际 Grader 生成结构化资产', () => {
    const assets = getEvalCaseGraderAssetCatalog()
    const caseAssets = assets.filter((asset) => asset.assetType === 'eval-case')
    const graderAssets = assets.filter((asset) => asset.assetType === 'eval-grader')
    const keys = assets.map((asset) => asset.key)

    expect(caseAssets.map((asset) => asset.key)).toEqual([
      ...EVAL_SCENARIOS.map((scenario) => `eval-case:${scenario.id}`),
      'eval-case:S01',
      'eval-case:S02',
      'eval-case:S03',
    ])
    expect(graderAssets.length).toBeGreaterThan(caseAssets.length)
    expect(new Set(keys).size).toBe(keys.length)
    for (const asset of assets) {
      expect(asset.category).toBe('eval')
      expect(asset.ownership).toBe('builtin')
      expect(asset.status).toBe('active')
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
      expect(asset.source).toMatch(/^(evals\/|electron\/)/)
    }
    for (const asset of graderAssets) {
      const content = JSON.parse(asset.content!) as { kind?: string; criteria?: unknown }
      expect(content.kind).toBeTruthy()
      expect(content.criteria).toBeTruthy()
      expect(asset.derivedFrom).toMatch(/^eval-case:/)
    }
  })

  it('Model Judge Grader 复用真实 reportPlan，并依赖 eval-judge Prompt', () => {
    const assets = getEvalCaseGraderAssetCatalog()
    const modelGraders = assets.filter((asset) => {
      if (asset.assetType !== 'eval-grader') return false
      return JSON.parse(asset.content!).kind === 'model-based'
    })

    expect(modelGraders.length).toBeGreaterThan(0)
    for (const asset of modelGraders) {
      const content = JSON.parse(asset.content!) as {
        criteria: { checks: Array<{ id: string; question: string }> }
        reportPlan: { checks: Array<{ id: string; question: string }> }
      }
      expect(content.criteria.checks).toEqual(content.reportPlan.checks)
      expect(asset.dependencies).toEqual(['eval-judge'])
    }
  })

  it('Skill Case 展示实际输入与预期，但不复制 Skill 正文或运行报告', () => {
    const assets = getEvalCaseGraderAssetCatalog()
    const skillCase = assets.find((asset) => asset.key === 'eval-case:S01')!
    const content = JSON.parse(skillCase.content!) as Record<string, unknown>

    expect(content.userPrompt).toBe('请帮我审阅 src/example.ts 的 TypeScript 代码。')
    expect(content.expectedActivation).toBe(true)
    expect(content).not.toHaveProperty('skillBody')
    expect(skillCase.content).not.toContain('先读取目标代码，再按必须修复')
  })

  it('静态目录不包含凭据、报告、临时目录或 Judge 隐藏推理', () => {
    const serialized = JSON.stringify(getEvalCaseGraderAssetCatalog())

    expect(serialized).not.toContain('TEST_LLM_API_KEY')
    expect(serialized).not.toContain('LLM_API_KEY')
    expect(serialized).not.toContain('eval-reports')
    expect(serialized).not.toContain('judgeResponse')
    expect(serialized).not.toContain('workdir')
  })
})
