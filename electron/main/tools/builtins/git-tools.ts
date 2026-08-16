import { buildTool } from '../builder'
import { execFile } from 'node:child_process'
import { buildSafeChildProcessEnv } from '../../utils/safe-process-env'
import { promisify } from 'node:util'
import { createLogger, hashForLog } from '../../utils/logger'
import { getWorkspaceRoot } from '../../agent/project-memory'
import type { ToolContext, ToolMetadata } from '../../../../src/shared/types'

const execFileAsync = promisify(execFile)
const log = createLogger('GitTools')

const TIMEOUT_MS = 15_000
const MAX_OUTPUT = 50_000
const MAX_PATH_LENGTH = 4_096
const MAX_REVISION_LENGTH = 200
const MAX_AUTHOR_LENGTH = 500
const MAX_COMMIT_MESSAGE_LENGTH = 20_000
const MAX_FILES_ARGUMENT_LENGTH = 20_000
const MAX_FILES_COUNT = 500
const MAX_BRANCH_NAME_LENGTH = 200

/**
 * Git 工具始终绑定当前 Agent 的有效工作区。
 *
 * 背景：旧实现未接收 ToolContext，子 Agent 即使被限制到独立 workdir，Git 仍会退回主进程
 * process.cwd()。设计意图：优先使用 ctx.workdir，其次使用当前项目；没有工作区就拒绝。
 * 关键约束：调用方不能自行回退 process.cwd()，否则会重新扩大子 Agent 文件边界。
 */
export function resolveGitWorkdir(ctx?: ToolContext): string | null {
  return ctx?.workdir?.trim() || getWorkspaceRoot() || null
}

async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      env: buildSafeChildProcessEnv({
        GIT_TERMINAL_PROMPT: '0',
        GIT_PAGER: 'cat',
        PAGER: 'cat',
      }),
    })
    const output = (stdout + (stderr ? `\n${stderr}` : '')).trim()
    if (output.length > MAX_OUTPUT) {
      return output.slice(0, MAX_OUTPUT) + `\n\n...（已截断，原始共 ${output.length} 个字符）`
    }
    return output
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.warn('Git command failed', {
      operation: args[0] || 'unknown',
      errorType: error instanceof Error ? error.name : 'unknown',
      errorLength: message.length,
    })
    throw new Error('Git 命令执行失败')
  }
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\0\r\n]/.test(value)
}

/** 防止把 ref 参数解释为 git diff 选项，同时保留 HEAD~1、main..feature 等常见 revspec。 */
export function isSafeGitRevision(value: unknown): value is string {
  return boundedString(value, MAX_REVISION_LENGTH) && !value.startsWith('-')
}

/** Git ref 基础约束；最终创建/切换仍由 Git 自身做存在性校验。 */
export function isSafeGitBranchName(value: unknown): value is string {
  if (!boundedString(value, MAX_BRANCH_NAME_LENGTH) || value.startsWith('-') || value === '@') return false
  return !value.startsWith('.')
    && !value.endsWith('.')
    && !value.endsWith('/')
    && !value.includes('..')
    && !value.includes('//')
    && !value.includes('@{')
    && !/[ ~^:?*[\\]/.test(value)
}

function invalidWorkdir(): string {
  return '错误：请先打开项目，Git 工具不会退回主进程目录执行。'
}

export const gitStatusTool = buildTool({
  name: 'git_status',
  description:
    "显示 Git 工作区状态，包括已暂存、未暂存和未跟踪文件；返回 M、A、D、? 等状态码。",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: "可选：只查看指定路径的状态。",
      },
    },
  },
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args, ctx?: ToolContext) => {
    const workdir = resolveGitWorkdir(ctx)
    if (!workdir) return invalidWorkdir()
    if (args.path !== undefined && !boundedString(args.path, MAX_PATH_LENGTH)) return '错误：Git 路径参数无效或过长'
    try {
      const pathArgs = args.path ? ['--', args.path] : []
      const [status, branch] = await Promise.all([
        runGit(['status', '--porcelain=v1', ...pathArgs], workdir),
        runGit(['branch', '--show-current'], workdir),
      ])
      return `分支：${branch || '（游离 HEAD）'}\n\n${status || '（工作区干净）'}`
    } catch {
      return '错误：读取 Git 状态失败，请确认当前目录是有效仓库。'
    }
  },
})

