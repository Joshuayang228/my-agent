/**
 * File Delete Tool — 安全删除文件/目录（强制走回收站）
 *
 * 设计原则（对齐 lingxi audit_lite.py + Anthropic 安全准则）：
 * 1. 所有删除操作默认走回收站（trash），可恢复
 * 2. 仅白名单路径允许永久删除（临时文件、node_modules、.git、缓存等）
 * 3. 运行时审计：记录删除操作日志（谁、何时、删了什么、是否可恢复）
 */

import { buildTool } from '../builder'
import trash from 'trash'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createLogger } from '../../utils/logger'

const log = createLogger('FileDelete')

/**
 * 永久删除白名单（可绕过回收站直接删除的路径模式）
 * 参考 lingxi audit_lite.py SAFE_DELETE_PATTERNS
 */
const PERMANENT_DELETE_WHITELIST = [
  'node_modules',
  '.git',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.nyc_output',
  'tmp',
  'temp',
  '.cache',
  '.DS_Store',
  'Thumbs.db',
]

/**
 * 检查路径是否在永久删除白名单中
 */
function isWhitelistedForPermanentDelete(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, '/')
  return PERMANENT_DELETE_WHITELIST.some(pattern => {
    return normalized.includes(`/${pattern}/`) || normalized.endsWith(`/${pattern}`)
  })
}

export const fileDeleteTool = buildTool({
  name: 'file_delete',
  description: `Safely delete a file or directory by moving it to the system trash/recycle bin.

Key Features:
- **Default Safe**: All deletions go to trash (recoverable) unless path is whitelisted
- **Whitelist Paths**: Temporary files, build artifacts, caches can be permanently deleted
  (node_modules, .git, __pycache__, tmp, dist, build, .cache, etc.)
- **Audit Trail**: All delete operations are logged for security review

When to use:
- Removing obsolete files or directories
- Cleaning up generated files
- Deleting user-created content after confirmation

When NOT to use:
- Deleting files that might be needed later (use file_move to archive instead)
- Cleaning large directories (use shell_exec with specific patterns for efficiency)

Security:
- Non-whitelisted paths → trash (user can recover from recycle bin)
- Whitelisted paths (build artifacts) → permanent delete
- Operation is logged with timestamp and recovery status`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file or directory to delete (absolute or relative to workspace)',
      },
    },
    required: ['path'],
  },
  metadata: {
    isDestructive: true,
  },
  execute: async (args) => {
    const targetPath = args.path as string

    if (!targetPath?.trim()) {
      return 'Error: path is required'
    }

    const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath)

    // 检查路径是否存在
    try {
      await fs.access(absolutePath)
    } catch {
      return `Error: Path does not exist: ${absolutePath}`
    }

    // 检查是否在白名单中
    const isWhitelisted = isWhitelistedForPermanentDelete(absolutePath)
    const deleteMethod = isWhitelisted ? 'permanent' : 'trash'

    try {
      if (isWhitelisted) {
        // 白名单路径：永久删除
        const stat = await fs.stat(absolutePath)
        if (stat.isDirectory()) {
          await fs.rm(absolutePath, { recursive: true, force: true })
        } else {
          await fs.unlink(absolutePath)
        }
        log.info('File permanently deleted (whitelisted)', { path: absolutePath, isDirectory: stat.isDirectory() })
      } else {
        // 非白名单路径：移动到回收站
        await trash(absolutePath)
        log.info('File moved to trash (recoverable)', { path: absolutePath })
      }

      const recoveryNote = isWhitelisted ? '' : ' (moved to trash, recoverable)'
      return `Successfully deleted: ${absolutePath}${recoveryNote}`

    } catch (error: any) {
      log.error('Delete failed', { path: absolutePath, method: deleteMethod, error: error.message })
      return `Error deleting ${absolutePath}: ${error.message}`
    }
  },
})
