import type { ChatMessage } from '../../../../src/shared/types'
import { enqueueCompanionOutbox } from '../core/outbox/outbox'
import { dispatchCompanionSessionOutbox } from '../adapters/session-outbox-dispatcher'

export async function enqueueCompanionSessionMessage(input: {
  roleId: string
  eventId?: string | null
  sessionId: string
  message: ChatMessage
}): Promise<void> {
  await enqueueCompanionOutbox({
    roleId: input.roleId,
    eventId: input.eventId ?? null,
    kind: 'main-session-message',
    dedupeKey: `main-session-message:${input.message.id}`,
    payload: { sessionId: input.sessionId, message: input.message },
  })
  await dispatchCompanionSessionOutbox()
}
