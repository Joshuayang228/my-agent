/**
 * M26-G3：卡司多场景 prompt
 */

import { describe, it, expect } from 'vitest'
import {
  CAST_SCENES,
  defaultCastScenePrompt,
  formatSummonSceneBlock,
  loadCastDisplayLine,
  loadCastScenePrompt,
} from '../../electron/main/companion/cast/scene-prompts'
import { loadCastBrief, buildRosterLines } from '../../electron/main/companion/cast/roster'
import { tryReadRoleText } from '../../electron/main/companion/identity/loader'

describe('cast scene prompts (M26-G3)', () => {
  it('chen/ayu 三场景文件可读且互不相同', () => {
    for (const roleId of ['chen', 'ayu'] as const) {
      const texts = CAST_SCENES.map((s) => loadCastScenePrompt(roleId, s))
      expect(texts.every((t) => t.length > 10)).toBe(true)
      expect(new Set(texts).size).toBe(3)
      expect(tryReadRoleText(roleId, 'scenes/interact.md')).toBeTruthy()
    }
    expect(loadCastScenePrompt('chen', 'interact')).toMatch(/陈姐/)
    expect(loadCastScenePrompt('ayu', 'execute')).toMatch(/阿雨|温度|歇口气/)
  })

  it('无 scenes 文件的角色走默认派生', () => {
    // lin 未配 scenes → 派生，且不含 protected 关键词堆叠
    const display = defaultCastScenePrompt('lin', 'display')
    const interact = loadCastScenePrompt('lin', 'interact')
    expect(display).toMatch(/小林|林/)
    expect(interact.length).toBeGreaterThan(0)
    expect(interact).not.toMatch(/SYSTEM PROMPT|你是一个 AI/)
  })

  it('formatSummonSceneBlock 含互动与执行标题', () => {
    const block = formatSummonSceneBlock('chen')
    expect(block).toMatch(/场景·互动/)
    expect(block).toMatch(/场景·执行/)
    expect(block).toMatch(/吐槽|干练|目标/)
  })

  it('loadCastBrief.summonHint 使用互动场景', () => {
    const brief = loadCastBrief('chen')
    expect(brief.summonHint).toMatch(/陈姐|短聊|吐槽/)
  })

  it('名册 display 场景进入边详情（陈姐）', () => {
    const lines = buildRosterLines('lin')
    const chen = lines.find((l) => l.otherId === 'chen')
    expect(chen).toBeTruthy()
    expect(chen!.text).toMatch(/陈姐/)
    // display 文件里的「工位搭子」或边 note 至少有一处圈子感
    expect(chen!.text.length).toBeGreaterThan(10)
    expect(loadCastDisplayLine('chen')).toMatch(/陈姐/)
  })
})
