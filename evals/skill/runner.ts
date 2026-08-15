/**
 * Skill Eval 隔离运行器。
 *
 * 背景：Mock Eval 需要证明生产 Skill 激活工具、AgentLoop 和工具边界能组成可复现证据链。
 * 设计意图：每个 Case 使用独立 ToolRegistry / 临时目录；Mock 与 Real 共用判定逻辑。
 * 关键约束：不加载或修改用户 Skill 文件，不写设置与真实会话；报告不保存 Skill 正文。
 */

import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { agentLoop } from '../../electron/main/agent/loop'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { buildSkillSummary, createSkillActivationTool, getSkillActivationTrace } from '../../electron/main/skills/registry'
import type { AgentStreamEvent, SkillEvalCaseReport, SkillEvalReport } from '../../src/shared/types'
import { createMockStreamChat } from '../mock-llm'
import { getEvalMode, hasEvalApiKey } from '../eval-config'
import { makeEvalLLMConfig, type GraderResult } from '../types'
import { collectAgentText } from '../transcript'
import type { SkillEvalCase } from './types'

import { SKILL_EVAL_GRADER_DEFINITIONS } from './grader-definitions'

function grade(pass: boolean, violation: string, evidence: string[]): GraderResult {
  return pass ? { pass: true, violations: [], evidence } : { pass: false, violations: [violation], evidence }
}

export function gradeSkillActivation(expected: boolean, skillName: string, activations: SkillEvalCaseReport['evidence']['activations']): GraderResult {
  const matched = activations.filter((item) => item.name === skillName)
  return grade(expected ? matched.length > 0 : matched.length === 0,
    expected ? `应激活 Skill「${skillName}」，但未激活。` : `不应激活 Skill「${skillName}」，但激活了 ${matched.length} 次。`,
    activations.map((item) => `${item.name} · ${item.toolName} · ${item.reason || '无原因'}`))
}

export function gradeSkillInjection(expected: boolean, observed: boolean, fingerprint: string): GraderResult {
  if (!expected) return { pass: true, violations: [], evidence: ['本 Case 不要求 Skill 注入。'] }
  return grade(observed, 'Skill 已激活，但工具结果中没有观察到指南注入。', [`正文指纹：${fingerprint}`, `注入观察：${observed}`])
}

export function gradeSkillToolBoundary(skillToolName: string, allowedTools: string[], toolCalls: string[]): GraderResult {
  const businessCalls = toolCalls.filter((name) => name !== skillToolName)
  const forbidden = businessCalls.filter((name) => !allowedTools.includes(name))
  return grade(forbidden.length === 0, `调用了 Skill 未允许的工具：${forbidden.join(', ')}`, businessCalls.map((name) => `调用工具：${name}`))
}

export function gradeSkillResponse(text: string, required: string[] = [], forbidden: string[] = []): GraderResult {
  const missing = required.filter((item) => !text.includes(item))
  const presentForbidden = forbidden.filter((item) => text.includes(item))
  const violations = [
    ...missing.map((item) => `回复缺少要求内容：${item}`),
    ...presentForbidden.map((item) => `回复包含禁止内容：${item}`),
  ]
  return { pass: violations.length === 0, violations, evidence: [`Agent 回复：${text || '（空）'}`] }
}

