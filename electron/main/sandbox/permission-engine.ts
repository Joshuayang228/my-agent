/**
 * 权限规则引擎 — 五模式责任链 + 可编辑规则
 *
 * Alice 方法论 Ch.12：sandbox-mode → tool-allow/deny → path-guard → rate-limit → user-override
 *
 * 责任链执行顺序：
 * 0. 不可绕过边界（危险命令、越界 cwd、Shell 控制符、显式越界路径）
 * 1. 用户自定义硬规则（allow/deny）
 * 2. 审批记录（session / persistent）
 * 3. 用户自定义 ask 规则
 * 4. 命令安全分级 + 沙箱策略（exec-policy / guardCommand）
 */

import { buildPolicy, type SandboxMode } from './policy'
import { guardCommand, type GuardDecision } from './command-guard'
import { checkApproval } from './approval-store'
import { createLogger, hashForLog } from '../utils/logger'
import { PERMISSION_RULE_ACTIONS, PERMISSION_RULE_TYPES } from '../../../src/shared/types'
export { PERMISSION_RULE_ACTIONS, PERMISSION_RULE_TYPES } from '../../../src/shared/types'

const log = createLogger('PermissionEngine')

export type RuleAction = typeof PERMISSION_RULE_ACTIONS[number]
export type PermissionRuleType = typeof PERMISSION_RULE_TYPES[number]
export const FILE_RULE_PRIORITY = ['deny', 'ask', 'allow'] as const

export interface PermissionRule {
  id: string
  type: PermissionRuleType
  pattern: string
  action: RuleAction
  description?: string
  enabled: boolean
}

/** 决策来源类型，便于审计和 DevPanel 展示 */
export type DecisionType =
  | 'custom-rule'      // 用户自定义规则命中
  | 'approval-store'   // 历史审批记录
  | 'dangerous'        // 危险命令检测（bypass-immune）
  | 'sandbox-policy'   // 沙箱策略
  | 'default-allow'    // 默认允许（无规则命中）

export const PERMISSION_DECISION_CHAIN = [
  { id: 'custom-hard-rule', source: 'custom-rule', outcome: 'allow-or-deny' },
  { id: 'approval-store', source: 'approval-store', outcome: 'allow-or-deny' },
  { id: 'custom-ask-rule', source: 'custom-rule', outcome: 'needs-approval' },
  { id: 'command-risk-and-sandbox', source: 'dangerous-or-sandbox-policy', outcome: 'allow-deny-or-needs-approval' },
  { id: 'fallback', source: 'default-allow', outcome: 'allow' },
] as const

export interface PermissionCheckResult {
  allowed: boolean | 'needs_approval'
  reason: string
  decisionType: DecisionType
  matchedRule?: string
  chain: string
}

const userRules: PermissionRule[] = []
const compiledRulePatterns = new Map<string, RegExp>()
const MAX_PERMISSION_RULES = 100
const MAX_PERMISSION_PATTERN_LENGTH = 512

/** 保存先做无副作用校验，避免写盘成功但规则被容错载入忽略；启动恢复仍保留旧容错边界。 */
export function validatePermissionRules(rulesJson: string): void {
  parseRules(rulesJson, true)
}

function parseRules(rulesJson: string, strict: boolean): PermissionRule[] {
  let parsed: unknown
  try { parsed = JSON.parse(rulesJson) } catch { throw new Error('规则格式无效，请检查后重试') }
  if (!Array.isArray(parsed)) throw new Error('规则必须是列表')
  if (strict && parsed.length > MAX_PERMISSION_RULES) throw new Error('最多保存 100 条规则')
  const result: PermissionRule[] = []
  const ids = new Set<string>()
  for (const item of parsed.slice(0, MAX_PERMISSION_RULES)) {
    const candidate = item as Partial<PermissionRule> | null
    let error = ''
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
      || typeof candidate.id !== 'string' || !candidate.id.trim() || candidate.id.length > 200
      || !PERMISSION_RULE_TYPES.includes(candidate.type as PermissionRuleType)
      || !PERMISSION_RULE_ACTIONS.includes(candidate.action as RuleAction)
      || typeof candidate.pattern !== 'string' || !candidate.pattern.trim()
      || candidate.pattern.length > MAX_PERMISSION_PATTERN_LENGTH) error = '规则内容无效，匹配内容需为 1 至 512 个字符'
    else if (ids.has(candidate.id)) error = '规则标识重复，请重新添加'
    else if (isUnsafeRegexShape(candidate.pattern)) error = '匹配表达式过于复杂，请简化后重试'
    else {
      try { new RegExp(candidate.pattern, 'i') } catch { error = '匹配表达式无效，请检查括号和转义' }
      if (strict && candidate.description !== undefined && (typeof candidate.description !== 'string' || candidate.description.length > 500)) error = '规则说明不能超过 500 个字符'
      if (strict && candidate.enabled !== undefined && typeof candidate.enabled !== 'boolean') error = '规则启用状态无效'
    }
    if (error) {
      if (strict) throw new Error(error)
      continue
    }
    const rule = candidate as PermissionRule
    ids.add(rule.id)
    result.push({ id: rule.id, type: rule.type, pattern: rule.pattern, action: rule.action,
      description: typeof rule.description === 'string' ? rule.description.slice(0, 500) : undefined, enabled: rule.enabled !== false })
  }
  return result
}

