/**
 * F01 — 破坏性工具：用户批准后正常执行
 *
 * 验证：confirm-all 模式下，file_write 触发确认弹窗；
 * 用户批准后工具执行成功；文件落地；done=completed。
 */
import type { EvalScenario } from '../types'
import {
  makeTerminalReasonGrader,
  makeToolCallGrader,
  makeFilesystemGrader,
} from '../graders/index'
import { buildTool } from '../../electron/main/tools/builder'
import type { ToolRegistry } from '../../electron/main/tools/registry'
import { makeEvalLLMConfig } from '../types'

export const F01: EvalScenario = {
  id: 'F01',
  description: '破坏性工具：用户批准后正常执行，文件落地',
  required: true,

  registerTools(registry: ToolRegistry) {
    registry.register(buildTool({
      name: 'write_eval_file',
      description: 'Write a test file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
      metadata: { isDestructive: true, isReadOnly: false, isConcurrencySafe: false },
      execute: async (args, ctx) => {
        const { writeFileSync } = await import('node:fs')
        const { join } = await import('node:path')
        const abs = join(ctx?.workdir ?? '.', args.path as string)
        writeFileSync(abs, args.content as string, 'utf-8')
        return `写入成功: ${args.path}`
      },
    }))
  },

  async buildOptions(workdir, registry) {
    return {
      config: makeEvalLLMConfig(),
      messages: [{ id: 'u1', role: 'user' as const, content: '请写一个测试文件', timestamp: Date.now() }],
      tools: registry.getAll(),
      executionMode: 'confirm-all' as const,
      // 始终批准
      confirmTool: async () => true,
      toolContext: { workdir, sessionId: 'eval-F01' },
    }
  },

  mockResponses: [
    {
      toolCalls: [{ id: 'tc1', name: 'write_eval_file', arguments: { path: 'output.txt', content: 'hello eval' } }],
    },
    { content: '文件写入完成' },
  ],

  graders: [
    makeTerminalReasonGrader('completed'),
    makeToolCallGrader('write_eval_file', { called: true, isError: false }),
    makeFilesystemGrader([{ relativePath: 'output.txt', exists: true, contentContains: 'hello eval' }]),
  ],
}
