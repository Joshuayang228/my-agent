import { useEffect, useMemo, useState } from 'react'
import { Table2 } from 'lucide-react'
import { Badge } from '../../foundation/Badge'
import { SegmentedControl } from '../../foundation/SegmentedControl'
import { AnnotationBar } from './AnnotationBar'
import {
  columnIndexToLetter,
  formatCellRange,
  formatSpreadsheetAnnotation,
  isCellInRange,
  normalizeCellRange,
  type CellRange,
  type SpreadsheetSheetData,
} from './annotation-format'

interface SpreadsheetPreviewProps {
  filePath: string
  sheets: SpreadsheetSheetData[]
  onSendToChat?: (text: string) => void
}

/**
 * 背景：用户需要在右侧工作区直接查看 Excel/CSV 内容并框选具体单元格区域向 AI 提问或下达修改指令。
 * 设计意图：展示标准 A/B/C 列标与 1/2/3 行号，支持多 Sheet 切换、单击单格、拖拽框选矩形区域以及 Shift+Click 扩展选区；
 * 选中后通过底部 AnnotationBar 将坐标与 Markdown 切片结构化发送到对话。
 * 关键约束：拖拽态在 window mouseup 自动收口，避免拖出表外后锁死选区；大表截断状态必须显式提示用户。
 */
export function SpreadsheetPreview({ filePath, sheets, onSendToChat }: SpreadsheetPreviewProps) {
  const [sheetIndex, setSheetIndex] = useState(0)
  const [range, setRange] = useState<CellRange | null>(null)
  const [dragging, setDragging] = useState(false)

  const activeSheet = sheets[sheetIndex] ?? sheets[0] ?? null

  useEffect(() => {
    setSheetIndex(0)
    setRange(null)
    setDragging(false)
  }, [filePath, sheets])

  useEffect(() => {
    if (!dragging) return
    const stop = () => setDragging(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [dragging])

  const colCount = useMemo(() => {
    if (!activeSheet) return 0
    return activeSheet.rows.reduce((max, row) => Math.max(max, row.length), 0)
  }, [activeSheet])

  const anchorLabel = activeSheet && range ? formatCellRange(activeSheet.name, range) : null
  const excerpt = useMemo(() => {
    if (!activeSheet || !range) return undefined
    const { minRow, maxRow, minCol, maxCol } = normalizeCellRange(range)
    const rCount = maxRow - minRow + 1
    const cCount = maxCol - minCol + 1
    const firstVal = activeSheet.rows[minRow]?.[minCol] ?? ''
    if (rCount === 1 && cCount === 1) {
      return firstVal ? `值：${firstVal}` : '空单元格'
    }
    return `已选 ${rCount} 行 × ${cCount} 列`
  }, [activeSheet, range])

  if (!activeSheet || activeSheet.rows.length === 0 || colCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center" data-testid="spreadsheet-preview-empty">
        <Table2 size={20} style={{ color: 'var(--text-muted)' }} />
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>当前工作表为空，没有可展示的单元格。</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="spreadsheet-preview">
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        {sheets.length > 1 ? (
          <SegmentedControl
            ariaLabel="工作表切换"
            value={String(sheetIndex)}
            onChange={(id) => {
              setSheetIndex(Number(id))
              setRange(null)
              setDragging(false)
            }}
            items={sheets.map((sheet, idx) => ({ id: String(idx), label: sheet.name }))}
          />
        ) : (
          <Badge>{activeSheet.name}</Badge>
        )}
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {activeSheet.rows.length} 行 × {colCount} 列
        </span>
        {(activeSheet.truncatedRows || activeSheet.truncatedCols) && (
          <span className="ml-auto text-[10px]" style={{ color: 'var(--warning, var(--text-muted))' }}>
            已按预览上限截断（原表 {activeSheet.totalRows ?? '?'} 行 × {activeSheet.totalCols ?? '?'} 列）
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto select-none" style={{ background: 'var(--bg-primary)' }}>
        <table className="w-max min-w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th
                className="sticky top-0 left-0 z-20 w-9 border-r border-b px-1.5 py-1 text-center font-mono text-[10px]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                }}
              >
                #
              </th>
              {Array.from({ length: colCount }, (_, colIdx) => (
                <th
                  key={colIdx}
                  className="sticky top-0 z-10 min-w-[78px] border-r border-b px-2 py-1 text-center font-mono text-[10px] font-medium"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {columnIndexToLetter(colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeSheet.rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td
                  className="sticky left-0 z-10 border-r border-b px-1.5 py-1 text-center font-mono text-[10px]"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {rowIdx + 1}
                </td>
                {Array.from({ length: colCount }, (_, colIdx) => {
                  const selected = isCellInRange(rowIdx, colIdx, range)
                  const value = row[colIdx] ?? ''
                  return (
                    <td
                      key={colIdx}
                      data-cell={`${columnIndexToLetter(colIdx)}${rowIdx + 1}`}
                      data-selected={selected ? 'true' : undefined}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return
                        if (event.shiftKey && range) {
                          setRange({ start: range.start, end: { row: rowIdx, col: colIdx } })
                        } else {
                          setRange({ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } })
                          setDragging(true)
                        }
                      }}
                      onMouseEnter={() => {
                        if (!dragging) return
                        setRange((prev) => prev ? { start: prev.start, end: { row: rowIdx, col: colIdx } } : null)
                      }}
                      className="max-w-[220px] cursor-cell truncate border-r border-b px-2 py-1 transition-colors"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: selected ? 'var(--accent-subtle)' : undefined,
                        color: selected ? 'var(--accent-fg)' : 'var(--text-primary)',
                        outline: selected ? '1px solid var(--accent-fg)' : undefined,
                        outlineOffset: '-1px',
                      }}
                      title={value}
                    >
                      {value}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onSendToChat && (
        <AnnotationBar
          testId="spreadsheet-annotation-bar"
          anchorLabel={anchorLabel}
          excerpt={excerpt}
          emptyHint="点击单元格或拖拽框选区域（支持 Shift 扩选），即可针对该区域写批注发送到对话"
          placeholder="例如：帮我核对这几行公式或异常值…"
          onClearAnchor={() => setRange(null)}
          onSubmit={(comment) => {
            if (!range) return
            onSendToChat(formatSpreadsheetAnnotation({
              filePath,
              sheetName: activeSheet.name,
              range,
              rows: activeSheet.rows,
              comment,
            }))
          }}
        />
      )}
    </div>
  )
}
