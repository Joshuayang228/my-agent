/**
 * 自有 Prompt 中文门禁。
 *
 * 背景：生产 Prompt、内置工具 schema 与 Eval Judge 曾混入整段英文，导致同一轮模型
 * 同时处理两套自然语言。这里直接检查运行时组装结果和自有 schema，而不是维护第二份文案清单。
 * 约束：工具名、JSON 字段、枚举值、路径和协议 token 可以保留英文；英文自然语言句子不允许。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { DEFAULT_SYSTEM_PROMPT } from '../../electron/main/agent/loop'
import { DEFAULT_PLAYGROUND_SYSTEM } from '../../electron/main/agent/playground'
import { EXTRACTION_PROMPT } from '../../electron/main/agent/profile-extractor'
import { buildSystemPrompt } from '../../electron/main/agent/prompt-builder'
import { buildSubAgentSystemPrompt } from '../../electron/main/agent/subagent'
import { formatReplyStanceForPrompt } from '../../electron/main/agent/reply-stance'
import { formatToneControlForPrompt } from '../../electron/main/agent/tone-control'
import { formatExpertiseLevelForPrompt } from '../../electron/main/agent/expertise-level'
import { formatRelationshipStageForPrompt } from '../../electron/main/companion/growth/relationship-stage'
import { formatFamiliarityMixForPrompt } from '../../electron/main/companion/growth/familiarity-mix'
import { formatMilestonesForPrompt } from '../../electron/main/companion/growth/milestones'
import { summonWorkerSystemAddon } from '../../electron/main/companion/cast/summon-delegation'
import { builtinTools } from '../../electron/main/tools/builtins/index'
import { errorFormattingMiddleware } from '../../electron/main/tools/middleware'

const ENGLISH_PROMPT_PATTERNS = [
  /\byou are\b/i,
  /\byour (?:task|response|message|result|reasoning)\b/i,
  /\bdo not\b/i,
  /\bplease (?:return|respond|write|use|fix|review|explain)\b/i,
  /\breturn only\b/i,
  /\bwhen (?:to|not to) use\b/i,
  /\bdoes the repl(?:y|ies)\b/i,
  /\bthe (?:user|assistant|conversation|response|result)\b/i,
  /\bcurrent conversation\b/i,
  /\brecent conversation\b/i,
  /\bmust be self-contained\b/i,
]

function expectNoEnglishPromptSentence(label: string, text: string): void {
  for (const pattern of ENGLISH_PROMPT_PATTERNS) {
    expect(text, `${label} 命中英文提示词：${pattern}`).not.toMatch(pattern)
  }
}

function collectSchemaText(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaText(item, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectSchemaText(item, out)
    }
  }
}

function staticString(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

function collectEvalJudgeAndToolText(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf8')
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(sf).replace(/["']/g, '')
      if (key === 'question' || key === 'description') {
        const text = staticString(node.initializer)
        if (text) found.push(text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

describe('自有 Prompt 中文门禁', () => {
  it('生产主 Prompt 与动态注入块不含英文自然语言指令', () => {
    const assembled = buildSystemPrompt({
      persona: {
        id: 'test',
        name: '测试角色',
        description: '测试角色',
        protected: '你是可靠、平等的数字伙伴。',
        profile: '当前身份：独立开发者。',
        worldProfile: '常住城市：上海。',
        mutable: '当前相处方式：简洁、自然。',
        aside_style: '偶尔一句轻松旁白',
      },
      toolNames: ['file_read', 'task_plan'],
      userProfile: { identity: '用户是产品经理。', workflow: '习惯先研究后动手。', voice: '偏好简洁中文。' },
      memories: '用户偏好 TypeScript。',
      sessionInfo: '当前任务是检查 Prompt。',
      replyStanceHint: formatReplyStanceForPrompt({ primary: 'act', signals: ['clear-act'], guidance: '直接推进并汇报验证结果。' }),
      toneControlHint: formatToneControlForPrompt({ register: 'tight', asidePolicy: 'discourage', signals: ['stance:act'], guidance: '语气档位：tight\n旁白策略：discourage\n行动指引：保持紧凑。' }),
      expertiseHint: formatExpertiseLevelForPrompt({ level: 'expert', signals: ['override:expert'], guidance: '少铺垫，多给差异点。', fromOverride: true }),
      relationshipStageHint: formatRelationshipStageForPrompt({ stage: 'familiar', guidance: '自然熟悉，但不越界。' }),
      milestoneHint: formatMilestonesForPrompt(['first_rapport']),
    })

    const prompts = [
      ['Loop 默认 System', DEFAULT_SYSTEM_PROMPT],
      ['Playground 默认 System', DEFAULT_PLAYGROUND_SYSTEM],
      ['画像提取 Prompt', EXTRACTION_PROMPT],
      ['主 Assemble', assembled],
      ['研究子 Agent', buildSubAgentSystemPrompt('researcher')],
      ['编码子 Agent', buildSubAgentSystemPrompt('coder')],
      ['召唤任务工边界', summonWorkerSystemAddon('summon')],
      ['熟悉度构成', formatFamiliarityMixForPrompt({ bond: 2, task: 3, neutral: 1, sampled: 6, lean: 'mixed', signals: [] })],
    ] as const

    for (const [label, text] of prompts) expectNoEnglishPromptSentence(label, text)
  })

  it('内置工具 schema 与输入示例不含英文自然语言指令', () => {
    for (const tool of builtinTools) {
      const texts: string[] = []
      collectSchemaText(tool.description, texts)
      collectSchemaText(tool.parameters, texts)
      collectSchemaText(tool.inputExamples, texts)
      for (const text of texts) expectNoEnglishPromptSentence(`工具 ${tool.name}`, text)
    }
  })

  it('框架自有工具错误与中间件提示使用中文', async () => {
    const result = await errorFormattingMiddleware(
      { call: { id: 'language-gate', name: 'test_tool', arguments: '{}' }, tool: builtinTools[0], args: {} },
      async () => { throw new Error('测试错误') },
    )
    expect(result.content).toContain('工具错误')
    expect(result.content).not.toContain('Tool Error')
  })

  it('Eval Judge 问题与 Eval 自有工具说明不含英文自然语言指令', () => {
    const files = [
      'b01-persona-tone.ts',
      'b02-protagonist-behavior.ts',
      'f01.ts',
      'f02-f07.ts',
      'p01-p04.ts',
      'p05-p06.ts',
    ]
    for (const file of files) {
      const filePath = path.resolve('evals/scenarios', file)
      for (const text of collectEvalJudgeAndToolText(filePath)) {
        expectNoEnglishPromptSentence(`Eval ${file}`, text)
      }
    }
  })
})
