import { describe, expect, it } from 'vitest'
import { parseSpreadsheetPreview } from '../../electron/main/utils/document-parser'
import { joinYamlFrontmatter, splitYamlFrontmatter } from '../../src/components/chat/right-dock/preview/markdown-frontmatter'
import {
  buildHtmlPickerSrcDoc,
  columnIndexToLetter,
  formatAnnotationQueueForChat,
  formatCellRange,
  formatDocxSelectionAnnotation,
  formatHtmlElementAnnotation,
  formatPdfPageAnnotation,
  formatPptxSlideAnnotation,
  formatSpreadsheetAnnotation,
  isCellInRange,
  parseHtmlPickerMessage,
  sanitizeDocxHtml,
  sliceRangeAsMarkdown,
} from '../../src/components/chat/right-dock/preview/annotation-format'

describe('workspace rich preview & annotation formatters', () => {
  it('converts 0-based column index to Excel letters', () => {
    expect(columnIndexToLetter(0)).toBe('A')
    expect(columnIndexToLetter(25)).toBe('Z')
    expect(columnIndexToLetter(26)).toBe('AA')
    expect(columnIndexToLetter(27)).toBe('AB')
    expect(columnIndexToLetter(-1)).toBe('A')
  })

  it('formats single-cell and rectangular cell ranges and slices markdown table', () => {
    const single = { start: { row: 1, col: 2 }, end: { row: 1, col: 2 } }
    expect(formatCellRange('Q4预算', single)).toBe('Q4预算!C2')

    // 反向拖拽（从右下到左上）也应自动规范化
    const rect = { start: { row: 2, col: 2 }, end: { row: 0, col: 1 } }
    expect(formatCellRange('Sheet 1', rect)).toBe("'Sheet 1'!B1:C3")
    expect(isCellInRange(1, 1, rect)).toBe(true)
    expect(isCellInRange(1, 0, rect)).toBe(false)

    const rows = [
      ['部门', '预算', '实际'],
      ['研发', '120', '115'],
      ['设计', '45', '52'],
    ]
    const md = sliceRangeAsMarkdown(rows, rect)
    expect(md).toContain('| 行/列 | B | C |')
    expect(md).toContain('| 1 | 预算 | 实际 |')
    expect(md).toContain('| 3 | 45 | 52 |')

    const formatted = formatSpreadsheetAnnotation({
      filePath: 'reports/q4-budget.xlsx',
      sheetName: '预算明细',
      range: rect,
      rows,
      comment: '核对设计部超支原因',
    })
    expect(formatted).toContain('[表格批注]')
    expect(formatted).toContain('预算明细!B1:C3')
    expect(formatted).toContain('核对设计部超支原因')
  })

  it('injects HTML picker script only when active and validates postMessage token', () => {
    const html = '<html><body><button id="cta" class="primary">立即体验</button></body></html>'
    expect(buildHtmlPickerSrcDoc(html, false, 'tok-1')).toBe(html)

    const injected = buildHtmlPickerSrcDoc(html, true, 'tok-1')
    expect(injected).toContain('__ma_pick_hover')
    expect(injected).toContain('tok-1')

    // token 不匹配应被拦截
    expect(parseHtmlPickerMessage({
      type: 'my-agent:html-element-pick',
      token: 'wrong-token',
      payload: { tagName: 'button', selector: '#cta' },
    }, 'tok-1')).toBeNull()

    // 合法消息解析并格式化
    const picked = parseHtmlPickerMessage({
      type: 'my-agent:html-element-pick',
      token: 'tok-1',
      payload: {
        tagName: 'button',
        selector: '#cta',
        textSnippet: '立即体验',
        htmlSnippet: '<button id="cta" class="primary">立即体验</button>',
        rect: { width: 120, height: 36 },
      },
    }, 'tok-1')
    expect(picked).not.toBeNull()
    const msg = formatHtmlElementAnnotation({
      filePath: 'landing.html',
      element: picked!,
      comment: '把按钮改成次要描边样式',
    })
    expect(msg).toContain('[HTML 元素批注]')
    expect(msg).toContain('#cta')
    expect(msg).toContain('把按钮改成次要描边样式')
  })

  it('sanitizes dangerous tags, event handlers, and javascript URLs from docx HTML', () => {
    const dirty = [
      '<h1 onclick="alert(1)">方案标题</h1>',
      '<script>window.evil=1</script>',
      '<iframe src="https://evil.test"></iframe>',
      '<p><a href="javascript:alert(2)">点我</a></p>',
      '<img src="data:text/html;base64,PHNjcmlwdD4=" onerror="alert(3)" />',
      '<img src="data:image/png;base64,AAAA" alt="ok" />',
    ].join('')
    const clean = sanitizeDocxHtml(dirty)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('<iframe')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('data:text/html')
    expect(clean).toContain('<h1>方案标题</h1>')
    expect(clean).toContain('data:image/png;base64,AAAA')
  })

  it('formats docx selection and pdf page annotations', () => {
    const docxMsg = formatDocxSelectionAnnotation({
      filePath: 'docs/spec.docx',
      selectedText: '本项目将在 Q4 完成一期上线',
      comment: '改成 Q1 里程碑',
    })
    expect(docxMsg).toContain('[文档批注]')
    expect(docxMsg).toContain('> 本项目将在 Q4 完成一期上线')
    expect(docxMsg).toContain('改成 Q1 里程碑')

    const pdfMsg = formatPdfPageAnnotation({
      filePath: 'docs/report.pdf',
      pageNumber: 2,
      totalPages: 5,
      comment: '提炼这一页的三个核心指标',
    })
    expect(pdfMsg).toContain('[PDF 批注]')
    expect(pdfMsg).toContain('第 2 / 5 页')
    expect(pdfMsg).toContain('提炼这一页的三个核心指标')

    const pdfSelectionMsg = formatPdfPageAnnotation({
      filePath: 'docs/report.pdf',
      pageNumber: 2,
      totalPages: 5,
      selectedText: '核心转化率同比提升 18.4%',
      comment: '核对这个同比口径',
    })
    expect(pdfSelectionMsg).toContain('> 核心转化率同比提升 18.4%')
    expect(pdfSelectionMsg).toContain('核对这个同比口径')

    const pptxMsg = formatPptxSlideAnnotation({
      filePath: 'decks/roadmap.pptx',
      slideNumber: 2,
      totalSlides: 3,
      slideTitle: 'Batch A 规划',
      comment: '补充一行风险说明',
    })
    expect(pptxMsg).toContain('[幻灯片批注]')
    expect(pptxMsg).toContain('第 2 / 3 页（Batch A 规划）')
    expect(pptxMsg).toContain('补充一行风险说明')
  })

  it('merges multiple queued annotations into a numbered summary', () => {
    expect(formatAnnotationQueueForChat([])).toBe('')
    const single = [{
      id: '1',
      filePath: 'a.xlsx',
      anchorLabel: 'Sheet1!B2',
      comment: '核对数值',
      formattedText: '[表格批注] 文件：`a.xlsx` · 选区：`Sheet1!B2`',
      createdAt: 1,
    }]
    expect(formatAnnotationQueueForChat(single)).toBe(single[0].formattedText)

    const merged = formatAnnotationQueueForChat([
      single[0],
      {
        id: '2',
        filePath: 'b.html',
        anchorLabel: '#cta',
        comment: '改色',
        formattedText: '[HTML 元素批注] 文件：`b.html` · 元素：`#cta`',
        createdAt: 2,
      },
    ])
    expect(merged).toContain('请依次处理以下 2 条工作区批注：')
    expect(merged).toContain('### 批注 1')
    expect(merged).toContain('### 批注 2')
    expect(merged).toContain('#cta')
  })

  it('parses xlsx merges, column widths, styles, and formula protection via exceljs', async () => {
    const mod = await import('exceljs')
    const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('预算汇总')
    ws.getColumn(1).width = 20
    ws.getCell('A1').value = '2026 季度预算'
    ws.getCell('A1').font = { bold: true }
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } }
    ws.getCell('A1').alignment = { horizontal: 'center' }
    ws.mergeCells('A1:B1')
    ws.getCell('A2').value = '研发'
    ws.getCell('B2').value = 120
    ws.getCell('A3').value = '合计'
    ws.getCell('B3').value = { formula: 'SUM(B2:B2)', result: 120 }

    const raw = await wb.xlsx.writeBuffer()
    const parsed = await parseSpreadsheetPreview(Buffer.from(raw as ArrayBuffer), 'budget.xlsx')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.sheets).toHaveLength(1)
    const sheet = parsed.sheets[0]
    expect(sheet.name).toBe('预算汇总')
    expect(sheet.editable).toBe(true)
    expect(sheet.merges).toEqual([{ startRow: 0, startCol: 0, endRow: 0, endCol: 1 }])
    expect(sheet.colWidths?.[0]).toBeGreaterThan(100)
    expect(sheet.cellStyles?.['0:0']?.bold).toBe(true)
    expect(sheet.cellStyles?.['0:0']?.bgColor).toBe('#E2F0D9')
    expect(sheet.cellStyles?.['0:0']?.align).toBe('center')
    expect(sheet.cellStyles?.['2:1']?.isFormula).toBe(true)
    expect(sheet.cellStyles?.['2:1']?.formula).toBe('=SUM(B2:B2)')
  }, 20_000)

  it('preserves YAML frontmatter cleanly across split and join round-trips', () => {
    const doc = [
      '---',
      'title: 产品方案',
      'tags: [workspace, markdown]',
      '---',
      '',
      '# 正文标题',
      '',
      '---',
      '',
      '正文分割线不应被误判为 frontmatter。',
    ].join('\n')

    const split = splitYamlFrontmatter(doc)
    expect(split.frontmatter).toBe('---\ntitle: 产品方案\ntags: [workspace, markdown]\n---\n')
    expect(split.body.trimStart().startsWith('# 正文标题')).toBe(true)
    expect(split.body).toContain('正文分割线不应被误判为 frontmatter。')

    const rejoined = joinYamlFrontmatter(split.frontmatter, '# 正文标题（已修改）\n')
    expect(rejoined.startsWith('---\ntitle: 产品方案\n')).toBe(true)
    expect(rejoined).toContain('# 正文标题（已修改）')

    const plain = '# 没有 Frontmatter\n\n---\n\n内容'
    expect(splitYamlFrontmatter(plain)).toEqual({ frontmatter: '', body: plain })
    expect(joinYamlFrontmatter('', plain)).toBe(plain)
  })
})
