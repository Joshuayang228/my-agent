/**
 * 权限与沙箱生产资产注册表。
 *
 * 背景：权限行为由沙箱档位、命令分级、路径边界、审批记录和责任链共同决定，分散查看难以审计。
 * 设计意图：直接读取生产常量与纯函数，生成只读安全资产，使 Debug 能解释规则来源而不复制运行配置。
 * 关键约束：不得读取用户 permissionRules、审批记录正文、当前 executionMode 或真实文件路径。
 */

import * as path from 'node:path'
import type { ModelContextAsset, ModelContextAssetType } from '../../../src/shared/types'
import { modelContextFingerprint } from '../prompts/fingerprint'
import {
  APPROVAL_COMMAND_PREFIX_WORDS,
  APPROVAL_LOOKUP_ORDER,
  APPROVAL_SCOPES,
  APPROVAL_SCOPE_STORAGE,
} from './approval-store'
import {
  DANGEROUS_COMMAND_PATTERNS,
  SAFE_COMMAND_NAMES,
  SAFE_COMMAND_PATTERNS,
} from './exec-policy'
import {
  PERMISSION_DECISION_CHAIN,
  PERMISSION_RULE_ACTIONS,
  PERMISSION_RULE_TYPES,
} from './permission-engine'
import {
  ALWAYS_PROTECTED_PATH_SEGMENTS,
  SANDBOX_MODES,
  buildPolicy,
} from './policy'
import {
  EFFECTIVE_SANDBOX_BY_EXECUTION_MODE,
  resolveEffectiveSandbox,
} from './effective-sandbox'
import { checkFileWriteSandbox, isPathInsideRoot } from './file-path-guard'
import { PERMISSION_SANDBOX_ASSET_KEYS } from './asset-keys'
export { PERMISSION_SANDBOX_ASSET_KEYS } from './asset-keys'

const POLICY_ASSET_VERSION = '1.0.0'


