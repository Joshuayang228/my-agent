import { describe, expect, it } from 'vitest'
import { evaluateLifeActionGating } from '../../electron/main/companion/life/life-gating'
import { describeMomentVisibility, resolveMomentVisibilityDays } from '../../electron/main/companion/life/moment-visibility'
import { formatLifeContextForMomentPolish, type LifeContextSnapshot } from '../../electron/main/companion/life/life-context-snapshot'

describe('Companion Life Mapping Consistency v1', () => {
  it('冷启动未知关系与陌生阶段均严格返回 3 天可见，熟悉 7 天，默契 14 天', () => {
    expect(resolveMomentVisibilityDays('ai', undefined)).toBe(3)
    expect(resolveMomentVisibilityDays('ai', 'stranger')).toBe(3)
    expect(resolveMomentVisibilityDays('ai', 'familiar')).toBe(7)
    expect(resolveMomentVisibilityDays('ai', 'rapport')).toBe(14)
    expect(resolveMomentVisibilityDays('private', 'rapport')).toBeNull()

    expect(describeMomentVisibility('ai', undefined)).toEqual({
      stageLabel: '初识',
      visibilityLabel: '展示近 3 天动态',
      visibilityDays: 3,
    })
    expect(describeMomentVisibility('ai', 'rapport')).toEqual({
      stageLabel: '默契',
      visibilityLabel: '展示近 14 天动态',
      visibilityDays: 14,
    })
    expect(describeMomentVisibility('private', 'familiar')).toEqual({
      stageLabel: '熟悉',
      visibilityLabel: '仅自己可见',
      visibilityDays: null,
    })
  })

  it('精力耗竭或极度低落且低社交欲时自动暂缓普通发圈与远行，但放行关系里程碑事件', () => {
    expect(evaluateLifeActionGating({
      kind: 'auto_moment',
      vitals: { mood: 60, energy: 15, socialNeed: 50 },
    })).toEqual({ allow: false, reason: 'low-energy' })

    expect(evaluateLifeActionGating({
      kind: 'auto_moment',
      vitals: { mood: 20, energy: 60, socialNeed: 40 },
    })).toEqual({ allow: false, reason: 'low-mood-withdrawn' })

    expect(evaluateLifeActionGating({
      kind: 'auto_moment',
      vitals: { mood: 20, energy: 10, socialNeed: 10 },
      hasRelationshipMilestone: true,
    })).toEqual({ allow: true, reason: 'ok' })

    expect(evaluateLifeActionGating({
      kind: 'travel_progression',
      vitals: { mood: 70, energy: 18, socialNeed: 60 },
    })).toEqual({ allow: false, reason: 'low-energy' })

    expect(evaluateLifeActionGating({
      kind: 'auto_moment',
      vitals: { mood: 75, energy: 80, socialNeed: 65 },
    })).toEqual({ allow: true, reason: 'ok' })
  })

  it('初识阶段抑制深夜脆弱倾诉与私密日记全量敞开，熟悉与默契阶段放行', () => {
    expect(evaluateLifeActionGating({
      kind: 'vulnerability',
      relationshipStage: 'stranger',
    })).toEqual({ allow: false, reason: 'relationship-too-early' })

    expect(evaluateLifeActionGating({
      kind: 'vulnerability',
      relationshipStage: 'familiar',
    })).toEqual({ allow: true, reason: 'ok' })

    expect(evaluateLifeActionGating({
      kind: 'vulnerability',
      relationshipStage: 'rapport',
    })).toEqual({ allow: true, reason: 'ok' })
  })

  it('朋友圈润色生活上下文格式化包含关系阶段、节律、近期经历、眼色与避重提示', () => {
    const snapshot: LifeContextSnapshot = {
      roleId: 'luffy',
      capturedAt: Date.now(),
      relationshipStage: 'familiar',
      relationshipLabel: '熟悉',
      vitals: { mood: 78, energy: 82, socialNeed: 60, summary: '心情明亮、精力充沛' },
      dynamicStatusTags: ['刚吃饱'],
      rhythm: { weekdayLabel: '周六', isWeekend: true, daypartLabel: '下午', weatherLabel: '晴朗有微风' },
      interactionGap: { hoursSinceLastMoment: 8, summary: '距上次发动态约 8 小时' },
      recentActivities: ['在甲板修补鱼竿', '和山治准备晚饭'],
      recentMomentAvoidance: ['今天海风好舒服', '刚抢到一块大烤肉'],
      activeOpenLoops: ['海鲜炒饭（聊天约定）'],
      recentUserVibe: '用户近期似乎有些疲惫或压力，表达宜更温和体贴，避免过于喧闹',
      hostCareNote: null,
      currentOutfit: '红色背心',
      activeTripSummary: null,
    }
    const text = formatLifeContextForMomentPolish(snapshot)
    expect(text).toContain('熟悉')
    expect(text).toContain('周六下午 · 晴朗有微风')
    expect(text).toContain('刚吃饱')
    expect(text).toContain('在甲板修补鱼竿')
    expect(text).toContain('温和体贴')
    expect(text).toContain('今天海风好舒服')
  })
})
