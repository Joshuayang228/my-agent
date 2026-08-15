/** 权限与沙箱生产资产稳定 key。 */
export const PERMISSION_SANDBOX_ASSET_KEYS = {
  sandboxModes: 'sandbox-policy:modes',
  decisionChain: 'permission-policy:decision-chain',
  commandSafetyGrading: 'permission-policy:command-safety-grading',
  pathBoundaries: 'permission-policy:path-boundaries',
  approvalFlow: 'permission-policy:approval-flow',
  effectiveMode: 'sandbox-policy:effective-mode',
} as const
