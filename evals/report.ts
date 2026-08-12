/**
 * Eval 报告序列化。
 *
 * 背景：远程人格验收不能依赖 Playground 目视，需要把实际回复、Judge 证据与 pass^k
 *       结果保存为可审阅文件。
 * 设计意图：JSON 供机器处理，Markdown 供用户阅读；两者共享同一结构，避免报告口径漂移。
 * 关键约束：禁止接收或保存 API Key；只记录 baseUrl、model、用户可见文本与 Grader 结果。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { PersonaEvalAgentInputSnapshot, PersonaEvalJudgeSnapshot, PersonaEvalReport } from '../src/shared/types'

export type { PersonaEvalReport } from '../src/shared/types'

function mdEscape(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function fenced(value: string): string[] {
  return ['```text', value, '```']
}

/** 把本次 Trial 真正送入 AgentLoop 的初始输入格式化为可人工审阅的 Markdown。 */
function formatAgentInput(input: PersonaEvalAgentInputSnapshot | undefined): string[] {
  if (!input) return ['> 历史报告未记录本次 Agent 输入。']

  const lines = [
    `- 模型：${input.model}`,
    `- Base URL：${input.baseUrl}`,
    `- 执行模式：${input.executionMode}`,
    `- 工具：${input.toolNames.length > 0 ? input.toolNames.join(', ') : '无'}`,
    '',
    '**用户与历史消息**',
    '',
  ]

  if (input.messages.length === 0) {
    lines.push('> （无初始消息）')
  } else {
    for (const message of input.messages) {
      lines.push(`- **${message.role}**`, '', ...fenced(message.content), '')
    }
  }

  lines.push(
    '<details>',
    '<summary>实际 System Prompt 快照</summary>',
    '',
    ...fenced(input.systemPrompt),
    '',
    '</details>',
  )
  return lines
}

/** Model Judge 的所有检查项在一次调用中完成；这里只展示评分计划，不暴露推理过程。 */
function formatJudgePlan(judge: PersonaEvalJudgeSnapshot | undefined): string[] {
  if (!judge) return ['> 本 Trial 没有 Model Judge，或历史报告未记录评分计划。']

  return [
    `- Grader：${judge.graderName}`,
    '- 调用方式：Agent 回复完成后，将以下全部维度一次性发送给 Judge AI 判断。',
    '',
    `> ${judge.systemContext}`,
    '',
    ...judge.checks.map((check, index) => `${index + 1}. \`${check.id}\` — ${check.question}`),
  ]
}


export function formatPersonaReportMarkdown(report: PersonaEvalReport): string {
  const lines = [
    '# Persona Eval 远程验收报告',
    '',
    `- 时间：${report.timestamp}`,
    `- 模式：${report.mode}`,
    `- 模型：${report.model}`,
    `- Base URL：${report.baseUrl}`,
    `- 稳定性：pass^${report.k}`,
    `- 结果：${report.pass ? 'PASS' : 'FAIL'}（${report.passedScenarios}/${report.totalScenarios} 场景稳定通过）`,
    '',
    '| 场景 | 通过次数 | 稳定通过 |',
    '|------|---------:|----------|',
    ...report.scenarios.map((scenario) =>
      `| ${scenario.id} ${mdEscape(scenario.description)} | ${scenario.passes}/${scenario.k} | ${scenario.pass ? '是' : '否'} |`
    ),
  ]

  for (const scenario of report.scenarios) {
    lines.push('', `## ${scenario.id} — ${scenario.description}`, '')
    for (let index = 0; index < scenario.trials.length; index++) {
      const trial = scenario.trials[index]
      lines.push(`### Trial ${index + 1} — ${trial.pass ? 'PASS' : 'FAIL'}`, '')
      if (trial.error) {
        lines.push(`**Runner Error**：${trial.error}`, '')
      }
      lines.push('**Agent 实际输入**', '', ...formatAgentInput(trial.agentInput), '')
      lines.push('**Judge 评分标准**', '', ...formatJudgePlan(trial.judge), '')
      lines.push('**Agent 回复**', '')
      lines.push(trial.agentTexts.length > 0
        ? trial.agentTexts.map((text) => `> ${text.replace(/\r?\n/g, '\n> ')}`).join('\n>\n')
        : '> （无 text 事件）')
      lines.push('', '**Grader**', '')
      for (const grader of trial.graderResults) {
        lines.push(`- **${grader.graderName}**：${grader.result.pass ? 'PASS' : 'FAIL'}`)
        for (const violation of grader.result.violations) {
          lines.push(`  - Violation：${violation}`)
        }
        for (const evidence of grader.result.evidence) {
          lines.push(`  - Evidence：${evidence}`)
        }
      }
    }
  }

  return `${lines.join('\n')}\n`
}

export function writePersonaEvalReport(
  report: PersonaEvalReport,
  outputDir: string,
): { jsonPath: string; markdownPath: string } {
  mkdirSync(outputDir, { recursive: true })
  const stamp = report.timestamp.replace(/[:.]/g, '-')
  const baseName = `${stamp}-persona-b02-b07-pass-${report.k}`
  const jsonPath = path.join(outputDir, `${baseName}.json`)
  const markdownPath = path.join(outputDir, `${baseName}.md`)
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
  writeFileSync(markdownPath, formatPersonaReportMarkdown(report), 'utf-8')
  return { jsonPath, markdownPath }
}
