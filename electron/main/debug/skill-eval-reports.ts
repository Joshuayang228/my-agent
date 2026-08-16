/**
 * Debug Skill Eval 报告读取服务。
 *
 * 背景：Skill Eval 由固定 CLI 生成报告，Debug 只负责展示同一份生产证据。
 * 设计意图：仅扫描命名符合约定的 JSON，并验证展示所需的最小结构后按时间倒序返回。
 * 关键约束：只读；拒绝目录穿越；损坏文件静默跳过；不读取 Markdown 或任意工作区文件。
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  DebugSkillEvalIndex,
  DebugSkillEvalReport,
  SkillEvalReport,
  SkillEvalReportSummary,
} from '../../../src/shared/types'

const SKILL_REPORT_PATTERN = /-skill-eval-(mock|real)-(pass|fail)\.json$/
const MAX_REPORT_BYTES = 25 * 1024 * 1024
const MAX_REPORT_FILES = 200

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isActivationTrace(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const trace = value as Record<string, unknown>
  return typeof trace.name === 'string'
    && typeof trace.toolName === 'string'
    && (trace.source === 'builtin' || trace.source === 'user')
    && typeof trace.version === 'string'
    && typeof trace.fingerprint === 'string'
    && (trace.reason === undefined || typeof trace.reason === 'string')
    && typeof trace.activatedAt === 'number'
}

function isGraderResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const grader = value as Record<string, unknown>
  if (typeof grader.graderName !== 'string' || !grader.result || typeof grader.result !== 'object') return false
  const result = grader.result as Record<string, unknown>
  return typeof result.pass === 'boolean'
    && isStringArray(result.violations)
    && isStringArray(result.evidence)
}

function isSkillEvalReport(value: unknown): value is SkillEvalReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Partial<SkillEvalReport>
  return (report.mode === 'mock' || report.mode === 'real')
    && typeof report.timestamp === 'string'
    && typeof report.model === 'string'
    && typeof report.baseUrl === 'string'
    && typeof report.pass === 'boolean'
    && typeof report.totalCases === 'number'
    && typeof report.passedCases === 'number'
    && Array.isArray(report.cases)
    && report.cases.every((testCase) => {
      if (!testCase || typeof testCase !== 'object') return false
      const item = testCase as Record<string, unknown>
      if (!item.input || typeof item.input !== 'object' || !item.evidence || typeof item.evidence !== 'object') return false
      const input = item.input as Record<string, unknown>
      const skill = input.skill as Record<string, unknown> | undefined
      const evidence = item.evidence as Record<string, unknown>
      return typeof item.id === 'string'
        && typeof item.description === 'string'
        && typeof item.pass === 'boolean'
        && typeof item.durationMs === 'number'
        && typeof input.userPrompt === 'string'
        && typeof input.model === 'string'
        && typeof input.baseUrl === 'string'
        && typeof input.expectedActivation === 'boolean'
        && isStringArray(input.allowedTools)
        && Boolean(skill)
        && typeof skill?.name === 'string'
        && typeof skill?.version === 'string'
        && (skill?.source === 'builtin' || skill?.source === 'user')
        && typeof skill?.fingerprint === 'string'
        && typeof skill?.toolName === 'string'
        && Array.isArray(evidence.activations)
        && evidence.activations.every(isActivationTrace)
        && isStringArray(evidence.toolCalls)
        && typeof evidence.injectionObserved === 'boolean'
        && typeof evidence.agentText === 'string'
        && Array.isArray(item.graderResults)
        && item.graderResults.every(isGraderResult)
    })
}

function toSummary(fileName: string, report: SkillEvalReport): SkillEvalReportSummary {
  return {
    fileName,
    timestamp: report.timestamp,
    mode: report.mode,
    model: report.model,
    baseUrl: report.baseUrl,
    pass: report.pass,
    totalCases: report.totalCases,
    passedCases: report.passedCases,
  }
}

async function readReport(reportDir: string, fileName: string): Promise<DebugSkillEvalReport | null> {
  if (path.basename(fileName) !== fileName || !SKILL_REPORT_PATTERN.test(fileName)) return null
  try {
    const filePath = path.join(reportDir, fileName)
    const fileStat = await stat(filePath)
    if (!fileStat.isFile() || fileStat.size > MAX_REPORT_BYTES) return null
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
    return isSkillEvalReport(parsed) ? { ...parsed, fileName } : null
  } catch {
    return null
  }
}

export async function listSkillEvalReports(reportDir: string): Promise<DebugSkillEvalIndex> {
  let fileNames: string[] = []
  try {
    fileNames = (await readdir(reportDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && SKILL_REPORT_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .slice(0, MAX_REPORT_FILES)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const parsed = await Promise.all(fileNames.map((fileName) => readReport(reportDir, fileName)))
  const reports = parsed
    .filter((report): report is DebugSkillEvalReport => report !== null)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))

  return {
    reportDir,
    reports: reports.map((report) => toSummary(report.fileName, report)),
    latest: reports[0] ?? null,
    skippedFiles: fileNames.length - reports.length,
  }
}

export async function getSkillEvalReport(
  reportDir: string,
  fileName: string,
): Promise<DebugSkillEvalReport | null> {
  return readReport(reportDir, fileName)
}
