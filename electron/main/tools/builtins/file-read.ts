import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../utils/logger'

const log = createLogger('FileRead')

const MAX_FILE_SIZE = 256 * 1024
const MAX_RESULT_CHARS = 50_000

export const fileReadTool = buildTool({
  name: 'file_read',
  description: `Read the contents of a file.

When to use:
- You need to view the full content of code, config, or documentation files
- You want to check if a file contains specific content or understand its structure
- You need to analyze implementation details or configuration values
- You want to verify file existence (reading will tell you if the file exists or not)

When NOT to use:
- Searching for specific text patterns across many files (use code_search instead)
- File is larger than 256KB without line range (use code_search to locate first, then read specific sections with line_start/line_end)
- You only need to know if a file exists (just try reading it - the error message will tell you)

Supports: Text files (code, config, markdown, logs, etc.)
Returns: File content as text, truncated at 50,000 characters if too large.
Optional: Use line_start/line_end parameters to read specific line ranges from large files.`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative file path to read.',
      },
      line_start: {
        type: 'string',
        description: 'Optional start line number (1-indexed). If set, only reads from this line.',
      },
      line_end: {
        type: 'string',
        description: 'Optional end line number (1-indexed, inclusive). If set, only reads up to this line.',
      },
    },
    required: ['path'],
  },
  inputExamples: [
    { path: 'src/main.ts' },
    { path: 'electron/main/agent/loop.ts', line_start: '100', line_end: '160' },
  ],
  metadata: {
    isReadOnly: true,
    isConcurrencySafe: true,
  },
  // Infinity = 永不落盘，防止循环：读文件 → 写临时文件 → 读临时文件 → ...
  maxResultSizeChars: Infinity,
  execute: async (args) => {
    const filePath = args.path as string
    if (!filePath?.trim()) return 'Error: file path is required'

    const resolved = path.resolve(filePath)
    log.info('Reading file', { path: resolved })

    try {
      const stat = await fs.stat(resolved)

      if (!stat.isFile()) return `Error: "${resolved}" is not a file`
      if (stat.size > MAX_FILE_SIZE) {
        return `Error: file too large (${(stat.size / 1024).toFixed(0)} KB, max ${MAX_FILE_SIZE / 1024} KB). Use line_start/line_end to read a portion.`
      }

      let content = await fs.readFile(resolved, 'utf-8')

      const lineStart = parseInt(String(args.line_start || '0'), 10)
      const lineEnd = parseInt(String(args.line_end || '0'), 10)

      if (lineStart > 0 || lineEnd > 0) {
        const lines = content.split('\n')
        const start = Math.max(1, lineStart) - 1
        const end = lineEnd > 0 ? Math.min(lineEnd, lines.length) : lines.length
        content = lines.slice(start, end).join('\n')
      }

      if (content.length > MAX_RESULT_CHARS) {
        content = content.slice(0, MAX_RESULT_CHARS) + `\n\n[... truncated at ${MAX_RESULT_CHARS} chars]`
      }

      return content
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('Read failed', { path: resolved, error: message })
      return `Error reading file: ${message}`
    }
  },
})
