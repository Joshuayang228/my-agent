import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Download, LockKeyhole, Save, Upload } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SettingCard, SettingsPageHeader } from './SettingsFields'

export type DataSettingsAction = 'export' | 'import'
export interface DataSettingsFeedback {
  message: string
  error?: boolean
}

interface DataSettingsContentProps {
  onAction: (action: DataSettingsAction) => Promise<DataSettingsFeedback | null>
  testIdPrefix?: string
  activeAction?: DataSettingsAction | null
}

/**
 * 数据备份入口需要在正式页与候选保持同一交互，但不能把真实 IPC 带入样张。
 * 因此调用方只注入操作，组件统一反馈与同步锁；卸载后仅忽略结果，不声称取消主进程操作。
 * 锁必须在 await 前建立，取消不报错，异常不可展示内部路径或异常正文。
 */
export function DataSettingsContent({ onAction, testIdPrefix = '', activeAction = null }: DataSettingsContentProps) {
  const [busy, setBusy] = useState<DataSettingsAction | null>(null)
  const [feedback, setFeedback] = useState<DataSettingsFeedback | null>(null)
  const locked = useRef(false)
  const generation = useRef(0)
  const pending = busy ?? activeAction
  useEffect(() => () => { generation.current += 1 }, [])

  const run = async (action: DataSettingsAction) => {
    if (locked.current || activeAction) return
    locked.current = true
    const request = generation.current
    setBusy(action)
    setFeedback(null)
    try {
      const result = await onAction(action)
      if (request === generation.current) setFeedback(result)
    } catch {
      if (request === generation.current) setFeedback({ error: true, message: `${action === 'export' ? '导出' : '导入'}失败，请重试。` })
    } finally {
      if (request === generation.current) {
        locked.current = false
        setBusy(null)
      }
    }
  }

  return <div className="space-y-4" data-testid={`${testIdPrefix}section-data`}>
    <SettingsPageHeader title="数据与隐私" description="管理本地数据的迁移和备份，并明确哪些内容不会跟着备份文件离开设备。" />
    <SettingCard>
      <div className="grid gap-2 sm:grid-cols-2">
        {(['export', 'import'] as const).map(action => {
          const Icon = action === 'export' ? Upload : Download
          return <ActionButton key={action} disabled={pending !== null} aria-busy={pending === action}
            onClick={() => { void run(action) }} data-testid={`${testIdPrefix}${action}`}
            className="w-full min-w-0 gap-3 text-left" style={{ minHeight: 64, padding: 12, justifyContent: 'space-between', borderColor: 'var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <span className="flex min-w-0 items-center gap-2"><Icon size={15} className="shrink-0" style={{ color: 'var(--accent-fg)' }} aria-hidden="true" /><span>
              <span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{action === 'export' ? '导出数据' : '导入数据'}</span>
              <span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>{action === 'export' ? '生成一份本地备份' : '从本地备份恢复'}</span>
            </span></span><ChevronRight size={14} className="shrink-0" aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          </ActionButton>
        })}
      </div>
      {pending && <p className="mt-3 text-[11px]" role="status" style={{ color: 'var(--text-secondary)' }}>{pending === 'export' ? '正在导出，请完成文件选择…' : '正在导入，请完成文件选择…'}</p>}
      {feedback && <p className="mt-3 rounded-[var(--radius-md)] px-3 py-2 text-[11px] leading-5" role={feedback.error ? 'alert' : 'status'} style={{ background: feedback.error ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--accent-subtle)', color: feedback.error ? 'var(--danger)' : 'var(--accent-fg)' }}>{feedback.message}</p>}
    </SettingCard>
    <SettingCard>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><Save size={14} aria-hidden="true" style={{ color: 'var(--accent-fg)' }} />备份包含</div>
          <ul className="space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><li>会话与消息</li><li>记忆条目</li><li>普通模型与伙伴偏好</li><li>生活资产与播种标记</li></ul></div>
        <div><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><LockKeyhole size={14} aria-hidden="true" style={{ color: 'var(--accent-fg)' }} />备份不包含</div>
          <ul className="space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><li>API Key 和 MCP 密钥</li><li>权限规则与执行模式</li><li>本机项目路径</li></ul></div>
      </div>
    </SettingCard>
  </div>
}
