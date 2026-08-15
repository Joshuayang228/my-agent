import { describe, expect, it, vi } from 'vitest'
import {
  APPROVAL_COMMAND_PREFIX_WORDS,
  APPROVAL_LOOKUP_ORDER,
  APPROVAL_SCOPES,
  APPROVAL_SCOPE_STORAGE,
} from '../../electron/main/sandbox/approval-store'
import { EFFECTIVE_SANDBOX_BY_EXECUTION_MODE } from '../../electron/main/sandbox/effective-sandbox'
import {
  DANGEROUS_COMMAND_PATTERNS,
  SAFE_COMMAND_NAMES,
  SAFE_COMMAND_PATTERNS,
} from '../../electron/main/sandbox/exec-policy'
import {
  PERMISSION_DECISION_CHAIN,
  PERMISSION_RULE_ACTIONS,
  PERMISSION_RULE_TYPES,
} from '../../electron/main/sandbox/permission-engine'
import { SANDBOX_MODES, buildPolicy } from '../../electron/main/sandbox/policy'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/my-agent-test' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const { getPermissionSandboxAssetCatalog } = await import('../../electron/main/sandbox/asset-registry')

describe('权限与沙箱生产资产目录', () => {
  it('登记稳定 key、来源和指纹，不读取用户规则或审批正文', () => {
    const assets = getPermissionSandboxAssetCatalog()
    const keys = assets.map((asset) => asset.key)

    expect(keys).toEqual([
      'sandbox-policy:modes',
      'permission-policy:decision-chain',
      'permission-policy:command-safety-grading',
      'permission-policy:path-boundaries',
      'permission-policy:approval-flow',
      'sandbox-policy:effective-mode',
    ])
    expect(new Set(keys).size).toBe(keys.length)
    for (const asset of assets) {
      expect(asset.category).toBe('permission')
      expect(['permission-policy', 'sandbox-policy']).toContain(asset.assetType)
      expect(asset.ownership).toBe('builtin')
      expect(asset.status).toBe('active')
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
      expect(asset.content).not.toContain('用户自定义规则示例')
      expect(asset.content).not.toContain('真实审批命令')
    }
  })

  it('沙箱、命令和责任链内容来自生产事实源', () => {
    const assets = getPermissionSandboxAssetCatalog()
    const sandbox = JSON.parse(assets.find((asset) => asset.key === 'sandbox-policy:modes')!.content!)
    const decisionChain = JSON.parse(assets.find((asset) => asset.key === 'permission-policy:decision-chain')!.content!)
    const commandSafety = JSON.parse(assets.find((asset) => asset.key === 'permission-policy:command-safety-grading')!.content!)

    expect(sandbox.modes).toEqual(SANDBOX_MODES.map((mode) => buildPolicy(mode, '<workspaceRoot>')))
    expect(decisionChain.ruleTypes).toEqual([...PERMISSION_RULE_TYPES])
    expect(decisionChain.ruleActions).toEqual([...PERMISSION_RULE_ACTIONS])
    expect(decisionChain.commandDecisionChain).toEqual([...PERMISSION_DECISION_CHAIN])
    expect(commandSafety.safeCommandNames).toEqual([...SAFE_COMMAND_NAMES])
    expect(commandSafety.safePatterns).toHaveLength(SAFE_COMMAND_PATTERNS.length)
    expect(commandSafety.dangerousPatterns).toHaveLength(DANGEROUS_COMMAND_PATTERNS.length)
    expect(commandSafety.dangerousCommandsBypassImmune).toBe(true)
  })

  it('审批和有效沙箱资产不包含当前运行时记录', () => {
    const assets = getPermissionSandboxAssetCatalog()
    const approval = JSON.parse(assets.find((asset) => asset.key === 'permission-policy:approval-flow')!.content!)
    const effective = JSON.parse(assets.find((asset) => asset.key === 'sandbox-policy:effective-mode')!.content!)
    const paths = JSON.parse(assets.find((asset) => asset.key === 'permission-policy:path-boundaries')!.content!)

    expect(approval).toEqual({
      scopes: [...APPROVAL_SCOPES],
      commandPrefixWords: APPROVAL_COMMAND_PREFIX_WORDS,
      lookupOrder: [...APPROVAL_LOOKUP_ORDER],
      storage: APPROVAL_SCOPE_STORAGE,
      currentRecordsIncluded: false,
    })
    expect(effective.mapping).toEqual(EFFECTIVE_SANDBOX_BY_EXECUTION_MODE)
    expect(effective.missingOrUnknownMode).toBe('workspace-write')
    expect(paths.containment).toEqual({
      workspaceItself: true,
      workspaceChild: true,
      workspaceOutside: false,
    })
    expect(paths.writeDecisions).toEqual({
      readOnlyBlocked: true,
      workspaceChildAllowed: true,
      workspaceOutsideBlocked: true,
      protectedSegmentBlocked: true,
      fullAccessAllowed: true,
    })
  })
})
