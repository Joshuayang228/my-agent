/**
 * 角色生图统一垫图与构图装配器（Companion Image Generation Prep）。
 *
 * 背景：此前生图只静态读取固定参考图且默认单一画幅，纯食物/风景照也会硬塞人物参考图，
 * 角色多角度设定图也容易被生图模型画成多胞胎克隆或呆板直视镜头。
 * 设计意图：借鉴成熟的多图垫图实践，按 8 类场景（selfie / outing / food / gift /
 * hangout / scenery / mood / cover）动态组装：
 *   1. 人物场景：优先角色多角度设定图（ref-sheet）+ 当前穿着衣物参考 + 房间场景参考（最多 3 张）；
 *   2. 纯食物/纯风景/静物场景：跳过人物垫图，让朋友圈视觉层次像真人一样丰富；
 *   3. 自动注入统一画风锚点（STYLE_ANCHOR）、构图方向、动态画幅（aspectRatio）与防克隆/防呆板视线提示。
 * 关键约束：缺失某张参考图时静默降级，绝不抛异常阻断生图；纯中文提示词协议，不改变权限或审批边界。
 */

import fs from 'node:fs'
import path from 'node:path'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { chatComplete } from '../../llm/index'
import type { GeneratedImageBytes, ImageAspectRatio } from '../../llm/image-generation'
import { compileImageDirectorRequest } from '../../prompts/registered-request'
import { createLogger } from '../../utils/logger'
import { loadRolePack, loadRoleReferenceImages, resolveRoleAssetFilePath } from '../identity/loader'
import { formatRoleAppearanceForImagePrompt } from '../identity/profile'
import { listAssets } from './assets'

const log = createLogger('ImageGenPrep')
const VALID_ASPECT_RATIOS = new Set<ImageAspectRatio>(['1:1', '3:4', '4:3', '16:9', '9:16'])

function getTimeOfDayLightLabel(hour: number): string {
  if (hour >= 5 && hour < 8) return '清晨柔光（微暖晨光与淡雾）'
  if (hour >= 8 && hour < 11) return '上午明亮日光（通透清爽）'
  if (hour >= 11 && hour < 14) return '正午充沛阳光（明快高光）'
  if (hour >= 14 && hour < 17) return '午后斜阳（柔和暖金色）'
  if (hour >= 17 && hour < 19) return '黄昏晚霞（橙金与淡紫暮光）'
  if (hour >= 19 && hour < 22) return '夜晚暖灯与微凉夜色'
  return '深夜静谧月光与室内微光'
}

export type CompanionImageCategory =
  | 'selfie'
  | 'outing'
  | 'food'
  | 'gift'
  | 'hangout'
  | 'scenery'
  | 'mood'
  | 'cover'

export const COMPANION_IMAGE_STYLE_ANCHOR =
  '自然统一的高质感生活插画与光影美学，色调协调、构图舒展、细节有呼吸感，无多余文字水印。'

export const ANTI_CLONE_REF_SHEET_GUARD =
  '画面中只画一个主角（参考图是同一人物的多角度设定图，不是多人）。严格保持与参考图一致的画风、五官与标志物，但不要照搬参考图中的站姿和视线方向，让动作与眼神自然融入当前场景。'

