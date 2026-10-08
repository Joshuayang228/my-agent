import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppearanceSettingsContent } from '../../src/components/settings/AppearanceSettingsContent'
import { DataSettingsContent } from '../../src/components/settings/DataSettingsContent'
import { CompanionSettingsContent, type CompanionSettingsContentProps } from '../../src/components/settings/CompanionSettingsContent'
import { SettingsPageHeader } from '../../src/components/settings/SettingsFields'

const noop = () => undefined
const companionProps: CompanionSettingsContentProps = {
  expertise: 'auto', onExpertiseChange: noop, momentTipsMuted: false, onMomentTipsMutedChange: noop,
  proactiveGreeting: false, onProactiveGreetingChange: noop, quietStart: '22', quietEnd: '8', maxPerDay: '3',
  onQuietStartChange: noop, onQuietEndChange: noop, onMaxPerDayChange: noop,
  note: '', onNoteChange: noop, roleAction: '管理角色架',
}

describe('settings header embedding remains explicit', () => {
  it('keeps the production header spacing unless explicitly opted in', () => {
    expect(renderToStaticMarkup(createElement(SettingsPageHeader, { title: '设置' }))).toContain('mb-5')
    expect(renderToStaticMarkup(createElement(SettingsPageHeader, { title: '设置', spacing: 'layout' }))).toContain('mb-[var(--layout-section,1rem)]')
  })
  it('preserves appearance fields when the host owns the header', () => {
    const props = { fontScale: 'md', onFontScaleChange: noop }
    expect(renderToStaticMarkup(createElement(AppearanceSettingsContent, props))).toContain('<h2')
    const embedded = renderToStaticMarkup(createElement(AppearanceSettingsContent, { ...props, showHeader: false }))
    expect(embedded).not.toContain('<h2')
    expect(embedded).toContain('界面语言')
    expect(embedded).toContain('字体大小')
  })
  it('preserves backup actions when the host owns the header', () => {
    const props = { onAction: async () => null }
    expect(renderToStaticMarkup(createElement(DataSettingsContent, props))).toContain('<h2')
    const embedded = renderToStaticMarkup(createElement(DataSettingsContent, { ...props, showHeader: false }))
    expect(embedded).not.toContain('<h2')
    expect(embedded).toContain('导出数据')
    expect(embedded).toContain('导入数据')
  })
  it('preserves companion preferences and the default eyebrow', () => {
    expect(renderToStaticMarkup(createElement(CompanionSettingsContent, companionProps))).toContain('伙伴设置')
    const embedded = renderToStaticMarkup(createElement(CompanionSettingsContent, { ...companionProps, showHeader: false }))
    expect(embedded).not.toContain('<h2')
    expect(embedded).toContain('回答方式')
    expect(embedded).toContain('相处补充说明')
  })
})
