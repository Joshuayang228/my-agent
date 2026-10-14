export const DEBUG_EVIDENCE_VIEWS = ['schedule', 'recent', 'activity', 'now', 'character', 'location', 'residence', 'footprints', 'growth', 'moments', 'relations', 'proactive', 'wardrobe', 'items', 'links', 'context', 'profile', 'memories'] as const
export type DebugEvidenceView = typeof DEBUG_EVIDENCE_VIEWS[number]
export interface DebugEvidenceQuery {
  view: DebugEvidenceView
  roleId: string
  date?: string
  limit?: number
  cursor?: string
  recordId?: string
}
export interface DebugEvidenceRecord {
  id: string
  roleId: string
  kind: string
  title: string
  time: number | null
  status: string
  body: string
  data: Record<string, unknown>
  source: string
  truncated: boolean
  links: Array<{ view: DebugEvidenceView; id: string; label: string }>
}
export interface DebugEvidenceResult {
  state: 'ready' | 'unsupported' | 'unavailable'
  roleId: string
  view: DebugEvidenceView
  date?: string
  timezone: string
  records: DebugEvidenceRecord[]
  source: string
  generatedAt: number
  nextCursor?: string
  hasMore: boolean
  total: null
  issues: string[]
  boundary: string
}
export interface DebugEvidenceScope {
  roles: Array<{ id: string; name: string }>
  activeRoleId: string | null
  universeId: string
  ready: boolean
}
