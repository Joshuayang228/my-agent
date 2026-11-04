import type { ChangeEvent, ReactNode } from 'react'
import { Eye, Heart, UserRound } from 'lucide-react'
import { TextField } from '../foundation/TextField'
import { TimeSelect } from '../foundation/TimeSelect'
import { SelectField } from '../foundation/SelectField'
import { ActionButton } from '../foundation/ActionButton'
import { SettingCard, SettingRow, SettingSwitch } from './SettingsFields'
import { LAYOUT_CLASSES } from '../../shared/content-layout'

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
  cadence: 'manual' | 'low' | 'regular'
  visibility: 'always' | 'three_days' | 'private'
  onCadenceChange: (value: 'manual' | 'low' | 'regular') => void
  onVisibilityChange: (value: 'always' | 'three_days' | 'private') => void
  /** 仅在已授权的候选预览中展示新发布策略控件。 */
  showPostingPolicy?: boolean
  postingMaxPerDay: string
  cooldownMinutes: string
  postingQuietStart: string
  postingQuietEnd: string
  imagePolicy: 'never' | 'existing'
  interactionPolicy: 'never' | 'occasional' | 'regular'
  onPostingMaxPerDayChange: (value: string) => void
  onCooldownMinutesChange: (value: string) => void
  onPostingQuietStartChange: (value: string) => void
  onPostingQuietEndChange: (value: string) => void
  onImagePolicyChange: (value: 'never' | 'existing') => void
  onInteractionPolicyChange: (value: 'never' | 'occasional' | 'regular') => void
  saveFailed?: boolean
  onRetrySave?: () => void
  roleAction: ReactNode
  testIdPrefix?: string
  showHeader?: boolean
}

const ANSWERS: readonly [CompanionExpertise, string, string][] = [
  ['auto', '自动', '简单问题直接回答，复杂问题补充步骤。'],
  ['novice', '讲清楚一些', '解释为什么这样做，再带你一步步完成。'],
  ['intermediate', '重点优先', '给出做法，同时保留必要注意事项。'],
  ['expert', '直接一点', '省略基础介绍，直接给方案、参数和边界。'],
]

