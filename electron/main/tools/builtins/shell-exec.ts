import type { ToolDefinition } from '../../../../src/shared/types'
import { exec } from 'node:child_process'
import { createLogger } from '../../utils/logger'

const log = createLogger('ShellExec')

const TIMEOUT_MS = 30_000
const MAX_OUTPUT_CHARS = 30_000

export const shellExecTool: ToolDefinition = {
  name: 'shell_exec',
  description:
    'Execute a shell command and return its output. Use for running scripts, installing packages, checking system info, etc. Commands time out after 30 seconds. Use with caution — this is a destructive operation.',
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

    log.info('Executing command', { command, cwd })

    return new Promise<string>((resolve) => {
      exec(command, { timeout: TIMEOUT_MS, cwd, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
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
