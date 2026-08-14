/**
 * Skill Eval 报告序列化。
 *
 * 背景：Debug 需要读取 CLI Eval 的持久化证据，而不是重新执行或复制 Skill 生产资产。
 * 设计意图：同一份结构化报告同时输出 JSON 和便于人工审阅的 Markdown。
 * 关键约束：报告只包含 Skill 元数据、指纹和运行证据，不包含 Skill 正文、API Key 或 reasoning。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { SkillEvalReport } from '../../src/shared/types'
import { redactSensitiveText } from '../../electron/main/utils/text-capture'

/** Base URL 可能携带 basic-auth 或 query token；展示时保留路由信息但移除凭据。 */
function sanitizeBaseUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.username) url.username = '[REDACTED]'
    if (url.password) url.password = '[REDACTED]'
    return redactSensitiveText(url.toString())
  } catch {
    return redactSensitiveText(raw)
  }
}

/** 递归覆盖报告中的错误、回复和证据文本，避免异常路径把凭据带入落盘文件。 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveText(value)
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeValue(item)]))
}

/** 报告落盘前统一脱敏；Base URL 额外移除 basic-auth 凭据。 */
export function sanitizeSkillEvalReport(report: SkillEvalReport): SkillEvalReport {
  const sanitized = sanitizeValue(report) as SkillEvalReport
  return {
    ...sanitized,
    baseUrl: sanitizeBaseUrl(sanitized.baseUrl),
    cases: sanitized.cases.map((testCase) => ({
      ...testCase,
      input: { ...testCase.input, baseUrl: sanitizeBaseUrl(testCase.input.baseUrl) },
    })),
  }
}

function safeTimestamp(timestamp: string): string {
  return timestamp.replace(/[:.]/g, '-')
}

function status(pass: boolean): string {
  return pass ? '通过' : '失败'
}

export function formatSkillEvalReportMarkdown(report: SkillEvalReport): string {
  const safeReport = sanitizeSkillEvalReport(report)
  const lines = [
    '# Skill Eval 报告',
    '',
    `- 时间：${safeReport.timestamp}`,
    `- 模式：${safeReport.mode === 'mock' ? 'Mock' : 'Real'}`,
    `- 模型：${safeReport.model}`,
    `- Base URL：${safeReport.baseUrl}`,
    `- 结果：${status(safeReport.pass)}（${safeReport.passedCases}/${safeReport.totalCases}）`,
    '',
  ]

  for (const testCase of safeReport.cases) {
    lines.push(
      `## ${testCase.id} · ${testCase.description}`,
      '',
      `- 结果：${status(testCase.pass)}`,
      `- 用户输入：${testCase.input.userPrompt}`,
      `- Skill：${testCase.input.skill.name} / ${testCase.input.skill.version} / ${testCase.input.skill.source}`,
      `- 指纹：${testCase.input.skill.fingerprint}`,
      `- 激活工具：${testCase.input.skill.toolName}`,
      `- 预期激活：${testCase.input.expectedActivation ? '是' : '否'}`,
      `- 允许工具：${testCase.input.allowedTools.join(', ') || '无'}`,
      `- 观察到指南注入：${testCase.evidence.injectionObserved ? '是' : '否'}`,
      `- 工具调用：${testCase.evidence.toolCalls.join(', ') || '无'}`,
      '',
      '### Agent 回复',
      '',
      testCase.evidence.agentText || '（空）',
      '',
      '### 激活 Trace',
      '',
    )
    if (testCase.evidence.activations.length === 0) lines.push('- 无')
    for (const trace of testCase.evidence.activations) {
      lines.push(`- ${trace.name} · ${trace.toolName} · ${trace.reason || '无原因'} · ${trace.fingerprint}`)
    }
    lines.push('', '### Grader', '')
    for (const grader of testCase.graderResults) {
      lines.push(`#### ${grader.graderName} · ${status(grader.result.pass)}`, '')
      lines.push(`- 违规：${grader.result.violations.join('；') || '无'}`)
      lines.push(`- 证据：${grader.result.evidence.join('；') || '无'}`, '')
    }
    if (testCase.error) lines.push(`- 运行错误：${testCase.error}`, '')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function writeSkillEvalReport(
  report: SkillEvalReport,
  outputDir: string,
): { jsonPath: string; markdownPath: string } {
  mkdirSync(outputDir, { recursive: true })
  const safeReport = sanitizeSkillEvalReport(report)
  const stem = `${safeTimestamp(safeReport.timestamp)}-skill-eval-${safeReport.mode}-${safeReport.pass ? 'pass' : 'fail'}`
  const jsonPath = path.join(outputDir, `${stem}.json`)
  const markdownPath = path.join(outputDir, `${stem}.md`)
  writeFileSync(jsonPath, `${JSON.stringify(safeReport, null, 2)}\n`, 'utf8')
  writeFileSync(markdownPath, formatSkillEvalReportMarkdown(safeReport), 'utf8')
  return { jsonPath, markdownPath }
}
