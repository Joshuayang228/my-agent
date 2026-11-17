import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve('electron/main')

function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? files(target) : target.endsWith('.ts') ? [target] : []
  })
}

it('主进程分层依赖保持单向，工具内置实现通过端口使用子任务运行时', () => {
  const rules = [
    { source: 'storage', forbidden: ['agent', 'ipc', 'llm'] },
    { source: 'llm', forbidden: ['agent', 'ipc'] },
    { source: 'agent', forbidden: ['ipc'] },
    { source: 'tools/builtins', forbidden: ['agent', 'ipc'] },
  ]
  const violations: string[] = []
  for (const rule of rules) {
    for (const file of files(path.join(root, rule.source))) {
      const imports = ts.preProcessFile(fs.readFileSync(file, 'utf8'), true, true).importedFiles
      for (const imported of imports) {
        if (!imported.fileName.startsWith('.')) continue
        const target = path.resolve(path.dirname(file), imported.fileName)
        const layer = path.relative(root, target).split(path.sep)[0]
        if (rule.forbidden.includes(layer)) violations.push(`${path.relative(root, file)} -> ${imported.fileName}`)
      }
    }
  }
  expect(violations).toEqual([])
})

it('Companion Core 独立拥有运行态和生活存储，过渡文件保持移除', () => {
  for (const removed of [
    'companion/life/store.ts',
    'companion/core/read-models/legacy-companion-read-model.ts',
    'companion/core/projections/legacy-life-projection.ts',
  ]) expect(fs.existsSync(path.join(root, removed))).toBe(false)
  const state = fs.readFileSync(path.join(root, 'companion/core/state/runtime-state.ts'), 'utf8')
  expect(state).not.toMatch(/getRoleState|setWorldState|projectLegacyWorldState|world_json/)
})
