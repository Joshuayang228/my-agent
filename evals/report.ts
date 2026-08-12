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
import type { ScenarioResult } from './types'

export interface PersonaScenarioReport {
  id: string
  description: string
  pass: boolean
  passes: number
  k: number
  trials: ScenarioResult[]
}

export interface PersonaEvalReport {
  timestamp: string
  mode: 'real'
  model: string
  baseUrl: string
  pass: boolean
  totalScenarios: number
  passedScenarios: number
  k: number
  scenarios: PersonaScenarioReport[]
}

function mdEscape(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
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
