import { describe, expect, it } from 'vitest'
import {
  buildHtmlPickerSrcDoc,
  columnIndexToLetter,
  formatCellRange,
  formatDocxSelectionAnnotation,
  formatHtmlElementAnnotation,
  formatPdfPageAnnotation,
  formatSpreadsheetAnnotation,
  isCellInRange,
  parseHtmlPickerMessage,
  sanitizeDocxHtml,
  sliceRangeAsMarkdown,
} from '../../src/components/playground/workspace-preview/annotation-format'

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
  })
})