export function CompanionSettingsContent(props: CompanionSettingsContentProps) {
  const testIdPrefix = props.testIdPrefix ?? ''
  return <div className={LAYOUT_CLASSES.section} data-testid="settings-companion-content">
    {props.showHeader !== false && <header className="mb-5"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em]" style={{ color: 'var(--accent-fg)' }}><Heart size={14} />伙伴设置</div><h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>伙伴与相处</h2><p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>调整伙伴和你说话、提醒以及回应你的方式。</p></header>}
    <SettingCard><SettingRow scope="伙伴" label="当前伙伴" description="朋友圈、衣柜和对话都会跟随当前主角。" icon={<UserRound size={15} />}>{props.roleAction}</SettingRow></SettingCard>
    <SettingCard><SettingRow scope="伙伴" label="回答方式" description="你希望伙伴平时怎么回答你？" icon={<Eye size={15} />} stacked><div className="grid gap-2 sm:grid-cols-2">{ANSWERS.map(([value, label, example]) => <ActionButton key={value} type="button" aria-pressed={props.expertise === value} onClick={() => props.onExpertiseChange(value)} className="block min-w-0 whitespace-normal rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition" style={{ display: 'block', padding: '10px 12px', borderColor: props.expertise === value ? 'var(--accent)' : 'var(--border-subtle)', background: props.expertise === value ? 'var(--accent-subtle)' : 'transparent' }}><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div><div className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>例如：{example}</div></ActionButton>)}</div></SettingRow></SettingCard>
    <SettingCard><div className="space-y-3"><SettingSwitch checked={!props.momentTipsMuted} scope="伙伴" label="生活动态提醒" description="有新的生活动态时，在应用内轻轻提醒你。" onChange={(checked) => props.onMomentTipsMutedChange(!checked)} testId={`${testIdPrefix}settings-switch-moment-tips`} />{!props.momentTipsMuted && <div className="grid gap-2 rounded-[var(--radius-md)] border p-3 sm:grid-cols-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>勿扰开始<TimeSelect aria-label="勿扰开始" value={props.quietStart} onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onQuietStartChange(event.target.value)} className="mt-1 w-full text-[11px]" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>勿扰结束<TimeSelect aria-label="勿扰结束" value={props.quietEnd} onChange={(event: ChangeEvent<HTMLSelectElement>) => props.onQuietEndChange(event.target.value)} className="mt-1 w-full text-[11px]" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>每日最多<TextField type="number" min="0" value={props.maxPerDay} onChange={(event: ChangeEvent<HTMLInputElement>) => props.onMaxPerDayChange(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-sm)] border px-2 py-2 text-[11px]" /></label></div>}<div className="grid gap-2 sm:grid-cols-2"><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>朋友圈更新节奏<SelectField aria-label="朋友圈更新节奏" value={props.cadence} onChange={(e) => props.onCadenceChange(e.target.value as CompanionSettingsContentProps['cadence'])} className="mt-1 text-[11px]"><option value="manual">只在明确发生时更新</option><option value="low">偶尔更新</option><option value="regular">按日程自然更新</option></SelectField></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>动态可见范围<SelectField aria-label="动态可见范围" value={props.visibility} onChange={(e) => props.onVisibilityChange(e.target.value as CompanionSettingsContentProps['visibility'])} className="mt-1 text-[11px]"><option value="always">一直可见</option><option value="three_days">仅保留最近三天</option><option value="private">仅人物自己可见</option></SelectField></label></div>{props.showPostingPolicy && (
<div className="grid gap-2 sm:grid-cols-2"><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>自动发帖上限<SelectField aria-label="自动发帖上限" value={props.postingMaxPerDay} onChange={(e) => props.onPostingMaxPerDayChange(e.target.value)} className="mt-1 text-[11px]">
<option value="1">每天最多 1 条</option>
<option value="3">每天最多 3 条</option>
<option value="5">每天最多 5 条</option>
</SelectField></label>
<label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>发帖最短间隔<SelectField aria-label="发帖最短间隔" value={props.cooldownMinutes} onChange={(e) => props.onCooldownMinutesChange(e.target.value)} className="mt-1 text-[11px]">
<option value="120">至少间隔 2 小时</option>
<option value="240">至少间隔 4 小时</option>
<option value="480">至少间隔 8 小时</option>
</SelectField></label>
<label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>自动发帖勿扰开始<TimeSelect aria-label="自动发帖勿扰开始" value={props.postingQuietStart} onChange={(e: ChangeEvent<HTMLSelectElement>) => props.onPostingQuietStartChange(e.target.value)} className="mt-1 w-full text-[11px]" /></label>
<label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>自动发帖勿扰结束<TimeSelect aria-label="自动发帖勿扰结束" value={props.postingQuietEnd} onChange={(e: ChangeEvent<HTMLSelectElement>) => props.onPostingQuietEndChange(e.target.value)} className="mt-1 w-full text-[11px]" /></label>
<label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>自动配图偏好<SelectField aria-label="自动配图偏好" value={props.imagePolicy} onChange={(e) => props.onImagePolicyChange(e.target.value as CompanionSettingsContentProps['imagePolicy'])} className="mt-1 text-[11px]">
<option value="never">不自动配图</option>
<option value="existing">有现成图片时才带</option>
</SelectField></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>自动互动频率<SelectField aria-label="自动互动频率" value={props.interactionPolicy} onChange={(e) => props.onInteractionPolicyChange(e.target.value as CompanionSettingsContentProps['interactionPolicy'])} className="mt-1 text-[11px]"><option value="never">不自动互动</option><option value="occasional">偶尔互动</option><option value="regular">按动态互动</option></SelectField></label></div>
)}<SettingSwitch checked={props.proactiveGreeting} scope="伙伴" label="主动问候" description="允许伙伴在合适的时机主动来打个招呼，默认保持关闭。" onChange={props.onProactiveGreetingChange} testId={`${testIdPrefix}settings-switch-proactive-greeting`} /></div></SettingCard>
    <div className="flex h-9 min-w-0 items-center justify-between gap-2" data-testid="settings-save-status" aria-live="polite">
      <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{props.saveFailed ? '修改尚未保存，请重试' : ''}</span>
      <ActionButton onClick={props.onRetrySave} disabled={!props.saveFailed} tabIndex={props.saveFailed ? 0 : -1} aria-hidden={!props.saveFailed} className={props.saveFailed ? '' : 'invisible'}>重试保存</ActionButton>
    </div>
  </div>
}
