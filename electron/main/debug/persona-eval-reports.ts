/**
 * Debug Persona Eval 报告读取服务。
 *
 * 背景：CLI 是真实 Eval 的执行入口，Debug 需要展示同一份报告真相，不能在 UI 再维护一套判定结果。
 * 设计意图：只扫描工作区 `eval-reports` 的 Persona JSON，校验最小结构后按时间倒序返回。
 * 关键约束：只读；拒绝目录穿越；损坏或非 Persona 报告跳过，不把文件系统异常和原始内容暴露给渲染层。
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  DebugPersonaEvalIndex,
  DebugPersonaEvalReport,
  PersonaEvalReport,
  PersonaEvalReportSummary,
} from '../../../src/shared/types'

const PERSONA_REPORT_PATTERN = /-persona-b02-b07-pass-\d+\.json$/

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isMessageRole(value: unknown): boolean {
  return value === 'user' || value === 'assistant' || value === 'system' || value === 'tool'
}

function isExecutionMode(value: unknown): boolean {
  return value === 'auto' || value === 'confirm-all' || value === 'plan-first' || value === 'full-access'
}

function isOptionalAgentInput(value: unknown): boolean {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  return typeof input.model === 'string'
    && typeof input.baseUrl === 'string'
    && isExecutionMode(input.executionMode)
    && typeof input.systemPrompt === 'string'
    && isStringArray(input.toolNames)
    && Array.isArray(input.messages)
    && input.messages.every((message) => {
      if (!message || typeof message !== 'object') return false
      const item = message as Record<string, unknown>
      return isMessageRole(item.role) && typeof item.content === 'string'
    })
}

function isOptionalJudgePlan(value: unknown): boolean {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false
  const judge = value as Record<string, unknown>
  return typeof judge.graderName === 'string'
    && judge.invocationMode === 'single-call'
    && typeof judge.systemContext === 'string'
    && Array.isArray(judge.checks)
    && judge.checks.every((check) => {
      if (!check || typeof check !== 'object') return false
      const item = check as Record<string, unknown>
      return typeof item.id === 'string' && typeof item.question === 'string'
    })
}

function isPersonaEvalReport(value: unknown): value is PersonaEvalReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Partial<PersonaEvalReport>
  return report.mode === 'real'
    && typeof report.timestamp === 'string'
    && typeof report.model === 'string'
    && typeof report.baseUrl === 'string'
    && typeof report.pass === 'boolean'
    && typeof report.totalScenarios === 'number'
    && typeof report.passedScenarios === 'number'
    && typeof report.k === 'number'
    && Array.isArray(report.scenarios)
    && report.scenarios.every((scenario) => {
      if (!scenario || typeof scenario !== 'object') return false
      const item = scenario as PersonaEvalReport['scenarios'][number]
      return typeof item.id === 'string'
        && typeof item.description === 'string'
        && typeof item.pass === 'boolean'
        && typeof item.passes === 'number'
        && typeof item.k === 'number'
        && Array.isArray(item.trials)
        && item.trials.every((trial) => {
          if (!trial || typeof trial !== 'object') return false
          const trialItem = trial as Record<string, unknown>
          return typeof trialItem.id === 'string'
            && typeof trialItem.description === 'string'
            && typeof trialItem.pass === 'boolean'
            && typeof trialItem.durationMs === 'number'
            && Array.isArray(trialItem.graderResults)
            && isStringArray(trialItem.agentTexts)
            && isOptionalAgentInput(trialItem.agentInput)
            && isOptionalJudgePlan(trialItem.judge)
        })
    })
}

function toSummary(fileName: string, report: PersonaEvalReport): PersonaEvalReportSummary {
  return {
    fileName,
    timestamp: report.timestamp,
    model: report.model,
    baseUrl: report.baseUrl,
    pass: report.pass,
    totalScenarios: report.totalScenarios,
    passedScenarios: report.passedScenarios,
    k: report.k,
  }
}

async function readReport(reportDir: string, fileName: string): Promise<DebugPersonaEvalReport | null> {
  if (path.basename(fileName) !== fileName || !PERSONA_REPORT_PATTERN.test(fileName)) return null
  try {
    const parsed: unknown = JSON.parse(await readFile(path.join(reportDir, fileName), 'utf8'))
    return isPersonaEvalReport(parsed) ? { ...parsed, fileName } : null
  } catch {
    return null
  }
}

export async function listPersonaEvalReports(reportDir: string): Promise<DebugPersonaEvalIndex> {
  let fileNames: string[] = []
  try {
    fileNames = (await readdir(reportDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && PERSONA_REPORT_PATTERN.test(entry.name))
      .map((entry) => entry.name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const parsed = await Promise.all(fileNames.map((fileName) => readReport(reportDir, fileName)))
  const reports = parsed
    .filter((report): report is DebugPersonaEvalReport => report !== null)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))

  return {
    reportDir,
    reports: reports.map((report) => toSummary(report.fileName, report)),
    latest: reports[0] ?? null,
    skippedFiles: fileNames.length - reports.length,
  }
}

export async function getPersonaEvalReport(
  reportDir: string,
  fileName: string,
): Promise<DebugPersonaEvalReport | null> {
  return readReport(reportDir, fileName)
}

