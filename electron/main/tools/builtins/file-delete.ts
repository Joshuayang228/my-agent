/**
 * File Delete Tool — 安全删除文件/目录（强制走回收站）
 *
 * 设计原则（对齐 lingxi audit_lite.py + Anthropic 安全准则）：
 * 1. 所有删除操作默认走回收站（trash），可恢复
 * 2. 仅白名单路径允许永久删除（临时文件、node_modules、.git、缓存等）
 * 3. 删除前统一经过有效沙箱与工作区路径守卫，用户确认不能绕过路径边界
 * 4. 运行时审计：记录删除操作日志（谁、何时、删了什么、是否可恢复）
 */

import { buildTool } from '../builder'
import { shell } from 'electron'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createLogger, hashForLog } from '../../utils/logger'
import { checkFileWriteSandbox, resolveToolFilePath } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../../agent/project-memory'
import { PERMISSION_SANDBOX_ASSET_KEYS } from '../../sandbox/asset-keys'
import type { ToolContext } from '../../../../src/shared/types'

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
  description: "通过移动到系统回收站，安全删除文件或目录。\n\n主要特性：\n- 默认安全：除非路径命中白名单，否则所有删除都会进入回收站并可恢复\n- 白名单路径：沙箱允许时，临时文件、构建产物和缓存可永久删除，例如 node_modules、.git、__pycache__、tmp、dist、build、.cache\n- 审计记录：所有删除操作都会记录，供安全复查\n\n适用场景：\n- 删除已废弃的文件或目录\n- 清理生成文件\n- 用户确认后删除其创建的内容\n\n不适用场景：\n- 文件以后可能仍有用，应改为归档而不是删除\n- 清理大型目录，可使用 shell_exec 配合精确模式提高效率\n\n安全规则：\n- workspace-write 只允许删除当前工作区内且不含受保护段的路径；read-only 一律阻止删除\n- 非白名单路径进入回收站，用户可恢复\n- 白名单中的构建产物等路径在沙箱允许时永久删除；受保护路径仍需 full-access\n- 操作会记录时间和恢复状态。",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: "要删除的文件或目录路径，可以是绝对路径或相对工作区路径。",
      },
    },
    required: ['path'],
  },
  metadata: {
    isDestructive: true,
  },
  execute: async (args, ctx?: ToolContext) => {
    const targetPath = args.path as string

    if (!targetPath?.trim()) {
      return '错误：必须提供路径'
    }

    const mode = await loadEffectiveSandbox()
    const workspaceRoot = ctx?.workdir?.trim() || getWorkspaceRoot()
    const absolutePath = resolveToolFilePath(targetPath, workspaceRoot)
    const blocked = checkFileWriteSandbox(absolutePath, mode, workspaceRoot, { action: '删除' })
    ctx?.assetUsageReporter?.({
      assetKey: PERMISSION_SANDBOX_ASSET_KEYS.pathBoundaries,
      relation: 'used', usageKind: 'permission-decision', status: blocked ? 'blocked' : 'success',
      metadata: { toolName: 'file_delete', sandboxMode: mode, decision: blocked ? 'deny' : 'allow' },
    })
    if (blocked) {
      log.warn('File delete blocked by sandbox', { mode })
      return blocked
    }

    // 先过路径守卫再探测存在性，避免从工作区外路径泄露文件存在信息。
    try {
      await fs.access(absolutePath)
    } catch {
      return `错误：路径不存在： ${absolutePath}`
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
        log.info('File permanently deleted (whitelisted)', { pathHash: hashForLog(absolutePath), isDirectory: stat.isDirectory() })
      } else {
        // 非白名单路径：移动到回收站
        await shell.trashItem(absolutePath)
        log.info('File moved to trash (recoverable)', { pathHash: hashForLog(absolutePath) })
      }

      const recoveryNote = isWhitelisted ? '' : '（已移入回收站，可恢复）'
      return `删除成功： ${absolutePath}${recoveryNote}`

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('Delete failed', { pathHash: hashForLog(absolutePath), method: deleteMethod, error: message })
      return `删除失败 ${absolutePath}: ${message}`
    }
  },
})
