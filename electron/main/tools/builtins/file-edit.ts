import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import { createLogger, hashForLog } from '../../utils/logger'
import { checkFileWriteSandbox, resolveToolFilePath } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../../agent/project-memory'
import { PERMISSION_SANDBOX_ASSET_KEYS } from '../../sandbox/asset-keys'
import type { ToolContext } from '../../../../src/shared/types'

const log = createLogger('FileEdit')
const MAX_PATH_LENGTH = 4_096
const MAX_EDIT_STRING_LENGTH = 1024 * 1024
const MAX_EDIT_FILE_SIZE = 5 * 1024 * 1024
const MAX_REPLACEMENTS = 100_000

export const fileEditTool = buildTool({
  name: 'file_edit',
  description: "通过替换指定文本来编辑文件。对小范围修改而言，比 file_write 更高效。\n\n适用场景：\n- 对现有文件做定点修改，例如修复 Bug、更新值或调整逻辑\n- 替换特定函数、类或代码块\n- 更新配置值或常量\n- 在指定位置后插入新代码（设置 insert_after=true）\n- 已知需要替换的准确文本，且能连同空白完全匹配\n\n不适用场景：\n- 创建新文件（使用 file_write）\n- 重写整个文件或进行大量分散修改（使用 file_write 或 apply_patch）\n- old_str 出现很多次，但只想修改某一个特定位置；请谨慎使用 count，或改用 apply_patch\n- 不确定文件当前的准确内容；应先读取文件确认\n\n工作方式：\n- 在文件中查找 old_str，并替换为 new_str\n- old_str 必须连同空白、缩进和换行完全匹配\n- 默认只替换第一次出现的位置；count=-1 时替换全部\n- insert_after=true 时在 old_str 后插入 new_str，而不是替换\n- 找不到 old_str 时返回错误，以便尽早发现上下文不一致\n\n最佳实践：\n1. 先读取文件，确认当前内容\n2. 让 old_str 包含足够上下文，确保定位唯一\n3. 修改后再次读取相关区域，验证结果。",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: "要编辑的绝对或相对文件路径；相对路径从工作区根目录解析。",
      },
      old_str: {
        type: 'string',
        description: "要在文件中查找的精确字符串，必须连同空白完全匹配。",
      },
      new_str: {
        type: 'string',
        description: "替换字符串；传空字符串可删除 old_str。",
      },
      count: {
        type: 'number',
        description: "替换次数，默认 1（首次匹配）；设为 -1 时替换全部匹配。",
      },
      insert_after: {
        type: 'boolean',
        description: "设为 true 时不替换 old_str，而是在它后面插入 new_str；默认 false。",
      },
    },
    required: ['path', 'old_str', 'new_str'],
  },
  inputExamples: [
    { path: 'src/config.ts', old_str: 'const PORT = 3000', new_str: 'const PORT = 8080' },
    { path: 'src/app.ts', old_str: 'import { debug } from "./debug"\n', new_str: '', count: 1 },
  ],
  metadata: {
    isDestructive: true,
  },
  execute: async (args, ctx?: ToolContext) => {
    if (typeof args.path !== 'string' || !args.path.trim()) return '错误：必须提供文件路径'
    if (args.path.length > MAX_PATH_LENGTH) return '错误：文件路径过长'
    if (typeof args.old_str !== 'string' || !args.old_str || args.old_str.length > MAX_EDIT_STRING_LENGTH) return '错误：old_str 为空或过长'
    if (typeof args.new_str !== 'string' || args.new_str.length > MAX_EDIT_STRING_LENGTH) return '错误：new_str 无效或过长'
    if (args.count !== undefined && (typeof args.count !== 'number' || !Number.isInteger(args.count) || (args.count !== -1 && (args.count < 1 || args.count > MAX_REPLACEMENTS)))) {
      return '错误：count 必须是 -1 或 1–100000 的整数'
    }
    if (args.insert_after !== undefined && typeof args.insert_after !== 'boolean') return '错误：insert_after 必须是布尔值'
    const filePath = args.path
    const oldStr = args.old_str
    const newStr = args.new_str
    const count = args.count ?? 1
    const insertAfter = args.insert_after ?? false

    const mode = await loadEffectiveSandbox()
    const wsRoot = ctx?.workdir?.trim() || getWorkspaceRoot()
    const resolved = resolveToolFilePath(filePath, wsRoot)
    const blocked = checkFileWriteSandbox(resolved, mode, wsRoot, { action: '编辑' })
    ctx?.assetUsageReporter?.({
      assetKey: PERMISSION_SANDBOX_ASSET_KEYS.pathBoundaries,
      relation: 'used', usageKind: 'permission-decision', status: blocked ? 'blocked' : 'success',
      metadata: { sandboxMode: mode, decision: blocked ? 'deny' : 'allow' },
    })
    if (blocked) {
      log.warn('File edit blocked by sandbox', { pathHash: hashForLog(resolved), mode })
      return blocked
    }

    let original: string
    try {
      const stat = await fs.stat(resolved)
      if (!stat.isFile()) return '读取文件失败：目标不是普通文件。'
      if (stat.size > MAX_EDIT_FILE_SIZE) return '读取文件失败：文件超过 5MB，请改用更小范围的补丁。'
      original = await fs.readFile(resolved, 'utf-8')
    } catch (err) {
      log.warn('Edit target read failed', { pathHash: hashForLog(resolved), errorType: err instanceof Error ? err.name : 'unknown' })
      return '读取编辑目标失败，请确认文件存在且可读。'
    }

    const occurrences = original.split(oldStr).length - 1
    if (occurrences === 0) {
      const preview = oldStr.length > 80 ? oldStr.slice(0, 80) + '...' : oldStr
      return `错误：在此文件中未找到 old_str： ${resolved}.\n搜索内容： ${JSON.stringify(preview)}\n文件共有 ${original.split('\n').length} 行、${original.length} 个字符。`
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
      return '没有发生修改（old_str 与 new_str 生成的内容相同）。'
    }

    try {
      await fs.writeFile(resolved, result, 'utf-8')
    } catch (err) {
      log.warn('Edit target write failed', { pathHash: hashForLog(resolved), errorType: err instanceof Error ? err.name : 'unknown' })
      return '写入编辑目标失败，请检查文件权限或磁盘状态。'
    }

    const actualReplacements = count === -1 ? occurrences : Math.min(count, occurrences)
    const action = insertAfter ? '插入' : '替换'
    log.info('File edited', { pathHash: hashForLog(resolved), replacements: actualReplacements })
    return `已${action} ${actualReplacements} 处，文件：${resolved}（共找到 ${occurrences} 处）。`
  },
})
