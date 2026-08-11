import { describe, expect, it } from 'vitest'
import {
  __test,
  formatExpressionBaseline,
  formatRoleProfileForPrompt,
} from '../../electron/main/companion/identity/profile'

describe('companion role profile', () => {
  it('表达基线裁剪到 0–10 且明确不是模型采样参数', () => {
    const text = formatExpressionBaseline({
      warmth: 12,
      energy: -3,
      directness: 6.6,
      playfulness: Number.NaN,
      initiative: 5,
    })
    expect(text).toContain('温暖度 10/10')
    expect(text).toContain('能量感 0/10')
    expect(text).toContain('直接度 7/10')
    expect(text).toContain('玩闹度 0/10')
  })

  it('人物摘要有长度上限', () => {
    const text = formatRoleProfileForPrompt({
      schemaVersion: 1,
      agePresentation: '青年',
      birthday: '1 月 1 日',
      genderPresentation: '青年气质',
      pronouns: '他',
      origin: '海边'.repeat(1_000),
      occupation: '协作者',
      background: [],
      education: [],
      careerHistory: [],
      skills: [],
      dailyRhythm: [],
      interests: [],
      dislikes: [],
      habits: [],
      flaws: [],
      socialStyle: [],
      valuesInPractice: [],
      lifeAnchors: [],
      appearance: {
        overall: '', hair: '', eyes: '', build: '', clothingStyle: '', distinguishingFeatures: [],
      },
      favorites: {
        foods: [], drinks: [], music: [], books: [], activities: [], weather: [], colors: [],
      },
      selfAwareness: '数字伙伴',
      expression: { warmth: 6, energy: 5, directness: 7, playfulness: 4, initiative: 6 },
    })
    expect(text.length).toBeLessThanOrEqual(__test.PROFILE_PROMPT_MAX)
  })
})
