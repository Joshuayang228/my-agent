import { Check, CircleHelp, Eye } from 'lucide-react'
import { DESIGN_THEME_ASSETS, FONT_SCALE_ASSETS, type ThemeId } from '../../shared/design-asset-registry'
import { ActionButton } from '../foundation/ActionButton'
import { SettingCard, SettingRow, SettingsPageHeader } from './SettingsFields'

/**
 * 背景：正式与候选外观页复制选项按钮，资产同源仍无法防止交互分叉。
 * 意图：共享业务结构并直接组合基础按钮，状态与保存由各自宿主持有。
 * 约束：不访问 IPC 或本地存储；选中标记始终占位，切换和 hover 不改变控件尺寸。
 */
export function AppearanceSettingsContent({ theme, fontScale, onThemeChange, onFontScaleChange, prefix = 'settings' }: {
  theme?: string
  fontScale: string
  onThemeChange?: (theme: ThemeId) => void
  onFontScaleChange: (scale: string) => void
  prefix?: string
}) {
  return <div className="space-y-4" data-testid={`${prefix}-section-appearance`}>
    <SettingsPageHeader title="外观与界面" />
    <SettingCard><SettingRow scope="本机" label="界面语言" description="当前只提供简体中文。" icon={<CircleHelp size={15} />}>
      <span className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>简体中文</span>
    </SettingRow></SettingCard>
    <SettingCard testId={`${prefix}-theme-card`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>主题</h3>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{DESIGN_THEME_ASSETS.find(asset => asset.id === theme)?.labelZh ?? theme}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{DESIGN_THEME_ASSETS.map(asset => {
        const selected = theme === asset.id
        return <ActionButton key={asset.id} data-testid={`${prefix}-theme-${asset.id}`} aria-pressed={selected}
          data-selected={selected ? 'true' : undefined} onClick={() => onThemeChange?.(asset.id)}
          className="min-w-0 text-left" style={{ display: 'block', padding: 12, borderRadius: 'var(--radius-md)', borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}>
          <span className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full border" style={{ background: asset.representativeColor, borderColor: 'var(--border-color)' }} /><span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{asset.labelZh}</span><Check size={13} aria-hidden="true" className={`ml-auto shrink-0 ${selected ? 'visible' : 'invisible'}`} style={{ color: 'var(--accent-fg)' }} /></span>
          <span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.descriptionZh}</span>
        </ActionButton>
      })}</div>
    </SettingCard>
    <SettingCard><SettingRow label="字体大小" description="只影响本机界面字号；不改变内容本身。" scope="本机" icon={<Eye size={15} />} stacked>
      <div className="grid gap-2 sm:grid-cols-3">{FONT_SCALE_ASSETS.map(scale => {
        const selected = fontScale === scale.id
        return <ActionButton key={scale.id} data-testid={`${prefix}-font-${scale.id}`} aria-pressed={selected}
          data-selected={selected ? 'true' : undefined} onClick={() => onFontScaleChange(scale.id)} className="min-w-0 text-left"
          style={{ display: 'block', padding: '8px 12px', borderRadius: 'var(--radius-md)', borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}>
          <span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{scale.labelZh}</span>
          <span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-muted)' }}>{scale.descriptionZh}</span>
        </ActionButton>
      })}</div>
    </SettingRow></SettingCard>
  </div>
}
