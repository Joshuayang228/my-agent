/**
 * Eval Case 与 Grader 生产资产注册表。
 *
 * 背景：运行报告只能说明某次结果，开发者还需要在运行前审阅有哪些 Case、判据和依赖。
 * 设计意图：从唯一 Scenario 注册表、真实 Grader 实例与 Skill Case 生成只读资产，不维护第三份评分规则。
 * 关键约束：不执行 Runner，不读取报告、环境变量、API Key、临时目录或 Judge 隐藏推理。
 */

import type { ModelContextAsset, ModelContextAssetType } from '../src/shared/types'
import { modelContextFingerprint } from '../electron/main/prompts/fingerprint'
import { SKILL_EVAL_CASES } from './skill/cases'
import { SKILL_EVAL_GRADER_DEFINITIONS } from './skill/grader-definitions'
import type { SkillEvalCase } from './skill/types'
import { REGISTERED_EVAL_SCENARIOS, type RegisteredEvalScenario } from './scenario-registry'
import type { EvalGrader } from './types'

const EVAL_ASSET_VERSION = '1.0.0'

function jsonContent(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function preview(content: string, max = 420): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact
}

function evalAsset(input: {
  key: string
  name: string
  purpose: string
  role: string
  source: string
  assetType: Extract<ModelContextAssetType, 'eval-case' | 'eval-grader'>
  content: string
  dependencies?: string[]
  derivedFrom?: string
}): ModelContextAsset {
  return {
    key: input.key,
    id: input.key,
    name: input.name,
    category: 'eval',
    purpose: input.purpose,
    role: input.role,
    desc: 'Eval 的静态 Case 或 Grader 定义；实际输入、回复与评分证据请查看质量 / Eval 报告。',
    source: input.source,
    sourcePath: input.source,
    version: EVAL_ASSET_VERSION,
    fingerprint: modelContextFingerprint(input.content),
    fingerprintKind: 'content',
    assetType: input.assetType,
    ownership: 'builtin',
    contentKind: 'data',
    mode: 'static',
    locale: 'zh-CN',
    locales: { 'zh-CN': { template: input.content } },
    slots: [],
    status: 'active',
    dependencies: input.dependencies ?? [],
    derivedFrom: input.derivedFrom,
    preview: preview(input.content),
    content: input.content,
    dynamic: false,
  }
}

function graderInstanceKeys(caseId: string, graders: EvalGrader[]): string[] {
  const counts = new Map<string, number>()
  return graders.map((grader) => {
    const kind = grader.assetDefinition.kind
    const ordinal = (counts.get(kind) ?? 0) + 1
    counts.set(kind, ordinal)
    return `eval-grader:${caseId}:${kind}:${ordinal}`
  })
}

function ordinaryGraderAssets(
  registration: RegisteredEvalScenario,
  keys: string[],
): ModelContextAsset[] {
  const caseKey = `eval-case:${registration.scenario.id}`
  return registration.scenario.graders.map((grader, index) => {
    const content = jsonContent({
      caseId: registration.scenario.id,
      order: index + 1,
      name: grader.name,
      kind: grader.assetDefinition.kind,
      criteria: grader.assetDefinition.criteria,
      reportPlan: grader.reportPlan ?? null,
    })
    return evalAsset({
      key: keys[index],
      name: `Eval Grader · ${registration.scenario.id} · ${grader.name}`,
      purpose: `评估 ${registration.scenario.id} 的第 ${index + 1} 项判据`,
      role: 'eval-grader',
      source: grader.assetDefinition.source,
      assetType: 'eval-grader',
      dependencies: grader.reportPlan ? ['eval-judge'] : [],
      derivedFrom: caseKey,
      content,
    })
  })
}

function ordinaryScenarioAssets(registration: RegisteredEvalScenario): ModelContextAsset[] {
  const scenario = registration.scenario
  const graderKeys = graderInstanceKeys(scenario.id, scenario.graders)
  const content = jsonContent({
    id: scenario.id,
    description: scenario.description,
    suite: registration.suite,
    defaultMode: scenario.mockResponses ? 'mock' : 'real',
    required: scenario.required,
    mockTurnCount: scenario.mockResponses?.length ?? 0,
    registersTools: Boolean(scenario.registerTools),
    graderKeys,
    actualInputLocation: 'Debug → 质量 / Eval → 对应报告与 Trial',
  })
  const caseAsset = evalAsset({
    key: `eval-case:${scenario.id}`,
    name: `Eval Case · ${scenario.id}`,
    purpose: scenario.description,
    role: 'eval-case',
    source: registration.source,
    assetType: 'eval-case',
    dependencies: graderKeys,
    content,
  })
  return [caseAsset, ...ordinaryGraderAssets(registration, graderKeys)]
}

