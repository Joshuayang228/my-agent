import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { SkillInfo } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { SettingCard, SettingSwitch } from './SettingsFields'

interface SkillViewProps {
  skill: SkillInfo
  disabled?: boolean
  onEnabledChange: (enabled: boolean) => void
  testId: string
  toggleTestId?: string
}

/** 候选与正式共享结构；仅父组件决定隔离数据或真实 IPC，不在展示层读取全局状态。 */
export function SkillListCard({ skill, disabled, onEnabledChange, onOpen, testId, toggleTestId }: SkillViewProps & { onOpen: () => void }) {
  return <SettingCard testId={testId}>
    <div className="flex items-center justify-between gap-3">
      <ActionButton disabled={disabled} onClick={onOpen} className="min-w-0 shrink border-0 p-0 text-left text-[13px] font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--text-primary)' }}>{skill.name}</ActionButton>
      <SettingSwitch checked={skill.enabled} compact disabled={disabled} label={skill.name} description="" onChange={onEnabledChange} testId={toggleTestId ?? `${testId}-enabled`} />
    </div>
  </SettingCard>
}

export function SkillDetail({ skill, disabled, onEnabledChange, onBack, content, actions, notice, testId, toggleTestId }: SkillViewProps & {
  onBack: () => void
  content: ReactNode
  actions?: ReactNode
  notice?: ReactNode
}) {
  return <SettingCard testId={testId}>
    <div className="mb-2"><ActionButton disabled={disabled} onClick={onBack} className="gap-1.5 border-0 p-0" aria-label="返回 Skills" data-testid={testId.replace(/-detail$/, '-back')}><ArrowLeft size={16} />返回 Skills</ActionButton></div>
    <div className="mb-4 flex items-center gap-3">
      <h3 className="min-w-0 flex-1 text-[15px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--text-primary)' }}>{skill.name}</h3>
      <SettingSwitch checked={skill.enabled} compact disabled={disabled} label={skill.name} description="" onChange={onEnabledChange} testId={toggleTestId ?? `${testId}-enabled`} />
    </div>
    <div className="space-y-2 text-[12px] leading-5 [overflow-wrap:anywhere]" style={{ color: 'var(--text-secondary)' }}>
      <p className="whitespace-pre-line"><span className="font-medium">触发条件：</span>{skill.when_to_use || '未单独声明'}</p>
      <p><span className="font-medium">技能描述：</span>{skill.description}</p>
    </div>
    <dl className="my-5 grid grid-cols-2 gap-3 border-y py-3 text-[11px] sm:grid-cols-4" style={{ borderColor: 'var(--border-subtle)' }}>
      {Object.entries({ 作者: skill.author || '未声明', 版本: skill.version || '未声明', 来源: skill.source === 'builtin' ? '内置' : '用户', 状态: skill.enabled ? '已启用' : '未启用' }).map(([label, value]) => <div className="min-w-0 [overflow-wrap:anywhere]" key={label}><dt style={{ color: 'var(--text-muted)' }}>{label}</dt><dd className="mt-1">{value}</dd></div>)}
    </dl>
    {actions && <div className="mb-3 flex flex-wrap items-center gap-2">{actions}</div>}
    {notice}
    <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
      <div className="text-[11px]"><div className="mb-2" style={{ color: 'var(--text-muted)' }}>文件</div><span className="block px-2 py-1.5" style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}>SKILL.md</span></div>
      {content}
    </div>
  </SettingCard>
}

export function SkillFilePreview({ content, testId }: { content: string; testId: string }) {
  return <pre tabIndex={0} role="region" aria-label="SKILL.md 文件内容" className="scrollbar-thin max-h-[48vh] min-w-0 overflow-auto overscroll-contain whitespace-pre-wrap break-words rounded-[var(--radius-md)] border p-3 font-mono text-[11px] leading-5 [overflow-wrap:anywhere] [scrollbar-gutter:stable]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }} data-testid={testId}>{content}</pre>
}
