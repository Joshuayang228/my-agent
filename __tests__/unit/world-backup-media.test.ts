import { expect, it } from 'vitest'
import { isValidBackupImageBundle } from '../../electron/main/storage/generated-image-backup'

const reference = {
  id: 'a'.repeat(64), fileName: 'outfit.png', mimeType: 'image/png' as const,
  width: 3, height: 2, byteLength: 3,
}
const media = { ...reference, data: 'YWJj' }

it('套装与当前穿搭允许跨资产共用同一份备份媒体', () => {
  const { fileName: _fileName, ...bytes } = media
  expect(isValidBackupImageBundle([], [bytes], [
    { scope: 'asset:outfit', references: [reference] },
    { scope: 'asset:wear-state', references: [{ ...reference }] },
  ])).toBe(true)
})

it('共享图片仍拒绝重复媒体、同一集合重复引用及不一致的尺寸', () => {
  const { fileName: _fileName, ...bytes } = media
  const collections = [{ scope: 'asset:outfit', references: [reference] }]
  expect(isValidBackupImageBundle([], [bytes, bytes], collections)).toBe(false)
  expect(isValidBackupImageBundle([], [bytes], [{ references: [reference, reference] }])).toBe(false)
  expect(isValidBackupImageBundle([], [bytes], [
    ...collections, { scope: 'asset:wear-state', references: [{ ...reference, width: 4 }] },
  ])).toBe(false)
})
