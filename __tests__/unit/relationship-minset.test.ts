/**
 * M30-G2：压缩保护关系最小集
 */
import { describe, expect, it } from 'vitest'
import {
  RELATIONSHIP_MINSET_WHITELIST,
  extractRelationshipMinSet,
  formatMinSetWhitelistForCompactPrompt,
  mergeMinSetIntoSummary,
  formatMinSetBlock,
} from '../../electron/main/agent/relationship-minset'
import type { ChatMessage } from '../../src/shared/types'

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: 'm', role, content, timestamp: 1 }
}

describe('relationship-minset', () => {
  it('白名单含三类关系信息', () => {
    expect(RELATIONSHIP_MINSET_WHITELIST.length).toBe(3)
    expect(formatMinSetWhitelistForCompactPrompt()).toContain('称呼与沟通偏好')
    expect(formatMinSetWhitelistForCompactPrompt()).toContain('共同约定')
  })

  it('抽取称呼/约定/锚点', () => {
    const items = extractRelationshipMinSet([
      msg('user', '叫我瓶盖就行，回复短一点'),
      msg('user', '这周我们一定要把登录页改完'),
      msg('user', '先别提上次那件事'),
      msg('assistant', '好的我用 file_read 看一下'),
    ])
    const kinds = items.map((i) => i.kind)
    expect(kinds).toContain('address_pref')
    expect(kinds).toContain('joint_commitment')
    expect(kinds).toContain('emotion_anchor')
  })

  it('merge 在无节时追加', () => {
    const items = extractRelationshipMinSet([
      msg('user', '请叫我 Joshua'),
    ])
    const merged = mergeMinSetIntoSummary('## 当前任务\n修 bug', items)
    expect(merged).toContain('## 关系最小集')
    expect(merged).toContain('Joshua')
  })

  it('空抽取仍写「无」节', () => {
    expect(formatMinSetBlock([])).toContain('无')
    const merged = mergeMinSetIntoSummary('summary only', [])
    expect(merged).toContain('## 关系最小集')
  })
})
