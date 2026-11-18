export const COMPANION_FOLLOWUP = {
  nightlyMemory: 'followup:nightly-memory',
  keepsakeMilestone: 'followup:keepsake-milestone',
} as const

export const COMPANION_FOLLOWUP_KINDS = Object.values(COMPANION_FOLLOWUP)
export type CompanionFollowupKind = typeof COMPANION_FOLLOWUP[keyof typeof COMPANION_FOLLOWUP]
