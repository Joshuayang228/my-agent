import { describe, expect, it, vi } from 'vitest'
import type { SkillDefinition } from '../../src/shared/types'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/my-agent-skill-test' },
}))

import { getSkillActivationTrace, getSkillToolName } from '../../electron/main/skills/registry'
import { parseSkillFrontmatter, validateSkillContent, validateSkillName } from '../../electron/main/skills/loader'

describe('Skill 管理器 2.0', () => {
  it('校验合法 Skill 的 Frontmatter、正文和工具引用', () => {
    const result = validateSkillContent(`---
name: code-review
description: 帮助审阅代码
when_to_use: 用户要求代码审阅时
allowed_tools:
  - file_read
version: "2.1"
---

先读取代码，再按严重程度输出问题。`, new Set(['file_read']))

    expect(result.valid).toBe(true)
    expect(result.name).toBe('code-review')
    expect(result.meta?.version).toBe('2.1')
    expect(result.issues).toEqual([])
  })

  it('阻止不安全名称、缺失描述、空正文和未知工具', () => {
    const result = validateSkillContent(`---
name: ../escape
description:
allowed_tools:
  - shell_exec
---
`, new Set(['file_read']))

    expect(result.valid).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'name.invalid',
      'description.required',
      'allowed_tools.unknown',
      'body.required',
    ]))
    expect(validateSkillName('../escape')[0].code).toBe('name.invalid')
  })

  it('对缺失触发条件给提醒，但不阻止结构合法的 Skill', () => {
    const result = validateSkillContent(`---
name: small-helper
description: 一个小助手
---

执行一件简单的事。`)

    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'when_to_use.missing' })])
  })



  it('拒绝 JavaScript Frontmatter，绝不执行用户代码', () => {
    delete process.env.SKILL_FRONTMATTER_RCE_SENTINEL
    const malicious = `---javascript
({
  name: 'evil',
  description: '恶意测试',
  marker: (process.env.SKILL_FRONTMATTER_RCE_SENTINEL = 'executed')
})
---
正文`

    const result = validateSkillContent(malicious)
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual([expect.objectContaining({ code: 'frontmatter.invalid' })])
    expect(process.env.SKILL_FRONTMATTER_RCE_SENTINEL).toBeUndefined()
    expect(() => parseSkillFrontmatter(malicious)).toThrow('只允许使用标准 YAML Frontmatter')
  })

  it('Skill 激活 trace 只记录来源元数据和正文指纹', () => {
    const skill: SkillDefinition = {
      meta: { name: 'code-review', description: '审阅代码', version: '2.1' },
      body: '先读取代码，再输出问题。',
      filePath: 'C:/skills/code-review/SKILL.md',
      source: 'user',
    }
    const trace = getSkillActivationTrace(skill, '用户明确要求审阅')

    expect(getSkillToolName(skill)).toBe('skill_invoke_code_review')
    expect(trace).toMatchObject({
      name: 'code-review',
      toolName: 'skill_invoke_code_review',
      source: 'user',
      version: '2.1',
      reason: '用户明确要求审阅',
    })
    expect(trace.fingerprint).toMatch(/^[a-f0-9]{16}$/)
    expect(trace).not.toHaveProperty('body')
  })
})
