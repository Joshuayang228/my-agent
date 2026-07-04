/**
 * 权限规则引擎 — 五模式责任链 + 可编辑规则
 *
 * Alice 方法论 Ch.12：sandbox-mode → tool-allow/deny → path-guard → rate-limit → user-override
 *
 * 责任链执行顺序：
 * 1. 用户自定义规则（allow/deny/ask）
 * 2. 审批记录（session / persistent）
 * 3. 命令安全分级（exec-policy）
 * 4. 沙箱策略（sandbox policy）
 * 5. 默认行为（fallback）
 */

import { assessCommand } from './exec-policy'
import { buildPolicy, type SandboxMode } from './policy'
import { guardCommand, type GuardDecision } from './command-guard'
import { checkApproval } from './approval-store'
import { createLogger } from '../utils/logger'

const log = createLogger('PermissionEngine')

export type RuleAction = 'allow' | 'deny' | 'ask'

export interface PermissionRule {
  id: string
  type: 'command' | 'tool' | 'path'
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

export interface PermissionCheckResult {
  allowed: boolean | 'needs_approval'
  reason: string
  decisionType: DecisionType
  matchedRule?: string
  chain: string
}

const userRules: PermissionRule[] = []

/** 加载用户自定义规则（从设置 JSON 字符串解析） */
export function loadRules(rulesJson: string): void {
  userRules.length = 0
  try {
    const parsed = JSON.parse(rulesJson)
    if (Array.isArray(parsed)) {
      for (const rule of parsed) {
        if (rule.id && rule.type && rule.pattern && rule.action) {
          userRules.push({ ...rule, enabled: rule.enabled !== false })
        }
      }
    }
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
 */
export function checkCommandPermission(
  command: string,
  cwd: string | undefined,
  sandboxMode: SandboxMode,
  workspaceRoot?: string,
): PermissionCheckResult {

  // Layer 1: 用户自定义规则
  const customResult = matchCustomRules(command, 'command')
  if (customResult) {
    log.debug('Custom rule matched', { command: command.slice(0, 60), rule: customResult.matchedRule })
    return customResult
  }

  // Layer 2: 历史审批记录
  const approved = checkApproval(command)
  if (approved !== null) {
    return {
      allowed: approved,
      reason: approved ? '历史审批：已允许' : '历史审批：已拒绝',
      decisionType: 'approval-store',
      chain: 'approval-store',
    }
  }

  // Layer 3-4: exec-policy + sandbox policy（委托给 guardCommand）
  const policy = buildPolicy(sandboxMode, workspaceRoot)
  const guard = guardCommand(command, cwd, policy)

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

function matchCustomRules(target: string, type: PermissionRule['type']): PermissionCheckResult | null {
  for (const rule of userRules) {
    if (!rule.enabled || rule.type !== type) continue
    try {
      const regex = new RegExp(rule.pattern, 'i')
      if (regex.test(target)) {
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
      log.warn('Invalid rule pattern', { ruleId: rule.id, pattern: rule.pattern })
    }
  }
  return null
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
