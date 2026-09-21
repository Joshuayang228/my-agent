import { Sparkles } from 'lucide-react'
import { SettingCard, SettingsPageHeader, SettingSwitch } from './SettingsFields'

export interface AboutSettingsContentProps {
  developerMode: boolean
  onDeveloperModeChange: (enabled: boolean) => void
  testIdPrefix?: string
  showHeader?: boolean
}

/**
 * 关于页内容同时服务正式设置和 Playground 样张。
 *
 * 背景：开发者模式决定侧栏 Debug / Playground 入口，但不能把入口开关做成孤儿控件，
 *       也不能让候选页直接写生产设置。
 * 设计意图：页面结构和 SettingSwitch 只维护一份；正式页注入真实 developerMode，
 *       候选页只改内存样张。调用方负责保存、失败恢复和入口刷新。
 * 关键约束：组件不直接读取设置 IPC；关闭开发者模式只表示入口收回，
 *       不删除诊断数据、资产或后台服务。
 */
export function AboutSettingsContent({
  developerMode,
  onDeveloperModeChange,
  testIdPrefix = '',
  showHeader = true,
}: AboutSettingsContentProps) {
  return (
    <div className="space-y-4" data-testid={`${testIdPrefix}section-about`}>
      {showHeader ? <SettingsPageHeader title="关于 My Agent" description="查看版本、运行环境和本机数据位置。" /> : null}
      <SettingCard>
        <div className="flex items-start gap-3">
          <Sparkles size={18} style={{ color: 'var(--companion-accent-warm)' }} aria-hidden="true" />
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>My Agent</div>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>有性格、有记忆，也会和你一起成长。</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 text-[11px] sm:grid-cols-3" style={{ color: 'var(--text-secondary)' }}>
          <div><div style={{ color: 'var(--text-muted)' }}>版本</div><div className="mt-1">0.1.0 · 开发中</div></div>
          <div><div style={{ color: 'var(--text-muted)' }}>运行环境</div><div className="mt-1">Electron</div></div>
          <div><div style={{ color: 'var(--text-muted)' }}>数据位置</div><div className="mt-1">本机存储</div></div>
        </div>
      </SettingCard>
      <SettingCard>
        <SettingSwitch
          checked={developerMode}
          scope="本机"
          label="开发者模式"
          description="开启后显示 Debug 与 Playground 入口；关闭不会删除任何数据或设置。"
          onChange={onDeveloperModeChange}
          testId={`${testIdPrefix}settings-developer-mode`}
        />
      </SettingCard>
    </div>
  )
}
