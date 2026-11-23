/**
 * 办公文档解析与结构化预览提取器（PDF / DOCX / XLSX / XLS / CSV / PPTX）。
 *
 * 背景：
 * 1. 聊天附件需要纯文本提取，避免把二进制文件读成乱码污染上下文；
 * 2. 右侧工作区需要结构化预览载荷（多 Sheet 表格、语义 HTML、按页 PDF、按页 PPTX 幻灯片与备注）。
 * 设计意图：在 Electron 主进程集中调用纯 JS 解析库（unpdf / mammoth / xlsx）与零依赖原生 zlib ZIP 解析器，
 * 限制体积、行列与页数上限，防 OOM 与 zip bomb，异常统一返回友好中文提示。
 * 关键约束：仅接受已知扩展名与有界字节数（<= 10MB）；绝不执行文档内宏或脚本。
 */

import path from 'node:path'
import zlib from 'node:zlib'
import type {
  ProjectFilePreviewPdfPage,
  ProjectFilePreviewPptxSlide,
  ProjectFilePreviewSheet,
} from '../../../src/shared/types'

export const MAX_DOCUMENT_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_PARSED_TEXT_CHARS = 80_000
export const MAX_PREVIEW_SHEET_ROWS = 500
export const MAX_PREVIEW_SHEET_COLS = 50
export const MAX_PREVIEW_PPTX_SLIDES = 80
const MAX_ZIP_ENTRY_BYTES = 2 * 1024 * 1024

export type ParsedDocumentResult =
  | { ok: true; text: string; truncated: boolean }
  | { ok: false; error: string }

const SUPPORTED_DOC_EXTS = new Set(['.pdf', '.docx', '.xlsx', '.xls'])

export function isSupportedDocumentFileName(fileName: string): boolean {
  const ext = path.extname(fileName.trim()).toLowerCase()
  return SUPPORTED_DOC_EXTS.has(ext)
}

function finalizeText(raw: string, emptyHint: string): ParsedDocumentResult {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim()
  if (!normalized) {
    return { ok: false, error: emptyHint }
  }
  if (normalized.length > MAX_PARSED_TEXT_CHARS) {
    return {
      ok: true,
      text: `${normalized.slice(0, MAX_PARSED_TEXT_CHARS)}\n\n[... 文档正文已截断，原文共 ${normalized.length} 字符 ...]`,
      truncated: true,
    }
  }
  return { ok: true, text: normalized, truncated: false }
}

export async function parseDocumentAttachment(fileName: string, buffer: Buffer): Promise<ParsedDocumentResult> {
  const safeName = typeof fileName === 'string' ? fileName.trim() : ''
  const ext = path.extname(safeName).toLowerCase()
  if (!SUPPORTED_DOC_EXTS.has(ext)) {
    return { ok: false, error: `暂不支持解析 ${ext || '该类型'} 文档` }
  }
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    return { ok: false, error: '文件内容为空' }
  }
  if (buffer.byteLength > MAX_DOCUMENT_ATTACHMENT_BYTES) {
    return { ok: false, error: '文档超过 10MB 限制' }
  }

  try {
    if (ext === '.pdf') {
      const { extractText } = await import('unpdf')
      const result = await extractText(new Uint8Array(buffer), { mergePages: true })
      const text = Array.isArray(result.text) ? result.text.join('\n\n') : String(result.text ?? '')
      return finalizeText(text, '该 PDF 未提取到可选中文字（可能是纯扫描图片型 PDF，可截图后作为图片发送）')
    }

    if (ext === '.docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return finalizeText(String(result.value ?? ''), '该 Word 文档中没有可提取的正文内容')
    }

    if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sections: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue
        const csv = XLSX.utils.sheet_to_csv(sheet).trim()
        if (csv) {
          sections.push(`### 工作表: ${sheetName}\n${csv}`)
        }
      }
      return finalizeText(sections.join('\n\n'), '该表格文档中没有可提取的单元格数据')
    }

    return { ok: false, error: '暂不支持解析该文档格式' }
  } catch {
    return { ok: false, error: `无法解析文档 ${path.basename(safeName)}，请确认文件未损坏且未加密` }
  }
}

