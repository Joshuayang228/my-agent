/**
 * Eval Runner 输入快照回归。
 *
 * 背景：Persona 报告过去只保存 Agent 回复，无法复现模型实际收到的题目与运行环境。
 * 意图：验证快照来自当次 AgentLoop options，并记录一次性 Judge 评分计划。
 * 约束：快照绝不能包含 API Key；Judge checks 不得混入被测 Agent 的 messages/System Prompt。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { runScenario } from '../../evals/runner'
import { makeModelBasedGrader } from '../../evals/graders/model-based'
import type { EvalScenario } from '../../evals/types'

const previousMode = process.env.EVAL_MODE

afterEach(() => {
  if (previousMode === undefined) delete process.env.EVAL_MODE
  else process.env.EVAL_MODE = previousMode
})

describe('Eval Runner 报告快照', () => {
  it('保存实际 Agent 输入与单次 Judge 全部检查项，但不保存 API Key', async () => {
    process.env.EVAL_MODE = 'mock'
    const checks = [
      { id: 'first', question: '是否出现第一类违规？' },
      { id: 'second', question: '是否出现第二类违规？' },
    ]
    const scenario: EvalScenario = {
      id: 'SNAPSHOT',
      description: '报告输入快照',
      required: false,
      async buildOptions() {
        return {
          config: {
            apiKey: 'sk-must-not-enter-report',
            baseUrl: 'https://example.test/v1',
            model: 'snapshot-model',
          },
          systemPrompt: '你是被测 Agent。只看用户消息，不知道评分标准。',
          messages: [{ id: 'u1', role: 'user', content: '这是实际发送的题目。', timestamp: 1 }],
          tools: [{
            name: 'read_only_tool',
            description: '只读工具',
            parameters: { type: 'object', properties: {} },
            metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
            execute: async () => 'ok',
          }],
          executionMode: 'confirm-all',
          _streamChatOverride: async function* () {
            yield { type: 'text' as const, content: '被测回复。' }
            return {
              content: '被测回复。',
              toolCalls: [],
              usage: { promptTokens: 10, completionTokens: 5 },
              stopReason: 'stop',
            }
          },
        }
      },
      graders: [
        makeModelBasedGrader('SnapshotJudge', '你在评估测试回复。', checks),
      ],
    }

    const result = await runScenario(scenario)

    expect(result.pass).toBe(true)
    expect(result.agentInput).toEqual({
      model: 'snapshot-model',
      baseUrl: 'https://example.test/v1',
      executionMode: 'confirm-all',
      systemPrompt: '你是被测 Agent。只看用户消息，不知道评分标准。',
      messages: [{ role: 'user', content: '这是实际发送的题目。' }],
      toolNames: ['read_only_tool'],
    })
    expect(result.judge).toEqual({
      graderName: 'SnapshotJudge',
      invocationMode: 'single-call',
      systemContext: '你在评估测试回复。',
      checks,
    })
    expect(JSON.stringify(result)).not.toContain('sk-must-not-enter-report')
    expect(result.agentInput?.systemPrompt).not.toContain('是否出现第一类违规')
    expect(result.agentInput?.messages[0].content).not.toContain('是否出现第二类违规')
  })
})
