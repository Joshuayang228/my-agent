import { AsyncLocalStorage } from 'node:async_hooks'

export interface CompanionCommandContext {
  commandId: string
  executionId: string
  correlationId: string
  roleId: string
  occurredAt: number
  signal?: AbortSignal
}

export const commandExecutionScope = new AsyncLocalStorage<CompanionCommandContext>()
