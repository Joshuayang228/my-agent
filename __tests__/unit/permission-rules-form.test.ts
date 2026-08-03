/**
 * 权限规则可视化编辑器：JSON 往返
 */
import { describe, expect, it } from 'vitest'
import {
  createEmptyPermissionRule,
  parsePermissionRulesJson,
  serializePermissionRules,
} from '../../src/shared/permission-rules'

describe('parsePermissionRulesJson', () => {
  it('解析合法数组', () => {
    const r = parsePermissionRulesJson(
      JSON.stringify([
        {
          id: 'no-publish',
          type: 'command',
          pattern: 'npm publish',
          action: 'deny',
          enabled: true,
        },
      ]),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rules).toHaveLength(1)
    expect(r.rules[0].pattern).toBe('npm publish')
  })

  it('非法 JSON 失败', () => {
    const r = parsePermissionRulesJson('{')
    expect(r.ok).toBe(false)
  })

  it('跳过残缺条目', () => {
    const r = parsePermissionRulesJson(
      JSON.stringify([{ id: 'x' }, { id: 'ok', type: 'tool', pattern: 'shell_exec', action: 'ask' }]),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rules).toHaveLength(1)
    expect(r.rules[0].id).toBe('ok')
  })
})

describe('serializePermissionRules', () => {
  it('丢弃空 pattern，保留 description', () => {
    const empty = createEmptyPermissionRule()
    const filled = {
      ...createEmptyPermissionRule(),
      id: 'deny-rm',
      pattern: 'rm -rf',
      action: 'deny' as const,
      description: '危险删除',
    }
    const json = serializePermissionRules([empty, filled])
    const again = parsePermissionRulesJson(json)
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.rules).toHaveLength(1)
    expect(again.rules[0].description).toBe('危险删除')
  })

  it('往返稳定', () => {
    const rules = [
      {
        id: 'mcp-loose',
        type: 'tool' as const,
        pattern: 'mcp:demo:*',
        action: 'allow' as const,
        enabled: true,
      },
    ]
    const json = serializePermissionRules(rules)
    const parsed = parsePermissionRulesJson(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.rules[0]).toMatchObject(rules[0])
  })
})