/** 解析 Excel / CSV 为右侧工作区结构化多 Sheet 预览载荷（硬限制 500 行 × 50 列防 OOM）。 */
export async function parseSpreadsheetPreview(
  buffer: Buffer,
  fileName: string,
): Promise<{ ok: true; sheets: ProjectFilePreviewSheet[] } | { ok: false; error: string }> {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    return { ok: false, error: '表格文件为空' }
  }
  if (buffer.byteLength > MAX_DOCUMENT_ATTACHMENT_BYTES) {
    return { ok: false, error: '表格文件超过 10MB 预览上限，请用系统应用打开' }
  }
  try {
    const XLSX = await import('xlsx')
    const ext = path.extname(fileName).toLowerCase()
    const workbook = ext === '.csv'
      ? XLSX.read(buffer.toString('utf-8'), { type: 'string' })
      : XLSX.read(buffer, { type: 'buffer' })

    const sheets: ProjectFilePreviewSheet[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue
      const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: true,
        raw: false,
      })
      const totalRows = rawMatrix.length
      const totalCols = rawMatrix.reduce((max, r) => Math.max(max, Array.isArray(r) ? r.length : 0), 0)
      const truncatedRows = totalRows > MAX_PREVIEW_SHEET_ROWS
      const truncatedCols = totalCols > MAX_PREVIEW_SHEET_COLS
      const rows = rawMatrix.slice(0, MAX_PREVIEW_SHEET_ROWS).map((r) => {
        const arr = Array.isArray(r) ? r : []
        return arr.slice(0, MAX_PREVIEW_SHEET_COLS).map((cell) => String(cell ?? ''))
      })
      sheets.push({
        name: ext === '.csv' ? path.basename(fileName) : sheetName,
        rows,
        truncatedRows,
        truncatedCols,
        totalRows,
        totalCols,
      })
    }
    return { ok: true, sheets }
  } catch {
    return { ok: false, error: '无法解析表格文件，请确认文件未损坏且未加密' }
  }
}

/** 解析 .docx 为语义 HTML 预览（前端仍强制经 sanitizeDocxHtml 清洗）。 */
export async function parseDocxHtmlPreview(
  buffer: Buffer,
): Promise<{ ok: true; html: string; notices: string[] } | { ok: false; error: string }> {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    return { ok: false, error: 'Word 文档为空' }
  }
  if (buffer.byteLength > MAX_DOCUMENT_ATTACHMENT_BYTES) {
    return { ok: false, error: 'Word 文档超过 10MB 预览上限，请用系统应用打开' }
  }
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ buffer })
    const notices = ['语义富文本预览模式；如需校对原始分页排版，可点击右上角用系统应用打开。']
    return { ok: true, html: String(result.value ?? ''), notices }
  } catch {
    return { ok: false, error: '无法解析 Word 文档，请确认文件未损坏且未加密' }
  }
}

/** 解析 .pdf 为按页文字列表 + 受控原版 base64（供渲染层原版预览与按页批注）。 */
export async function parsePdfPreview(
  buffer: Buffer,
): Promise<{ ok: true; pages: ProjectFilePreviewPdfPage[]; pdfBase64: string } | { ok: false; error: string }> {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    return { ok: false, error: 'PDF 文件为空' }
  }
  if (buffer.byteLength > MAX_DOCUMENT_ATTACHMENT_BYTES) {
    return { ok: false, error: 'PDF 文件超过 10MB 预览上限，请用系统应用打开' }
  }
  try {
    const { extractText } = await import('unpdf')
    const result = await extractText(new Uint8Array(buffer), { mergePages: false })
    const rawPages = Array.isArray(result.text)
      ? result.text
      : [String(result.text ?? '')]
    const pages: ProjectFilePreviewPdfPage[] = rawPages.map((text, idx) => ({
      pageNumber: idx + 1,
      fallbackText: String(text ?? '').replace(/\u0000/g, '').trim(),
    }))
    return {
      ok: true,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, fallbackText: '' }],
      pdfBase64: buffer.toString('base64'),
    }
  } catch {
    return { ok: false, error: '无法解析 PDF 文档，请确认文件未损坏且未加密' }
  }
}

