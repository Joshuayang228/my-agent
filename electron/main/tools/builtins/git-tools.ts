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
      return output.slice(0, MAX_OUTPUT) + `\n\n... (truncated, ${output.length} total chars)`
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
    'Show the working tree status: staged, unstaged, and untracked files. ' +
    'Returns structured output with file status codes (M=modified, A=added, D=deleted, ?=untracked).',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Optional: limit status to a specific path.',
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
      return `Branch: ${branch || '(detached HEAD)'}\n\n${status || '(clean working tree)'}`
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})

export const gitDiffTool = buildTool({
  name: 'git_diff',
  description:
    'Show changes between commits, working tree, or staging area. ' +
    'Default: unstaged changes. Use staged=true for staged changes. ' +
    'Provide commit to diff against a specific commit (e.g. "HEAD~1", "main").',
  parameters: {
    type: 'object',
    properties: {
      staged: {
        type: 'boolean',
        description: 'If true, show staged (cached) changes. Default: false.',
      },
      commit: {
        type: 'string',
        description: 'Compare working tree against this commit/ref.',
      },
      path: {
        type: 'string',
        description: 'Limit diff to a specific file or directory.',
      },
      stat_only: {
        type: 'boolean',
        description: 'If true, show only diffstat summary instead of full diff. Default: false.',
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
      return output || '(no differences)'
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})

export const gitLogTool = buildTool({
  name: 'git_log',
  description:
    'Show commit log. Returns recent commits with hash, author, date, and message. ' +
    'Default: last 10 commits in oneline format.',
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Number of commits to show. Default: 10.',
      },
      oneline: {
        type: 'boolean',
        description: 'Compact one-line format. Default: true.',
      },
      path: {
        type: 'string',
        description: 'Show only commits that changed this file/directory.',
      },
      author: {
        type: 'string',
        description: 'Filter by author name or email.',
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
      return output || '(no commits found)'
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})

export const gitCommitTool = buildTool({
  name: 'git_commit',
  description:
    'Stage files and create a commit. Can stage specific files or all changes. ' +
    'This is a destructive operation that modifies git history.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Commit message (required).',
      },
      files: {
        type: 'string',
        description: 'Space-separated list of files to stage. Use "." for all changes. Default: "." (stage all).',
      },
    },
    required: ['message'],
  },
  metadata: { isDestructive: true },
  execute: async (args) => {
    const message = args.message as string
    if (!message?.trim()) return 'Error: commit message is required'

    const files = (args.files as string) || '.'

    try {
      const addArgs = files === '.' ? ['add', '.'] : ['add', ...files.split(/\s+/)]
      await runGit(addArgs)
      const output = await runGit(['commit', '-m', message])
      log.info('Git commit created', { message })
      return output
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})

export const gitBranchTool = buildTool({
  name: 'git_branch',
  description:
    'List, create, switch, or delete branches. ' +
    'Use action: "list" (default), "create", "switch", or "delete".',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'One of: list, create, switch, delete. Default: list.',
      },
      name: {
        type: 'string',
        description: 'Branch name (required for create/switch/delete).',
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
          if (!name) return 'Error: branch name is required'
          return await runGit(['checkout', '-b', name])
        case 'switch':
          if (!name) return 'Error: branch name is required'
          return await runGit(['checkout', name])
        case 'delete':
          if (!name) return 'Error: branch name is required'
          return await runGit(['branch', '-d', name])
        default:
          return `Error: unknown action "${action}". Use: list, create, switch, delete.`
      }
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})
