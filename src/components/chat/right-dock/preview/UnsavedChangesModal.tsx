import { useEffect } from 'react'
import { AlertTriangle, Save } from 'lucide-react'
import { ActionButton } from '../../../foundation/ActionButton'

interface UnsavedChangesModalProps {
  open: boolean
  /** 未保存文件路径列表 */
  filePaths: string[]
  /** 动作名称，例如「关闭文档」「关闭工作区」「切换项目」 */
  actionLabel: string
  saving?: boolean
  error?: string | null
  onSaveAndContinue: () => void
  onDiscardAndContinue: () => void
  onCancel: () => void
}

function fileBasename(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath
}

/**
 * 背景：用户在工作区修改表格/文档后若直接关闭标签、收起工作区或切换项目，原生 confirm 只有二选一且无法一键保存。
 * 设计意图：提供应用内主题化三态拦截弹窗（保存并继续 / 放弃修改 / 取消），展示所有未保存文件名；
 * 保存失败（例如 Windows 文件被 WPS/Excel 占用）时保持草稿并原位展示错误，绝不静默丢稿。
 * 关键约束：保存进行中禁用按钮与 Escape 关闭，防止重复提交写回 IPC。
 */
export function UnsavedChangesModal({
  open,
  filePaths,
  actionLabel,
  saving = false,
  error,
  onSaveAndContinue,
  onDiscardAndContinue,
  onCancel,
}: UnsavedChangesModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, saving, onCancel])

  if (!open || filePaths.length === 0) return null

  const isSingle = filePaths.length === 1
  const title = isSingle
    ? `保存对「${fileBasename(filePaths[0])}」的修改？`
    : `有 ${filePaths.length} 个文件包含未保存的修改`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, #000 38%, transparent)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="unsaved-changes-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel()
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-[var(--radius-card)] border p-5 shadow-xl"
        style={{
          borderColor: 'var(--border-color)',
          background: 'var(--card-bg)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--warning) 14%, transparent)',
              color: 'var(--warning)',
            }}
            aria-hidden="true"
          >
            <AlertTriangle size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p className="mt-1.5 text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>
              在{actionLabel}前，是否先将当前修改写入磁盘？选择「放弃修改」将丢失未保存的内容。
            </p>
            {!isSingle && (
              <ul
                className="mt-2.5 max-h-28 space-y-1 overflow-auto rounded-[var(--radius-md)] border px-3 py-2 text-[11.5px]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {filePaths.map((fp) => (
                  <li key={fp} className="truncate font-mono" title={fp}>
                    • {fileBasename(fp)}
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <div
                className="mt-2.5 rounded-[var(--radius-md)] border px-3 py-2 text-[11.5px] leading-5"
                style={{
                  borderColor: 'color-mix(in srgb, var(--danger) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
                  color: 'var(--danger)',
                }}
                role="alert"
              >
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <ActionButton size="sm" onClick={onCancel} disabled={saving}>
            取消
          </ActionButton>
          <ActionButton size="sm" tone="danger" onClick={onDiscardAndContinue} disabled={saving}>
            放弃修改
          </ActionButton>
          <ActionButton size="sm" tone="accent" onClick={onSaveAndContinue} disabled={saving}>
            <Save size={12} />
            <span>{saving ? '保存中…' : (isSingle ? '保存并继续' : '全部保存并继续')}</span>
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
