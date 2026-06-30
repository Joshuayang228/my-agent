import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../utils/logger'
import { buildPolicy, type SandboxMode } from '../../sandbox/policy'
import * as settings from '../../storage/settings-store'
import { getWorkspaceRoot } from '../../agent/project-memory'

const log = createLogger('FileEdit')

function checkFileSandbox(resolved: string, mode: SandboxMode, wsRoot?: string): string | null {
  if (mode === 'full-access') return null

  if (mode === 'read-only') {
    return `[SANDBOX BLOCKED] 只读模式下禁止编辑文件。当前沙箱模式为 "${mode}"。`
  }

  const policy = buildPolicy(mode, wsRoot)

  if (wsRoot) {
    const normalizedPath = path.resolve(resolved).toLowerCase()
    const normalizedRoot = path.resolve(wsRoot).toLowerCase()
    if (!normalizedPath.startsWith(normalizedRoot)) {
      return `[SANDBOX BLOCKED] 目标路径 "${resolved}" 超出工作区 "${wsRoot}"。`
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

export const fileEditTool = buildTool({
  name: 'file_edit',
  description: `Edit a file by replacing specific text. Much more efficient than file_write for small changes.

When to use:
- Making targeted changes to existing files (fixing bugs, updating values, modifying logic)
- Replacing specific functions, classes, or code blocks
- Updating configuration values or constants
- Inserting new code after a specific location (use insert_after: true)
- You know the exact text to replace (must match EXACTLY including whitespace)

When NOT to use:
- Creating new files (use file_write instead)
- Rewriting entire files or making many scattered changes (use file_write - it's clearer)
- The old_str appears many times and you only want to change one specific occurrence (use count parameter carefully, or use apply_patch for surgical edits)
- You're not sure of the exact current content (read the file first to verify)

How it works:
- Finds old_str in the file and replaces it with new_str
- old_str must match EXACTLY (including all whitespace, indentation, line breaks)
- By default replaces only the FIRST occurrence (set count=-1 for all occurrences)
- Set insert_after=true to insert new_str after old_str instead of replacing
- Returns error if old_str is not found (helps catch mismatches early)

Best practices:
1. Read the file first to see the exact current content
2. Copy the exact text including all whitespace for old_str
3. If old_str appears multiple times, consider using apply_patch for more precise control
4. Use count parameter to limit replacements (default: 1 = first occurrence only)

Sandbox: Respects current sandbox mode (blocks writes outside workspace in workspace-write mode).`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative file path to edit.',
      },
      old_str: {
        type: 'string',
        description: 'The exact string to find in the file. Must match exactly including whitespace.',
      },
      new_str: {
        type: 'string',
        description: 'The replacement string. Use empty string to delete old_str.',
      },
      count: {
        type: 'number',
        description: 'How many occurrences to replace. Default: 1 (first match). Use -1 for all occurrences.',
      },
      insert_after: {
        type: 'boolean',
        description: 'If true, insert new_str after old_str instead of replacing it. Default: false.',
      },
    },
    required: ['path', 'old_str', 'new_str'],
  },
  metadata: {
    isDestructive: true,
  },
  execute: async (args) => {
    const filePath = args.path as string
    const oldStr = args.old_str as string
    const newStr = args.new_str as string
    const count = (args.count as number) ?? 1
    const insertAfter = (args.insert_after as boolean) ?? false

    if (!filePath?.trim()) return 'Error: file path is required'
    if (!oldStr) return 'Error: old_str is required'

    const resolved = path.resolve(filePath)

    const mode = (await settings.getSetting('sandboxMode') || 'workspace-write') as SandboxMode
    const wsRoot = getWorkspaceRoot()
    const blocked = checkFileSandbox(resolved, mode, wsRoot)
    if (blocked) {
      log.warn('File edit blocked by sandbox', { path: resolved, mode })
      return blocked
    }

    let original: string
    try {
      original = await fs.readFile(resolved, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error reading file: ${message}`
    }

    const occurrences = original.split(oldStr).length - 1
    if (occurrences === 0) {
      const preview = oldStr.length > 80 ? oldStr.slice(0, 80) + '...' : oldStr
      return `Error: old_str not found in ${resolved}.\nSearched for: ${JSON.stringify(preview)}\nFile has ${original.split('\n').length} lines, ${original.length} characters.`
    }

    let result: string
    if (count === -1) {
      if (insertAfter) {
        result = original.split(oldStr).join(oldStr + newStr)
      } else {
        result = original.split(oldStr).join(newStr)
      }
    } else {
      let replaced = 0
      result = original
      let searchFrom = 0
      while (replaced < count) {
        const idx = result.indexOf(oldStr, searchFrom)
        if (idx === -1) break
        if (insertAfter) {
          result = result.slice(0, idx + oldStr.length) + newStr + result.slice(idx + oldStr.length)
          searchFrom = idx + oldStr.length + newStr.length
        } else {
          result = result.slice(0, idx) + newStr + result.slice(idx + oldStr.length)
          searchFrom = idx + newStr.length
        }
        replaced++
      }
    }

    if (result === original) {
      return 'No changes made (old_str and new_str produce identical content).'
    }

    try {
      await fs.writeFile(resolved, result, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error writing file: ${message}`
    }

    const actualReplacements = count === -1 ? occurrences : Math.min(count, occurrences)
    const action = insertAfter ? 'inserted after' : 'replaced'
    log.info('File edited', { path: resolved, replacements: actualReplacements })
    return `Successfully ${action} ${actualReplacements} occurrence(s) in ${resolved}. (${occurrences} total found)`
  },
})
