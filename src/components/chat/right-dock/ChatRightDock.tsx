/**
 * Chat 右侧能力坞 — 文件 / 审阅 / 终端；Debug 调用链盖上层（Alice 式）
 */

import { useState } from 'react'
import { FileText, GitCompare, TerminalSquare, X } from 'lucide-react'
import { FileBrowser, type FileBrowserPreviewData } from '../../FileBrowser'
import { ReviewPanel } from './ReviewPanel'
import { TerminalPanel } from './TerminalPanel'
import { ConversationDebugAside } from '../ConversationDebugAside'
import type { LLMCallSummary } from '../../../shared/types'

export type RightDockTab = 'files' | 'review' | 'terminal'

interface ChatRightDockProps {
  projectPath: string | null
  sessionId: string | null
  showFiles: boolean
  conversationDebug: boolean
  persistedCalls: LLMCallSummary[]
  persistedLoading: boolean
  /** 可拖宽度；默认 380 */
  width?: number
  /** Playground / 测试专用只读文件样张。 */
  filesPreview?: FileBrowserPreviewData
  onCloseFiles: () => void
  onCloseDebug: () => void
}

const TABS: { id: RightDockTab; label: string; icon: typeof FileText }[] = [
  { id: 'files', label: '文件', icon: FileText },
  { id: 'review', label: '审阅', icon: GitCompare },
  { id: 'terminal', label: '终端', icon: TerminalSquare },
]

export function ChatRightDock({
  projectPath,
  sessionId,
  showFiles,
  conversationDebug,
  persistedCalls,
  persistedLoading,
  width = 380,
  filesPreview,
  onCloseFiles,
  onCloseDebug,
}: ChatRightDockProps) {
  const [tab, setTab] = useState<RightDockTab>('files')
  const open = showFiles || conversationDebug
  if (!open) return null

  const showWorkbench = showFiles

  return (
    <div
      className="relative shrink-0 border-l overflow-hidden flex flex-col"
      style={{ width, borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
      data-testid="chat-right-dock"
    >
      {showWorkbench && (
        <div className="flex h-full min-h-0 flex-col">
          <div
            className="flex shrink-0 items-center gap-0.5 border-b px-1.5 py-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition"
                  style={{
                    color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                    background: active ? 'var(--accent-subtle)' : undefined,
                  }}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              )
            })}
            <button
              type="button"
              className="ml-auto rounded p-1"
              style={{ color: 'var(--text-muted)' }}
              title="关闭右坞"
              onClick={onCloseFiles}
            >
              <X size={14} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === 'files' && (
              <FileBrowser projectPath={projectPath} onClose={onCloseFiles} embedded previewData={filesPreview} />
            )}
            {tab === 'review' && (
              <ReviewPanel sessionId={sessionId} />
            )}
            {tab === 'terminal' && (
              <TerminalPanel projectPath={projectPath} />
            )}
          </div>
        </div>
      )}

      {conversationDebug && (
        <div
          className={
            showWorkbench
              ? 'absolute inset-0 z-20 flex flex-col border-l shadow-lg'
              : 'flex h-full min-h-0 flex-col'
          }
          style={{
            borderColor: showWorkbench ? 'var(--border-subtle)' : undefined,
            background: showWorkbench
              ? 'color-mix(in srgb, var(--bg-secondary) 92%, transparent)'
              : 'var(--bg-secondary)',
            backdropFilter: showWorkbench ? 'blur(8px)' : undefined,
          }}
        >
          <ConversationDebugAside
            sessionId={sessionId}
            persistedCalls={persistedCalls}
            persistedLoading={persistedLoading}
            onClose={onCloseDebug}
          />
        </div>
      )}
    </div>
  )
}
