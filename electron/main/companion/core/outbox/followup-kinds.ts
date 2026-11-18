export const COMPANION_FOLLOWUP = {
  nightlyMemory: 'followup:nightly-memory',
  keepsakeMilestone: 'followup:keepsake-milestone',
  cultureKeepsake: 'followup:culture-keepsake',
  momentDelayedReply: 'followup:moment-delayed-reply',
  chatVitals: 'followup:chat-vitals',
  chatFeedback: 'followup:chat-feedback',
  chatResonance: 'followup:chat-resonance',
} as const

export const COMPANION_FOLLOWUP_KINDS = Object.values(COMPANION_FOLLOWUP)
export type CompanionFollowupKind = typeof COMPANION_FOLLOWUP[keyof typeof COMPANION_FOLLOWUP]
