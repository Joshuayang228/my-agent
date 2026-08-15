/**
 * C01 — Companion W6：名册浅注入且不泄露他人 protected（脚本断言，无 key 可跑）
 *
 * 流式禁换角由单元测试 companion-mutable / companion-life 覆盖；本场景锁 Assemble 契约。
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EvalScenario, EvalGrader, EvalContext, GraderResult } from '../types'
import { makeTerminalReasonGrader } from '../graders/index'
import { makeEvalLLMConfig } from '../types'
import { buildSystemPrompt, rolePackToPromptParts } from '../../electron/main/agent/prompt-builder'
import { loadRolePack } from '../../electron/main/companion/identity/loader'
import {
  buildRosterLines,
  formatRosterForPrompt,
} from '../../electron/main/companion/cast/roster'

function makeCompanionChecksGrader(): EvalGrader {
  return {
    name: 'CompanionAssembleRoster',
    assetDefinition: {
      kind: 'companion-assemble-roster',
      source: 'evals/scenarios/c01-companion.ts',
      criteria: {
        requiredChecks: ['hasRoster', 'hasLinProtected', 'noForeignProtected'],
        evidenceFile: 'companion-checks.json',
      },
    },
    grade({ workdir }: EvalContext): GraderResult {
      try {
        const raw = JSON.parse(
          readFileSync(join(workdir, 'companion-checks.json'), 'utf-8'),
        ) as Record<string, boolean>
        const violations: string[] = []
        if (!raw.hasRoster) violations.push('Prompt 缺少 Cast roster')
        if (!raw.hasLinProtected) violations.push('Prompt 缺少活跃主角 protected')
        if (!raw.noForeignProtected) violations.push('Prompt 泄露了非活跃角色全文 protected')
        if (violations.length) {
          return { pass: false, violations, evidence: [JSON.stringify(raw)] }
        }
        return {
          pass: true,
          violations: [],
          evidence: ['companion-checks.json 全部通过'],
        }
      } catch (err) {
        return {
          pass: false,
          violations: [`无法读取 companion-checks.json: ${String(err)}`],
          evidence: [],
        }
      }
    },
  }
}

export const C01: EvalScenario = {
  id: 'C01',
  description: 'Companion：主 Prompt 含名册短句且无他人全文 protected',
  required: true,

  async buildOptions(workdir, registry) {
    const pack = loadRolePack('lin')
    const rosterLines = formatRosterForPrompt(buildRosterLines('lin'))
    const systemPrompt = buildSystemPrompt({
      persona: rolePackToPromptParts(pack),
      toolNames: registry.getAll().map((t) => t.name),
      rosterLines,
    })

    writeFileSync(
      join(workdir, 'companion-checks.json'),
      JSON.stringify({
        hasRoster: systemPrompt.includes('## 角色名册') && systemPrompt.includes('陈姐'),
        hasLinProtected: systemPrompt.includes(pack.protected.slice(0, 16)),
        noForeignProtected:
          !systemPrompt.includes('CHEN_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT') &&
          !systemPrompt.includes('AYU_PROTECTED_FULL_BODY_MUST_NOT_APPEAR_IN_MAIN_PROMPT'),
      }),
    )

    return {
      config: makeEvalLLMConfig(),
      messages: [
        {
          id: 'u1',
          role: 'user' as const,
          content: '你好',
          timestamp: Date.now(),
        },
      ],
      systemPrompt,
      tools: registry.getAll(),
    }
  },

  mockResponses: [{ content: '嘿，我在。' }],

  graders: [makeTerminalReasonGrader('completed'), makeCompanionChecksGrader()],
}
