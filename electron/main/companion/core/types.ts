export interface CompanionRuntimeState {
  roleId: string
  universeId: string
  mood: number
  energy: number
  socialNeed: number
  hunger: number
  sleepiness: number
  home: string
  timezone: string
  currentActivity: string
  currentLocation: string
  locationDetail: string
  statusTags: string[]
  situation: string
  version: number
  updatedAt: number
  lastEventId: string | null
}

export interface CompanionDomainEvent {
  id: string
  roleId: string
  universeId: string
  type: string
  sourceType: string
  sourceId: string | null
  causationId: string | null
  correlationId: string
  idempotencyKey: string
  occurredAt: number
  payload: Record<string, unknown>
  schemaVersion: number
}

export type CompanionExecutionStatus = 'accepted' | 'running' | 'completed' | 'failed' | 'retryable' | 'cancelled'

export interface CompanionExecutionRun {
  id: string
  roleId: string
  commandId: string | null
  eventId: string | null
  actionType: string
  status: CompanionExecutionStatus
  attempt: number
  errorCode: string | null
  errorMessage: string | null
  startedAt: number
  completedAt: number | null
}

export interface CompanionOutboxMessage {
  id: string
  roleId: string
  eventId: string | null
  kind: string
  dedupeKey: string
  payload: Record<string, unknown>
  status: 'pending' | 'delivered' | 'failed'
  attempt: number
  lastError: string | null
  createdAt: number
  deliveredAt: number | null
}
