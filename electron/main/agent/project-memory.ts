/**
 * 项目记忆 — 基于 PROJECT.md 的可编辑项目知识库
 *
 * Alice 方法论 Ch.8：M2 Project Memory，以 markdown 文件形式存储项目上下文。
 *
 * 功能：
 * - 自动检测工作区根目录下的 PROJECT.md
 * - 读取并注入到 System Prompt（L3 层）
 * - 通过 IPC 暴露增删改查能力
 * - Agent 可通过工具更新项目记忆
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { createLogger } from '../utils/logger'

const log = createLogger('ProjectMemory')

const PROJECT_FILE = 'PROJECT.md'

let workspaceRoot: string | undefined

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root
}

function getProjectPath(): string | null {
  if (!workspaceRoot) return null
  return path.join(workspaceRoot, PROJECT_FILE)
}

/**
 * 读取 PROJECT.md 的内容。
 * 如果文件不存在返回 null。
 */
export function readProjectMemory(): string | null {
  const filePath = getProjectPath()
  if (!filePath) return null

  try {
    if (!fs.existsSync(filePath)) return null
    const content = fs.readFileSync(filePath, 'utf-8')
    log.debug('Project memory loaded', { length: content.length })
    return content
  } catch (err) {
    log.warn('Failed to read PROJECT.md', { error: String(err) })
    return null
  }
}

/**
 * 写入 PROJECT.md（全量覆盖）。
 */
export function writeProjectMemory(content: string): boolean {
  const filePath = getProjectPath()
  if (!filePath) {
    log.warn('Cannot write PROJECT.md: no workspace root')
    return false
  }

  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    log.info('Project memory updated', { length: content.length })
    return true
  } catch (err) {
    log.warn('Failed to write PROJECT.md', { error: String(err) })
    return false
  }
}

/**
 * 向 PROJECT.md 追加一个段落（section）。
 * 如果文件不存在，创建初始模板。
 */
export function appendProjectSection(heading: string, body: string): boolean {
  const existing = readProjectMemory()
  const section = `\n\n## ${heading}\n\n${body}`

  if (existing) {
    return writeProjectMemory(existing + section)
  }

  const template = `# Project Memory\n\n> 项目知识库 — Agent 和用户共同维护的项目上下文。\n${section}`
  return writeProjectMemory(template)
}

/**
 * 构建项目记忆的 Prompt 注入文本。
 * 用于 System Prompt L3 层。
 */
export function buildProjectMemoryPrompt(): string | undefined {
  const content = readProjectMemory()
  if (!content || content.trim().length < 10) return undefined

  const truncated = content.length > 4000
    ? content.slice(0, 4000) + '\n\n[... PROJECT.md 内容已截断 ...]'
    : content

  return `<project_memory>\n${truncated}\n</project_memory>`
}
