/**
 * 背景：右侧工作区富文档预览（Excel / HTML / Word / PDF）需要将用户选中的具体位置与批注
 * 结构化回传到主对话输入框，同时保证 HTML 拾取消息与 Word 富文本输出满足安全边界。
 * 设计意图：将坐标换算、选区切片、批注格式化、HTML 拾取脚本注入与白名单清洗收敛为无副作用纯函数，
 * 既方便 P0 Playground 隔离验收与单元测试，也能在 P1 正式回流时零分叉复用。
 * 关键约束：HTML 拾取脚本必须依赖随机 channelToken 防止宿主页面伪造消息，且绝不要求 allow-same-origin；
 * Word HTML 清洗必须剥离脚本、内嵌框架与事件属性。
 */

export interface CellCoord {
  row: number
  col: number
}

export interface CellRange {
  start: CellCoord
  end: CellCoord
}

export interface NormalizedCellRange {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export interface SpreadsheetSheetData {
  name: string
  rows: string[][]
  truncatedRows?: boolean
  truncatedCols?: boolean
  totalRows?: number
  totalCols?: number
}

export interface HtmlPickedElement {
  tagName: string
  selector: string
  textSnippet: string
  htmlSnippet: string
  rect?: { width: number; height: number }
}

const PICKER_MESSAGE_TYPE = 'my-agent:html-element-pick'

/** 将 0 起始列下标转换为 Excel 列字母（0 -> A, 25 -> Z, 26 -> AA）。 */
export function columnIndexToLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) return 'A'
  let n = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

export function normalizeCellRange(range: CellRange): NormalizedCellRange {
  return {
    minRow: Math.min(range.start.row, range.end.row),
    maxRow: Math.max(range.start.row, range.end.row),
    minCol: Math.min(range.start.col, range.end.col),
    maxCol: Math.max(range.start.col, range.end.col),
  }
}

export function isCellInRange(row: number, col: number, range: CellRange | null): boolean {
  if (!range) return false
  const { minRow, maxRow, minCol, maxCol } = normalizeCellRange(range)
  return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
}

