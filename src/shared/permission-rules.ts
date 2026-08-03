/**
 * 权限规则表单模型（渲染进程可解析；与 permission-engine.PermissionRule 字段对齐）
 */

export type PermissionRuleType = 'command' | 'tool' | 'path'
export type PermissionRuleAction = 'allow' | 'deny' | 'ask'

export interface PermissionRuleForm {
  id: string
  type: PermissionRuleType
  pattern: string
  action: PermissionRuleAction
  description?: string
  enabled: boolean
}

const TYPES: PermissionRuleType[] = ['command', 'tool', 'path']
const ACTIONS: PermissionRuleAction[] = ['allow', 'deny', 'ask']

function isType(v: unknown): v is PermissionRuleType {
  return typeof v === 'string' && (TYPES as string[]).includes(v)
}

function isAction(v: unknown): v is PermissionRuleAction {
  return typeof v === 'string' && (ACTIONS as string[]).includes(v)
}

export function createEmptyPermissionRule(): PermissionRuleForm {
  return {
    id: `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
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
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const r = item as Record<string, unknown>
    if (typeof r.id !== 'string' || !r.id.trim()) continue
    if (!isType(r.type) || !isAction(r.action)) continue
    if (typeof r.pattern !== 'string') continue
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
