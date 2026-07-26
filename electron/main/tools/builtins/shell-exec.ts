import { buildTool } from '../builder'
import { exec } from 'node:child_process'
import { createLogger } from '../../utils/logger'
import type { SandboxMode } from '../../sandbox/policy'
import { checkCommandPermission } from '../../sandbox/permission-engine'
import { getWorkspaceRoot } from '../../agent/project-memory'
import * as settings from '../../storage/settings-store'

const log = createLogger('ShellExec')

const TIMEOUT_MS = 30_000
const MAX_OUTPUT_CHARS = 30_000

export const shellExecTool = buildTool({
  name: 'shell_exec',
  description: `Execute a shell command and return its output.

When to use:
- Running build scripts, tests, or compilation commands
- Installing or managing packages (npm, pip, cargo, etc.)
- Checking system information (disk space, processes, environment variables)
- Running Git commands (status, diff, log, etc.)
- File operations that are easier with shell commands (find, grep with complex patterns)
- Executing project-specific scripts or tools

When NOT to use:
- Simple file read/write operations (use dedicated file tools - they're safer and faster)
- Searching code (use code_search - it's optimized for this and returns structured results)
- Commands that require interactive input (shell is non-interactive)
- Long-running processes (commands timeout after 30 seconds)

Behavior:
- Commands timeout after 30 seconds (returns partial output + timeout indicator)
- Sandbox mode controls what commands are allowed:
  * read-only: blocks all write operations
  * workspace-write: blocks dangerous commands (rm -rf, dd, format, etc.) and writes outside workspace
  * full-access: allows all commands (use with caution)
- Returns stdout, stderr, and exit code
- Output truncated at 30,000 characters (use redirection to file for large outputs)

Security: All commands go through the permission engine (custom rules → approval store → sandbox). Dangerous operations may be blocked. Previously denied commands are automatically blocked.`,
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute.',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command. Defaults to current directory.',
      },
    },
    required: ['command'],
  },
  inputExamples: [
    { command: 'npm test' },
    { command: 'git status', cwd: 'packages/core' },
  ],
  metadata: {
    isDestructive: true,
  },
  execute: async (args) => {
    const command = args.command as string
    const cwd = (args.cwd as string) || undefined

    if (!command?.trim()) return 'Error: command is required'

    const mode = (await settings.getSetting('sandboxMode') || 'workspace-write') as SandboxMode
    const workspaceRoot = getWorkspaceRoot()
    // 统一走五层责任链（自定义规则 / 审批记录 / 沙箱），禁止工具内自管权限
    const decision = checkCommandPermission(command, cwd, mode, workspaceRoot)

    if (decision.allowed === false) {
      log.warn('Command blocked by permission engine', {
        command: command.slice(0, 100),
        reason: decision.reason,
        decisionType: decision.decisionType,
        chain: decision.chain,
      })
      return `[SANDBOX BLOCKED] ${decision.reason}\n\nThe current sandbox mode is "${mode}". This command was blocked for safety reasons.`
    }

    if (decision.allowed === 'needs_approval') {
      // 责任链已查过审批库仍为 needs_approval → 尚无允许记录。
      // Loop 在 confirmTool 通过后会 recordApproval(session)；若仍到这里说明未确认或 confirm 被跳过。
      log.warn('Command needs approval but none recorded', {
        command: command.slice(0, 100),
        reason: decision.reason,
      })
      return `[SANDBOX BLOCKED] ${decision.reason}\n\nThis command requires approval before execution. Ask the user to confirm, or use a less privileged alternative.`
    }

    log.info('Executing command', {
      command,
      cwd,
      sandboxMode: mode,
      decisionType: decision.decisionType,
    })

    const sanitizedEnv = { ...process.env }
    if (mode !== 'full-access') {
      delete sanitizedEnv.LD_PRELOAD
      delete sanitizedEnv.DYLD_INSERT_LIBRARIES
    }

    const isWin = process.platform === 'win32'
    const actualCommand = isWin ? `chcp 65001 >nul && ${command}` : command

    return new Promise<string>((resolve) => {
      exec(actualCommand, { timeout: TIMEOUT_MS, cwd, maxBuffer: 2 * 1024 * 1024, env: sanitizedEnv, encoding: 'utf-8' }, (error, stdout, stderr) => {
        const parts: string[] = []

        if (stdout) {
          let out = stdout.toString()
          if (out.length > MAX_OUTPUT_CHARS) {
            out = out.slice(0, MAX_OUTPUT_CHARS) + `\n[... truncated at ${MAX_OUTPUT_CHARS} chars]`
          }
          parts.push(out)
        }

        if (stderr) {
          let err = stderr.toString()
          if (err.length > MAX_OUTPUT_CHARS) {
            err = err.slice(0, MAX_OUTPUT_CHARS) + `\n[... truncated]`
          }
          parts.push(`[stderr]\n${err}`)
        }

        if (error) {
          const exitCode = error.code ?? 'unknown'
          parts.push(`[exit code: ${exitCode}]`)
          if (error.killed) parts.push('[process killed — timeout]')
          log.warn('Command failed', { command, exitCode })
        } else {
          log.info('Command completed', { command })
        }

        resolve(parts.join('\n') || '(no output)')
      })
    })
  },
})
