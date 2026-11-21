import { compileImageGenerationRequest } from '../../prompts/registered-request'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { buildTool } from '../builder'
import { loadImageGenerationConfig } from '../../llm/aux-config'
import { ImageGenerationError, inspectGeneratedImageBytes, requestGeneratedImage, type GeneratedImageBytes } from '../../llm/image-generation'
import { normalizeGeneratedImage } from '../../utils/generated-image-codec'
import { checkFileWriteSandbox, isPathInsideRoot } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getRules } from '../../sandbox/permission-engine'
import type { GeneratedImageReference, ToolContext } from '../../../../src/shared/types'
import type { SandboxMode } from '../../sandbox/policy'
import { createLogger } from '../../utils/logger'
import { getSession } from '../../storage/session-store'
import { getCompanionRuntimeState } from '../../companion/core/state/runtime-state'
import { attachWorldAssetImage, getAsset, listAssets } from '../../companion/life/assets'
import { loadRolePack } from '../../companion/identity/loader'
import { prepareCompanionImageGen, type CompanionImageCategory } from '../../companion/life/image-gen-prep'
import type { ImageAspectRatio } from '../../llm/image-generation'
import { isValidVisualSlot, saveRoleVisualOverride } from '../../companion/identity/visual-overrides'
import { formatRoleAppearanceForImagePrompt } from '../../companion/identity/profile'
import { attachMomentImageForRole, prepareMomentImageTarget } from '../../companion/life/moment-images'

const log = createLogger('ImageGenerate')

/**
 * 从当前会话消息历史中提取用户最近发送的图片附件，供 image_generate 的 useChatImage 垫图/改图使用。
 *
 * 背景：用户在对话中粘贴图片后常说“照着这张改一下”或“画成水彩风”，若工具无法读取会话图片，只能让用户手输本地路径。
 * 设计意图：倒序扫描当前会话的 user 消息 images 附件，按 1-based 序号（true 默认第 1 张即最新一张）解码并做光栅格式校验。
 * 关键约束：严格限定 4MB 上限与受控光栅签名；仅读当前 sessionId，不跨会话泄漏图片。
 */
export async function loadRecentChatImage(
  sessionId: string,
  selector: boolean | number,
): Promise<GeneratedImageBytes> {
  const session = await getSession(sessionId)
  const attachments: string[] = []
  if (session?.messages) {
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const msg = session.messages[i]
      if (msg.role !== 'user' || !Array.isArray(msg.images)) continue
      for (let j = msg.images.length - 1; j >= 0; j--) {
        const dataUrl = msg.images[j]?.dataUrl
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          attachments.push(dataUrl)
        }
      }
    }
  }
  if (attachments.length === 0) {
    throw new ImageGenerationError('当前对话中还没有找到用户发送的图片，请先发一张图再使用 useChatImage。')
  }
  const index = typeof selector === 'number' && Number.isFinite(selector)
    ? Math.max(0, Math.floor(selector) - 1)
    : 0
  if (index >= attachments.length) {
    throw new ImageGenerationError(`当前对话中只有 ${attachments.length} 张图片，无法取第 ${selector} 张。`)
  }
  const match = attachments[index].match(/^data:image\/[^;]+;base64,(.+)$/)
  if (!match) {
    throw new ImageGenerationError('对话中的图片格式无效，无法作为垫图参考。')
  }
  const bytes = Buffer.from(match[1], 'base64')
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) {
    throw new ImageGenerationError('对话中的图片过大（超过 4MB）或为空，无法作为垫图参考。')
  }
  return inspectGeneratedImageBytes(bytes)
}

/**
 * 将已校验的衣柜槽位转成生图用的短视觉锚点。
 *
 * 背景：绑定穿搭的图片请求必须和当前穿着保持一致，否则衣柜版本链只保护了落盘却没有保护画面语义。
 * 设计意图：只读取当前角色衣柜中被穿搭引用的 garment 名称，放弃把整张资产表或用户可编辑正文塞进 Prompt。
 * 关键约束：角色、种类和槽位必须由真实资产查询确认；缺少有效引用时返回空字符串，不猜测衣物。
 */
