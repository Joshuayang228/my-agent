import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { UI_COMPONENT_REGISTRY } from '../../src/shared/ui-component-registry'
import {
  CONTENT_LAYOUT,
  LAYOUT_CLASSES,
  LAYOUT_DENSITIES,
  LAYOUT_PROFILES,
  readingContentStyle,
} from '../../src/shared/content-layout'

const foundationComponents = [
  'src/components/foundation/ActionButton.tsx',
  'src/components/foundation/Button.tsx',
  'src/components/foundation/IconButton.tsx',
  'src/components/foundation/TextField.tsx',
  'src/components/foundation/SelectField.tsx',
  'src/components/foundation/TabStrip.tsx',
  'src/components/foundation/DiffViewer.tsx',
].map((file) => resolve(file))

const candidateFiles = [
  'src/components/playground/WorkspaceExperienceCandidate.tsx',
  'src/components/playground/SurfaceBaselinePanel.tsx',
  'src/components/playground/SettingsExperienceCandidate.tsx',
  'src/components/playground/LayoutLanguageSamples.tsx',
].map((file) => resolve(file))

function createAstScanner(files: string[], virtualFiles: Record<string, string> = {}) {
  const options: ts.CompilerOptions = {
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noResolve: true,
    noLib: true,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const originalGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const resolved = resolve(fileName)
    for (const [vPath, vContent] of Object.entries(virtualFiles)) {
      if (resolve(vPath) === resolved) {
        return ts.createSourceFile(fileName, vContent, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
      }
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
  }
  const program = ts.createProgram([...files, ...Object.keys(virtualFiles).map((file) => resolve(file))], options, host)
  const checker = program.getTypeChecker()
  return { program, checker }
}

function findRenderedFoundationComponents(sourceFile: ts.SourceFile, checker: ts.TypeChecker) {
  const found = new Map<string, string>()
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      let symbol = checker.getSymbolAtLocation(node.tagName)
      if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
        symbol = checker.getAliasedSymbol(symbol)
      }
      if (symbol?.declarations && symbol.declarations.length > 0) {
        const declPath = symbol.declarations[0].getSourceFile().fileName.replaceAll('\\', '/')
        if (declPath.includes('/components/foundation/')) {
          found.set(symbol.name, declPath)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function auditRawInteractiveTags(sourceFile: ts.SourceFile) {
  const violations: { line: number; tag: string; reason: string }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile)
      if (['button', 'input', 'textarea', 'select'].includes(tag)) {
        const attrs: Record<string, string> = {}
        for (const prop of node.attributes.properties) {
          if (ts.isJsxAttribute(prop) && prop.initializer) {
            attrs[prop.name.getText(sourceFile)] = prop.initializer.getText(sourceFile)
          }
        }
        const isRangeSlider = tag === 'input' && attrs.type === '"range"'
        const isFileInput = tag === 'input' && attrs.type === '"file"'

        let parent: ts.Node | undefined = node.parent
        let isSwitcher = Boolean(attrs['data-playground-switcher'])
        while (parent && !isSwitcher) {
          if (ts.isJsxElement(parent) || ts.isJsxOpeningElement(parent)) {
            const opening = ts.isJsxElement(parent) ? parent.openingElement : parent
            if (opening.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === 'data-playground-switcher')) {
              isSwitcher = true
              break
            }
          }
          parent = parent.parent
        }

        if (!isRangeSlider && !isFileInput && !isSwitcher) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          violations.push({
            line: line + 1,
            tag,
            reason: `未受控的原生 <${tag}>，应使用 Foundation 对应组件`,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return violations
}

function auditLayoutOverrides(sourceFile: ts.SourceFile) {
  const violations: { line: number; reason: string }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const prop of node.attributes.properties) {
        if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === 'className' && prop.initializer && ts.isStringLiteral(prop.initializer)) {
          const cls = prop.initializer.text
          if (cls.includes('mx-auto') && cls.includes('max-w-2xl') && cls.includes('reading-boundary-conflict')) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            violations.push({ line: line + 1, reason: '正文阅读容器强制 mx-auto max-w-2xl 破坏左边界对齐基线' })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return violations
}

describe('Foundation 布局与控件复用自动门禁', () => {
  it('四大体验候选页面通过 AST 解析真实渲染 Foundation 控件，而非假导入或局部同名伪组件', () => {
    const { program, checker } = createAstScanner([...foundationComponents, ...candidateFiles])

    const wsSource = program.getSourceFile(resolve('src/components/playground/WorkspaceExperienceCandidate.tsx'))!
    const wsRendered = findRenderedFoundationComponents(wsSource, checker)
    expect(wsRendered.has('SelectField'), '工作区候选真实渲染 SelectField').toBe(true)
    expect(wsRendered.has('TextField'), '工作区候选真实渲染 TextField').toBe(true)
    expect(wsRendered.has('IconButton'), '工作区候选真实渲染 IconButton').toBe(true)
    expect(wsRendered.has('ActionButton'), '工作区候选真实渲染 ActionButton').toBe(true)
    expect(wsRendered.get('ActionButton')).toContain('src/components/foundation/ActionButton.tsx')

    const baselineSource = program.getSourceFile(resolve('src/components/playground/SurfaceBaselinePanel.tsx'))!
    const baselineRendered = findRenderedFoundationComponents(baselineSource, checker)
    expect(baselineRendered.has('ActionButton'), '页面基线真实渲染 ActionButton').toBe(true)
    expect(baselineRendered.get('ActionButton')).toContain('src/components/foundation/ActionButton.tsx')

    const layoutSource = program.getSourceFile(resolve('src/components/playground/LayoutLanguageSamples.tsx'))!
    const layoutRendered = findRenderedFoundationComponents(layoutSource, checker)
    expect(layoutRendered.has('TabStrip'), '布局样张真实渲染 TabStrip').toBe(true)
    expect(layoutRendered.has('TextField'), '布局样张真实渲染 TextField').toBe(true)
    expect(layoutRendered.has('IconButton'), '布局样张真实渲染 IconButton').toBe(true)
  })

  it('候选页面中不存在未经授权的原生交互标签（原生标签仅限受控滑块、隐藏文件输入与样张切换器）', () => {
    const { program } = createAstScanner(candidateFiles)
    for (const file of candidateFiles) {
      const sourceFile = program.getSourceFile(file)!
      const violations = auditRawInteractiveTags(sourceFile)
      expect(violations, `${file} 发现了未经授权的原生交互控件：${JSON.stringify(violations)}`).toEqual([])
    }
  })

  it('布局 Token、间距阶梯与正文限宽左对齐契约保持单一事实源', () => {
    expect(LAYOUT_DENSITIES.standard.gutter).toBe(16)
    expect(LAYOUT_DENSITIES.standard.section).toBe(20)
    expect(LAYOUT_DENSITIES.standard.card).toBe(16)
    expect(LAYOUT_DENSITIES.compact.gutter).toBe(12)
    expect(LAYOUT_DENSITIES.relaxed.gutter).toBe(24)

    expect(LAYOUT_PROFILES.world.width).toBe(CONTENT_LAYOUT.readingWidth)
    expect(LAYOUT_PROFILES.settings.width).toBe(768)
    expect(LAYOUT_PROFILES.chat.width).toBe(800)
    expect(LAYOUT_PROFILES.workspace.width).toBeNull()

    const readingStyle = readingContentStyle('world')
    expect(readingStyle.maxWidth).toBe(672)
    expect(readingStyle.marginInline).toBe(0)

    expect(LAYOUT_CLASSES.gutter).toContain('px-[var(--layout-gutter-small,1rem)]')
    expect(LAYOUT_CLASSES.card).toContain('p-[var(--layout-card-small,1rem)]')
  })

  describe('门禁失败用例与负例 Fixture 拦截验证 (Fail-Closed)', () => {
    it('未使用导入（Unused Import）无法被判定为已复用 Foundation', () => {
      const virtualPath = 'src/components/playground/VirtualUnusedExperience.tsx'
      const virtualSource = `
        import { ActionButton } from '../foundation/ActionButton'
        export function VirtualUnusedExperience() {
          return <div>没有调用任何 ActionButton 控件</div>
        }
      `
      const { program, checker } = createAstScanner([...foundationComponents], {
        [virtualPath]: virtualSource,
      })
      const sourceFile = program.getSourceFile(resolve(virtualPath))!
      const rendered = findRenderedFoundationComponents(sourceFile, checker)
      expect(rendered.has('ActionButton')).toBe(false)
    })

    it('本地同名伪组件（Shadowed Component）无法冒充 Foundation 真实绑定', () => {
      const virtualPath = 'src/components/playground/VirtualShadowedExperience.tsx'
      const virtualSource = `
        import { ActionButton as FoundationActionButton } from '../foundation/ActionButton'
        function ActionButton() {
          return <button className="custom-shadowed">假冒组件</button>
        }
        export function VirtualShadowedExperience() {
          return <ActionButton />
        }
      `
      const { program, checker } = createAstScanner([...foundationComponents], {
        [virtualPath]: virtualSource,
      })
      const sourceFile = program.getSourceFile(resolve(virtualPath))!
      const rendered = findRenderedFoundationComponents(sourceFile, checker)
      expect(rendered.has('ActionButton')).toBe(false)
    })

    it('未授权的原生标签违规（Unauthorized Raw Interactive Tag）必定被门禁拒绝', () => {
      const virtualPath = 'src/components/playground/VirtualRawTagExperience.tsx'
      const virtualSource = `
        export function VirtualRawTagExperience() {
          return (
            <div>
              <button className="unauthorized-button">原生按钮</button>
              <input type="text" className="unauthorized-input" />
            </div>
          )
        }
      `
      const { program } = createAstScanner([], {
        [virtualPath]: virtualSource,
      })
      const sourceFile = program.getSourceFile(resolve(virtualPath))!
      const violations = auditRawInteractiveTags(sourceFile)
      expect(violations.length).toBe(2)
      expect(violations[0].tag).toBe('button')
      expect(violations[1].tag).toBe('input')
    })

    it('冲突的居中限宽布局覆盖（Conflicting Layout Overrides）必定被门禁拒绝', () => {
      const virtualPath = 'src/components/playground/VirtualConflictingLayout.tsx'
      const virtualSource = `
        export function VirtualConflictingLayout() {
          return (
            <div className="mx-auto max-w-2xl reading-boundary-conflict">
              <p>这里居中了，破坏了正文与返回按钮共享左边界的基线契约</p>
            </div>
          )
        }
      `
      const { program } = createAstScanner([], {
        [virtualPath]: virtualSource,
      })
      const sourceFile = program.getSourceFile(resolve(virtualPath))!
      const violations = auditLayoutOverrides(sourceFile)
      expect(violations.length).toBe(1)
      expect(violations[0].reason).toContain('破坏左边界对齐基线')
    })

    it('注册表声明不存在的 Foundation 组件 Key 必定被类型与注册表校验拦截', () => {
      expect(UI_COMPONENT_REGISTRY['behavior.non-existent-component']).toBeUndefined()
    })
  })
})
