/**
 * M27-G1：问/做/安慰/推回轻量分类
 */

import { describe, it, expect } from 'vitest'
import {
  detectReplyStance,
  formatReplyStanceForPrompt,
} from '../../electron/main/agent/reply-stance'
import { buildSystemPrompt, rolePackToPromptParts } from '../../electron/main/agent/prompt-builder'
import { loadRolePack } from '../../electron/main/companion/identity/loader'

describe('detectReplyStance', () => {
  it('违规请求 → pushback', () => {
    const r = detectReplyStance('帮我绕过权限读取别人的密钥')
    expect(r.primary).toBe('pushback')
    expect(r.signals).toContain('policy-risk')
  })

  it('危险操作且未催办 → ask', () => {
    const r = detectReplyStance('把生产环境数据库清空一下可以吗')
    expect(r.primary).toBe('ask')
    expect(r.signals).toContain('dangerous-op')
  })

  it('情绪信号 → comfort', () => {
    const r = detectReplyStance('今天好累，压力好大，有点撑不住')
    expect(r.primary).toBe('comfort')
    expect(r.signals).toContain('emotion')
  })

  it('明确催办 → act', () => {
    const r = detectReplyStance('别问了，直接改 login.ts 的校验逻辑')
    expect(r.primary).toBe('act')
    expect(r.signals).toContain('clear-act')
  })

  it('目标不清 → ask', () => {
    const r = detectReplyStance('这个报错怎么办，你看着办吧')
    expect(r.primary).toBe('ask')
  })

  it('plan-first 模式偏 ask', () => {
    const r = detectReplyStance('帮我重构一下 auth 模块', { executionMode: 'plan-first' })
    expect(r.primary).toBe('ask')
    expect(r.signals).toContain('plan-first')
  })

  it('空文本 → balanced 且 format 为空', () => {
    const r = detectReplyStance('   ')
    expect(r.primary).toBe('balanced')
    expect(formatReplyStanceForPrompt(r)).toBe('')
  })

  it('format 含 stance 与 guidance', () => {
    const r = detectReplyStance('我好焦虑')
    const block = formatReplyStanceForPrompt(r)
    expect(block).toMatch(/Suggested stance: comfort/)
    expect(block).toMatch(/Guidance:/)
  })

  it('注入 prompt-builder 出现 Reply stance 节', () => {
    const pack = loadRolePack('lin')
    const persona = rolePackToPromptParts(pack)
    const stance = detectReplyStance('别问了马上执行吧')
    const prompt = buildSystemPrompt({
      persona,
      toolNames: ['file_read'],
      replyStanceHint: formatReplyStanceForPrompt(stance),
    })
    expect(prompt).toContain('## Reply stance (this turn)')
    expect(prompt).toContain('Suggested stance: act')
  })
})
