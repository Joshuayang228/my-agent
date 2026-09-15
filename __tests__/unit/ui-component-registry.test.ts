import { existsSync, readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  UI_COMPONENT_ASSETS,
  UI_COMPONENT_CATEGORIES,
  UI_COMPONENT_REGISTRY,
  UI_COMPONENT_STATUSES,
} from '../../src/shared/ui-component-registry'

/** 检查实际 JSX 使用而非仅有 import，防止注册表宣称复用但页面仍维护孤立实现。 */
function rendersSharedTabs(source: string, componentName = 'TabStrip', moduleSuffix = '/foundation/TabStrip'): boolean {
  const file = ts.createSourceFile('surface.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const aliases = new Set<string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.endsWith(moduleSuffix)) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const entry of bindings.elements) if ((entry.propertyName ?? entry.name).text === componentName) aliases.add(entry.name.text)
    }
  }
  let rendered = false
  const visit = (node: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && ts.isIdentifier(node.tagName) && aliases.has(node.tagName.text)) rendered = true
    ts.forEachChild(node, visit)
  }
  visit(file)
  return rendered
}

describe('UI component asset registry', () => {
  it('MCP 添加流程实际渲染共享表单，候选只注入隔离适配器', () => {
    const usesForm = (source: string) => rendersSharedTabs(source, 'McpConnectionForm', '/settings/McpConnectionForm')
    for (const path of ['src/components/SettingsPanel.tsx', 'src/components/playground/McpConnectionPreview.tsx']) {
      expect(usesForm(readFileSync(path, 'utf8')), path).toBe(true)
    }
    expect(rendersSharedTabs(readFileSync('src/components/playground/SettingsExperienceCandidate.tsx', 'utf8'), 'McpConnectionPreview', '/McpConnectionPreview')).toBe(true)
    expect(usesForm("import { McpConnectionForm } from './settings/McpConnectionForm'; const view = <div />")).toBe(false)
    expect(usesForm('const McpConnectionForm = () => <div />; const view = <McpConnectionForm />')).toBe(false)
    expect(readFileSync('src/components/settings/McpConnectionForm.tsx', 'utf8')).not.toContain('window.electronAPI')
  })
  it('MCP 正式设置与候选实际渲染同一服务卡片，而不只是登记或 import', () => {
    const usesCard = (source: string) => rendersSharedTabs(source, 'McpServiceCard', '/settings/McpServiceCard')
    for (const path of ['src/components/SettingsPanel.tsx', 'src/components/playground/SettingsExperienceCandidate.tsx']) {
      expect(usesCard(readFileSync(path, 'utf8')), path).toBe(true)
    }
    expect(usesCard("import { McpServiceCard } from './settings/McpServiceCard'; const view = <div />")).toBe(false)
    expect(usesCard('const McpServiceCard = () => <div />; const view = <McpServiceCard />')).toBe(false)
    expect(usesCard("import { McpServiceCard as Card } from './settings/McpServiceCard'; const view = <Card />")).toBe(true)
    expect(UI_COMPONENT_REGISTRY['layout.mcp-service-card'].sourcePath).toBe('src/components/settings/McpServiceCard.tsx')
  })
  it('requires shared tabs to be rendered by foundation, experience and production', () => {
    expect(UI_COMPONENT_REGISTRY['behavior.tabs'].sourcePath).toBe('src/components/foundation/TabStrip.tsx')
    for (const path of [
      'src/components/playground/UiControlsPanel.tsx',
      'src/components/playground/WorkspaceExperienceCandidate.tsx',
      'src/components/chat/right-dock/ChatRightDock.tsx',
      'src/components/chat/right-dock/WorkspaceFilesPanel.tsx',
    ]) expect(rendersSharedTabs(readFileSync(path, 'utf8')), path).toBe(true)
    expect(rendersSharedTabs("import { TabStrip } from '../foundation/TabStrip'; const x = <div />")).toBe(false)
    expect(rendersSharedTabs("const TabStrip = () => <div />; const x = <TabStrip />")).toBe(false)
    expect(rendersSharedTabs("import { TabStrip as Tabs } from '../foundation/TabStrip'; const x = <Tabs />")).toBe(true)
  })
  it('keeps stable keys, category coverage and lifecycle metadata', () => {
    const keys = UI_COMPONENT_ASSETS.map((asset) => asset.key)

    expect(UI_COMPONENT_ASSETS.length).toBeGreaterThanOrEqual(25)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(UI_COMPONENT_CATEGORIES.map((item) => item.id))).toEqual(new Set(UI_COMPONENT_ASSETS.map((asset) => asset.category)))
    const statusIds = new Set(UI_COMPONENT_STATUSES.map((item) => item.id))
    for (const asset of UI_COMPONENT_ASSETS) expect(statusIds.has(asset.status)).toBe(true)

    for (const asset of UI_COMPONENT_ASSETS) {
      expect(asset.key).toMatch(/^[a-z-]+\.[a-z0-9-]+$/)
      expect(asset.labelZh).toBeTruthy()
      expect(asset.labelEn).toBeTruthy()
      expect(asset.descriptionZh).toBeTruthy()
      expect(['foundation', 'experience']).toContain(asset.layer)
      expect(asset.stories.length).toBeGreaterThanOrEqual(0)
      expect(asset.accessibilityNotes.length).toBeGreaterThanOrEqual(1)
      expect(['verified', 'needs-review', 'not-applicable']).toContain(asset.accessibilityStatus)
      expect(UI_COMPONENT_REGISTRY[asset.key]).toBe(asset)
      if (asset.sourcePath) expect(existsSync(asset.sourcePath)).toBe(true)
      if (asset.status === 'adopted') expect(asset.sourcePath).toBeTruthy()
      if (asset.implementation === 'radix-candidate') expect(asset.reference).toMatch(/Radix/)
    }
  })

  it('keeps the first component inventory anchors discoverable', () => {
    for (const key of [
      'behavior.button',
      'behavior.input',
      'behavior.dialog',
      'behavior.tabs',
      'behavior.select',
      'behavior.combobox',
      'behavior.form-field',
      'behavior.checkbox',
      'behavior.switch',
      'behavior.command',
      'behavior.context-menu',
      'behavior.popover',
      'behavior.tooltip',
      'behavior.scroll-area',
      'state.toast',
      'state.skeleton',
      'state.progress',
      'developer.diff-viewer',
      'state.permission-confirm',
      'developer.asset-table',
      'developer.debug-overview',
      'companion.status-bar',
      'layout.primary-sidebar',
      'layout.right-dock',
      'layout.foundation-workbench',
      'layout.business-states-workbench',
    ]) {
      expect(UI_COMPONENT_REGISTRY[key]).toBeDefined()
    }
    expect(UI_COMPONENT_REGISTRY['layout.foundation-workbench'].layer).toBe('experience')
    expect(UI_COMPONENT_REGISTRY['layout.business-states-workbench'].layer).toBe('experience')
    expect(UI_COMPONENT_REGISTRY['layout.primary-sidebar'].layer).toBe('experience')
    expect(UI_COMPONENT_REGISTRY['companion.status-bar'].layer).toBe('experience')
    expect(UI_COMPONENT_REGISTRY['companion.memory-citations'].layer).toBe('experience')
    expect(UI_COMPONENT_REGISTRY['layout.right-dock'].layer).toBe('experience')
    expect(UI_COMPONENT_REGISTRY['behavior.button'].layer).toBe('foundation')
    expect(UI_COMPONENT_REGISTRY['behavior.input'].layer).toBe('foundation')
  })
})