async function formatWardrobeVisualAnchor(roleId: string, asset: { kind: string; payload: Record<string, unknown> }): Promise<string> {
  if (asset.kind !== 'wardrobe' || !['outfit', 'wear-state'].includes(String(asset.payload.recordType))) return ''
  const slots = asset.payload.slots
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return ''
  const garments = await listAssets(roleId, { kind: 'wardrobe' })
  const names = Object.entries(slots as Record<string, unknown>).flatMap(([slot, id]) => {
    if (typeof id !== 'string') return []
    const garment = garments.find(item => item.id === id && item.payload.recordType === 'garment' && item.payload.category === slot)
    return garment ? [`${slot}：${garment.name}`] : []
  })
  return names.length ? `当前确认穿搭：${names.join('；')}` : ''
}

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
      targetAssetId: { type: 'string', description: '可选：将生成图片绑定到当前会话角色的人物世界资产。' },
      targetMomentId: { type: 'string', description: '可选：将生成图片绑定到当前会话角色的一条已发布朋友圈动态，最多九张。' },
      targetVisualSlot: { type: 'string', enum: ['avatar', 'banner'], description: '可选：将生成图片直接应用为当前会话角色的头像（avatar）或主页封面壁纸（banner）。' },
      category: { type: 'string', enum: ['selfie', 'outing', 'food', 'gift', 'hangout', 'scenery', 'mood', 'cover'], description: '可选：构图与垫图分类；食物/风景/静物自动跳过人物垫图。' },
      aspectRatio: { type: 'string', enum: ['1:1', '3:4', '4:3', '16:9', '9:16'], description: '可选：画面宽高比，默认按构图分类自动选择。' },
      useChatImage: { type: 'number', description: '可选：引用当前对话中用户发过的图片作为垫图参考（传 1 表示最新一张，2 表示倒数第二张）。' },
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
      const targetAssetId = typeof args.targetAssetId === 'string' ? args.targetAssetId.trim() : ''
      const targetMomentId = typeof args.targetMomentId === 'string' ? args.targetMomentId.trim() : ''
      const targetVisualSlot = isValidVisualSlot(args.targetVisualSlot) ? args.targetVisualSlot : ''
      if ([targetAssetId, targetMomentId, targetVisualSlot].filter(Boolean).length > 1) throw new ImageGenerationError('一次生图只能绑定一个目标：资产、朋友圈动态或角色头像/封面。')
      if (targetVisualSlot && !context?.roleId) throw new ImageGenerationError('当前会话没有绑定人物，无法更换角色头像或封面。')
      let expectedOutfitVersion: number | undefined
      let targetAsset: Awaited<ReturnType<typeof getAsset>> = null
      if (targetAssetId) {
        if (!context?.roleId) throw new ImageGenerationError('当前会话没有绑定人物，无法把图片放入人物世界。')
        const asset = await getAsset(targetAssetId)
        if (!asset || asset.roleId !== context.roleId) throw new ImageGenerationError('人物世界资产已不存在或不属于当前伙伴。')
        targetAsset = asset
        if (asset.kind === 'wardrobe' && ['outfit', 'wear-state'].includes(String(asset.payload.recordType))) {
          if (!Number.isSafeInteger(asset.payload.outfitVersion)) throw new ImageGenerationError('穿搭版本无效，请重新读取衣柜后再生成图片。')
          expectedOutfitVersion = Number(asset.payload.outfitVersion)
        }
      }
      if (targetMomentId) {
        if (!context?.roleId) throw new ImageGenerationError('当前会话没有绑定人物，无法把图片放入朋友圈。')
        const target = await prepareMomentImageTarget(context.roleId, targetMomentId)
        if (!target.ok) throw new ImageGenerationError(target.error)
      }
      // 配置装配也会异步等待；请求前再次复核，不能等付费完成才发现授权或目标失效。
      const requestMode = await loadEffectiveSandbox()
      context?.signal?.throwIfAborted()
      const requestTarget = resolveGeneratedImageTarget(args.path, context, requestMode)
      if (requestTarget.target !== target.target || mode !== requestMode || rules !== JSON.stringify(getRules())) throw new ImageGenerationError('项目或权限已变化，未发起生图。请检查设置后再操作。')
      const appearanceAnchor = context?.roleId ? (() => { try { const profile = loadRolePack(context.roleId).profile; return profile ? formatRoleAppearanceForImagePrompt(profile) : '' } catch { return '' } })() : ''
      const wardrobeAnchor = context?.roleId && targetAsset ? await formatWardrobeVisualAnchor(context.roleId, targetAsset) : ''
      const visualAnchor = [appearanceAnchor, wardrobeAnchor].filter(Boolean).join('；')
      const validCategories = new Set<CompanionImageCategory>(['selfie', 'outing', 'food', 'gift', 'hangout', 'scenery', 'mood', 'cover'])
      const validRatios = new Set<ImageAspectRatio>(['1:1', '3:4', '4:3', '16:9', '9:16'])
      const explicitCategory = typeof args.category === 'string' && validCategories.has(args.category as CompanionImageCategory)
        ? (args.category as CompanionImageCategory)
        : targetVisualSlot === 'banner'
          ? 'cover'
          : targetVisualSlot === 'avatar'
            ? 'selfie'
            : undefined
      const explicitRatio = typeof args.aspectRatio === 'string' && validRatios.has(args.aspectRatio as ImageAspectRatio)
        ? (args.aspectRatio as ImageAspectRatio)
        : targetVisualSlot === 'avatar'
          ? '1:1'
          : undefined
      const extraReferenceImages: GeneratedImageBytes[] = []
      if (args.useChatImage === true || (typeof args.useChatImage === 'number' && args.useChatImage >= 1)) {
        extraReferenceImages.push(await loadRecentChatImage(context!.sessionId!, args.useChatImage))
      }
      const prepared = context?.roleId
        ? await prepareCompanionImageGen({
            roleId: context.roleId,
            description: args.prompt,
            category: explicitCategory,
            aspectRatio: explicitRatio,
            extraReferenceImages,
            signal: context?.signal,
          })
        : null
      const finalPrompt = prepared ? prepared.prompt : args.prompt
      const finalAnchor = [prepared?.visualAnchor || appearanceAnchor, wardrobeAnchor].filter(Boolean).join('；')
      const response = await requestGeneratedImage(
        config,
        compileImageGenerationRequest(finalPrompt, finalAnchor),
        context?.signal,
        {
          referenceImages: prepared ? prepared.referenceImages : extraReferenceImages,
          aspectRatio: explicitRatio ?? prepared?.aspectRatio,
        },
      )
      const image = await normalizeGeneratedImage(response.bytes, context?.signal)
      context?.signal?.throwIfAborted()
      const currentMode = await loadEffectiveSandbox()
      const current = resolveGeneratedImageTarget(args.path, context, currentMode)
      if (current.target !== target.target || mode !== currentMode || rules !== JSON.stringify(getRules())) throw new ImageGenerationError('生成期间项目或权限已变化，未写入图片。请检查设置后再操作。')
      context?.signal?.throwIfAborted()
      commitImage(current, image.bytes)
      const generatedImages: GeneratedImageReference[] = [{ id: createHash('sha256').update(image.bytes).digest('hex'), path: current.target, mimeType: image.mimeType, width: image.width, height: image.height, byteLength: image.bytes.length }]
      if (targetAssetId) {
        let linked: Awaited<ReturnType<typeof attachWorldAssetImage>>
        try {
          linked = await attachWorldAssetImage(targetAssetId, generatedImages[0], { expectedRoleId: context!.roleId!, expectedOutfitVersion })
        } catch (error) {
          try { fs.unlinkSync(current.target) } catch { log.warn('Generated image cleanup failed after asset link error', { target: current.target }) }
          throw error
        }
        if (!linked.ok) {
          try { fs.unlinkSync(current.target) } catch { log.warn('Generated image cleanup failed after asset link rejection', { target: current.target }) }
          throw new ImageGenerationError(linked.error)
        }
      }
      if (targetMomentId) {
        let linked: Awaited<ReturnType<typeof attachMomentImageForRole>>
        try {
          linked = await attachMomentImageForRole(context!.roleId!, targetMomentId, generatedImages[0].id)
        } catch (error) {
          try { fs.unlinkSync(current.target) } catch { log.warn('Generated image cleanup failed after moment link error', { target: current.target }) }
          throw error
        }
        if (!linked.ok) {
          try { fs.unlinkSync(current.target) } catch { log.warn('Generated image cleanup failed after moment link rejection', { target: current.target }) }
          throw new ImageGenerationError(linked.error)
        }
      }
      if (targetVisualSlot && context?.roleId) {
        const saved = await saveRoleVisualOverride(context.roleId, targetVisualSlot, image.bytes)
        if (!saved.ok) throw new ImageGenerationError(saved.error)
      }
      return { content: `图片已生成并保存到 ${args.path}（${image.width} × ${image.height}）${targetVisualSlot ? `，并已应用为当前角色的${targetVisualSlot === 'avatar' ? '头像' : '主页封面'}` : ''}。`, generatedImages }
    } catch (error) {
      return { content: context?.signal?.aborted ? '已取消生图，服务端可能仍在处理；请勿重复提交。' : error instanceof ImageGenerationError ? error.message : '图片生成或保存失败，请检查模型、图片格式和项目权限；没有自动重试。', isError: true }
    }
  },
})


