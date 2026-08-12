import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import { createLogger } from '../../utils/logger'
import { checkFileWriteSandbox, resolveToolFilePath } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../../agent/project-memory'

const log = createLogger('FileEdit')

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
  execute: async (args) => {
    const filePath = args.path as string
    const oldStr = args.old_str as string
    const newStr = args.new_str as string
    const count = (args.count as number) ?? 1
    const insertAfter = (args.insert_after as boolean) ?? false

    if (!filePath?.trim()) return '错误：必须提供文件路径'
    if (!oldStr) return '错误：必须提供 old_str'

    const mode = await loadEffectiveSandbox()
    const wsRoot = getWorkspaceRoot()
    const resolved = resolveToolFilePath(filePath, wsRoot)
    const blocked = checkFileWriteSandbox(resolved, mode, wsRoot, { action: '编辑' })
    if (blocked) {
      log.warn('File edit blocked by sandbox', { path: resolved, mode })
      return blocked
    }

    let original: string
    try {
      original = await fs.readFile(resolved, 'utf-8')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return `读取文件失败： ${message}`
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
      const message = err instanceof Error ? err.message : String(err)
      return `写入文件失败：${message}`
    }

    const actualReplacements = count === -1 ? occurrences : Math.min(count, occurrences)
    const action = insertAfter ? '插入' : '替换'
    log.info('File edited', { path: resolved, replacements: actualReplacements })
    return `已${action} ${actualReplacements} 处，文件：${resolved}（共找到 ${occurrences} 处）。`
  },
})
