/**
 * 权限规则表单模型（渲染进程可解析；与 permission-engine.PermissionRule 字段对齐）
 */

import { PERMISSION_RULE_ACTIONS, PERMISSION_RULE_TYPES } from './types'
export { PERMISSION_RULE_ACTIONS, PERMISSION_RULE_TYPES } from './types'
export type PermissionRuleType = typeof PERMISSION_RULE_TYPES[number]
export type PermissionRuleAction = typeof PERMISSION_RULE_ACTIONS[number]

export interface PermissionRuleForm {
  id: string
  type: PermissionRuleType
  pattern: string
  action: PermissionRuleAction
  description?: string
  enabled: boolean
}

function isType(v: unknown): v is PermissionRuleType {
  return typeof v === 'string' && (PERMISSION_RULE_TYPES as readonly string[]).includes(v)
}

function isAction(v: unknown): v is PermissionRuleAction {
  return typeof v === 'string' && (PERMISSION_RULE_ACTIONS as readonly string[]).includes(v)
}

export function createEmptyPermissionRule(): PermissionRuleForm {
  return {
    id: `rule-${globalThis.crypto.randomUUID()}`,
    type: 'command',
    pattern: '',
    action: 'deny',
    description: '',
    enabled: true,
  }
}

/**
 * 解析 settings.permissionRules JSON。
 * 非法条目跳过；整体非数组则失败。
 */
export function parsePermissionRulesJson(
  raw: string,
): { ok: true; rules: PermissionRuleForm[] } | { ok: false; error: string } {
  const text = (raw ?? '').trim() || '[]'
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是合法 JSON' }
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: '权限规则必须是 JSON 数组' }
  }
  const rules: PermissionRuleForm[] = []
  const ids = new Set<string>()
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, error: '存在无法识别的规则' }
    const r = item as Record<string, unknown>
    if (typeof r.id !== 'string' || !r.id.trim() || ids.has(r.id)) return { ok: false, error: '规则标识无效或重复' }
    if (!isType(r.type) || !isAction(r.action) || typeof r.pattern !== 'string') return { ok: false, error: '存在无法识别的规则内容' }
    ids.add(r.id)
    rules.push({
      id: r.id.trim(),
      type: r.type,
      pattern: r.pattern,
      action: r.action,
      description: typeof r.description === 'string' ? r.description : '',
      enabled: r.enabled !== false,
    })
  }
  return { ok: true, rules }
}

export function serializePermissionRules(rules: PermissionRuleForm[]): string {
  const cleaned = rules
    .filter((r) => r.id.trim() && r.pattern.trim())
    .map((r) => ({
      id: r.id.trim(),
      type: r.type,
      pattern: r.pattern.trim(),
      action: r.action,
      ...(r.description?.trim() ? { description: r.description.trim() } : {}),
      enabled: r.enabled !== false,
    }))
  return JSON.stringify(cleaned, null, 2)
}
