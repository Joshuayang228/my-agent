import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  FOUNDATION_STORIES,
  FOUNDATION_STORY_GROUPS,
  FOUNDATION_STORY_NAVIGATION_GROUPS,
  getFoundationStoriesByGroup,
  getFoundationStoriesByNavigationGroup,
  getFoundationStoryByViewId,
  getFoundationStoryLifecycle,
} from '../../src/shared/foundation-story-registry'
import { UI_COMPONENT_REGISTRY } from '../../src/shared/ui-component-registry'

const uiControlsSource = readFileSync('src/components/playground/UiControlsPanel.tsx', 'utf8')
const advancedSource = readFileSync('src/components/playground/FoundationAdvancedStories.tsx', 'utf8')

describe('Foundation story registry', () => {
  it('基础故事、体验与正式审阅按真实符号复用 DiffViewer 和 CodeBlock', () => {
    const consumers = [
      'src/components/MarkdownRenderer.tsx',
      'src/components/FileBrowser.tsx',
      'src/components/playground/UiControlsPanel.tsx',
      'src/components/foundation/DiffViewer.tsx',
      'src/components/chat/right-dock/ReviewPanel.tsx',
      'src/components/playground/FoundationAdvancedStories.tsx',
      'src/components/playground/WorkspaceExperienceCandidate.tsx',
    ].map((file) => resolve(file))
    const fixture = resolve('__tests__/fixtures/code-block-binding.tsx')
    const source = `import { CodeBlock as Shared } from '../../src/components/MarkdownRenderer'
      import { DiffViewer as SharedDiff } from '../../src/components/foundation/DiffViewer'
      function Unused() { return <pre /> }
      function Shadowed(Shared: any) { return <Shared /> }
      function Used() { return <Shared code="raw" /> }
      function ShadowedDiff(SharedDiff: any) { return <SharedDiff /> }
      function UsedDiff() { return <SharedDiff unified="raw" /> }`
    // 本检查只验证 JSX 的导入符号归属；显式载入全部调用者和定义，避免解析外部类型图。
    // 别名和局部遮蔽仍由 TypeChecker 判定；项目完整类型检查另由 tsc 门禁负责。
    const options: ts.CompilerOptions = { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true, noResolve: true, noLib: true, types: [] }
    const host = ts.createCompilerHost(options)
    const getSourceFile = host.getSourceFile.bind(host)
    host.getSourceFile = (file, ...args) => resolve(file) === fixture
      ? ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
      : getSourceFile(file, ...args)
    const program = ts.createProgram([...consumers, fixture], options, host)
    expect(program.getSourceFiles().map((file) => resolve(file.fileName)).sort()).toEqual([...consumers, fixture].sort())
    const checker = program.getTypeChecker()
    const rendersShared = (root: ts.Node, name: string, sourcePath: string) => {
      let found = false
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          let symbol = checker.getSymbolAtLocation(node.tagName)
          if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol)
          found ||= Boolean(symbol?.name === name && symbol.declarations?.some((declaration) =>
            resolve(declaration.getSourceFile().fileName) === sourcePath))
        }
        ts.forEachChild(node, visit)
      }
      visit(root)
      return found
    }
    const codeSource = consumers[0]
    const diffSource = resolve('src/components/foundation/DiffViewer.tsx')
    for (const file of consumers.slice(0, 4)) expect(rendersShared(program.getSourceFile(file)!, 'CodeBlock', codeSource), file).toBe(true)
    for (const file of consumers.slice(4)) {
      expect(rendersShared(program.getSourceFile(file)!, 'DiffViewer', diffSource), file).toBe(true)
      expect(rendersShared(program.getSourceFile(file)!, 'DiffViewControls', diffSource), file).toBe(true)
    }
    expect(UI_COMPONENT_REGISTRY['developer.diff-viewer'].sourcePath).toBe('src/components/foundation/DiffViewer.tsx')
    const functions = program.getSourceFile(fixture)!.statements.filter(ts.isFunctionDeclaration)
    expect(functions.map((node) => rendersShared(node, 'CodeBlock', codeSource))).toEqual([false, false, true, false, false])
    expect(functions.map((node) => rendersShared(node, 'DiffViewer', diffSource))).toEqual([false, false, false, false, true])
  })

  it('IconButton 的真实生产调用指向 Foundation，避免工作区重新声明操作槽', () => {
    for (const file of ['src/components/FileBrowser.tsx', 'src/components/chat/right-dock/ReviewPanel.tsx', 'src/components/chat/right-dock/BrowserPanel.tsx', 'src/components/chat/right-dock/TerminalPanel.tsx', 'src/components/chat/right-dock/SideChatPanel.tsx', 'src/components/playground/WorkspaceExperienceCandidate.tsx']) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain('IconButton')
      expect(source).toContain('foundation/IconButton')
      expect(source).toMatch(/<IconButton[\s\S]*label=/)
    }
    const dock = readFileSync('src/components/chat/right-dock/ChatRightDock.tsx', 'utf8')
    expect(dock).toContain('foundation/WorkspaceToolMenu')
    expect(dock).toMatch(/<WorkspaceToolMenu[\s\S]*onSelect=/)
    const menu = readFileSync('src/components/foundation/WorkspaceToolMenu.tsx', 'utf8')
    expect(menu).toContain("from './IconButton'")
    expect(menu).toMatch(/<IconButton[\s\S]*label=/)
  })

  it('Markdown 代码块复制槽复用 Foundation IconButton', () => {
    const source = readFileSync('src/components/MarkdownRenderer.tsx', 'utf8')
    expect(source).toContain("from './foundation/IconButton'")
    expect(source).toMatch(/<IconButton[\s\S]*label=\{copied/)
  })

  it('Diff 视图切换复用 Foundation IconButton 并保留固定操作槽', () => {
    const source = readFileSync('src/components/foundation/DiffViewer.tsx', 'utf8')
    expect(source).toContain("from './IconButton'")
    expect(source).toMatch(/<IconButton[\s\S]*size=\{24\}[\s\S]*aria-pressed=/)
    expect(source).not.toMatch(/<button[\s\S]*统一差异/)
  })

  it('Chat 思考与工具回调的折叠行复用 Foundation ActionButton', () => {
    for (const file of ['src/components/chat/callbacks/ReasoningCallback.tsx', 'src/components/chat/callbacks/ToolCallbackList.tsx']) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain("from '../../foundation/ActionButton'")
      expect(source).toMatch(/<ActionButton[\s\S]*onClick=/)
      expect(source).not.toMatch(/<button[\s\S]*onClick=/)
    }
  })

  it('TextField 的 Foundation 实现覆盖故事和正式工作区输入', () => {
    for (const file of ['src/components/playground/UiControlsPanel.tsx', 'src/components/FileBrowser.tsx', 'src/components/chat/right-dock/BrowserPanel.tsx', 'src/components/chat/right-dock/TerminalPanel.tsx', 'src/components/chat/right-dock/SideChatPanel.tsx']) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain('foundation/TextField')
      expect(source).toMatch(/<TextField[\s\S]*?/)
    }
  })

  it('SegmentedControl 的 Foundation 实现覆盖故事和正式文件预览', () => {
    const story = readFileSync('src/components/playground/FoundationAdvancedStories.tsx', 'utf8')
    const production = readFileSync('src/components/FileBrowser.tsx', 'utf8')
    expect(story).toContain("from '../foundation/SegmentedControl'")
    expect(story).toMatch(/<SegmentedControl[\s\S]*ariaLabel=/)
    expect(production).toContain("from './foundation/SegmentedControl'")
    expect(production).toMatch(/<SegmentedControl[\s\S]*value=\{htmlView\}/)
  })

  it('ActionButton 的 Foundation 实现覆盖故事和正式工作区恢复动作', () => {
    const story = readFileSync('src/components/playground/FoundationAdvancedStories.tsx', 'utf8')
    expect(story).toContain("from '../foundation/ActionButton'")
    expect(story).toContain("case 'foundation.action-button'")
    for (const file of ['src/components/FileBrowser.tsx', 'src/components/chat/right-dock/BrowserPanel.tsx', 'src/components/chat/right-dock/ReviewPanel.tsx', 'src/components/chat/right-dock/SideChatPanel.tsx']) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain('foundation/ActionButton')
      expect(source).toContain('<ActionButton')
    }
  })

  it('keeps story keys, views, assets and groups in one consistent relation', () => {
    const keys = FOUNDATION_STORIES.map((story) => story.key)
    const viewIds = FOUNDATION_STORIES.map((story) => story.viewId)

    expect(keys.length).toBeGreaterThan(30)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(viewIds).size).toBe(viewIds.length)
    expect(new Set(FOUNDATION_STORY_GROUPS.map((group) => group.id))).toEqual(new Set(FOUNDATION_STORIES.map((story) => story.group)))

    for (const story of FOUNDATION_STORIES) {
      const asset = UI_COMPONENT_REGISTRY[story.assetKey]
      expect(asset).toBeDefined()
      expect(asset.layer).toBe('foundation')
      expect(getFoundationStoryByViewId(story.viewId)).toBe(story)
      expect(['ui-controls', 'advanced']).toContain(story.renderer)
      expect(['candidate', 'playground', 'adopted', 'deprecated', 'archived']).toContain(getFoundationStoryLifecycle(story))

      const rendererSource = story.renderer === 'advanced' ? advancedSource : uiControlsSource
      const rendererMarker = story.renderer === 'advanced' ? `case '${story.key}'` : `effectiveSub === '${story.viewId}'`
      expect(rendererSource).toContain(rendererMarker)
    }
  })

  it('derives every group view without a second manual story list', () => {
    expect(FOUNDATION_STORY_GROUPS.flatMap((group) => getFoundationStoriesByGroup(group.id))).toEqual([...FOUNDATION_STORIES])
  })

  it('uses navigation groups to reduce tabs without deleting story coverage', () => {
    const navigationGroupIds = FOUNDATION_STORY_NAVIGATION_GROUPS.map((group) => group.id)
    expect(new Set(navigationGroupIds)).toEqual(new Set(FOUNDATION_STORIES.map((story) => story.navigationGroup)))
    for (const story of FOUNDATION_STORIES) {
      expect(navigationGroupIds).toContain(story.navigationGroup)
    }
    expect(FOUNDATION_STORY_NAVIGATION_GROUPS).toHaveLength(13)
    expect(FOUNDATION_STORY_NAVIGATION_GROUPS.map((group) => group.label)).toEqual([
      '按钮', '输入与表单', '标签与选择', '弹层', '菜单与提示', '徽标与标签', '状态反馈', '加载与进度', '工具卡', 'Markdown 与资产', '文件与差异', '布局与滚动', '卡片',
    ])
    expect(
      FOUNDATION_STORY_NAVIGATION_GROUPS.flatMap((group) => getFoundationStoriesByNavigationGroup(group.id)).map((story) => story.key).sort(),
    ).toEqual(FOUNDATION_STORIES.map((story) => story.key).sort())
  })
})