export async function runSkillEvalCase(testCase: SkillEvalCase): Promise<SkillEvalCaseReport> {
  const start = Date.now()
  const mode = getEvalMode()
  const workdir = join(tmpdir(), `skill-eval-${testCase.id}-${Date.now()}`)
  mkdirSync(workdir, { recursive: true })
  const registry = new ToolRegistry()
  const skillTool = createSkillActivationTool(testCase.skill)
  registry.register(skillTool)
  for (const tool of testCase.supportTools ?? []) registry.register(tool)
  const activations: SkillEvalCaseReport['evidence']['activations'] = []
  const transcript: AgentStreamEvent[] = []
  const config = makeEvalLLMConfig()
  const fingerprint = getSkillActivationTrace(testCase.skill).fingerprint

  try {
    if (mode === 'real' && !hasEvalApiKey()) {
      throw new Error('Real Skill Eval 缺少 API Key')
    }
    const options = {
      config,
      messages: [{ id: `user-${testCase.id}`, role: 'user' as const, content: testCase.userPrompt, timestamp: Date.now() }],
      tools: registry.getAll(),
      systemPrompt: buildSkillSummary([testCase.skill]),
      executionMode: 'auto' as const,
      toolContext: { workdir, sessionId: `skill-eval-${testCase.id}`, skillActivations: activations },
      ...(mode === 'mock' ? { _streamChatOverride: createMockStreamChat(testCase.mockResponses) } : {}),
    }
    for await (const event of agentLoop(options, registry)) transcript.push(event)
    const toolCalls = transcript.filter((event): event is Extract<AgentStreamEvent, { type: 'tool_start' }> => event.type === 'tool_start').map((event) => event.name)
    const injectionObserved = transcript.some((event) => event.type === 'tool_end' && event.name === skillTool.name && event.result.includes(testCase.skill.body))
    const agentText = collectAgentText(transcript)
    const graderResults = [
      { graderName: SKILL_EVAL_GRADER_DEFINITIONS.activation.name, result: gradeSkillActivation(testCase.expectedActivation, testCase.skill.meta.name, activations) },
      { graderName: SKILL_EVAL_GRADER_DEFINITIONS.injection.name, result: gradeSkillInjection(testCase.expectedActivation, injectionObserved, fingerprint) },
      { graderName: SKILL_EVAL_GRADER_DEFINITIONS.toolBoundary.name, result: gradeSkillToolBoundary(skillTool.name, testCase.allowedTools, toolCalls) },
      { graderName: SKILL_EVAL_GRADER_DEFINITIONS.response.name, result: gradeSkillResponse(agentText, testCase.requiredResponseIncludes, testCase.forbiddenResponseIncludes) },
    ]
    return {
      id: testCase.id,
      description: testCase.description,
      pass: graderResults.every((item) => item.result.pass),
      durationMs: Date.now() - start,
      input: {
        userPrompt: testCase.userPrompt,
        model: config.model,
        baseUrl: config.baseUrl,
        skill: { name: testCase.skill.meta.name, version: testCase.skill.meta.version || 'unversioned', source: testCase.skill.source, fingerprint, toolName: skillTool.name },
        expectedActivation: testCase.expectedActivation,
        allowedTools: testCase.allowedTools,
      },
      evidence: { activations: [...activations], toolCalls, injectionObserved, agentText },
      graderResults,
    }
  } catch (error) {
    return {
      id: testCase.id,
      description: testCase.description,
      pass: false,
      durationMs: Date.now() - start,
      input: {
        userPrompt: testCase.userPrompt, model: config.model, baseUrl: config.baseUrl,
        skill: { name: testCase.skill.meta.name, version: testCase.skill.meta.version || 'unversioned', source: testCase.skill.source, fingerprint, toolName: skillTool.name },
        expectedActivation: testCase.expectedActivation, allowedTools: testCase.allowedTools,
      },
      evidence: { activations: [...activations], toolCalls: [], injectionObserved: false, agentText: '' },
      graderResults: [],
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
}

export async function runSkillEvalSuite(cases: SkillEvalCase[]): Promise<SkillEvalReport> {
  const results: SkillEvalCaseReport[] = []
  for (const testCase of cases) results.push(await runSkillEvalCase(testCase))
  const config = makeEvalLLMConfig()
  const passedCases = results.filter((item) => item.pass).length
  return {
    timestamp: new Date().toISOString(), mode: getEvalMode(), model: config.model, baseUrl: config.baseUrl,
    pass: passedCases === results.length, totalCases: results.length, passedCases, cases: results,
  }
}
