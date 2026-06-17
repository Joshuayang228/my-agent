import type { ToolDefinition } from '../../../../src/shared/types'
import { exec } from 'node:child_process'
import { createLogger } from '../../utils/logger'
import { buildPolicy, type SandboxMode } from '../../sandbox/policy'
import { guardCommand } from '../../sandbox/command-guard'
import { checkApproval } from '../../sandbox/approval-store'
import * as settings from '../../storage/settings-store'

const log = createLogger('ShellExec')

const TIMEOUT_MS = 30_000
const MAX_OUTPUT_CHARS = 30_000

export const shellExecTool: ToolDefinition = {
  name: 'shell_exec',
  description:
    'Execute a shell command and return its output. Use for running scripts, installing packages, checking system info, etc. Commands time out after 30 seconds. Commands are sandboxed — dangerous operations may be blocked.',
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
  metadata: {
    isReadOnly: false,
    isDestructive: true,
    isConcurrencySafe: false,
  },
  execute: async (args) => {
    const command = args.command as string
    const cwd = (args.cwd as string) || undefined

    if (!command?.trim()) return 'Error: command is required'

    const mode = (await settings.getSetting('sandboxMode') || 'workspace-write') as SandboxMode
    const policy = buildPolicy(mode, cwd || process.cwd())
    const decision = guardCommand(command, cwd, policy)

    if (decision.allowed === false) {
      log.warn('Command blocked by sandbox', { command: command.slice(0, 100), reason: decision.reason })
      return `[SANDBOX BLOCKED] ${decision.reason}\n\nThe current sandbox mode is "${mode}". This command was blocked for safety reasons.`
    }

    if (decision.allowed === 'needs_approval') {
      const priorApproval = checkApproval(command)
      if (priorApproval === false) {
        return `[SANDBOX BLOCKED] Previously denied: ${decision.reason}`
      }
    }

    log.info('Executing command', { command, cwd, sandboxMode: mode })

    const sanitizedEnv = { ...process.env }
    if (mode !== 'full-access') {
      delete sanitizedEnv.LD_PRELOAD
      delete sanitizedEnv.DYLD_INSERT_LIBRARIES
    }

    return new Promise<string>((resolve) => {
      exec(command, { timeout: TIMEOUT_MS, cwd, maxBuffer: 2 * 1024 * 1024, env: sanitizedEnv }, (error, stdout, stderr) => {
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
}
