import type { ReactNode } from 'react'
import { Activity, FileText, Globe, Wrench } from 'lucide-react'

export type DebugOverviewTab = 'prompt' | 'request-runtime' | 'world' | 'system'

interface DebugOverviewProps {
  onOpen: (tab: DebugOverviewTab) => void
}

const EVIDENCE_ENTRIES: Array<{
  tab: DebugOverviewTab
  label: string
  detail: string
  icon: ReactNode
}> = [
  { tab: 'prompt', label: 'Prompt 与生产资产', detail: '查看实际装配的 Prompt、资产和使用证据。', icon: <FileText size={15} /> },
  { tab: 'request-runtime', label: 'LLM、调用链与事件', detail: '按请求、Trace 和事件粒度排查运行过程。', icon: <Activity size={15} /> },
  { tab: 'world', label: '伙伴世界快照', detail: '查看当前伙伴和世界状态。', icon: <Globe size={15} /> },
  { tab: 'system', label: '系统与工具', detail: '查看运行环境、权限、Skills、MCP 与工具目录。', icon: <Wrench size={15} /> },
]

/**
 * Debug 的只读入口页。
 *
 * 背景：正式 Debug 已有多个真实证据面，但直接打开内部面板会让用户自行拼接运行上下文。
 * 设计意图：先提供稳定的证据导航，再逐步补充真实运行概览；本组件不维护生产状态，也不新增 IPC。
 * 关键约束：所有入口必须跳转到已有 Debug 分区，不能放入 Playground fixture 或假诊断动作。
 */
export function DebugOverview({ onOpen }: DebugOverviewProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="debug-overview">
      <header>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>运行概览</h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>查看当前系统实际状态，再进入对应的真实证据。</p>
      </header>
      <section className="theme-card rounded-lg border p-4" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>真实证据入口</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {EVIDENCE_ENTRIES.map((entry) => (
            <button
              key={entry.tab}
              type="button"
              onClick={() => onOpen(entry.tab)}
              className="flex min-h-[72px] items-start gap-3 rounded-lg border px-3 py-3 text-left transition hover:bg-[var(--hover-overlay)]"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <span className="mt-0.5" style={{ color: 'var(--accent)' }}>{entry.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{entry.label}</span>
                <span className="mt-1 block text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>{entry.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
