import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../utils/logger'
import { buildPolicy, type SandboxMode } from '../../sandbox/policy'
import * as settings from '../../storage/settings-store'
import { getWorkspaceRoot } from '../../agent/project-memory'

const log = createLogger('FileWrite')

function checkFileSandbox(resolved: string, mode: SandboxMode, wsRoot?: string): string | null {
  if (mode === 'full-access') return null

  if (mode === 'read-only') {
    return `[SANDBOX BLOCKED] 只读模式下禁止写入文件。当前沙箱模式为 "${mode}"。`
  }

  // workspace-write: 必须在工作区内
  const policy = buildPolicy(mode, wsRoot)

  if (wsRoot) {
    const normalizedPath = path.resolve(resolved).toLowerCase()
    const normalizedRoot = path.resolve(wsRoot).toLowerCase()
    if (!normalizedPath.startsWith(normalizedRoot)) {
      return `[SANDBOX BLOCKED] 目标路径 "${resolved}" 超出工作区 "${wsRoot}"。workspace-write 模式仅允许写入工作区内的文件。`
    }
  }

  for (const protPath of policy.protectedPaths) {
    const segments = resolved.split(path.sep)
    if (segments.some((s) => s === protPath)) {
      return `[SANDBOX BLOCKED] 目标路径包含受保护路径 "${protPath}"。`
    }
  }

  return null
}

export const fileWriteTool = buildTool({
  name: 'file_write',
  description: `Write content to a file. Creates the file if it does not exist, or overwrites if it does.

When to use:
- Creating new files (code, config, documentation)
- Completely replacing file contents (when the entire file needs to be rewritten)
- Appending content to existing files (use append: "true" parameter)
- You have verified the target path and content are correct

When NOT to use:
- Making small edits to existing files (use file_edit or apply_patch instead - they're safer and more precise)
- Modifying structured files where only specific sections need changes (use edit tools)
- Writing to files outside the workspace in workspace-write mode (will be blocked by sandbox)

Behavior:
- Creates parent directories automatically if they don't exist
- Default mode: overwrites existing files completely
- Append mode: adds content to the end of existing files
- Sandbox: respects current sandbox mode (read-only blocks all writes, workspace-write blocks writes outside project)

CAUTION: This is a destructive operation. Double-check the path and content before executing.`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative file path to write to.',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file.',
      },
      append: {
        type: 'string',
        description: 'If "true", append to the file instead of overwriting. Default: "false".',
      },
    },
    required: ['path', 'content'],
  },
  inputExamples: [
    { path: 'notes/todo.md', content: '# TODO\n- item 1\n' },
    { path: 'logs/run.log', content: 'appended line\n', append: 'true' },
  ],
  metadata: {
    isDestructive: true,
  },
  execute: async (args) => {
    const filePath = args.path as string
    const content = args.content as string
    const append = String(args.append || 'false').toLowerCase() === 'true'

    if (!filePath?.trim()) return 'Error: file path is required'

    const resolved = path.resolve(filePath)

    // 沙箱策略检查
    const mode = (await settings.getSetting('sandboxMode') || 'workspace-write') as SandboxMode
    const wsRoot = getWorkspaceRoot()
    const blocked = checkFileSandbox(resolved, mode, wsRoot)
    if (blocked) {
      log.warn('File write blocked by sandbox', { path: resolved, mode, wsRoot })
      return blocked
    }

    log.info('Writing file', { path: resolved, append, contentLength: content.length, sandboxMode: mode })

    try {
      await fs.mkdir(path.dirname(resolved), { recursive: true })

      if (append) {
        await fs.appendFile(resolved, content, 'utf-8')
      } else {
        await fs.writeFile(resolved, content, 'utf-8')
      }

      const stat = await fs.stat(resolved)
      return `File ${append ? 'appended' : 'written'} successfully: ${resolved} (${stat.size} bytes)`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('Write failed', { path: resolved, error: message })
      return `Error writing file: ${message}`
    }
  },
})