export const gitDiffTool = buildTool({
  name: 'git_diff',
  description:
    "显示提交、工作区或暂存区之间的差异。默认显示未暂存修改；staged=true 查看已暂存修改；commit 可指定对比基准。",
  parameters: {
    type: 'object',
    properties: {
      staged: {
        type: 'boolean',
        description: "设为 true 时显示已暂存（cached）的修改；默认 false。",
      },
      commit: {
        type: 'string',
        description: "将工作区与此 commit 或 ref 进行比较。",
      },
      path: {
        type: 'string',
        description: "只显示指定文件或目录的差异。",
      },
      stat_only: {
        type: 'boolean',
        description: "设为 true 时只显示 diffstat 摘要，不输出完整 diff；默认 false。",
      },
    },
  },
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args, ctx?: ToolContext) => {
    const workdir = resolveGitWorkdir(ctx)
    if (!workdir) return invalidWorkdir()
    if (args.staged !== undefined && typeof args.staged !== 'boolean') return '错误：staged 参数必须是布尔值'
    if (args.stat_only !== undefined && typeof args.stat_only !== 'boolean') return '错误：stat_only 参数必须是布尔值'
    if (args.commit !== undefined && !isSafeGitRevision(args.commit)) return '错误：commit/ref 参数无效'
    if (args.path !== undefined && !boundedString(args.path, MAX_PATH_LENGTH)) return '错误：Git 路径参数无效或过长'
    try {
      const gitArgs = ['diff']
      if (args.staged) gitArgs.push('--cached')
      if (args.stat_only) gitArgs.push('--stat')
      if (args.commit) gitArgs.push(args.commit)
      if (args.path) gitArgs.push('--', args.path)

      const output = await runGit(gitArgs, workdir)
      return output || '（没有差异）'
    } catch {
      return '错误：读取 Git 差异失败，请检查 ref 或仓库状态。'
    }
  },
})

export const gitLogTool = buildTool({
  name: 'git_log',
  description:
    "显示 Git 提交历史，包括 hash、作者、日期和消息；默认以单行格式显示最近 10 条。",
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: "要显示的提交数量，默认 10，最大 100。",
      },
      oneline: {
        type: 'boolean',
        description: "是否使用紧凑单行格式，默认 true。",
      },
      path: {
        type: 'string',
        description: "只显示修改过此文件或目录的提交。",
      },
      author: {
        type: 'string',
        description: "按作者姓名或邮箱过滤。",
      },
    },
  },
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args, ctx?: ToolContext) => {
    const workdir = resolveGitWorkdir(ctx)
    if (!workdir) return invalidWorkdir()
    const count = args.count === undefined ? 10 : args.count
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 100) return '错误：count 必须是 1–100 的整数'
    if (args.oneline !== undefined && typeof args.oneline !== 'boolean') return '错误：oneline 参数必须是布尔值'
    if (args.path !== undefined && !boundedString(args.path, MAX_PATH_LENGTH)) return '错误：Git 路径参数无效或过长'
    if (args.author !== undefined && !boundedString(args.author, MAX_AUTHOR_LENGTH)) return '错误：author 参数无效或过长'
    try {
      const oneline = args.oneline !== false
      const gitArgs = ['log', `-${count}`]
      if (oneline) gitArgs.push('--oneline', '--decorate')
      else gitArgs.push('--format=%H %an <%ae> %ai%n  %s')
      if (args.author) gitArgs.push(`--author=${args.author}`)
      if (args.path) gitArgs.push('--', args.path)

      const output = await runGit(gitArgs, workdir)
      return output || '（没有找到提交）'
    } catch {
      return '错误：读取 Git 历史失败，请检查过滤条件或仓库状态。'
    }
  },
})

