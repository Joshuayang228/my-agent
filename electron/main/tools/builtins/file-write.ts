import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../utils/logger'
import { checkFileWriteSandbox, resolveToolFilePath } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../../agent/project-memory'
import { PERMISSION_SANDBOX_ASSET_KEYS } from '../../sandbox/asset-keys'
import type { ToolContext } from '../../../../src/shared/types'

const log = createLogger('FileWrite')

export const fileWriteTool = buildTool({
  name: 'file_write',
  description: "向文件写入内容。文件不存在时创建，存在时默认覆盖。\n\n适用场景：\n- 创建代码、配置或文档等新文件\n- 完整替换文件内容\n- 向现有文件追加内容（设置 append=\"true\"）\n- 已经确认目标路径和内容正确\n\n不适用场景：\n- 对现有文件做小范围修改（使用更安全、精确的 file_edit 或 apply_patch）\n- 只修改结构化文件中的特定部分（使用编辑工具）\n- 在 workspace-write 模式下写入工作区外部路径，沙箱会阻止\n\n行为：\n- 父目录不存在时自动创建\n- 默认模式会完全覆盖已有文件\n- 追加模式会把内容写到文件末尾\n- 成功后返回实际路径和文件大小\n- 受沙箱和用户审批规则约束。",
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: "要写入的绝对或相对文件路径；相对路径从已打开的工作区根目录解析。",
      },
      content: {
        type: 'string',
        description: "要写入文件的内容。",
      },
      append: {
        type: 'string',
        description: "设为 true 时追加内容而不是覆盖；默认 false。",
      },
    },
    required: ['path', 'content'],
  },
  inputExamples: [
    { path: 'notes/todo.md', content: '# TODO\n- item 1\n' },
    { path: 'logs/run.log', content: 'appended line\n', append: 'true' },
  ],
  metadata: {
    isDestructive: true,
  },
  execute: async (args, ctx?: ToolContext) => {
    const filePath = args.path as string
    const content = args.content as string
    const append = String(args.append || 'false').toLowerCase() === 'true'

    if (!filePath?.trim()) return '错误：必须提供文件路径'

    const mode = await loadEffectiveSandbox()
    const wsRoot = getWorkspaceRoot()
    const resolved = resolveToolFilePath(filePath, wsRoot)
    const blocked = checkFileWriteSandbox(resolved, mode, wsRoot, { action: '写入' })
    ctx?.assetUsageReporter?.({
      assetKey: PERMISSION_SANDBOX_ASSET_KEYS.pathBoundaries,
      relation: 'used', usageKind: 'permission-decision', status: blocked ? 'blocked' : 'success',
      metadata: { sandboxMode: mode, decision: blocked ? 'deny' : 'allow' },
    })
    if (blocked) {
      log.warn('File write blocked by sandbox', { path: resolved, mode, wsRoot })
      return blocked
    }

    log.info('Writing file', { path: resolved, append, contentLength: content.length, effectiveSandbox: mode })

    try {
      await fs.mkdir(path.dirname(resolved), { recursive: true })

      if (append) {
        await fs.appendFile(resolved, content, 'utf-8')
      } else {
        await fs.writeFile(resolved, content, 'utf-8')
      }

      const stat = await fs.stat(resolved)
      return `文件${append ? '追加' : '写入'}成功： ${resolved} (${stat.size} bytes)`
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('Write failed', { path: resolved, error: message })
      return `写入文件失败： ${message}`
    }
  },
})
