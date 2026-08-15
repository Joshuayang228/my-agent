import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import { createLogger } from '../../utils/logger'
import { checkFileWriteSandbox, resolveToolFilePath } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../../agent/project-memory'
import { PERMISSION_SANDBOX_ASSET_KEYS } from '../../sandbox/asset-keys'
import type { ToolContext } from '../../../../src/shared/types'

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
    "应用 unified diff 补丁修改文件。接受标准 unified diff 格式（含 --- a/file、+++ b/file、@@ 区块头和 +/- 行）。相比 file_write 更适合多处定点修改，并支持最多 ±3 行的模糊匹配。",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: "目标文件路径。如果省略，将从补丁的 +++ 行提取。",
      },
      patch: {
        type: 'string',
        description: "要应用的 unified diff 内容。",
      },
    },
    required: ['patch'],
  },
  metadata: {
    isDestructive: true,
  },
  execute: async (args, ctx?: ToolContext) => {
    const patchContent = args.patch as string
    if (!patchContent?.trim()) return '错误：必须提供补丁内容'

    const { targetFile: parsedTarget, hunks } = parseUnifiedDiff(patchContent)
    const filePath = (args.path as string) || parsedTarget
    if (!filePath) return '错误：无法确定目标文件。请提供 path 参数，或在补丁中包含 +++ 行。'
    if (hunks.length === 0) return '错误：补丁中没有找到有效区块。'

    const resolved = resolveToolFilePath(filePath, getWorkspaceRoot())

    const mode = await loadEffectiveSandbox()
    const wsRoot = getWorkspaceRoot()
    const blocked = checkFileWriteSandbox(resolved, mode, wsRoot, { action: '编辑' })
    ctx?.assetUsageReporter?.({
      assetKey: PERMISSION_SANDBOX_ASSET_KEYS.pathBoundaries,
      relation: 'used', usageKind: 'permission-decision', status: blocked ? 'blocked' : 'success',
      metadata: { sandboxMode: mode, decision: blocked ? 'deny' : 'allow' },
    })
    if (blocked) return blocked

    let original: string
    try {
      original = await fs.readFile(resolved, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `读取文件失败： ${message}`
    }

    const { result, applied, failed } = applyHunks(original, hunks)

    if (applied === 0) {
      return `补丁应用失败：0/${hunks.length} 个区块已应用。文件内容可能与预期上下文不匹配。`
    }

    try {
      await fs.writeFile(resolved, result, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `写入文件失败： ${message}`
    }

    log.info('Patch applied', { path: resolved, applied, failed, totalHunks: hunks.length })
    if (failed > 0) {
      return `补丁已部分应用： ${applied}/${hunks.length} 个区块成功，${failed} 个失败。请检查文件是否正确。`
    }
    return `补丁应用成功： ${applied}/${hunks.length} 个区块已应用到 ${resolved}.`
  },
})