/** 生成标准 Excel 选区引用，例如 Sheet1!B2 或 Sheet1!B2:D5。 */
export function formatCellRange(sheetName: string, range: CellRange): string {
  const { minRow, maxRow, minCol, maxCol } = normalizeCellRange(range)
  const startRef = `${columnIndexToLetter(minCol)}${minRow + 1}`
  const endRef = `${columnIndexToLetter(maxCol)}${maxRow + 1}`
  const safeSheet = /[\s!:'"]/.test(sheetName)
    ? `'${sheetName.replace(/'/g, "''")}'`
    : sheetName
  return startRef === endRef ? `${safeSheet}!${startRef}` : `${safeSheet}!${startRef}:${endRef}`
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim()
}

/** 将选区单元格矩阵序列化为紧凑 Markdown 表格，避免超长上下文撑爆对话。 */
export function sliceRangeAsMarkdown(
  rows: string[][],
  range: CellRange,
  maxRows = 20,
  maxCols = 12,
): string {
  const { minRow, maxRow, minCol, maxCol } = normalizeCellRange(range)
  const rowCount = maxRow - minRow + 1
  const colCount = maxCol - minCol + 1
  const cappedRows = Math.min(rowCount, maxRows)
  const cappedCols = Math.min(colCount, maxCols)

  const headerCells = ['行/列']
  for (let c = 0; c < cappedCols; c++) {
    headerCells.push(columnIndexToLetter(minCol + c))
  }
  const lines = [
    `| ${headerCells.join(' | ')} |`,
    `| ${headerCells.map(() => '---').join(' | ')} |`,
  ]
  for (let r = 0; r < cappedRows; r++) {
    const rowIndex = minRow + r
    const rowData = rows[rowIndex] ?? []
    const cells = [String(rowIndex + 1)]
    for (let c = 0; c < cappedCols; c++) {
      cells.push(escapeMarkdownCell(String(rowData[minCol + c] ?? '')))
    }
    lines.push(`| ${cells.join(' | ')} |`)
  }
  if (rowCount > cappedRows || colCount > cappedCols) {
    lines.push(`> 选区共 ${rowCount} 行 × ${colCount} 列，预览已截断为前 ${cappedRows} 行 × ${cappedCols} 列。`)
  }
  return lines.join('\n')
}

export function formatSpreadsheetAnnotation(opts: {
  filePath: string
  sheetName: string
  range: CellRange
  rows: string[][]
  comment: string
}): string {
  const ref = formatCellRange(opts.sheetName, opts.range)
  const table = sliceRangeAsMarkdown(opts.rows, opts.range)
  const note = opts.comment.trim()
  return [
    `[表格批注] 文件：\`${opts.filePath}\` · 选区：\`${ref}\``,
    '',
    table,
    '',
    `批注说明：${note}`,
  ].join('\n')
}

export function formatHtmlElementAnnotation(opts: {
  filePath: string
  element: HtmlPickedElement
  comment: string
}): string {
  const note = opts.comment.trim()
  const lines = [
    `[HTML 元素批注] 文件：\`${opts.filePath}\` · 元素：\`${opts.element.selector}\`（\`<${opts.element.tagName}>\`）`,
  ]
  if (opts.element.textSnippet) {
    lines.push(`元素文本：${opts.element.textSnippet}`)
  }
  if (opts.element.htmlSnippet) {
    lines.push('', '```html', opts.element.htmlSnippet, '```')
  }
  lines.push('', `修改/批注说明：${note}`)
  return lines.join('\n')
}

export function formatDocxSelectionAnnotation(opts: {
  filePath: string
  selectedText: string
  comment: string
}): string {
  const excerpt = opts.selectedText.trim().slice(0, 600)
  const note = opts.comment.trim()
  return [
    `[文档批注] 文件：\`${opts.filePath}\``,
    ...(excerpt ? ['', `> ${excerpt.replace(/\r?\n/g, '\n> ')}`] : []),
    '',
    `批注说明：${note}`,
  ].join('\n')
}

export function formatPdfPageAnnotation(opts: {
  filePath: string
  pageNumber: number
  totalPages: number
  comment: string
}): string {
  const note = opts.comment.trim()
  return [
    `[PDF 批注] 文件：\`${opts.filePath}\` · 第 ${opts.pageNumber} / ${opts.totalPages} 页`,
    '',
    `批注说明：${note}`,
  ].join('\n')
}

/**
 * 为沙箱 iframe 注入轻量元素拾取脚本。
 * 仅在 pickerActive=true 时注入；保持 sandbox="allow-scripts" 且不放开 allow-same-origin。
 */
export function buildHtmlPickerSrcDoc(
  sourceHtml: string,
  pickerActive: boolean,
  channelToken: string,
): string {
  if (!pickerActive) return sourceHtml
  const tokenJson = JSON.stringify(channelToken)
  const typeJson = JSON.stringify(PICKER_MESSAGE_TYPE)
  const script = `<style id="__ma_pick_style">
.__ma_pick_hover { outline: 2px solid #2563eb !important; outline-offset: 1px !important; cursor: crosshair !important; }
.__ma_pick_selected { outline: 2px solid #d97706 !important; outline-offset: 2px !important; }
#__ma_pick_tip { position: fixed; z-index: 2147483647; pointer-events: none; padding: 2px 6px; border-radius: 4px; font: 11px/1.4 ui-monospace, monospace; background: rgba(15,23,42,0.92); color: #f8fafc; white-space: nowrap; display: none; }
</style>
<script>(function(){
  var TOKEN = ${tokenJson};
  var TYPE = ${typeJson};
  var hovered = null;
  var selected = null;
  var tip = document.createElement('div');
  tip.id = '__ma_pick_tip';
  function ensureTip(){ if (!tip.parentNode && document.body) document.body.appendChild(tip); }
  function buildSelector(el){
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + el.id;
    var parts = [];
    var cur = el;
    for (var depth = 0; cur && cur.nodeType === 1 && depth < 4; depth++) {
      var tag = cur.tagName.toLowerCase();
      if (tag === 'html' || tag === 'body') { parts.unshift(tag); break; }
      var cls = (typeof cur.className === 'string' ? cur.className : '')
        .split(/\\s+/).filter(function(c){ return c && c.indexOf('__ma_pick_') !== 0; }).slice(0, 2);
      var seg = tag + (cls.length ? '.' + cls.join('.') : '');
      if (cur.parentElement) {
        var siblings = Array.prototype.filter.call(cur.parentElement.children, function(s){ return s.tagName === cur.tagName; });
        if (siblings.length > 1) {
          seg += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
        }
      }
      parts.unshift(seg);
      if (cur.id) { parts[0] = '#' + cur.id; break; }
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  function clearHover(){ if (hovered) { hovered.classList.remove('__ma_pick_hover'); hovered = null; } tip.style.display = 'none'; }
  document.addEventListener('mousemove', function(e){
    var target = e.target;
    if (!target || target === tip || target === document.documentElement || target === document.body) { clearHover(); return; }
    if (hovered !== target) {
      if (hovered) hovered.classList.remove('__ma_pick_hover');
      hovered = target;
      hovered.classList.add('__ma_pick_hover');
    }
    ensureTip();
    tip.textContent = buildSelector(target);
    tip.style.display = 'block';
    tip.style.left = Math.min(window.innerWidth - 160, Math.max(6, e.clientX + 10)) + 'px';
    tip.style.top = Math.min(window.innerHeight - 28, Math.max(6, e.clientY + 12)) + 'px';
  }, true);
  document.addEventListener('mouseleave', clearHover, true);
  document.addEventListener('click', function(e){
    var target = e.target;
    if (!target || target === tip || target === document.documentElement || target === document.body) return;
    e.preventDefault();
    e.stopPropagation();
    if (selected) selected.classList.remove('__ma_pick_selected');
    selected = target;
    target.classList.remove('__ma_pick_hover');
    target.classList.add('__ma_pick_selected');
    var rect = target.getBoundingClientRect();
    var clone = target.cloneNode(true);
    if (clone && clone.classList) { clone.classList.remove('__ma_pick_hover', '__ma_pick_selected'); }
    var text = (target.innerText || target.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 160);
    var html = (clone && clone.outerHTML ? clone.outerHTML : '').replace(/\\s+/g, ' ').trim().slice(0, 400);
    window.parent.postMessage({
      type: TYPE,
      token: TOKEN,
      payload: {
        tagName: target.tagName.toLowerCase(),
        selector: buildSelector(target),
        textSnippet: text,
        htmlSnippet: html,
        rect: { width: Math.round(rect.width), height: Math.round(rect.height) }
      }
    }, '*');
  }, true);
})();</script>`

  if (/<\/body>/i.test(sourceHtml)) {
    return sourceHtml.replace(/<\/body>/i, `${script}</body>`)
  }
  if (/<\/html>/i.test(sourceHtml)) {
    return sourceHtml.replace(/<\/html>/i, `${script}</html>`)
  }
  return `${sourceHtml}\n${script}`
}

/** 白名单解析来自 HTML 沙箱 iframe 的元素拾取消息，防伪造和超长字段注入。 */
export function parseHtmlPickerMessage(
  data: unknown,
  expectedToken: string,
): HtmlPickedElement | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.type !== PICKER_MESSAGE_TYPE || record.token !== expectedToken) return null
  const payload = record.payload as Record<string, unknown> | undefined
  if (!payload || typeof payload !== 'object') return null
  const tagName = typeof payload.tagName === 'string' ? payload.tagName.trim().slice(0, 32) : ''
  const selector = typeof payload.selector === 'string' ? payload.selector.trim().slice(0, 240) : ''
  if (!tagName || !selector) return null
  const textSnippet = typeof payload.textSnippet === 'string' ? payload.textSnippet.trim().slice(0, 200) : ''
  const htmlSnippet = typeof payload.htmlSnippet === 'string' ? payload.htmlSnippet.trim().slice(0, 500) : ''
  const rawRect = payload.rect as Record<string, unknown> | undefined
  const rect = rawRect && typeof rawRect.width === 'number' && typeof rawRect.height === 'number'
    ? { width: Math.max(0, Math.round(rawRect.width)), height: Math.max(0, Math.round(rawRect.height)) }
    : undefined
  return { tagName, selector, textSnippet, htmlSnippet, rect }
}

/**
 * 清洗 Word 转换产出的 HTML，剥离危险标签、内联事件和 javascript: 协议，
 * 防止恶意文档在预览渲染层执行脚本。
 */
export function sanitizeDocxHtml(rawHtml: string): string {
  if (!rawHtml) return ''
  let clean = rawHtml
    .replace(/<(script|iframe|object|embed|style|link|meta|base|form)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed|style|link|meta|base|input|button)\b[^>]*\/?>/gi, '')
    // 移除所有 on* 事件属性（含双引号、单引号与无引号）
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // 阻断 href/src 中的 javascript: 或 vbscript: 或非安全 data:
    .replace(
      /\b(href|src)\s*=\s*(?:"\s*(?:javascript|vbscript):[^"]*"|'\s*(?:javascript|vbscript):[^']*')/gi,
      '$1="#"',
    )
  // 禁止 data:text/html 等非图片 data URI
  clean = clean.replace(
    /\bsrc\s*=\s*(?:"\s*data:(?!image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,)[^"]*"|'\s*data:(?!image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,)[^']*')/gi,
    'src=""',
  )
  return clean
}
