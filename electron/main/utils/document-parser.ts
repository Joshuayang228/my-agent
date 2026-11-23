/**
 * 办公文档附件纯文本提取器（PDF / DOCX / XLSX / XLS）。
 *
 * 背景：前端 File.text() 只能读取纯文本/代码文件，遇到 PDF/Word/Excel 会读成二进制乱码导致模型无法理解。
 * 设计意图：在 Electron 主进程集中调用成熟纯 JS 解析库（unpdf / mammoth / xlsx），限制体积与输出长度，
 *           保证跨平台零原生编译依赖、异常只暴露友好提示。
 * 关键约束：仅接受已知办公文档扩展名与有界字节数（<= 10MB）；绝不执行文档内宏或脚本。
 */

import path from 'node:path'

export const MAX_DOCUMENT_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_PARSED_TEXT_CHARS = 80_000

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
