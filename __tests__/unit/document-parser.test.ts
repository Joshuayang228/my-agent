import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  isSupportedDocumentFileName,
  MAX_DOCUMENT_ATTACHMENT_BYTES,
  parseDocumentAttachment,
} from '../../electron/main/utils/document-parser'

/** 构造一份合法的最小单页文本 PDF，确保单测不依赖外部 fixture 文件 */
function buildMinimalTextPdf(text: string): Buffer {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += obj
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}

describe('document-parser', () => {
  it('identifies supported office document extensions', () => {
    expect(isSupportedDocumentFileName('report.PDF')).toBe(true)
    expect(isSupportedDocumentFileName('spec.docx')).toBe(true)
    expect(isSupportedDocumentFileName('sheet.xlsx')).toBe(true)
    expect(isSupportedDocumentFileName('legacy.xls')).toBe(true)
    expect(isSupportedDocumentFileName('notes.txt')).toBe(false)
    expect(isSupportedDocumentFileName('photo.png')).toBe(false)
  })

  it('extracts text from a real XLSX workbook across sheets', async () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Score'],
      ['Alpha', 95],
      ['Beta', 88],
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'Summary')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const res = await parseDocumentAttachment('scores.xlsx', buf)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.truncated).toBe(false)
      expect(res.text).toContain('### 工作表: Summary')
      expect(res.text).toContain('Alpha,95')
      expect(res.text).toContain('Beta,88')
    }
  })

  it('extracts text from a real PDF buffer', async () => {
    const pdfBuf = buildMinimalTextPdf('Hello My Agent PDF 2026')
    const res = await parseDocumentAttachment('hello.pdf', pdfBuf)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.text).toContain('Hello My Agent PDF 2026')
    }
  })

  it('returns friendly errors for empty, oversized, unsupported, or corrupt files', async () => {
    expect(await parseDocumentAttachment('bad.exe', Buffer.from('abc'))).toEqual({
      ok: false,
      error: '暂不支持解析 .exe 文档',
    })
    expect(await parseDocumentAttachment('empty.pdf', Buffer.alloc(0))).toEqual({
      ok: false,
      error: '文件内容为空',
    })
    expect(
      await parseDocumentAttachment('huge.pdf', Buffer.alloc(MAX_DOCUMENT_ATTACHMENT_BYTES + 1)),
    ).toEqual({
      ok: false,
      error: '文档超过 10MB 限制',
    })
    const corruptDocx = await parseDocumentAttachment('corrupt.docx', Buffer.from('not-a-zip-docx'))
    expect(corruptDocx.ok).toBe(false)
    if (!corruptDocx.ok) {
      expect(corruptDocx.error).toContain('无法解析文档 corrupt.docx')
    }
  })
})
