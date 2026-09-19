import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { buildTool } from '../builder'
import { loadImageGenerationConfig } from '../../llm/aux-config'
import { ImageGenerationError, requestGeneratedImage } from '../../llm/image-generation'
import { normalizeGeneratedImage } from '../../utils/generated-image-codec'
import { checkFileWriteSandbox, isPathInsideRoot } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getRules } from '../../sandbox/permission-engine'
import type { GeneratedImageReference, ToolContext } from '../../../../src/shared/types'
import type { SandboxMode } from '../../sandbox/policy'
import { createLogger } from '../../utils/logger'

const log = createLogger('ImageGenerate')

/**
 * 背景：生图先付出远程调用成本，必须先拒绝越界、覆盖和链接目标。
 * 意图：只接受工作区 images 下简单文件名，固定根目录与真实父目录，不接受任意模型路径。
 * 约束：调用前和落盘前各检查一次；明确禁止覆盖，即使完全访问模式也不放宽此工具输出位置。
 */
export function resolveGeneratedImageTarget(raw: unknown, context: ToolContext | undefined, mode: SandboxMode): { root: string; directory: string; target: string } {
  if (!context?.workdir?.trim() || !context.workspaceRoot?.trim() || !context.sessionId) throw new ImageGenerationError('请先打开项目，再生成并保存图片。')
  if (typeof raw !== 'string' || !/^images\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}\.png$/.test(raw)) throw new ImageGenerationError('请使用 images/图片名称.png 形式的路径，名称只含字母、数字、短横线或下划线。')
  let root: string
  try { root = fs.realpathSync(context.workdir) } catch { throw new ImageGenerationError('项目目录不可用，请重新选择项目。') }
  if (fs.realpathSync(context.workspaceRoot) !== root) throw new ImageGenerationError('工作目录与所选项目不一致，已停止生成。')
  if (!fs.statSync(root).isDirectory()) throw new ImageGenerationError('项目目录不可用，请重新选择项目。')
  const directory = path.join(root, 'images')
  const target = path.join(directory, path.basename(raw))
  try {
    const directoryStat = fs.lstatSync(directory)
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory() || fs.realpathSync(directory) !== directory) throw new ImageGenerationError('图片目录不是普通目录，已停止生成。')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  if (!isPathInsideRoot(target, root) || checkFileWriteSandbox(target, mode, root)) throw new ImageGenerationError('当前权限不允许在项目中保存图片。')
  try { fs.lstatSync(target); throw new ImageGenerationError('目标图片已存在，请换一个文件名；生图不会覆盖原文件。') }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  return { root, directory, target }
}

/**
 * 背景：图片生成可能等待数分钟，期间工作区链接或权限配置可能发生变化。
 * 意图：在内存中完成验证后同步提交，临时文件与最终文件同目录，硬链接提交避免覆盖既有文件。
 * 约束：只清理本次独占创建的临时文件；失败不能删除其他调用已经写入的目标。
 */
function commitImage(target: ReturnType<typeof resolveGeneratedImageTarget>, bytes: Buffer): void {
  if (!fs.existsSync(target.directory)) fs.mkdirSync(target.directory)
  if (fs.lstatSync(target.directory).isSymbolicLink() || fs.realpathSync(target.directory) !== target.directory) throw new ImageGenerationError('图片目录已变化，未保存生成结果。')
  const temporary = path.join(target.directory, `.generated-${randomUUID()}.tmp`)
  let owned = false
  let fd: number | undefined
  try {
    fd = fs.openSync(temporary, 'wx', 0o600); owned = true
    fs.writeFileSync(fd, bytes)
    fs.fsyncSync(fd)
    fs.closeSync(fd); fd = undefined
    fs.linkSync(temporary, target.target)
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
    if (owned) {
      try { fs.unlinkSync(temporary) }
      catch { log.warn('Generated image temporary file cleanup failed') }
    }
  }
}

export const imageGenerateTool = buildTool({
  name: 'image_generate',
  description: '根据用户描述生成一张图片，使用设置中明确安排的生图模型。图片保存到当前项目 images/ 目录并作为工具图片结果返回。可能产生服务费用，受审批和文件写入规则约束；不覆盖已有文件，不自动重试。仅用于用户要求生成新图片，不用于理解已有图片。',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '图片内容描述，最多 16000 字。' },
      path: { type: 'string', description: '输出路径，例如 images/tea-room.png；名称只含字母、数字、短横线或下划线，不能覆盖已有文件。' },
    },
    required: ['prompt', 'path'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false, longRunning: true },
  execute: async (args, context) => {
    try {
      context?.signal?.throwIfAborted()
      const mode = await loadEffectiveSandbox()
      const target = resolveGeneratedImageTarget(args.path, context, mode)
      const rules = JSON.stringify(getRules())
      const config = await loadImageGenerationConfig()
      if (!config) throw new ImageGenerationError('请先在模型设置中安排生图模型。')
      if (typeof args.prompt !== 'string' || !args.prompt.trim() || args.prompt.length > 16_000) throw new ImageGenerationError('请提供不超过 16000 字的图片描述。')
      // 配置装配也会异步等待；请求前再次复核，不能等付费完成才发现授权或目标失效。
      const requestMode = await loadEffectiveSandbox()
      context?.signal?.throwIfAborted()
      const requestTarget = resolveGeneratedImageTarget(args.path, context, requestMode)
      if (requestTarget.target !== target.target || mode !== requestMode || rules !== JSON.stringify(getRules())) throw new ImageGenerationError('项目或权限已变化，未发起生图。请检查设置后再操作。')
      const response = await requestGeneratedImage(config, args.prompt, context?.signal)
      const image = await normalizeGeneratedImage(response.bytes, context?.signal)
      context?.signal?.throwIfAborted()
      const currentMode = await loadEffectiveSandbox()
      const current = resolveGeneratedImageTarget(args.path, context, currentMode)
      if (current.target !== target.target || mode !== currentMode || rules !== JSON.stringify(getRules())) throw new ImageGenerationError('生成期间项目或权限已变化，未写入图片。请检查设置后再操作。')
      context?.signal?.throwIfAborted()
      commitImage(current, image.bytes)
      const generatedImages: GeneratedImageReference[] = [{ id: createHash('sha256').update(image.bytes).digest('hex'), path: current.target, mimeType: image.mimeType, width: image.width, height: image.height, byteLength: image.bytes.length }]
      return { content: `图片已生成并保存到 ${args.path}（${image.width} × ${image.height}）。`, generatedImages }
    } catch (error) {
      return { content: context?.signal?.aborted ? '已取消生图，服务端可能仍在处理；请勿重复提交。' : error instanceof ImageGenerationError ? error.message : '图片生成或保存失败，请检查模型、图片格式和项目权限；没有自动重试。', isError: true }
    }
  },
})