export const IMAGE_CATEGORY_CONFIG: Readonly<Record<CompanionImageCategory, {
  aspectRatio: ImageAspectRatio
  includeCharacterRef: boolean
  compositionGuide: string
}>> = {
  selfie: {
    aspectRatio: '3:4',
    includeCharacterRef: true,
    compositionGuide: '半身近景（胸部以上），轻松自然的日常定格视角，表情贴合此刻心情，背景轻微虚化，画面中不要出现手机或相机。',
  },
  outing: {
    aspectRatio: '3:4',
    includeCharacterRef: true,
    compositionGuide: '中景半身构图，人物自然融入眼前环境（吹风、眺望、闲逛或忙手头的事），不要呆板站立死盯镜头。',
  },
  food: {
    aspectRatio: '1:1',
    includeCharacterRef: false,
    compositionGuide: '俯拍或斜角美食特写，画面中不出现人物，聚焦食物的色泽、热气、质感与桌面氛围。',
  },
  gift: {
    aspectRatio: '3:4',
    includeCharacterRef: true,
    compositionGuide: '半身或手部近景，人物正在捧着、拆开或端详礼物，神情自然欣喜。',
  },
  hangout: {
    aspectRatio: '4:3',
    includeCharacterRef: true,
    compositionGuide: '横向群像半身构图，人物与伙伴各自有自然动作（聊天、大笑、吃东西或看风景），不需要所有人都看镜头。',
  },
  scenery: {
    aspectRatio: '16:9',
    includeCharacterRef: false,
    compositionGuide: '宽幅纯风景与环境构图，画面中不出现人物，突出光影、海天层次、云团或建筑细节。',
  },
  mood: {
    aspectRatio: '1:1',
    includeCharacterRef: false,
    compositionGuide: '静物与氛围特写，画面中不出现人物，聚焦桌面物件、书页、光影或窗外天气细节。',
  },
  cover: {
    aspectRatio: '16:9',
    includeCharacterRef: true,
    compositionGuide: '宽幅电影感场景封面构图，留出柔和的天空或背景呼吸空间，人物位于画面一侧自然看向前方或融入风景。',
  },
}

/**
 * 根据动态正文轻量推断最合适的配图构图分类。
 */
export function inferMomentImageCategory(text: string): CompanionImageCategory {
  const t = text.trim()
  if (/(索隆|娜美|乌索普|山治|伙伴|大家|一起|宴会|干杯|打赌)/.test(t)) return 'hangout'
  if (/(烤肉|炒饭|早饭|午饭|晚饭|拉面|美食|甜瓜|料理|肉排|咖啡|茶)/.test(t) && !/(我|吹风|甲板|自拍)/.test(t)) return 'food'
  if (/(日落|日出|晚霞|星空|海平线|云团|海浪|风景|暴雨|彩虹)/.test(t) && !/(我|笑|抢|吃|吹风)/.test(t)) return 'scenery'
  if (/(礼物|信物|送|收到)/.test(t)) return 'gift'
  if (/(草帽|书页|笔记本|安静|发呆|雨滴)/.test(t) && t.length < 30) return 'mood'
  return 'outing'
}

function readLocalImageBytes(filePath: string): GeneratedImageBytes | null {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null
    const bytes = fs.readFileSync(filePath)
    if (!bytes.length || bytes.length > 4 * 1024 * 1024) return null
    const ext = path.extname(filePath).toLowerCase()
    const mimeType: GeneratedImageBytes['mimeType'] =
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png'
    return { bytes, mimeType }
  } catch {
    return null
  }
}

export interface PrepareCompanionImageGenInput {
  roleId: string
  description: string
  category?: CompanionImageCategory
  aspectRatio?: ImageAspectRatio
  homeRoomId?: string
  universeId?: string
  forceCharacterRef?: boolean
  /** 可选：是否启用辅助 LLM 绘画导演扩写（默认 true；未配置辅助模型或失败时静默回退模板）。 */
  useDirector?: boolean
  /** 可选：当前心情简述，供绘画导演捕捉神情与氛围。 */
  moodSummary?: string
  /** 可选：用户主动指定的额外参考垫图（如聊天中刚发送的图片），优先占用垫图槽位（总上限 3 张）。 */
  extraReferenceImages?: ReadonlyArray<GeneratedImageBytes>
  signal?: AbortSignal
}

export interface PreparedCompanionImageGen {
  category: CompanionImageCategory
  aspectRatio: ImageAspectRatio
  prompt: string
  visualAnchor: string
  referenceImages: GeneratedImageBytes[]
  refLabels: string[]
  homeRoomId?: string
  directedByLlm?: boolean
}

export interface ImageDirectorResult {
  prompt: string
  homeRoom?: string
  aspectRatio?: ImageAspectRatio
}

/**
 * 调用辅助 LLM 将简短场景描述扩写为高质感中文生图提示词，并推断匹配房间与画幅比例。
 *
 * 背景：直接把 10~30 字简短描述发给生图模型容易出图平淡；由辅助模型结合时段光线、穿着与构图方向扩写可显著提升成片质量。
 * 设计意图：仅在已配置可用辅助模型且未取消时发起一次受控 JSON 请求；任何失败或格式异常均返回 null 由上层无缝回退确定性模板。
 * 关键约束：必须通过 compileImageDirectorRequest 签发请求；不得抛异常阻断生图主流程。
 */