export const gitCommitTool = buildTool({
  name: 'git_commit',
  description:
    "暂存文件并创建 Git commit。可暂存指定文件或全部修改；这是会修改 Git 历史的破坏性操作。",
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: "提交消息，必填。",
      },
      files: {
        type: 'string',
        description: "要暂存的文件列表，以空格分隔；使用 . 表示全部修改，默认 .。",
      },
    },
    required: ['message'],
  },
  metadata: { isDestructive: true },
  execute: async (args, ctx?: ToolContext) => {
    const workdir = resolveGitWorkdir(ctx)
    if (!workdir) return invalidWorkdir()
    const message = args.message
    if (!boundedString(message, MAX_COMMIT_MESSAGE_LENGTH) || !message.trim()) return '错误：提交消息为空、过长或包含控制字符'
    const files = args.files === undefined ? '.' : args.files
    if (!boundedString(files, MAX_FILES_ARGUMENT_LENGTH)) return '错误：文件参数无效或过长'
    const fileArgs = files === '.' ? ['.'] : files.trim().split(/\s+/)
    if (fileArgs.length === 0 || fileArgs.length > MAX_FILES_COUNT) return '错误：文件数量无效或过多'

    try {
      // `--` 终止 option 解析，防止文件名被解释成 git add 参数。
      await runGit(['add', '--', ...fileArgs], workdir)
      const output = await runGit(['commit', '-m', message], workdir)
      log.info('Git commit created', { messageHash: hashForLog(message), messageLength: message.length })
      return output
    } catch {
      return '错误：Git 提交失败，请检查暂存文件和仓库状态。'
    }
  },
})

/** list 可证明只读；其它 action 与未知参数都按破坏性、不可并发处理。 */
export function resolveGitBranchMetadata(args: Record<string, unknown>): Partial<ToolMetadata> {
  const action = typeof args.action === 'string' ? args.action : 'list'
  const readOnly = action === 'list'
  return {
    isReadOnly: readOnly,
    isDestructive: !readOnly,
    isConcurrencySafe: readOnly,
  }
}

export const gitBranchTool = buildTool({
  name: 'git_branch',
  description:
    "列出、创建、切换或删除分支。action 可为 list、create、switch、delete，默认 list。",
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "操作类型：list、create、switch 或 delete；默认 list。",
      },
      name: {
        type: 'string',
        description: "分支名称；create、switch、delete 操作时必填。",
      },
    },
  },
  // 参数未知时 fail-closed；仅 list 由 resolveMetadata 降为只读。
  metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
  resolveMetadata: resolveGitBranchMetadata,
  execute: async (args, ctx?: ToolContext) => {
    const workdir = resolveGitWorkdir(ctx)
    if (!workdir) return invalidWorkdir()
    const action = typeof args.action === 'string' ? args.action : 'list'
    const name = args.name

    try {
      switch (action) {
        case 'list': {
          const output = await runGit(['branch', '-a', '--no-color'], workdir)
          return output || '（没有分支）'
        }
        case 'create':
          if (!isSafeGitBranchName(name)) return '错误：分支名称无效'
          return await runGit(['switch', '-c', name], workdir)
        case 'switch':
          if (!isSafeGitBranchName(name)) return '错误：分支名称无效'
          return await runGit(['switch', name], workdir)
        case 'delete':
          if (!isSafeGitBranchName(name)) return '错误：分支名称无效'
          return await runGit(['branch', '-d', '--', name], workdir)
        default:
          return `错误：未知操作“${action}”。可用值：list、create、switch、delete。`
      }
    } catch {
      return '错误：Git 分支操作失败，请检查分支名称或仓库状态。'
    }
  },
})
