import type { SkillDefinition, ToolDefinition } from '../../src/shared/types'
import type { SkillEvalCase } from './types'

export const CODE_REVIEW_SKILL: SkillDefinition = {
  meta: {
    name: 'code-review',
    description: '审阅代码并按严重程度输出问题',
    when_to_use: '用户要求审阅代码、PR 或补丁时',
    allowed_tools: ['file_read'],
    version: '1.0',
  },
  body: '先读取目标代码，再按必须修复、建议改进、可选优化三个层级输出问题。禁止在未读取代码时编造结论。',
  filePath: 'eval-fixture://code-review/SKILL.md',
  source: 'builtin',
}

const FILE_READ_TOOL: ToolDefinition = {
  name: 'file_read',
  description: '读取文件内容',
  parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
  execute: async (args) => `文件 ${String(args.path)}：const answer = 42`,
}

export const SKILL_EVAL_CASES: SkillEvalCase[] = [
  {
    id: 'S01',
    description: '匹配代码审阅请求时激活目标 Skill 并注入指南',
    skill: CODE_REVIEW_SKILL,
    userPrompt: '请帮我审阅 src/example.ts 的 TypeScript 代码。',
    expectedActivation: true,
    allowedTools: [],
    requiredResponseIncludes: ['必须修复'],
    mockResponses: [
      { toolCalls: [{ id: 'skill-1', name: 'skill_invoke_code_review', arguments: { reason: '用户明确要求代码审阅' } }] },
      { content: '必须修复：当前示例没有发现阻塞问题。' },
    ],
  },
  {
    id: 'S02',
    description: '普通闲聊不得误触发代码审阅 Skill',
    skill: CODE_REVIEW_SKILL,
    userPrompt: '今天天气不错，随便聊聊。',
    expectedActivation: false,
    allowedTools: [],
    forbiddenResponseIncludes: ['代码审阅已激活'],
    mockResponses: [{ content: '是啊，适合出去走走。' }],
  },
  {
    id: 'S03',
    description: '激活后只调用 Skill 声明允许的工具',
    skill: CODE_REVIEW_SKILL,
    userPrompt: '读取 src/example.ts 并做代码审阅。',
    expectedActivation: true,
    allowedTools: ['file_read'],
    supportTools: [FILE_READ_TOOL],
    requiredResponseIncludes: ['建议改进'],
    mockResponses: [
      { toolCalls: [{ id: 'skill-2', name: 'skill_invoke_code_review', arguments: { reason: '需要执行代码审阅流程' } }] },
      { toolCalls: [{ id: 'read-1', name: 'file_read', arguments: { path: 'src/example.ts' } }] },
      { content: '建议改进：可以为 answer 增加语义化命名。' },
    ],
  },
]
