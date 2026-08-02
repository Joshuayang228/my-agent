/**
 * 伴侣 Chat 弱场景：从 presence / location 文案映射场景键（无外部插画资产）。
 * 场景只影响氛围底色，不改变布局与可读性。
 */

export type CompanionSceneId =
  | 'home'
  | 'office'
  | 'cafe'
  | 'street'
  | 'commute'
  | 'night'
  | 'default'

/** 从「活动（地点）」或纯地点串里抽出地点片段 */
export function extractLocationHint(text: string): string {
  const raw = text.trim()
  if (!raw) return ''
  const paren = raw.match(/[（(]([^）)]+)[）)]/)
  if (paren?.[1]) return paren[1].trim()
  return raw
}

/**
 * 将地点/presence 映射到场景 id。
 * 优先匹配明确地点关键词；夜间时段的「家」可升为 night。
 */
export function resolveCompanionScene(
  input: { presence?: string; location?: string; now?: number } = {},
): CompanionSceneId {
  const loc = extractLocationHint(input.location || input.presence || '').toLowerCase()
  const blob = `${input.presence || ''} ${input.location || ''}`.toLowerCase()
  const hour = new Date(input.now ?? Date.now()).getHours()

  if (/咖啡|cafe|咖啡厅|茶馆/.test(loc) || /咖啡|cafe/.test(blob)) return 'cafe'
  // 通勤优先于工位：剧本常用「路上/工位」
  if (/通勤|地铁|公交|路上|出租/.test(loc) || /通勤/.test(blob)) return 'commute'
  if (/工位|办公室|公司|职场|会议室/.test(loc) || /工位|办公室/.test(blob)) return 'office'
  if (/街|公园|户外|商场|外面|附近/.test(loc)) return 'street'
  if (/家|宿舍|卧室|客厅/.test(loc) || /(^|[^a-z])家([^a-z]|$)/.test(blob)) {
    if (hour >= 21 || hour < 6) return 'night'
    return 'home'
  }
  if (hour >= 22 || hour < 5) return 'night'
  return 'default'
}

export const COMPANION_SCENE_LABEL: Record<CompanionSceneId, string> = {
  home: '家',
  office: '工位',
  cafe: '咖啡馆',
  street: '户外',
  commute: '路上',
  night: '夜色',
  default: '日常',
}
