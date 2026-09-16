import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SkillDetail, SkillFilePreview } from '../../src/components/settings/SkillViews'

describe('Skills 共享展示', () => {
  it('元信息与正文转义，长文本保留独立滚动边界', () => {
    const html = renderToStaticMarkup(createElement(SkillDetail, {
      skill: { name: '<script>name</script>', description: '<script>description</script>', source: 'builtin', enabled: false },
      testId: 'skill', onBack: () => {}, onEnabledChange: () => {},
      content: createElement(SkillFilePreview, { content: '<img src=x onerror=alert(1)>', testId: 'file' }),
    }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img')
    expect(html).toContain('未声明')
    expect(html).toContain('未启用')
    expect(html).toContain('max-h-[48vh]')
    expect(html).toContain('overscroll-contain')
  })

  it('正式与候选必须实际渲染同一列表、详情和正文符号，未使用 import 不算复用', () => {
    const shared = resolve('src/components/settings/SkillViews.tsx')
    const consumers = ['src/components/SkillsPanel.tsx', 'src/components/playground/SettingsExperienceCandidate.tsx'].map((file) => resolve(file))
    const fixture = resolve('src/components/skill-binding-fixture.tsx')
    const options: ts.CompilerOptions = { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noResolve: true, noLib: true, types: [] }
    const host = ts.createCompilerHost(options)
    const original = host.getSourceFile.bind(host)
    host.getSourceFile = (file, ...args) => resolve(file) === fixture ? ts.createSourceFile(file, `import { SkillDetail as Shared } from './settings/SkillViews'; function Unused() { return <div /> } function Shadowed(Shared: any) { return <Shared /> } function Used() { return <Shared /> }`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX) : original(file, ...args)
    const program = ts.createProgram([shared, ...consumers, fixture], options, host)
    const checker = program.getTypeChecker()
    const uses = (node: ts.Node, name: string): boolean => {
      let found = false
      const visit = (child: ts.Node) => {
        if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
          let symbol = checker.getSymbolAtLocation(child.tagName)
          if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
          found ||= Boolean(symbol?.name === name && symbol.declarations?.some((item) => resolve(item.getSourceFile().fileName) === shared))
        }
        ts.forEachChild(child, visit)
      }
      visit(node)
      return found
    }
    for (const file of consumers) for (const name of ['SkillListCard', 'SkillDetail', 'SkillFilePreview']) expect(uses(program.getSourceFile(file)!, name), `${file}: ${name}`).toBe(true)
    const functions = program.getSourceFile(fixture)!.statements.filter(ts.isFunctionDeclaration)
    expect(functions.map((node) => uses(node, 'SkillDetail'))).toEqual([false, false, true])
  })
})