/** 旧配置恢复容错，写入入口先调用严格校验；两条路径使用同一规则解析，避免保存与执行漂移。 */
export function loadRules(rulesJson: string): void {
  userRules.length = 0
  compiledRulePatterns.clear()
  try {
    userRules.push(...parseRules(rulesJson, false))
    for (const rule of userRules) compiledRulePatterns.set(rule.id, new RegExp(rule.pattern, 'i'))
    log.info('Permission rules loaded', { count: userRules.length })
  } catch {
    log.warn('Failed to parse permission rules')
  }
}

/** 获取当前规则列表 */
export function getRules(): PermissionRule[] {
  return [...userRules]
}

/**
 * 命令权限检查 — 五层责任链
 *
 * ask 规则不能抢在审批库之前返回：否则用户确认后的 session 审批永远命不中。
 * 但任何自定义规则和审批都不能绕过第 0 层的硬边界。
 */
export function checkCommandPermission(
  command: string,
  cwd: string | undefined,
  sandboxMode: SandboxMode,
  workspaceRoot?: string,
): PermissionCheckResult {
  // 先跑不可绕过的命令边界：危险命令、越界 cwd、Shell 控制符和显式越界路径
  // 不能被自定义 allow 或历史审批覆盖。
  const policy = buildPolicy(sandboxMode, workspaceRoot)
  const guard = guardCommand(command, cwd, policy)
  if (guard.allowed === false) return guardToResult(guard)

  // Layer 1: 用户自定义硬规则（仅 allow / deny）
  const hardCustom = matchCustomRules(command, 'command', { includeAsk: false })
  if (hardCustom) return hardCustom

  // Layer 2: 历史审批记录。只对已经通过不可绕过边界的命令生效。
  const approved = checkApproval(command)
  if (approved !== null) {
    return {
      allowed: approved,
      reason: approved ? '历史审批：已允许' : '历史审批：已拒绝',
      decisionType: 'approval-store',
      chain: 'approval-store',
    }
  }

  // Layer 3: 自定义 ask（无审批记录时才要求确认）
  const askCustom = matchCustomRules(command, 'command', { includeAsk: true, askOnly: true })
  if (askCustom) return askCustom

  // Layer 4-5: 沙箱策略和默认行为
  return guardToResult(guard)
}

/**
 * 工具权限检查 — 检查某工具是否允许执行
 */
export function checkToolPermission(toolName: string): PermissionCheckResult {
  const customResult = matchCustomRules(toolName, 'tool')
  if (customResult) return customResult

  return { allowed: true, reason: '默认允许', decisionType: 'default-allow', chain: 'fallback' }
}

/**
 * 文件规则需要同时检查逻辑路径与真实目标，防止 symlink 别名绕过拒绝规则。
 * 按 deny > ask > allow 合并所有匹配，不让较宽的 allow 遮住另一个路径的限制；
 * 调用方仍须先检查沙箱硬边界，命令规则既有审批顺序不受此函数影响。
 */
export function checkFilePermission(targets: readonly string[], operation: 'read' | 'write' | 'delete'): PermissionCheckResult | null {
  const types: PermissionRuleType[] = ['path']
  if (operation !== 'read') types.push(operation === 'write' ? 'file-write' : 'file-delete')
  for (const action of FILE_RULE_PRIORITY) {
    for (const rule of userRules) {
      if (!rule.enabled || !types.includes(rule.type) || rule.action !== action) continue
      const pattern = compiledRulePatterns.get(rule.id)
      if (!targets.some(target => pattern?.test(target))) continue
      return { allowed: action === 'ask' ? 'needs_approval' : action === 'allow',
        reason: rule.description || '匹配文件操作规则', decisionType: 'custom-rule', matchedRule: rule.id, chain: 'custom-file-rule' }
    }
  }
  return null
}

function matchCustomRules(
  target: string,
  type: PermissionRule['type'],
  opts: { includeAsk?: boolean; askOnly?: boolean } = {},
): PermissionCheckResult | null {
  const includeAsk = opts.includeAsk !== false
  const askOnly = opts.askOnly === true

  for (const rule of userRules) {
    if (!rule.enabled || rule.type !== type) continue
    if (askOnly && rule.action !== 'ask') continue
    if (!includeAsk && rule.action === 'ask') continue

    try {
      const regex = compiledRulePatterns.get(rule.id)
      if (regex?.test(target)) {
        const allowed = rule.action === 'allow' ? true
          : rule.action === 'deny' ? false
          : 'needs_approval' as const

        return {
          allowed,
          reason: rule.description || `匹配规则: ${rule.pattern}`,
          decisionType: 'custom-rule',
          matchedRule: rule.id,
          chain: 'custom-rule',
        }
      }
    } catch {
      log.warn('Invalid rule pattern', { ruleId: rule.id, patternHash: hashForLog(rule.pattern), patternLength: rule.pattern.length })
    }
  }
  return null
}

function isUnsafeRegexShape(pattern: string): boolean {
  return /(?:\([^)]*[+*][^)]*\))[+*?]|(?:\.\*|\.\+).*?(?:\.\*|\.\+)|\\[1-9]/.test(pattern)
}

function guardToResult(guard: GuardDecision): PermissionCheckResult {
  if (guard.allowed === true) {
    return { allowed: true, reason: '沙箱策略允许', decisionType: 'sandbox-policy', chain: 'sandbox-policy' }
  }
  if (guard.allowed === false) {
    // 区分危险命令（bypass-immune）和普通策略拒绝
    const decisionType: DecisionType = guard.reason.startsWith('危险命令被拦截')
      ? 'dangerous'
      : 'sandbox-policy'
    return { allowed: false, reason: guard.reason, decisionType, chain: 'sandbox-policy' }
  }
  return { allowed: 'needs_approval', reason: guard.reason, decisionType: 'sandbox-policy', chain: 'sandbox-policy' }
}
