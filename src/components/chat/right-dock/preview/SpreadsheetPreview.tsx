import { useEffect, useMemo, useState } from 'react'
import { Save, Table2, X } from 'lucide-react'
import { Badge } from '../../../foundation/Badge'
import { EmptyState } from '../../../foundation/EmptyState'
import { ActionButton } from '../../../foundation/ActionButton'
import { SegmentedControl } from '../../../foundation/SegmentedControl'
import { AnnotationBar } from './AnnotationBar'
import {
  columnIndexToLetter,
  formatCellRange,
  formatSpreadsheetAnnotation,
  isCellInRange,
  normalizeCellRange,
  type AnnotationQueueItem,
  type CellRange,
  type SpreadsheetSheetData,
} from './annotation-format'
import type { SpreadsheetCellEditInput } from '../../../../shared/types'

interface SpreadsheetPreviewProps {
  filePath: string
  sheets: SpreadsheetSheetData[]
  mtimeMs?: number
  onDirtyChange?: (dirty: boolean) => void
  onSendToChat?: (text: string) => void
  onQueueAnnotation?: (item: Omit<AnnotationQueueItem, 'id' | 'createdAt'>) => void
}

function isNumericCell(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^[+-]?\d[\d,]*(?:\.\d+)?%?$/.test(trimmed)
}

/**
 * 背景：用户需要在右侧工作区直接查看 Excel/CSV 内容并框选具体单元格区域向 AI 提问或下达修改指令。
 * 设计意图：展示 A/B/C 列标与 1/2/3 行号、表头与轻斑马纹、数字右对齐、外围统一矩形选区描边以及双态渐进批注条。
 * 关键约束：拖拽态在 window mouseup 自动收口，避免拖出表外后锁死选区；大表截断状态与空表分别用清晰状态呈现。
 */