function jsonContent(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function preview(content: string, max = 420): string {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact
}

function policyAsset(input: {
  key: string
  name: string
  purpose: string
  role: string
  source: string
  assetType: Extract<ModelContextAssetType, 'permission-policy' | 'sandbox-policy'>
  content: string
  dependencies?: string[]
}): ModelContextAsset {
  return {
    key: input.key,
    id: input.key,
    name: input.name,
    category: 'permission',
    purpose: input.purpose,
    role: input.role,
    desc: '权限与沙箱的内置生产事实；不包含用户规则、审批记录或当前会话状态。',
    source: input.source,
    sourcePath: input.source,
    version: POLICY_ASSET_VERSION,
    fingerprint: modelContextFingerprint(input.content),
    fingerprintKind: 'content',
    assetType: input.assetType,
    ownership: 'builtin',
    contentKind: 'data',
    mode: 'static',
    locale: 'zh-CN',
    locales: { 'zh-CN': { template: input.content } },
    slots: [],
    status: 'active',
    dependencies: input.dependencies ?? [],
    preview: preview(input.content),
    content: input.content,
    dynamic: false,
  }
}

function commandPatternSummary(patterns: ReadonlyArray<{ pattern: RegExp; label: string }>) {
  return patterns.map(({ pattern, label }) => ({
    label,
    pattern: pattern.source,
    flags: pattern.flags,
  }))
}

/**
 * 生成不含真实用户路径的路径边界证明。
 *
 * 背景：路径守卫的生产真相是纯函数，直接复制文字说明容易与行为漂移。
 * 设计意图：使用固定的合成目录调用真实函数，只把布尔结论写入目录。
 * 关键约束：合成路径不进入工具执行，也不会触碰文件系统。
 */
function pathBoundarySnapshot() {
  const workspaceRoot = path.resolve('/asset-registry-workspace')
  const childPath = path.join(workspaceRoot, 'src', 'file.ts')
  const outsidePath = path.resolve(workspaceRoot, '..', 'outside', 'file.ts')
  const protectedPath = path.join(workspaceRoot, '.git', 'config')

  return {
    relativePathBase: '优先 workspaceRoot；缺失时使用 process.cwd()',
    containment: {
      workspaceItself: isPathInsideRoot(workspaceRoot, workspaceRoot),
      workspaceChild: isPathInsideRoot(childPath, workspaceRoot),
      workspaceOutside: isPathInsideRoot(outsidePath, workspaceRoot),
    },
    writeDecisions: {
      readOnlyBlocked: checkFileWriteSandbox(childPath, 'read-only', workspaceRoot) !== null,
      workspaceChildAllowed: checkFileWriteSandbox(childPath, 'workspace-write', workspaceRoot) === null,
      workspaceOutsideBlocked: checkFileWriteSandbox(outsidePath, 'workspace-write', workspaceRoot) !== null,
      protectedSegmentBlocked: checkFileWriteSandbox(protectedPath, 'workspace-write', workspaceRoot) !== null,
      fullAccessAllowed: checkFileWriteSandbox(outsidePath, 'full-access', workspaceRoot) === null,
    },
    protectedPathSegments: [...ALWAYS_PROTECTED_PATH_SEGMENTS],
  }
}

/**
 * 构建权限与沙箱生产资产目录。
 *
 * 背景：统一生产资产目录需要审阅安全控制面，但运行时用户规则和审批内容具有隐私与生命周期边界。
 * 设计意图：只登记 builtin 定义，并通过生产常量 / 纯函数形成稳定指纹和依赖关系。
 * 关键约束：返回对象仅供 Debug 只读展示，修改目录内容不会改变权限执行结果。
 */
export function getPermissionSandboxAssetCatalog(): ModelContextAsset[] {
  const sandboxModeContent = jsonContent({
    modes: SANDBOX_MODES.map((mode) => buildPolicy(mode, '<workspaceRoot>')),
  })
  const decisionChainContent = jsonContent({
    ruleTypes: [...PERMISSION_RULE_TYPES],
    ruleActions: [...PERMISSION_RULE_ACTIONS],
    commandDecisionChain: [...PERMISSION_DECISION_CHAIN],
    toolFallback: '无自定义工具规则命中时默认允许',
  })
  const commandSafetyContent = jsonContent({
    safeCommandNames: [...SAFE_COMMAND_NAMES],
    safePatterns: commandPatternSummary(SAFE_COMMAND_PATTERNS),
    dangerousPatterns: commandPatternSummary(DANGEROUS_COMMAND_PATTERNS),
    dangerousCommandsBypassImmune: true,
  })
  const pathBoundaryContent = jsonContent(pathBoundarySnapshot())
  const approvalFlowContent = jsonContent({
    scopes: [...APPROVAL_SCOPES],
    commandPrefixWords: APPROVAL_COMMAND_PREFIX_WORDS,
    lookupOrder: [...APPROVAL_LOOKUP_ORDER],
    storage: APPROVAL_SCOPE_STORAGE,
    currentRecordsIncluded: false,
  })
  const effectiveSandboxContent = jsonContent({
    mapping: EFFECTIVE_SANDBOX_BY_EXECUTION_MODE,
    missingOrUnknownMode: resolveEffectiveSandbox(undefined),
  })

  return [
    policyAsset({
      key: PERMISSION_SANDBOX_ASSET_KEYS.sandboxModes,
      name: '沙箱策略 · 档位与边界',
      purpose: '定义 read-only、workspace-write 与 full-access 的写入和网络边界',
      role: 'sandbox-policy',
      source: 'electron/main/sandbox/policy.ts',
      assetType: 'sandbox-policy',
      content: sandboxModeContent,
    }),
    policyAsset({
      key: PERMISSION_SANDBOX_ASSET_KEYS.decisionChain,
      name: '权限策略 · 决策责任链',
      purpose: '解释命令和工具权限按什么顺序得出允许、拒绝或需确认',
      role: 'permission-engine',
      source: 'electron/main/sandbox/permission-engine.ts',
      assetType: 'permission-policy',
      dependencies: [
        'permission-policy:approval-flow',
        'permission-policy:command-safety-grading',
        'sandbox-policy:modes',
      ],
      content: decisionChainContent,
    }),
    policyAsset({
      key: PERMISSION_SANDBOX_ASSET_KEYS.commandSafetyGrading,
      name: '权限策略 · 命令安全分级',
      purpose: '定义 safe、dangerous 和 unknown 命令的生产匹配事实',
      role: 'exec-policy',
      source: 'electron/main/sandbox/exec-policy.ts',
      assetType: 'permission-policy',
      content: commandSafetyContent,
    }),
    policyAsset({
      key: PERMISSION_SANDBOX_ASSET_KEYS.pathBoundaries,
      name: '权限策略 · 文件路径边界',
      purpose: '定义工作区包含关系、受保护路径和文件写入沙箱结果',
      role: 'file-path-guard',
      source: 'electron/main/sandbox/file-path-guard.ts',
      assetType: 'permission-policy',
      dependencies: ['sandbox-policy:modes'],
      content: pathBoundaryContent,
    }),
    policyAsset({
      key: PERMISSION_SANDBOX_ASSET_KEYS.approvalFlow,
      name: '权限策略 · 审批生命周期',
      purpose: '定义 once、session、persistent 审批的归一化、查询顺序和存储边界',
      role: 'approval-store',
      source: 'electron/main/sandbox/approval-store.ts',
      assetType: 'permission-policy',
      content: approvalFlowContent,
    }),
    policyAsset({
      key: PERMISSION_SANDBOX_ASSET_KEYS.effectiveMode,
      name: '沙箱策略 · 有效模式推导',
      purpose: '定义对话执行模式如何映射到工具真正使用的沙箱档位',
      role: 'effective-sandbox',
      source: 'electron/main/sandbox/effective-sandbox.ts',
      assetType: 'sandbox-policy',
      dependencies: ['sandbox-policy:modes'],
      content: effectiveSandboxContent,
    }),
  ]
}