function skillGraderEntries(testCase: SkillEvalCase) {
  return [
    {
      definition: SKILL_EVAL_GRADER_DEFINITIONS.activation,
      criteria: {
        ...SKILL_EVAL_GRADER_DEFINITIONS.activation.criteria,
        expectedActivation: testCase.expectedActivation,
        skillName: testCase.skill.meta.name,
      },
    },
    {
      definition: SKILL_EVAL_GRADER_DEFINITIONS.injection,
      criteria: {
        ...SKILL_EVAL_GRADER_DEFINITIONS.injection.criteria,
        expectedActivation: testCase.expectedActivation,
      },
    },
    {
      definition: SKILL_EVAL_GRADER_DEFINITIONS.toolBoundary,
      criteria: {
        ...SKILL_EVAL_GRADER_DEFINITIONS.toolBoundary.criteria,
        allowedTools: [...testCase.allowedTools],
      },
    },
    {
      definition: SKILL_EVAL_GRADER_DEFINITIONS.response,
      criteria: {
        ...SKILL_EVAL_GRADER_DEFINITIONS.response.criteria,
        requiredResponseIncludes: [...(testCase.requiredResponseIncludes ?? [])],
        forbiddenResponseIncludes: [...(testCase.forbiddenResponseIncludes ?? [])],
      },
    },
  ]
}

function skillCaseAssets(testCase: SkillEvalCase): ModelContextAsset[] {
  const graderEntries = skillGraderEntries(testCase)
  const graderKeys = graderEntries.map(({ definition }) => `eval-grader:${testCase.id}:${definition.kind}:1`)
  const caseKey = `eval-case:${testCase.id}`
  const caseContent = jsonContent({
    id: testCase.id,
    description: testCase.description,
    suite: 'skill',
    defaultMode: 'mock-or-real',
    userPrompt: testCase.userPrompt,
    skill: {
      name: testCase.skill.meta.name,
      version: testCase.skill.meta.version ?? 'unversioned',
      source: testCase.skill.source,
    },
    expectedActivation: testCase.expectedActivation,
    allowedTools: [...testCase.allowedTools],
    supportTools: (testCase.supportTools ?? []).map((tool) => tool.name),
    requiredResponseIncludes: [...(testCase.requiredResponseIncludes ?? [])],
    forbiddenResponseIncludes: [...(testCase.forbiddenResponseIncludes ?? [])],
    mockTurnCount: testCase.mockResponses.length,
    graderKeys,
  })
  const caseAsset = evalAsset({
    key: caseKey,
    name: `Skill Eval Case · ${testCase.id}`,
    purpose: testCase.description,
    role: 'skill-eval-case',
    source: 'evals/skill/cases.ts',
    assetType: 'eval-case',
    dependencies: graderKeys,
    content: caseContent,
  })
  const graderAssets = graderEntries.map(({ definition, criteria }, index) => {
    const content = jsonContent({
      caseId: testCase.id,
      order: index + 1,
      name: definition.name,
      kind: definition.kind,
      criteria,
    })
    return evalAsset({
      key: graderKeys[index],
      name: `Skill Eval Grader · ${testCase.id} · ${definition.name}`,
      purpose: `评估 ${testCase.id} 的 ${definition.name} 判据`,
      role: 'skill-eval-grader',
      source: definition.source,
      assetType: 'eval-grader',
      derivedFrom: caseKey,
      content,
    })
  })
  return [caseAsset, ...graderAssets]
}

/**
 * 构建全部静态 Eval Case / Grader 资产。
 *
 * 背景：Debug 需要运行前的评分计划，不能依赖某次已经生成的报告。
 * 设计意图：普通场景从唯一注册表展开，Skill Case 从现有 Case 数组展开，Grader 判据来自真实实例定义。
 * 关键约束：函数只做内存序列化，不调用 buildOptions、grade、Runner 或 LLM。
 */
export function getEvalCaseGraderAssetCatalog(): ModelContextAsset[] {
  return [
    ...REGISTERED_EVAL_SCENARIOS.flatMap(ordinaryScenarioAssets),
    ...SKILL_EVAL_CASES.flatMap(skillCaseAssets),
  ]
}
