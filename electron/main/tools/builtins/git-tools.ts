import { buildTool } from '../builder'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createLogger } from '../../utils/logger'
import { getWorkspaceRoot } from '../../agent/project-memory'

const execFileAsync = promisify(execFile)
const log = createLogger('GitTools')

const TIMEOUT_MS = 15_000
const MAX_OUTPUT = 50_000

async function runGit(args: string[], cwd?: string): Promise<string> {
  const workDir = cwd || getWorkspaceRoot() || process.cwd()
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: workDir,
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    const output = (stdout + (stderr ? `\n${stderr}` : '')).trim()
    if (output.length > MAX_OUTPUT) {
      return output.slice(0, MAX_OUTPUT) + `\n\n...（已截断，原始共 ${output.length} 个字符）`
    }
    return output
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(message)
  }
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
  execute: async (args) => {
    try {
      const pathArgs = args.path ? ['--', args.path as string] : []
      const [status, branch] = await Promise.all([
        runGit(['status', '--porcelain=v1', ...pathArgs]),
        runGit(['branch', '--show-current']),
      ])
      return `分支：${branch || '（游离 HEAD）'}\n\n${status || '（工作区干净）'}`
    } catch (err) {
      return `错误：${err instanceof Error ? err.message : String(err)}`
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
  execute: async (args) => {
    try {
      const gitArgs = ['diff']
      if (args.staged) gitArgs.push('--cached')
      if (args.stat_only) gitArgs.push('--stat')
      if (args.commit) gitArgs.push(args.commit as string)
      if (args.path) gitArgs.push('--', args.path as string)

      const output = await runGit(gitArgs)
      return output || '（没有差异）'
    } catch (err) {
      return `错误：${err instanceof Error ? err.message : String(err)}`
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
        description: "要显示的提交数量，默认 10。",
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
  execute: async (args) => {
    try {
      const count = (args.count as number) || 10
      const oneline = args.oneline !== false
      const gitArgs = ['log', `-${count}`]
      if (oneline) {
        gitArgs.push('--oneline', '--decorate')
      } else {
        gitArgs.push('--format=%H %an <%ae> %ai%n  %s')
      }
      if (args.author) gitArgs.push(`--author=${args.author as string}`)
      if (args.path) gitArgs.push('--', args.path as string)

      const output = await runGit(gitArgs)
      return output || '（没有找到提交）'
    } catch (err) {
      return `错误：${err instanceof Error ? err.message : String(err)}`
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
  execute: async (args) => {
    const message = args.message as string
    if (!message?.trim()) return '错误：必须提供提交消息'

    const files = (args.files as string) || '.'

    try {
      const addArgs = files === '.' ? ['add', '.'] : ['add', ...files.split(/\s+/)]
      await runGit(addArgs)
      const output = await runGit(['commit', '-m', message])
      log.info('Git commit created', { message })
      return output
    } catch (err) {
      return `错误：${err instanceof Error ? err.message : String(err)}`
    }
  },
})

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
  metadata: {},
  execute: async (args) => {
    const action = (args.action as string) || 'list'
    const name = args.name as string

    try {
      switch (action) {
        case 'list': {
          const output = await runGit(['branch', '-a', '--no-color'])
          return output || '(no branches)'
        }
        case 'create':
          if (!name) return '错误：必须提供分支名称'
          return await runGit(['checkout', '-b', name])
        case 'switch':
          if (!name) return '错误：必须提供分支名称'
          return await runGit(['checkout', name])
        case 'delete':
          if (!name) return '错误：必须提供分支名称'
          return await runGit(['branch', '-d', name])
        default:
          return `错误：未知操作“${action}”。可用值：list、create、switch、delete。`
      }
    } catch (err) {
      return `错误：${err instanceof Error ? err.message : String(err)}`
    }
  },
})