export function SpreadsheetPreview({ filePath, sheets, mtimeMs, onDirtyChange, onSendToChat, onQueueAnnotation }: SpreadsheetPreviewProps) {
  const [sheetIndex, setSheetIndex] = useState(0)
  const [range, setRange] = useState<CellRange | null>(null)
  const [dragging, setDragging] = useState(false)
  const [localSheets, setLocalSheets] = useState(sheets)
  const [editing, setEditing] = useState<{ row: number; col: number; value: string } | null>(null)
  const [edits, setEdits] = useState<SpreadsheetCellEditInput[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const activeSheet = localSheets[sheetIndex] ?? localSheets[0] ?? null

  useEffect(() => {
    setLocalSheets(sheets)
    setSheetIndex(0)
    setRange(null)
    setDragging(false)
    setEditing(null)
    setEdits([])
    setSaveError(null)
    onDirtyChange?.(false)
  }, [filePath, sheets])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && edits.length > 0) {
        event.preventDefault()
        void saveEdits()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const saveEdits = async () => {
    if (!edits.length || saving || !activeSheet) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await window.electronAPI?.project.saveSpreadsheetCells({ filePath, expectedMtimeMs: mtimeMs, edits })
      if (!result || !result.ok) {
        setSaveError(result?.error || '保存失败，请重试')
        return
      }
      setLocalSheets(result.sheets)
      setEdits([])
      setEditing(null)
      onDirtyChange?.(false)
    } catch {
      setSaveError('文件保存失败，可能正被其他应用占用')
    } finally {
      setSaving(false)
    }
  }

  const commitCell = (row: number, col: number, value: string) => {
    if (!activeSheet || !activeSheet.editable) return
    const style = activeSheet.cellStyles?.[`${row}:${col}`]
    if (style?.isFormula) return
    setLocalSheets((current) => current.map((sheet, idx) => {
      if (idx !== sheetIndex) return sheet
      const nextRows = sheet.rows.map((line) => [...line])
      while (nextRows.length <= row) nextRows.push([])
      while (nextRows[row].length <= col) nextRows[row].push('')
      nextRows[row][col] = value
      return { ...sheet, rows: nextRows }
    }))
    setEdits((current) => {
      const next = current.filter((item) => !(item.sheetIndex === sheetIndex && item.row === row && item.col === col))
      return [...next, { sheetIndex, sheetName: activeSheet.name, row, col, value }]
    })
    onDirtyChange?.(true)
    setEditing(null)
  }

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

  const bounds = useMemo(() => (range ? normalizeCellRange(range) : null), [range])
  const anchorLabel = activeSheet && range ? formatCellRange(activeSheet.name, range) : null
  const excerpt = useMemo(() => {
    if (!activeSheet || !bounds) return undefined
    const rCount = bounds.maxRow - bounds.minRow + 1
    const cCount = bounds.maxCol - bounds.minCol + 1
    const firstVal = activeSheet.rows[bounds.minRow]?.[bounds.minCol] ?? ''
    if (rCount === 1 && cCount === 1) {
      return firstVal ? `值：${firstVal}` : '空单元格'
    }
    return `已选 ${rCount} 行 × ${cCount} 列`
  }, [activeSheet, bounds])

  if (!activeSheet || activeSheet.rows.length === 0 || colCount === 0) {
    return (
      <div className="workspace-surface-stage flex h-full flex-col" data-testid="spreadsheet-preview-empty">
        <EmptyState
          variant="minimal"
          icon={<Table2 size={18} />}
          title="工作表为空"
          description="当前工作表没有可展示的单元格。"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="spreadsheet-preview">
      <div className="workspace-subtoolbar flex shrink-0 select-none items-center gap-2 border-b px-3">
        {localSheets.length > 1 ? (
          <SegmentedControl
            ariaLabel="工作表切换"
            value={String(sheetIndex)}
            onChange={(id) => {
              setSheetIndex(Number(id))
              setRange(null)
              setDragging(false)
            }}
            items={localSheets.map((sheet, idx) => ({ id: String(idx), label: sheet.name }))}
          />
        ) : (
          <Badge>{activeSheet.name}</Badge>
        )}
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {activeSheet.rows.length} 行 × {colCount} 列
        </span>
        {activeSheet.editable && edits.length > 0 && (
          <span className="text-[10px]" style={{ color: 'var(--warning)' }}>未保存 {edits.length} 项</span>
        )}
        {activeSheet.editable && (
          <ActionButton size="sm" tone="accent" disabled={saving || edits.length === 0} onClick={() => void saveEdits()}>
            <Save size={12} /> {saving ? '保存中…' : '保存'}
          </ActionButton>
        )}
        {(activeSheet.truncatedRows || activeSheet.truncatedCols) && (
          <span className="ml-auto truncate text-[10px]" style={{ color: 'var(--warning, var(--text-muted))' }}>
            已截断预览（原表 {activeSheet.totalRows ?? '?'} × {activeSheet.totalCols ?? '?'}）
          </span>
        )}
      </div>

      <div className="workspace-surface-stage min-h-0 flex-1 overflow-auto p-3">
        <div className="workspace-surface-paper overflow-auto rounded-[var(--radius-md)] border select-none">
          <table className="w-max min-w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                <th
                  className="sticky top-0 left-0 z-20 w-9 border-r border-b px-1.5 py-1.5 text-center font-mono text-[10px]"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'color-mix(in srgb, var(--bg-secondary) 72%, var(--card-bg))',
                    color: 'var(--text-muted)',
                  }}
                >
                  #
                </th>
                {Array.from({ length: colCount }, (_, colIdx) => (
                  <th
                    key={colIdx}
                    className="sticky top-0 z-10 min-w-[82px] border-r border-b px-2.5 py-1.5 text-center font-mono text-[10px] font-medium last:border-r-0"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'color-mix(in srgb, var(--bg-secondary) 72%, var(--card-bg))',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {columnIndexToLetter(colIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.rows.map((row, rowIdx) => {
                const isHeaderRow = rowIdx === 0
                const isEvenData = rowIdx > 0 && rowIdx % 2 === 0
                return (
                  <tr key={rowIdx} className="transition-colors hover:bg-[var(--hover-overlay)]">
                    <td
                      className="sticky left-0 z-10 border-r border-b px-1.5 py-1.5 text-center font-mono text-[10px] tabular-nums"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'color-mix(in srgb, var(--bg-secondary) 72%, var(--card-bg))',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {rowIdx + 1}
                    </td>
                    {Array.from({ length: colCount }, (_, colIdx) => {
                      const selected = isCellInRange(rowIdx, colIdx, range)
                      const value = row[colIdx] ?? ''
                      const formula = activeSheet.cellStyles?.[`${rowIdx}:${colIdx}`]?.isFormula
                      const isEditing = editing?.row === rowIdx && editing.col === colIdx
                      const numeric = !isHeaderRow && isNumericCell(value)
                      const shadows: string[] = []
                      if (selected && bounds) {
                        if (rowIdx === bounds.minRow) shadows.push('inset 0 1.5px 0 0 var(--accent)')
                        if (rowIdx === bounds.maxRow) shadows.push('inset 0 -1.5px 0 0 var(--accent)')
                        if (colIdx === bounds.minCol) shadows.push('inset 1.5px 0 0 0 var(--accent)')
                        if (colIdx === bounds.maxCol) shadows.push('inset -1.5px 0 0 0 var(--accent)')
                      }
                      const rowBg = isHeaderRow
                        ? 'color-mix(in srgb, var(--bg-secondary) 46%, var(--card-bg))'
                        : isEvenData
                          ? 'color-mix(in srgb, var(--bg-secondary) 22%, var(--card-bg))'
                          : undefined
                      return (
                        <td
                          key={colIdx}
                          data-cell={`${columnIndexToLetter(colIdx)}${rowIdx + 1}`}
                          data-selected={selected ? 'true' : undefined}
                          onDoubleClick={() => {
                            if (activeSheet.editable && !formula) setEditing({ row: rowIdx, col: colIdx, value })
                          }}
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
                          className={`max-w-[220px] cursor-cell truncate border-r border-b px-2.5 py-1.5 transition-colors last:border-r-0 ${isHeaderRow ? 'font-medium' : ''} ${numeric ? 'text-right font-mono tabular-nums' : ''}`}
                          style={{
                            borderColor: 'color-mix(in srgb, var(--border-subtle) 85%, transparent)',
                            background: selected ? 'color-mix(in srgb, var(--accent) 12%, var(--card-bg))' : rowBg,
                            color: selected ? 'var(--accent-fg)' : 'var(--text-primary)',
                            boxShadow: shadows.length > 0 ? shadows.join(', ') : undefined,
                          }}
                          title={formula ? `公式：${activeSheet.cellStyles?.[`${rowIdx}:${colIdx}`]?.formula || ''}` : value}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editing.value}
                              className="w-full min-w-[70px] bg-transparent outline-none"
                              onChange={(event) => setEditing((current) => current ? { ...current, value: event.target.value } : current)}
                              onBlur={() => commitCell(rowIdx, colIdx, editing.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') commitCell(rowIdx, colIdx, editing.value)
                                if (event.key === 'Escape') setEditing(null)
                              }}
                            />
                          ) : value}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(onSendToChat || onQueueAnnotation) && (
        <AnnotationBar
          testId="spreadsheet-annotation-bar"
          anchorLabel={anchorLabel}
          excerpt={excerpt}
          emptyHint="点击单元格或拖拽框选区域（支持 Shift 扩选），即可针对该区域写批注发送到对话"
          placeholder="例如：帮我核对这几行公式或异常值…"
          onClearAnchor={() => setRange(null)}
          onAddToQueue={onQueueAnnotation ? (comment) => {
            if (!range || !anchorLabel) return
            onQueueAnnotation({
              filePath,
              anchorLabel,
              excerpt,
              comment,
              formattedText: formatSpreadsheetAnnotation({
                filePath,
                sheetName: activeSheet.name,
                range,
                rows: activeSheet.rows,
                comment,
              }),
            })
          } : undefined}
          onSubmit={(comment) => {
            if (!range) return
            onSendToChat?.(formatSpreadsheetAnnotation({
              filePath,
              sheetName: activeSheet.name,
              range,
              rows: activeSheet.rows,
              comment,
            }))
          }}
        />
      )}
      {saveError && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--danger)' }}>
          <span>{saveError}</span>
          <button type="button" aria-label="关闭保存错误" onClick={() => setSaveError(null)}><X size={12} /></button>
        </div>
      )}
    </div>
  )
}
