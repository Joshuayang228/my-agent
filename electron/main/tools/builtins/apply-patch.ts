import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../utils/logger'
import { buildPolicy, type SandboxMode } from '../../sandbox/policy'
import * as settings from '../../storage/settings-store'
import { getWorkspaceRoot } from '../../agent/project-memory'

const log = createLogger('ApplyPatch')

interface HunkHeader {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
}

interface PatchHunk {
  header: HunkHeader
  lines: string[]
}

function parseHunkHeader(line: string): HunkHeader | null {
  const m = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/)
  if (!m) return null
  return {
    oldStart: parseInt(m[1], 10),
    oldCount: m[2] !== undefined ? parseInt(m[2], 10) : 1,
    newStart: parseInt(m[3], 10),
    newCount: m[4] !== undefined ? parseInt(m[4], 10) : 1,
  }
}

function parseUnifiedDiff(patch: string): { targetFile: string | null; hunks: PatchHunk[] } {
  const lines = patch.split('\n')
  let targetFile: string | null = null
  const hunks: PatchHunk[] = []
  let currentHunk: PatchHunk | null = null

  for (const line of lines) {
    if (line.startsWith('--- ')) {
      continue
    }
    if (line.startsWith('+++ ')) {
      const filePart = line.slice(4).trim()
      targetFile = filePart.startsWith('b/') ? filePart.slice(2) : filePart
      continue
    }

    const header = parseHunkHeader(line)
    if (header) {
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = { header, lines: [] }
      continue
    }

    if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') || line === '')) {
      currentHunk.lines.push(line)
    }
  }
  if (currentHunk) hunks.push(currentHunk)

  return { targetFile, hunks }
}

function applyHunks(original: string, hunks: PatchHunk[]): { result: string; applied: number; failed: number } {
  const originalLines = original.split('\n')
  let offset = 0
  let applied = 0
  let failed = 0

  for (const hunk of hunks) {
    const startIdx = hunk.header.oldStart - 1 + offset

    const contextLines = hunk.lines
      .filter(l => l.startsWith(' ') || l.startsWith('-'))
      .map(l => l.slice(1))

    let matchIdx = -1
    for (let fuzzy = 0; fuzzy <= 3; fuzzy++) {
      const tryIdx = startIdx + (fuzzy === 0 ? 0 : (fuzzy % 2 === 1 ? Math.ceil(fuzzy / 2) : -Math.ceil(fuzzy / 2)))
      if (tryIdx < 0 || tryIdx >= originalLines.length) continue

      let matches = true
      for (let ci = 0; ci < contextLines.length; ci++) {
        const lineIdx = tryIdx + ci
        if (lineIdx >= originalLines.length || originalLines[lineIdx] !== contextLines[ci]) {
          matches = false
          break
        }
      }
      if (matches) {
        matchIdx = tryIdx
        break
      }
    }

    if (matchIdx === -1) {
      failed++
      log.warn('Hunk failed to apply', { oldStart: hunk.header.oldStart })
      continue
    }

    const removeCount = hunk.lines.filter(l => l.startsWith('-') || l.startsWith(' ')).length
    const newLines = hunk.lines
      .filter(l => l.startsWith('+') || l.startsWith(' '))
      .map(l => l.slice(1))

    originalLines.splice(matchIdx, removeCount, ...newLines)
    offset += newLines.length - removeCount
    applied++
  }

  return { result: originalLines.join('\n'), applied, failed }
}

export const applyPatchTool = buildTool({
  name: 'apply_patch',
  description:
    'Apply a unified diff patch to a file. Accepts standard unified diff format ' +
    '(with --- a/file, +++ b/file, @@ hunk headers, and +/- lines). ' +
    'More precise than file_write for targeted multi-location edits. ' +
    'Supports fuzzy matching (±3 lines) for minor line offset differences.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Target file path. If omitted, extracted from the +++ line in the patch.',
      },
      patch: {
        type: 'string',
        description: 'The unified diff content to apply.',
      },
    },
    required: ['patch'],
  },
  metadata: {
    isDestructive: true,
  },
  execute: async (args) => {
    const patchContent = args.patch as string
    if (!patchContent?.trim()) return 'Error: patch content is required'

    const { targetFile: parsedTarget, hunks } = parseUnifiedDiff(patchContent)
    const filePath = (args.path as string) || parsedTarget
    if (!filePath) return 'Error: could not determine target file. Provide path parameter or include +++ line in patch.'
    if (hunks.length === 0) return 'Error: no valid hunks found in patch.'

    const resolved = path.resolve(filePath)

    const mode = (await settings.getSetting('sandboxMode') || 'workspace-write') as SandboxMode
    const wsRoot = getWorkspaceRoot()

    if (mode !== 'full-access') {
      if (mode === 'read-only') {
        return `[SANDBOX BLOCKED] 只读模式下禁止编辑文件。`
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
    }

    let original: string
    try {
      original = await fs.readFile(resolved, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error reading file: ${message}`
    }

    const { result, applied, failed } = applyHunks(original, hunks)

    if (applied === 0) {
      return `Patch failed: 0/${hunks.length} hunks applied. The file content may not match the expected context lines.`
    }

    try {
      await fs.writeFile(resolved, result, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error writing file: ${message}`
    }

    log.info('Patch applied', { path: resolved, applied, failed, totalHunks: hunks.length })
    if (failed > 0) {
      return `Patch partially applied: ${applied}/${hunks.length} hunks succeeded, ${failed} failed. Review the file for correctness.`
    }
    return `Patch applied successfully: ${applied}/${hunks.length} hunks applied to ${resolved}.`
  },
})
