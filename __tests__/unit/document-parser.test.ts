import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import {
  isSupportedDocumentFileName,
  MAX_DOCUMENT_ATTACHMENT_BYTES,
  parseDocumentAttachment,
  parsePdfPreview,
  parsePptxPreview,
  parseSpreadsheetPreview,
} from '../../electron/main/utils/document-parser'

/** 构造一份合法的最小 ZIP（用于验证无依赖 PPTX 解析器） */
function buildMinimalZip(entries: Array<{ name: string; content: string; deflate?: boolean }>): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const rawBuf = Buffer.from(entry.content, 'utf8')
    const dataBuf = entry.deflate ? zlib.deflateRawSync(rawBuf) : rawBuf
    const method = entry.deflate ? 8 : 0

    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(dataBuf.length, 18)
    local.writeUInt32LE(rawBuf.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    nameBuf.copy(local, 30)
    localParts.push(local, dataBuf)

    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(dataBuf.length, 20)
    central.writeUInt32LE(rawBuf.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBuf.copy(central, 46)
    centralParts.push(central)

    offset += local.length + dataBuf.length
  }

  const cdBuf = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)

  return Buffer.concat([...localParts, cdBuf, eocd])
}

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

  it('parses structured spreadsheet preview for XLSX and CSV', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['部门', '预算'], ['研发', 120]]), '汇总')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['月份', '费用'], ['11月', 18]]), '明细')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const xlsxRes = await parseSpreadsheetPreview(buf, 'budget.xlsx')
    expect(xlsxRes.ok).toBe(true)
    if (xlsxRes.ok) {
      expect(xlsxRes.sheets).toHaveLength(2)
      expect(xlsxRes.sheets[0].name).toBe('汇总')
      expect(xlsxRes.sheets[0].rows[1]).toEqual(['研发', '120'])
    }

    const csvRes = await parseSpreadsheetPreview(Buffer.from('A,B\n1,2\n', 'utf8'), 'table.csv')
    expect(csvRes.ok).toBe(true)
    if (csvRes.ok) {
      expect(csvRes.sheets[0].name).toBe('table.csv')
      expect(csvRes.sheets[0].rows).toEqual([['A', 'B'], ['1', '2']])
    }
  })

  it('parses PDF preview with per-page text and base64 payload', async () => {
    const pdfBuf = buildMinimalTextPdf('Workspace Preview Page 1')
    const res = await parsePdfPreview(pdfBuf)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.pages).toHaveLength(1)
      expect(res.pages[0].pageNumber).toBe(1)
      expect(res.pages[0].fallbackText).toContain('Workspace Preview Page 1')
      expect(res.pdfBase64).toBe(pdfBuf.toString('base64'))
    }
  })

  it('parses PPTX slides and speaker notes without extra zip dependencies', async () => {
    const slide1Xml = '<p:sld><a:p><a:r><a:t>工作区升级汇报</a:t></a:r></a:p><a:p><a:r><a:t>支持 Excel 框选批注</a:t></a:r></a:p><a:p><a:r><a:t>支持 HTML 选元素</a:t></a:r></a:p></p:sld>'
    const notes1Xml = '<p:notes><a:p><a:r><a:t>开场强调安全沙箱边界</a:t></a:r></a:p></p:notes>'
    const zipBuf = buildMinimalZip([
      { name: 'ppt/slides/slide1.xml', content: slide1Xml, deflate: true },
      { name: 'ppt/notesSlides/notesSlide1.xml', content: notes1Xml, deflate: false },
    ])

    const res = await parsePptxPreview(zipBuf)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.slides).toHaveLength(1)
      expect(res.slides[0]).toEqual({
        slideNumber: 1,
        title: '工作区升级汇报',
        bullets: ['支持 Excel 框选批注', '支持 HTML 选元素'],
        notes: '开场强调安全沙箱边界',
      })
    }
  })
})