export async function directCompanionImagePrompt(params: {
  roleName: string
  artStyle: string
  appearanceAnchor?: string
  description: string
  category: CompanionImageCategory
  compositionGuide: string
  includeCharacter: boolean
  moodSummary?: string
  currentOutfit?: string
  availableRooms?: ReadonlyArray<{ id: string; name: string }>
  signal?: AbortSignal
}): Promise<ImageDirectorResult | null> {
  if (params.signal?.aborted) return null
  try {
    const auxConfig = await loadAuxLLMConfig()
    if (!hasLLMAuthentication(auxConfig)) return null
    const request = compileImageDirectorRequest({
      roleName: params.roleName,
      artStyle: params.artStyle,
      appearanceAnchor: params.appearanceAnchor,
      description: params.description,
      category: params.category,
      compositionGuide: params.compositionGuide,
      includeCharacter: params.includeCharacter,
      timeLabel: getTimeOfDayLightLabel(new Date().getHours()),
      moodSummary: params.moodSummary,
      currentOutfit: params.currentOutfit,
      availableRooms: params.availableRooms,
    })
    const raw = await chatComplete({
      config: { ...auxConfig, maxTokens: 420, temperature: 0.6 },
      request,
      caller: 'image-director',
      signal: params.signal,
    })
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : ''
    if (!prompt || prompt.length < 12) return null

    const rawRoom = typeof parsed.homeRoom === 'string' ? parsed.homeRoom.trim() : ''
    const validRoom = rawRoom && params.availableRooms?.some((r) => r.id === rawRoom) ? rawRoom : undefined
    const rawRatio = typeof parsed.aspectRatio === 'string' ? parsed.aspectRatio.trim() : ''
    const validRatio = VALID_ASPECT_RATIOS.has(rawRatio as ImageAspectRatio)
      ? (rawRatio as ImageAspectRatio)
      : undefined

    return {
      prompt: prompt.slice(0, 1200),
      homeRoom: validRoom,
      aspectRatio: validRatio,
    }
  } catch (err) {
    log.warn('Image director expansion skipped, falling back to template', { error: String(err) })
    return null
  }
}

/**
 * 统一装配角色生图的提示词、画幅、外观锚点与多职责垫图（最多 3 张）。
 */
