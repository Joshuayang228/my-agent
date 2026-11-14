import { describe, expect, it } from 'vitest'
import { attachContentProvenance, contentIntegrityError, contentProvenanceFromEvent } from '../../src/shared/content-integrity'

describe('Content Integrity', () => {
  const validEvent = {
    roleId: 'luffy', type: 'moment_created', sourceType: 'companion_moment', sourceId: 'moment-1',
    correlationId: 'moment-1', idempotencyKey: 'moment-created:moment-1', occurredAt: 1, payload: {}, schemaVersion: 1,
  }

  it('拒绝缺少来源、关联或幂等信息的内容事实', () => {
    expect(contentIntegrityError({ ...validEvent, sourceType: '' })).toContain('来源')
    expect(contentIntegrityError({ ...validEvent, correlationId: '' })).toContain('关联')
    expect(contentIntegrityError({ ...validEvent, idempotencyKey: '' })).toContain('幂等')
    expect(contentIntegrityError(validEvent)).toBeNull()
  })

  it('为派生内容附加可验证来源，并拒绝覆盖无效证据', () => {
    const provenance = contentProvenanceFromEvent({ origin: 'derived', sourceType: 'inner_thought', sourceId: 'thought-1', occurredAt: 10 })
    expect(attachContentProvenance({ title: '日记' }, provenance)).toMatchObject({ contentProvenance: provenance })
    expect(() => attachContentProvenance({ contentProvenance: { origin: 'agent' } }, provenance)).toThrow('来源证据')
  })
})
