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
import type { GeneratedImageBytes, ImageAspectRatio } from '../../llm/image-generation'
import { loadRolePack, loadRoleReferenceImages, resolveRoleAssetFilePath } from '../identity/loader'
import { formatRoleAppearanceForImagePrompt } from '../identity/profile'
import { listAssets } from './assets'

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
  '温暖明快的手绘日系冒险插画风格，细腻清透的水彩光影与干净线条，色彩自然有海风与阳光呼吸感，无多余文字水印。'

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
}

export interface PreparedCompanionImageGen {
  category: CompanionImageCategory
  aspectRatio: ImageAspectRatio
  prompt: string
  visualAnchor: string
  referenceImages: GeneratedImageBytes[]
  refLabels: string[]
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
  const aspectRatio = input.aspectRatio ?? cfg.aspectRatio
  const useCharacterRef = input.forceCharacterRef ?? cfg.includeCharacterRef

  const referenceImages: GeneratedImageBytes[] = []
  const refLabels: string[] = []
  const anchorParts: string[] = [COMPANION_IMAGE_STYLE_ANCHOR]

  if (useCharacterRef) {
    let pack: ReturnType<typeof loadRolePack> | null = null
    try {
      pack = loadRolePack(input.roleId, universeId)
    } catch {
      pack = null
    }

    if (pack?.profile) {
      const appearance = formatRoleAppearanceForImagePrompt(pack.profile)
      if (appearance) anchorParts.push(appearance)
    }

    // 1. 优先加载角色多角度设定图 ref-sheet-<role>.png，缺失时回退 Role Pack 既有参考图
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

    // 2. 尝试附加当前穿着衣物名称（及可用衣物参考图）
    try {
      const wardrobe = await listAssets(input.roleId, { kind: 'wardrobe' })
      const wearing = wardrobe.find((a) => a.payload.wearing === true || a.payload.isWearing === true)
      if (wearing) {
        anchorParts.push(`当前穿着：${wearing.name}`)
        const visualPath = typeof wearing.payload.visualPath === 'string' ? wearing.payload.visualPath : ''
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

    // 3. 若指定了房间场景且垫图位有余量，附加该房间的场景参考图
    if (input.homeRoomId && pack?.worldDefaults?.rooms && referenceImages.length < 3) {
      const room = pack.worldDefaults.rooms.find((r) => r.id === input.homeRoomId)
      const roomVisual = room?.visualPath
      if (roomVisual) {
        const full = resolveRoleAssetFilePath(input.roleId, roomVisual, universeId)
        const roomBytes = full ? readLocalImageBytes(full) : null
        if (roomBytes) {
          referenceImages.push(roomBytes)
          refLabels.push(`room:${room.id}`)
        }
      }
    }
  }

  const prompt = `${input.description.trim()}\n【构图方向】${cfg.compositionGuide}`
  return {
    category,
    aspectRatio,
    prompt,
    visualAnchor: anchorParts.filter(Boolean).join('；'),
    referenceImages,
    refLabels,
  }
}
