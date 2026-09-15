import { resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { UI_COMPONENT_REGISTRY } from '../../src/shared/ui-component-registry'

it('正式与故事记忆沿实际 JSX 符号共用管理页及 Foundation，不能用未使用导入冒充复用', () => {
  const paths = [
    'src/components/SettingsPanel.tsx', 'src/components/playground/SurfaceBaselinePanel.tsx',
    'src/components/MemoryPanel.tsx', 'src/components/memory/MemoryManagementControls.tsx',
    'src/components/foundation/TabStrip.tsx', 'src/components/foundation/TextField.tsx',
    'src/components/foundation/IconButton.tsx', 'src/components/foundation/ActionButton.tsx',
  ].map((path) => resolve(path))
  const asset = UI_COMPONENT_REGISTRY['companion.memory-management']
  expect(asset.layer).toBe('experience')
  expect(asset.status).toBe('adopted')
  expect(resolve(asset.sourcePath!)).toBe(paths[3])
  const fixture = resolve('__tests__/fixtures/memory-binding.tsx')
  const fixtureSource = `import { MemoryPanel as Shared } from '../../src/components/MemoryPanel'
    function Unused() { return <div /> }
    function Shadowed(Shared: any) { return <Shared /> }
    function Real() { return <Shared onClose={() => {}} /> }`
  const options: ts.CompilerOptions = { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, noResolve: true, noLib: true, types: [] }
  const host = ts.createCompilerHost(options)
  const original = host.getSourceFile.bind(host)
  host.getSourceFile = (file, ...args) => resolve(file) === fixture
    ? ts.createSourceFile(file, fixtureSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)
    : original(file, ...args)
  const program = ts.createProgram([...paths, fixture], options, host)
  const checker = program.getTypeChecker()
  const renders = (root: ts.Node, name: string, file: string) => {
    let found = false
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        let symbol = checker.getSymbolAtLocation(node.tagName)
        if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) symbol = checker.getAliasedSymbol(symbol)
        found ||= Boolean(symbol?.name === name && symbol.declarations?.some((declaration) => resolve(declaration.getSourceFile().fileName) === file))
      }
      ts.forEachChild(node, visit)
    }
    visit(root)
    return found
  }
  for (const file of paths.slice(0, 2)) expect(renders(program.getSourceFile(file)!, 'MemoryPanel', paths[2])).toBe(true)
  for (const name of ['MemoryToolbar', 'MemoryAddRow']) expect(renders(program.getSourceFile(paths[2])!, name, paths[3])).toBe(true)
  for (const [index, name] of ['TabStrip', 'TextField', 'IconButton', 'ActionButton'].entries()) {
    expect(renders(program.getSourceFile(paths[3])!, name, paths[index + 4])).toBe(true)
  }
  expect(renders(program.getSourceFile(paths[2])!, 'TextField', paths[5])).toBe(true)
  expect(renders(program.getSourceFile(paths[2])!, 'IconButton', paths[6])).toBe(true)
  const functions = program.getSourceFile(fixture)!.statements.filter(ts.isFunctionDeclaration)
  expect(functions.map((fn) => renders(fn, 'MemoryPanel', paths[2]))).toEqual([false, false, true])
})
