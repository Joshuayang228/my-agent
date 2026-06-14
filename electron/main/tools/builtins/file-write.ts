import type { ToolDefinition } from '../../../../src/shared/types'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../utils/logger'

const log = createLogger('FileWrite')

export const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description:
    'Write content to a file. Creates the file if it does not exist, or overwrites if it does. Creates parent directories automatically. Use with caution — this is a destructive operation.',
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
  metadata: {
    isReadOnly: false,
    isDestructive: true,
    isConcurrencySafe: false,
  },
  execute: async (args) => {
    const filePath = args.path as string
    const content = args.content as string
    const append = String(args.append || 'false').toLowerCase() === 'true'

    if (!filePath?.trim()) return 'Error: file path is required'

    const resolved = path.resolve(filePath)
    log.info('Writing file', { path: resolved, append, contentLength: content.length })

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
}
