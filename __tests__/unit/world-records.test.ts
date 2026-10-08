import { describe, expect, it } from 'vitest'
import { normalizeWorldRecordField, readingNotesForAsset, worldRecordConsistencyError } from '../../src/shared/world-records'

describe('world record production contracts', () => {
  it('preserves full narratives and rejects invalid structured records atomically', () => {
    const long = '读完以后留下的感想。'.repeat(80)
    expect(normalizeWorldRecordField('culture', 'detail', long)).toEqual({ handled: true, ok: true, value: long })
    expect(normalizeWorldRecordField('culture', 'readingNotes', [{ id: 'a', text: long, page: 36 }])).toMatchObject({ ok: true })
    for (const notes of [[{ id: 'a', text: '' }], [{ id: 'a', text: '一' }, { id: 'a', text: '二' }], [{ id: 'a', text: '正文', page: -1 }], [{ id: 'a', text: '正文', occurredAt: Infinity }]]) {
      expect(normalizeWorldRecordField('bookshelf', 'readingNotes', notes)).toMatchObject({ ok: false })
    }
    expect(normalizeWorldRecordField('culture', 'readingNotes', Array.from({ length: 201 }, (_, i) => ({ id: String(i), text: '正文' })))).toMatchObject({ ok: false })
  })

  it('requires explicit clothing slots and valid space evidence without interpreting unknown metadata', () => {
    expect(normalizeWorldRecordField('wardrobe', 'slots', { top: 'shirt', shoes: 'shoe' })).toMatchObject({ ok: true })
    expect(normalizeWorldRecordField('wardrobe', 'slots', {})).toMatchObject({ ok: false })
    expect(normalizeWorldRecordField('wardrobe', 'slots', { bag: 'camera' })).toMatchObject({ ok: false })
    expect(normalizeWorldRecordField('furniture', 'displayInHome', 'true')).toMatchObject({ ok: false })
    expect(normalizeWorldRecordField('furniture', 'displayEvidence', ['event:1'])).toMatchObject({ ok: true })
    expect(normalizeWorldRecordField('culture', 'image', { id: 'image' })).toEqual({ handled: false })
    expect(normalizeWorldRecordField('toString', 'constructor', {})).toEqual({ handled: false })
  })

  it('checks real calendar dates, travel status and stop boundaries without turning places into trips', () => {
    expect(normalizeWorldRecordField('footprint', 'start', '2026-02-30')).toMatchObject({ ok: false })
    const trip = { recordType: 'trip', destination: '苏州', status: 'completed', start: '2026-09-26', end: '2026-09-27', stops: [{ id: 'alley', name: '街巷', story: '散步', date: '2026-09-26' }] }
    expect(worldRecordConsistencyError('footprint', trip)).toBeNull()
    expect(worldRecordConsistencyError('footprint', { ...trip, start: undefined })).not.toBeNull()
    expect(worldRecordConsistencyError('footprint', { ...trip, end: '2026-09-25' })).not.toBeNull()
    expect(worldRecordConsistencyError('footprint', { ...trip, status: 'active' })).not.toBeNull()
    expect(worldRecordConsistencyError('footprint', { ...trip, stops: [{ ...trip.stops[0], date: '2026-09-28' }] })).not.toBeNull()
    expect(worldRecordConsistencyError('footprint', { recordType: 'place', visitStatus: 'favorite' })).toBeNull()
    expect(worldRecordConsistencyError('culture', { currentPage: 400, totalPages: 352 })).not.toBeNull()
    expect(worldRecordConsistencyError('wardrobe', { recordType: 'outfit', slots: { top: 'shirt' } })).not.toBeNull()
    expect(worldRecordConsistencyError('wardrobe', { recordType: 'wear-state', slots: { top: 'shirt' } })).toBeNull()
  })

  it('reads the same notes for list and detail, preserves ownership and never invents dates', () => {
    expect(readingNotesForAsset({ id: 'book', payload: { note: '原笔记' } })).toEqual([{ id: 'book:note', assetId: 'book', text: '原笔记' }])
    expect(readingNotesForAsset({ id: 'book', payload: { note: '原笔记', readingNotes: [] } })).toEqual([])
    expect(readingNotesForAsset({ id: 'book', payload: { readingNotes: [{ id: 'n1', text: '新笔记' }] } })).toEqual([{ id: 'n1', assetId: 'book', text: '新笔记' }])
    expect(readingNotesForAsset({ id: 'book', payload: { readingNotes: [{ id: 'n1', assetId: 'other', text: '串资料' }] } })).toEqual([])
  })
})
