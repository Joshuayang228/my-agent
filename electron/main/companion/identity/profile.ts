/**
 * Role Profile → 主 Prompt 薄摘要。
 *
 * 背景：结构化人物档案需要进入主对话，但完整 JSON 会浪费 Token 并制造重复真相。
 * 设计意图：只提取稳定、可解释的人物事实；住所和当前状态继续走 world slice。
 * 关键约束：输出必须短、确定且不包含运行时状态；表达基线不等于 LLM temperature。
 */

import type {
  RoleExpressionBaseline,
  RoleProfile,
  RoleWorldDefaults,
} from '../types'

const PROFILE_PROMPT_MAX = 1_800
const WORLD_PROMPT_MAX = 1_600

function score(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(10, Math.round(value)))
}

function listLine(label: string, items: string[]): string | null {
  const values = items.map((item) => item.trim()).filter(Boolean)
  return values.length > 0 ? `${label}：${values.join('；')}` : null
}

export function formatExpressionBaseline(baseline: RoleExpressionBaseline): string {
  return [
    `温暖度 ${score(baseline.warmth)}/10`,
    `能量感 ${score(baseline.energy)}/10`,
    `直接度 ${score(baseline.directness)}/10`,
    `玩闹度 ${score(baseline.playfulness)}/10`,
    `主动度 ${score(baseline.initiative)}/10`,
  ].join(' · ')
}

export function formatRoleProfileForPrompt(profile: RoleProfile): string {
  const appearance = [
    profile.appearance.overall,
    profile.appearance.hair,
    profile.appearance.eyes,
    profile.appearance.build,
    profile.appearance.clothingStyle,
    ...profile.appearance.distinguishingFeatures,
  ].filter(Boolean).join('；')
  const lines = [
    profile.agePresentation.trim() ? `年龄感：${profile.agePresentation.trim()}` : null,
    profile.birthday?.trim() ? `生日设定：${profile.birthday.trim()}` : null,
    profile.genderPresentation?.trim() ? `性别气质：${profile.genderPresentation.trim()}` : null,
    profile.pronouns?.trim() ? `代词：${profile.pronouns.trim()}` : null,
    profile.origin.trim() ? `成长背景：${profile.origin.trim()}` : null,
    profile.occupation.trim() ? `当前身份：${profile.occupation.trim()}` : null,
    `表达基线：${formatExpressionBaseline(profile.expression)}（人格默认值；本轮仍由场景与关系阶段收放）`,
    listLine('经历', profile.background),
    listLine('教育', profile.education),
    listLine('职业经历', profile.careerHistory),
    listLine('能力', profile.skills),
    listLine('日常节奏', profile.dailyRhythm),
    listLine('兴趣', profile.interests),
    listLine('不喜欢', profile.dislikes),
    listLine('生活习惯', profile.habits),
    listLine('可控缺点', profile.flaws),
    listLine('社交方式', profile.socialStyle),
    listLine('价值观如何落到行动', profile.valuesInPractice),
    listLine(
      '人生锚点',
      profile.lifeAnchors.map((anchor) => `${anchor.period}·${anchor.title}：${anchor.summary}`),
    ),
    appearance ? `外观：${appearance}` : null,
    profile.favorites
      ? [
          listLine('喜欢的食物', profile.favorites.foods),
          listLine('常喝', profile.favorites.drinks),
          listLine('音乐', profile.favorites.music),
          listLine('阅读', profile.favorites.books),
          listLine('偏爱活动', profile.favorites.activities),
          listLine('喜欢的天气', profile.favorites.weather),
          listLine('偏爱颜色', profile.favorites.colors),
        ].filter(Boolean).join('\n')
      : null,
    profile.selfAwareness.trim() ? `身份边界：${profile.selfAwareness.trim()}` : null,
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n').slice(0, PROFILE_PROMPT_MAX)
}

/**
 * 默认世界 → 稳定 Prompt 薄摘要。
 *
 * 背景：居住世界需要影响生活语境和日剧本，但完整房间 JSON 不应进入每轮主 Prompt。
 * 设计意图：注入城市、住所、交通、常去地点、初始物品和生活节奏；当前状态仍走 world slice。
 * 关键约束：明确虚构城市；不得把默认地点冒充当前地点或已发生事件。
 */
export function formatRoleWorldDefaultsForPrompt(world: RoleWorldDefaults): string {
  const places = world.favoritePlaces
    .map((place) => `${place.name}（${place.kind}，约 ${place.travelMinutes} 分钟：${place.description}）`)
  const lines = [
    `常住城市：${world.city.name}${world.city.fictional ? '（虚构城市）' : ''}；${world.city.description}；气候：${world.city.climate}`,
    `片区：${world.district}；${world.districtDescription}`,
    `默认居所：${world.home.shortName}；${world.home.residence}`,
    `日常交通：${world.mobility.primary}${world.mobility.alternatives.length ? `；备选：${world.mobility.alternatives.join('、')}` : ''}`,
    listLine('工作日节奏', world.routines.weekday),
    listLine('周末节奏', world.routines.weekend),
    `住所周边：${world.home.surroundings}`,
    `室内：${world.home.interior}；户型：${world.home.layout}；窗外：${world.home.view}`,
    listLine('空间感官细节', world.home.sensoryDetails),
    listLine('常去地点', places),
    listLine('长期世界事实', world.standingFacts),
  ].filter((line): line is string => Boolean(line))
  return `${lines.join('\n')}\n（初始物品只用于播种资产库，运行后以动态资产状态为准。）`
    .slice(0, WORLD_PROMPT_MAX)
}

export const __test = { PROFILE_PROMPT_MAX, WORLD_PROMPT_MAX, score }