/** 轻量无依赖 ZIP 读取器：按中央目录定位并解压匹配路径的条目，限制单条目解压体积防 zip bomb。 */
function readZipEntries(buffer: Buffer, pathFilter: (entryName: string) => boolean): Map<string, string> {
  const results = new Map<string, string>()
  // 从末尾向前查找 End of Central Directory (0x06054b50)
  const minEocdOffset = Math.max(0, buffer.length - 65_557)
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= minEocdOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) return results

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16)
  let ptr = cdOffset

  for (let idx = 0; idx < totalEntries && ptr + 46 <= buffer.length; idx++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break
    const method = buffer.readUInt16LE(ptr + 10)
    const compressedSize = buffer.readUInt32LE(ptr + 20)
    const uncompressedSize = buffer.readUInt32LE(ptr + 24)
    const nameLen = buffer.readUInt16LE(ptr + 28)
    const extraLen = buffer.readUInt16LE(ptr + 30)
    const commentLen = buffer.readUInt16LE(ptr + 32)
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42)
    const entryName = buffer.toString('utf-8', ptr + 46, ptr + 46 + nameLen)
    ptr += 46 + nameLen + extraLen + commentLen

    if (!pathFilter(entryName)) continue
    if (uncompressedSize > MAX_ZIP_ENTRY_BYTES || compressedSize > MAX_ZIP_ENTRY_BYTES) continue
    if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buffer.length) continue

    const slice = buffer.subarray(dataStart, dataEnd)
    try {
      if (method === 0) {
        results.set(entryName, slice.toString('utf-8'))
      } else if (method === 8) {
        const inflated = zlib.inflateRawSync(slice, { maxOutputLength: MAX_ZIP_ENTRY_BYTES })
        results.set(entryName, inflated.toString('utf-8'))
      }
    } catch {
      // 跳过单个损坏条目，继续解析其余页面
    }
  }
  return results
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
}

function extractParagraphsFromSlideXml(xml: string): string[] {
  const paragraphs: string[] = []
  const pMatches = xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)
  for (const match of pMatches) {
    const runs = [...match[1].matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((m) => decodeXmlEntities(m[1]))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (runs) paragraphs.push(runs)
  }
  return paragraphs
}

/** 零依赖解析 .pptx 幻灯片标题、要点与演讲者备注（上限 80 页）。 */
export async function parsePptxPreview(
  buffer: Buffer,
): Promise<{ ok: true; slides: ProjectFilePreviewPptxSlide[] } | { ok: false; error: string }> {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    return { ok: false, error: 'PPT 文件为空' }
  }
  if (buffer.byteLength > MAX_DOCUMENT_ATTACHMENT_BYTES) {
    return { ok: false, error: 'PPT 文件超过 10MB 预览上限，请用系统应用打开' }
  }
  try {
    const entries = readZipEntries(
      buffer,
      (name) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/i.test(name),
    )
    const slideNumbers = [...entries.keys()]
      .map((name) => /^ppt\/slides\/slide(\d+)\.xml$/i.exec(name))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b)
      .slice(0, MAX_PREVIEW_PPTX_SLIDES)

    if (slideNumbers.length === 0) {
      return { ok: false, error: '该 PPTX 中没有可解析的幻灯片页面' }
    }

    const slides: ProjectFilePreviewPptxSlide[] = slideNumbers.map((num, idx) => {
      const slideXml = entries.get(`ppt/slides/slide${num}.xml`) ?? ''
      const notesXml = entries.get(`ppt/notesSlides/notesSlide${num}.xml`) ?? ''
      const paragraphs = extractParagraphsFromSlideXml(slideXml)
      const [first, ...rest] = paragraphs
      const notesParagraphs = extractParagraphsFromSlideXml(notesXml).filter((p) => !/^\d+$/.test(p))
      return {
        slideNumber: idx + 1,
        title: first || `第 ${idx + 1} 页`,
        bullets: rest,
        notes: notesParagraphs.length > 0 ? notesParagraphs.join('\n') : undefined,
      }
    })
    return { ok: true, slides }
  } catch {
    return { ok: false, error: '无法解析 PPTX 演示文稿，请确认文件未损坏且未加密' }
  }
}
