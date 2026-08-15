import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger, hashForLog } from '../../utils/logger'

const log = createLogger('FileRead')

const MAX_FILE_SIZE = 256 * 1024
const MAX_RESULT_CHARS = 50_000

export const fileReadTool = buildTool({
  name: 'file_read',
  description: "读取文件内容。\n\n适用场景：\n- 查看代码、配置或文档文件的完整内容\n- 检查文件是否包含特定内容，或理解其结构\n- 分析实现细节或配置值\n- 验证文件是否存在；读取结果会明确指出文件是否存在\n\n不适用场景：\n- 跨多个文件搜索特定文本模式（使用 code_search）\n- 文件大于 256KB 且没有指定行范围；先用 code_search 定位，再用 line_start、line_end 读取局部\n- 只想知道文件是否存在；直接尝试读取即可，错误信息会给出结论\n\n支持：代码、配置、Markdown、日志等文本文件。\n返回：文件文本；内容过大时在 50,000 个字符处截断。\n可选：使用 line_start、line_end 读取大文件的指定行范围。",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: "要读取的绝对或相对文件路径。",
      },
      line_start: {
        type: 'string',
        description: "可选起始行号，从 1 开始；设置后从该行读取。",
      },
      line_end: {
        type: 'string',
        description: "可选结束行号，从 1 开始且包含该行；设置后读到该行为止。",
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
    if (!filePath?.trim()) return '错误：必须提供文件路径'

    const resolved = path.resolve(filePath)
    log.info('Reading file', { pathHash: hashForLog(resolved) })

    try {
      const stat = await fs.stat(resolved)

      if (!stat.isFile()) return `错误：“${resolved}”不是文件`
      if (stat.size > MAX_FILE_SIZE) {
        return `错误：文件过大（${(stat.size / 1024).toFixed(0)} KB，最大允许 ${MAX_FILE_SIZE / 1024} KB）。请使用 line_start/line_end 分段读取。`
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
        content = content.slice(0, MAX_RESULT_CHARS) + `\n\n[... 已在 ${MAX_RESULT_CHARS} 个字符处截断]`
      }

      return content
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('Read failed', { pathHash: hashForLog(resolved), error: message })
      return `读取文件失败： ${message}`
    }
  },
})
