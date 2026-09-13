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
  it('基础故事、体验与正式文件审阅渲染同一个 CodeBlock，而不是只导入或声明同名组件', () => {
    const consumers = [
      'src/components/MarkdownRenderer.tsx',
      'src/components/FileBrowser.tsx',
      'src/components/chat/right-dock/ReviewPanel.tsx',
      'src/components/playground/UiControlsPanel.tsx',
      'src/components/playground/FoundationAdvancedStories.tsx',
      'src/components/playground/WorkspaceExperienceCandidate.tsx',
    ].map((file) => resolve(file))
    const fixture = resolve('__tests__/fixtures/code-block-binding.tsx')
    const source = `import { CodeBlock as Shared } from '../../src/components/MarkdownRenderer'
      function Unused() { return <pre /> }
      function Shadowed(Shared: any) { return <Shared /> }
      function Used() { return <Shared code="raw" /> }`
    const options: ts.CompilerOptions = { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true }
    const host = ts.createCompilerHost(options)
    const getSourceFile = host.getSourceFile.bind(host)
    host.getSourceFile = (file, ...args) => resolve(file) === fixture
      ? ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
      : getSourceFile(file, ...args)
    const program = ts.createProgram([...consumers, fixture], options, host)
    const checker = program.getTypeChecker()
    const rendersShared = (root: ts.Node) => {
      let found = false
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          let symbol = checker.getSymbolAtLocation(node.tagName)
          if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol)
          found ||= Boolean(symbol?.name === 'CodeBlock' && symbol.declarations?.some((declaration) =>
            resolve(declaration.getSourceFile().fileName) === consumers[0]))
        }
        ts.forEachChild(node, visit)
      }
      visit(root)
      return found
    }
    for (const file of consumers) expect(rendersShared(program.getSourceFile(file)!), file).toBe(true)
    const functions = program.getSourceFile(fixture)!.statements.filter(ts.isFunctionDeclaration)
    expect(functions.map(rendersShared)).toEqual([false, false, true])
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
