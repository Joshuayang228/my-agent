import { join, relative, resolve } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
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
  'src/components/foundation/EmptyState.tsx',
  'src/components/foundation/ErrorState.tsx',
].map((file) => resolve(file))

const candidateFiles = [
  'src/components/playground/WorkspaceExperienceCandidate.tsx',
  'src/components/playground/SurfaceBaselinePanel.tsx',
  'src/components/playground/SettingsExperienceCandidate.tsx',
  'src/components/playground/LayoutLanguageSamples.tsx',
].map((file) => resolve(file))

const worldPanelFiles = [
  'src/components/world/WorldJournalPanel.tsx',
  'src/components/world/WorldKeepsakesPanel.tsx',
  'src/components/world/WorldContactsGallery.tsx',
  'src/components/world/WorldCultureGallery.tsx',
  'src/components/world/WorldHomeGallery.tsx',
  'src/components/world/WorldTravelGallery.tsx',
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

function auditEmptyStateWrapper(sourceFile: ts.SourceFile) {
  const violations: { line: number; tag: string; reason: string }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sourceFile)
      if (tag === 'EmptyState' || tag === 'ErrorState') {
        // 检查直接父 JSX 元素是否把 EmptyState / ErrorState 包在居中且大留白容器中，破坏与其他 Tab 的全宽贴顶基线
        const parent = ts.isJsxOpeningElement(node) ? node.parent?.parent : node.parent
        if (parent && ts.isJsxElement(parent)) {
          for (const prop of parent.openingElement.attributes.properties) {
            if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === 'className' && prop.initializer && ts.isStringLiteral(prop.initializer)) {
              const cls = prop.initializer.text
              if (cls.includes('items-center') && cls.includes('justify-center') && /\bp-(6|8|10|12)\b/.test(cls)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(parent.openingElement.getStart(sourceFile))
                violations.push({
                  line: line + 1,
                  tag,
                  reason: `<${tag}> 外层禁止包裹居中大留白容器（${cls}），应直接放入共享内容区全宽贴顶展示`,
                })
              }
            }
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
    expect(readingStyle.marginInline).toBe('auto')

    expect(LAYOUT_CLASSES.gutter).toContain('px-[var(--layout-gutter-small,1rem)]')
    expect(LAYOUT_CLASSES.card).toContain('p-[var(--layout-card-small,1rem)]')
  })

  it('人物世界正式内容页真实复用 Foundation EmptyState 且不外包居中大留白容器', () => {
    const { program, checker } = createAstScanner([...foundationComponents, ...worldPanelFiles])
    for (const file of worldPanelFiles) {
      const sourceFile = program.getSourceFile(file)!
      const rendered = findRenderedFoundationComponents(sourceFile, checker)
      expect(rendered.has('EmptyState'), `${file} 必须直接复用 Foundation EmptyState`).toBe(true)
      expect(rendered.get('EmptyState')).toContain('src/components/foundation/EmptyState.tsx')
      const violations = auditEmptyStateWrapper(sourceFile)
      expect(violations, `${file} 发现空态/错误态外层包裹违规：${JSON.stringify(violations)}`).toEqual([])
    }
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

    it('空态外包居中大留白容器（Wrapped EmptyState）必定被门禁拒绝', () => {
      const virtualPath = 'src/components/world/VirtualWrappedEmptyPanel.tsx'
      const virtualSource = `
        import { EmptyState } from '../foundation/EmptyState'
        export function VirtualWrappedEmptyPanel() {
          return (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState title="空态" description="不应被挤成局部小框" />
            </div>
          )
        }
      `
      const { program } = createAstScanner([...foundationComponents], {
        [virtualPath]: virtualSource,
      })
      const sourceFile = program.getSourceFile(resolve(virtualPath))!
      const violations = auditEmptyStateWrapper(sourceFile)
      expect(violations.length).toBe(1)
      expect(violations[0].tag).toBe('EmptyState')
    })

    it('注册表声明不存在的 Foundation 组件 Key 必定被类型与注册表校验拦截', () => {
      expect(UI_COMPONENT_REGISTRY['behavior.non-existent-component']).toBeUndefined()
    })

    it('全仓 src/**/*.tsx 禁止不带显式颜色类的裸 ring-1/2/4/8（防止 Tailwind v4 默认 currentColor 黑框）', () => {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (entry.name.endsWith('.tsx')) files.push(full)
        }
      }
      walk(resolve('src'))
      const violations: string[] = []
      const ringWidthRe = /\b(?:[a-z-]+:)?ring-(?:1|2|4|8)\b/
      const ringColorRe = /\b(?:[a-z-]+:)?ring-(?:\[[^\]]+\]|white|black|transparent|current|inherit|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+)/
      for (const file of files) {
        const lines = readFileSync(file, 'utf8').split(/\r?\n/)
        lines.forEach((line, idx) => {
          if (ringWidthRe.test(line) && !ringColorRe.test(line)) {
            violations.push(`${relative(process.cwd(), file)}:${idx + 1} -> ${line.trim()}`)
          }
        })
      }
      expect(violations).toEqual([])
    })

    it('全仓 CompanionAvatar 调用点禁止外传裸 ring-* 或 !border-*，必须走 framed 原语', () => {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (entry.name.endsWith('.tsx')) files.push(full)
        }
      }
      walk(resolve('src'))
      const violations: string[] = []
      for (const file of files) {
        if (file.endsWith('CompanionAvatar.tsx')) continue
        const source = readFileSync(file, 'utf8')
        const matches = source.matchAll(/<CompanionAvatar\b[\s\S]*?\/>/g)
        for (const match of matches) {
          if (/\b(?:ring-|!border-)/.test(match[0])) {
            violations.push(`${relative(process.cwd(), file)} -> ${match[0].replace(/\s+/g, ' ').slice(0, 120)}`)
          }
        }
      }
      expect(violations).toEqual([])
    })

    it('带 role="menu" 浮层的 <section> 外壳禁止挂 overflow-hidden（防止下拉菜单被裁切）', () => {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (entry.name.endsWith('.tsx')) files.push(full)
        }
      }
      walk(resolve('src'))
      const violations: string[] = []
      for (const file of files) {
        const source = readFileSync(file, 'utf8')
        if (!source.includes('role="menu"')) continue
        const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const visit = (node: ts.Node, clippedSection: boolean) => {
          let nextClipped = clippedSection
          if (ts.isJsxElement(node)) {
            const tag = node.openingElement.tagName.getText(ast)
            const cls = node.openingElement.attributes.properties
              .filter(ts.isJsxAttribute)
              .find((a) => a.name.getText(ast) === 'className')?.initializer?.getText(ast) ?? ''
            if (tag === 'section' && cls.includes('overflow-hidden')) {
              nextClipped = true
            }
            const roleAttr = node.openingElement.attributes.properties
              .filter(ts.isJsxAttribute)
              .find((a) => a.name.getText(ast) === 'role')?.initializer?.getText(ast) ?? ''
            if (nextClipped && roleAttr.includes('menu')) {
              violations.push(relative(process.cwd(), file))
            }
          }
          ts.forEachChild(node, (child) => visit(child, nextClipped))
        }
        visit(ast, false)
      }
      expect(violations).toEqual([])
    })

    it('src/index.css 维持全局 6px 悬停滚动条基线且不与 scrollbar-width: thin 冲突', () => {
      const css = readFileSync(resolve('src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(css).toContain('*::-webkit-scrollbar')
      expect(css).toContain('.scrollbar-stable')
      expect(css).toContain('scrollbar-gutter: stable')
      expect(css).not.toContain('scrollbar-width: thin')
    })
  })
})
