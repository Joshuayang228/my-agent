import { describe, expect, it } from 'vitest'
import { characterDefinitionFromRolePack, compileCompanionBehaviorPrompt, compileMainChatPrompt } from '../../electron/main/prompts/compiler'

const character = characterDefinitionFromRolePack({
  id: 'test',
  name: '测试角色',
  description: '测试',
  protected: '稳定身份',
  mutableDefault: '可成长表达',
  voice: '自然简洁',
  asideStyle: '偶尔一句旁白',
})

describe('Prompt semantic compiler', () => {
  it('按语义模块编译主对话并保留真实输入边界', () => {
    const result = compileMainChatPrompt({
      character,
      platform: { toolNames: ['file_read'] },
      behavior: { key: 'main-chat', purpose: '处理用户请求', customInstructions: '本轮关注安全' },
      situation: { memories: '用户偏好简洁', sessionInfo: '当前任务' },
      currentDate: '2026-10-13',
    })
    expect(result.modules.map((module) => module.id)).toEqual([
      'platform-rules', 'character-definition', 'character-growth', 'behavior-definition', 'situational-context', 'output-contract',
    ])
    expect(result.text).toContain('本轮关注安全')
    expect(result.text).toContain('当前日期：2026-10-13')
    expect(result.text).not.toContain('L1')
    expect(result.text).not.toContain('L2')
    expect(result.text.match(/task_plan/g)).toHaveLength(1)
  })

  it('行为编译器把人物补充限制在行为和输出契约内', () => {
    const text = compileCompanionBehaviorPrompt({
      character,
      behavior: { key: 'moment-polish', purpose: '润色已发布动态', characterSupplement: '可以更轻快，但不能添事实' },
      facts: '活动：散步\n地点：公园',
      output: { format: '一句中文', validation: '必须锚定活动或地点', fallback: '使用规则底稿' },
    })
    expect(text).toContain('人物行为补充（增量）')
    expect(text).toContain('活动：散步')
    expect(text).toContain('必须锚定活动或地点')
    expect(text).not.toContain('<aside>')
  })
})
