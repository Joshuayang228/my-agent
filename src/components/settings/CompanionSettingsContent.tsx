import type { ChangeEvent, ReactNode } from 'react'
import { Eye, Heart, Sparkles, UserRound } from 'lucide-react'
import { TextField } from '../foundation/TextField'
import { ActionButton } from '../foundation/ActionButton'
import { MAX_COMPANION_RESPONSE_NOTE_LENGTH } from '../../shared/types'
import { SettingCard, SettingRow, SettingSwitch } from './SettingsFields'

export type CompanionExpertise = 'auto' | 'novice' | 'intermediate' | 'expert'

export interface CompanionSettingsContentProps {
  expertise: CompanionExpertise
  onExpertiseChange: (value: CompanionExpertise) => void
  momentTipsMuted: boolean
  onMomentTipsMutedChange: (value: boolean) => void
  proactiveGreeting: boolean
  onProactiveGreetingChange: (value: boolean) => void
  quietStart: string
  quietEnd: string
  maxPerDay: string
  onQuietStartChange: (value: string) => void
  onQuietEndChange: (value: string) => void
  onMaxPerDayChange: (value: string) => void
  note: string
  onNoteChange: (value: string) => void
  saveFailed?: boolean
  onRetrySave?: () => void
  roleAction: ReactNode
  testIdPrefix?: string
}

const ANSWERS: readonly [CompanionExpertise, string, string, string][] = [
  ['auto', '自动', '根据问题难度调整', '简单问题直接回答，复杂问题补充步骤。'],
  ['novice', '讲清楚一些', '多补充背景和步骤', '解释为什么这样做，再带你一步步完成。'],
  ['intermediate', '重点优先', '先结论，再补关键原因', '给出做法，同时保留必要注意事项。'],
  ['expert', '直接一点', '默认进入细节', '省略基础介绍，直接给方案、参数和边界。'],
]

export function CompanionSettingsContent(props: CompanionSettingsContentProps) {
  const testIdPrefix = props.testIdPrefix ?? ''
  return <div className="space-y-4" data-testid="settings-companion-content">
    <header className="mb-5"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em]" style={{ color: 'var(--accent-fg)' }}><Heart size={14} />伙伴设置</div><h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>伙伴与相处</h2><p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>调整伙伴和你说话、提醒以及回应你的方式。</p></header>
    <SettingCard><SettingRow scope="伙伴" label="当前伙伴" description="朋友圈、衣柜和对话都会跟随当前主角。" icon={<UserRound size={15} />}>{props.roleAction}</SettingRow></SettingCard>
    <SettingCard><SettingRow scope="伙伴" label="回答方式" description="你希望伙伴平时怎么回答你？" icon={<Eye size={15} />} stacked><div className="grid gap-2 sm:grid-cols-2">{ANSWERS.map(([value, label, description, example]) => <ActionButton key={value} type="button" aria-pressed={props.expertise === value} onClick={() => props.onExpertiseChange(value)} className="block min-w-0 whitespace-normal rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition" style={{ display: 'block', padding: '10px 12px', borderColor: props.expertise === value ? 'var(--accent)' : 'var(--border-subtle)', background: props.expertise === value ? 'var(--accent-subtle)' : 'transparent' }}><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{description}</div><div className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>例如：{example}</div></ActionButton>)}</div></SettingRow></SettingCard>
    <SettingCard><div className="space-y-3"><SettingRow label="相处补充说明" description="告诉伙伴你希望长期保持的回应方式。" icon={<Sparkles size={15} />} stacked><TextField multiline maxLength={MAX_COMPANION_RESPONSE_NOTE_LENGTH} aria-label="相处补充说明" value={props.note} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => props.onNoteChange(event.target.value)} rows={3} className="w-full resize-y rounded-[var(--radius-md)] border px-3 py-2" /></SettingRow><SettingSwitch checked={!props.momentTipsMuted} scope="伙伴" label="生活动态提醒" description="有新的生活动态时，在应用内轻轻提醒你。" onChange={(checked) => props.onMomentTipsMutedChange(!checked)} testId={`${testIdPrefix}settings-switch-moment-tips`} />{!props.momentTipsMuted && <div className="grid gap-2 rounded-[var(--radius-md)] border p-3 sm:grid-cols-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>勿扰开始<TextField type="number" min="0" max="23" value={props.quietStart} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onQuietStartChange(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-sm)] border px-2 py-2 text-[11px]" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>勿扰结束<TextField type="number" min="0" max="23" value={props.quietEnd} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onQuietEndChange(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-sm)] border px-2 py-2 text-[11px]" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>每日最多<TextField type="number" min="0" value={props.maxPerDay} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onMaxPerDayChange(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-sm)] border px-2 py-2 text-[11px]" /></label></div>}<SettingSwitch checked={props.proactiveGreeting} scope="伙伴" label="主动问候" description="允许伙伴在合适的时机主动来打个招呼，默认保持关闭。" onChange={props.onProactiveGreetingChange} testId={`${testIdPrefix}settings-switch-proactive-greeting`} /></div></SettingCard>
    <div className="flex h-9 min-w-0 items-center justify-between gap-2" data-testid="settings-save-status" aria-live="polite">
      <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{props.saveFailed ? '修改尚未保存，请重试' : ''}</span>
      <ActionButton onClick={props.onRetrySave} disabled={!props.saveFailed} tabIndex={props.saveFailed ? 0 : -1} aria-hidden={!props.saveFailed} className={props.saveFailed ? '' : 'invisible'}>重试保存</ActionButton>
    </div>
  </div>
}