/**
 * 伙伴专属拍照/自拍工具（companion_take_photo）。
 *
 * 背景：通用 image_generate 面向任意画面创作，主模型容易在画伙伴本人时手写漂移的外貌/画风或忘穿当前衣物；
 * 拆出专属拍照工具后，主模型只需提供 10~50 字简短场景描述，其余全部交由绘画导演与多图垫图装配器自动完成。
 * 设计意图：自动读取当前角色心情、穿着、房间与三视图参考，走统一安全落盘与权限边界；明确约定“换装拍照须先调 companion_change_wardrobe 再拍照”。
 * 关键约束：必须纳入 Agent Host DOMAIN_TOOL_POLICIES（companion.write）；路径仍严格受 resolveGeneratedImageTarget 沙箱防穿越与禁覆盖约束。
 */
export const companionTakePhotoTool = buildTool({
  name: 'companion_take_photo',
  description: [
    '为当前伙伴拍摄一张生活照、自拍、穿搭照或眼前风景/美食照（自动注入角色三视图垫图、当前穿着、时段光线、心情与绘画导演扩写）。',
    '【使用规则】',
    '1. 凡是需要伙伴本人出镜拍照、自拍、晒穿搭或拍当下生活瞬间时，必须优先调用本工具，不要使用 image_generate；',
    '2. description 只需写 10~50 字的简短场景描述，不要自己编造画风、人物五官或构图参数，系统全部自动处理；',
    '3. food / scenery / mood 分类会自动拍纯食物/风景/静物照，不画人物本人；',
    '4. 如果用户要求先换衣服/换造型再拍照，必须先调用 companion_change_wardrobe 换装，再调用本工具，否则拍出来仍是原来的穿着。',
  ].join('\n'),
  parameters: {
    type: 'object',
    properties: {
      description: { type: 'string', description: '10~100 字简短场景描述（例如：在甲板上迎着海风大笑、刚烤好的带骨大肉）。' },
      category: { type: 'string', enum: ['selfie', 'outing', 'food', 'gift', 'hangout', 'scenery', 'mood', 'cover'], description: '拍摄分类，默认 selfie；food/scenery/mood 不出现人物。' },
      homeRoomId: { type: 'string', description: '可选：指定所处房间 ID（不填则由绘画导演按场景自动匹配）。' },
      path: { type: 'string', description: '可选：保存路径（images/名称.png）；省略时自动生成唯一文件名。' },
      targetVisualSlot: { type: 'string', enum: ['avatar', 'banner'], description: '可选：顺手把这张照片设为当前伙伴的头像或主页封面。' },
    },
    required: ['description'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false, longRunning: true },
  execute: async (args, context) => {
    try {
      context?.signal?.throwIfAborted()
      if (!context?.roleId) throw new ImageGenerationError('当前会话没有绑定伙伴，无法拍摄伙伴生活照。')
      const description = typeof args.description === 'string' ? args.description.trim() : ''
      if (!description || description.length > 500) {
        throw new ImageGenerationError('请提供简短的场景描述（1~500 字）。')
      }
      const mode = await loadEffectiveSandbox()
      const autoName = `images/companion-photo-${Date.now()}-${randomUUID().slice(0, 6)}.png`
      const targetPath = typeof args.path === 'string' && args.path.trim() ? args.path.trim() : autoName
      const target = resolveGeneratedImageTarget(targetPath, context, mode)
      const rules = JSON.stringify(getRules())
      const config = await loadImageGenerationConfig()
      if (!config) throw new ImageGenerationError('请先在模型设置中安排生图模型。')

      const validCategories = new Set<CompanionImageCategory>(['selfie', 'outing', 'food', 'gift', 'hangout', 'scenery', 'mood', 'cover'])
      const targetVisualSlot = isValidVisualSlot(args.targetVisualSlot) ? args.targetVisualSlot : ''
      const category: CompanionImageCategory = typeof args.category === 'string' && validCategories.has(args.category as CompanionImageCategory)
        ? (args.category as CompanionImageCategory)
        : targetVisualSlot === 'banner'
          ? 'cover'
          : 'selfie'
      const homeRoomId = typeof args.homeRoomId === 'string' && args.homeRoomId.trim() ? args.homeRoomId.trim() : undefined

      let moodSummary: string | undefined
      try {
        const runtimeState = await getCompanionRuntimeState(context.roleId)
        if (runtimeState) {
          const m = runtimeState.mood
          moodSummary = m >= 75 ? '开心雀跃' : m >= 45 ? '轻松自然' : '略显疲惫安静'
        }
      } catch {
        // 心情读取降级，不阻断拍照
      }

      const requestMode = await loadEffectiveSandbox()
      context?.signal?.throwIfAborted()
      const requestTarget = resolveGeneratedImageTarget(targetPath, context, requestMode)
      if (requestTarget.target !== target.target || mode !== requestMode || rules !== JSON.stringify(getRules())) {
        throw new ImageGenerationError('项目或权限已变化，未发起拍照。请检查设置后再操作。')
      }

      const prepared = await prepareCompanionImageGen({
        roleId: context.roleId,
        description,
        category,
        homeRoomId,
        aspectRatio: targetVisualSlot === 'avatar' ? '1:1' : undefined,
        moodSummary,
        useDirector: true,
        signal: context?.signal,
      })

      const response = await requestGeneratedImage(
        config,
        compileImageGenerationRequest(prepared.prompt, prepared.visualAnchor),
        context?.signal,
        { referenceImages: prepared.referenceImages, aspectRatio: prepared.aspectRatio },
      )
      const image = await normalizeGeneratedImage(response.bytes, context?.signal)
      context?.signal?.throwIfAborted()
      const currentMode = await loadEffectiveSandbox()
      const current = resolveGeneratedImageTarget(targetPath, context, currentMode)
      if (current.target !== target.target || mode !== currentMode || rules !== JSON.stringify(getRules())) {
        throw new ImageGenerationError('拍照期间项目或权限已变化，未写入图片。')
      }
      commitImage(current, image.bytes)

      const generatedImages: GeneratedImageReference[] = [{
        id: createHash('sha256').update(image.bytes).digest('hex'),
        path: current.target,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        byteLength: image.bytes.length,
      }]

      if (targetVisualSlot) {
        const saved = await saveRoleVisualOverride(context.roleId, targetVisualSlot, image.bytes)
        if (!saved.ok) throw new ImageGenerationError(saved.error)
      }

      return {
        content: `照片已拍好并保存到 ${targetPath}（${image.width} × ${image.height}，画幅 ${prepared.aspectRatio}）${targetVisualSlot ? `，并已应用为当前伙伴的${targetVisualSlot === 'avatar' ? '头像' : '主页封面'}` : ''}。`,
        generatedImages,
      }
    } catch (error) {
      return {
        content: context?.signal?.aborted
          ? '已取消拍照，服务端可能仍在处理；请勿重复提交。'
          : error instanceof ImageGenerationError
            ? error.message
            : '拍照失败，请检查生图模型配置与项目权限；没有自动重试。',
        isError: true,
      }
    }
  },
})