export async function prepareCompanionImageGen(
  input: PrepareCompanionImageGenInput,
): Promise<PreparedCompanionImageGen> {
  const universeId = input.universeId ?? 'default'
  const category = input.category ?? inferMomentImageCategory(input.description)
  const cfg = IMAGE_CATEGORY_CONFIG[category]
  let aspectRatio = input.aspectRatio ?? cfg.aspectRatio
  const useCharacterRef = input.forceCharacterRef ?? cfg.includeCharacterRef

  const referenceImages: GeneratedImageBytes[] = []
  const refLabels: string[] = []
  if (Array.isArray(input.extraReferenceImages) && input.extraReferenceImages.length > 0) {
    for (const extra of input.extraReferenceImages.slice(0, 3)) {
      if (Buffer.isBuffer(extra.bytes) && extra.bytes.length > 0 && extra.bytes.length <= 4 * 1024 * 1024) {
        referenceImages.push(extra)
        refLabels.push(`chat-ref-${referenceImages.length}`)
      }
    }
  }

  let pack: ReturnType<typeof loadRolePack> | null = null
  try {
    pack = loadRolePack(input.roleId, universeId)
  } catch {
    pack = null
  }
  const styleAnchor = pack?.profile?.appearance?.artStyle?.trim() || COMPANION_IMAGE_STYLE_ANCHOR
  const anchorParts: string[] = [styleAnchor]
  let currentOutfitName: string | undefined
  let currentOutfitPath: string | undefined

  if (useCharacterRef) {
    if (pack?.profile) {
      const appearance = formatRoleAppearanceForImagePrompt(pack.profile)
      if (appearance) anchorParts.push(appearance)
    }

    // 1. 优先加载角色多角度设定图 ref-sheet-<role>.png，缺失时回退 Role Pack 既有参考图
    if (referenceImages.length < 3) {
      const refSheetPath = resolveRoleAssetFilePath(input.roleId, `visual/ref-sheet-${input.roleId}.png`, universeId)
      const refSheetBytes = refSheetPath ? readLocalImageBytes(refSheetPath) : null
      if (refSheetBytes) {
        referenceImages.push(refSheetBytes)
        refLabels.push(`ref-sheet-${input.roleId}.png`)
        anchorParts.push(ANTI_CLONE_REF_SHEET_GUARD)
      } else {
        const fallbackRefs = loadRoleReferenceImages(input.roleId, universeId, 1)
        if (fallbackRefs[0]) {
          referenceImages.push(fallbackRefs[0])
          refLabels.push('role-reference-fallback')
        }
      }
    }

    // 2. 尝试附加当前穿着衣物名称（及可用衣物参考图）
    try {
      const wardrobe = await listAssets(input.roleId, { kind: 'wardrobe' })
      const wearing = wardrobe.find((a) => a.payload.wearing === true || a.payload.isWearing === true)
      if (wearing) {
        currentOutfitName = wearing.name
        anchorParts.push(`当前穿着：${wearing.name}`)
        const visualPath = typeof wearing.payload.visualPath === 'string' ? wearing.payload.visualPath : ''
        if (visualPath) currentOutfitPath = visualPath
        if (visualPath && referenceImages.length < 3) {
          const full = resolveRoleAssetFilePath(input.roleId, visualPath, universeId)
          const outfitBytes = full ? readLocalImageBytes(full) : null
          if (outfitBytes) {
            referenceImages.push(outfitBytes)
            refLabels.push(`outfit:${wearing.name}`)
          }
        }
      }
    } catch {
      // 衣柜读取降级，不阻断生图
    }
  }

  // 可选：调用辅助 LLM「绘画导演」扩写提示词，并推断匹配房间与画幅比例
  const availableRooms = (pack?.worldDefaults?.rooms ?? []).map((r) => ({ id: r.id, name: r.name }))
  let resolvedRoomId = input.homeRoomId
  let directedPrompt: string | null = null
  if (input.useDirector !== false) {
    const directed = await directCompanionImagePrompt({
      roleName: pack?.name || input.roleId,
      artStyle: styleAnchor,
      appearanceAnchor: anchorParts.filter(Boolean).join('；'),
      description: input.description.trim(),
      category,
      compositionGuide: cfg.compositionGuide,
      includeCharacter: useCharacterRef,
      moodSummary: input.moodSummary,
      currentOutfit: currentOutfitName,
      availableRooms,
      signal: input.signal,
    })
    if (directed) {
      directedPrompt = directed.prompt
      if (!resolvedRoomId && directed.homeRoom) resolvedRoomId = directed.homeRoom
      if (!input.aspectRatio && directed.aspectRatio) aspectRatio = directed.aspectRatio
    }
  }

  // 3. 若显式指定或由导演推断出房间场景且垫图位有余量，附加该房间的场景参考图
  if (useCharacterRef && resolvedRoomId && pack?.worldDefaults?.rooms && referenceImages.length < 3) {
    const room = pack.worldDefaults.rooms.find((r) => r.id === resolvedRoomId)
    const roomVisual = room?.visualPath
    if (roomVisual && roomVisual !== currentOutfitPath) {
      const full = resolveRoleAssetFilePath(input.roleId, roomVisual, universeId)
      const roomBytes = full ? readLocalImageBytes(full) : null
      if (roomBytes) {
        referenceImages.push(roomBytes)
        refLabels.push(`room:${room.id}`)
      }
    }
  }

  const prompt = directedPrompt
    ? `${directedPrompt}\n【构图方向】${cfg.compositionGuide}`
    : `${input.description.trim()}\n【构图方向】${cfg.compositionGuide}`
  return {
    category,
    aspectRatio,
    prompt,
    visualAnchor: anchorParts.filter(Boolean).join('；'),
    referenceImages,
    refLabels,
    ...(resolvedRoomId ? { homeRoomId: resolvedRoomId } : {}),
    directedByLlm: Boolean(directedPrompt),
  }
}
